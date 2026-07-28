use super::*;

use crate::web::state::RunningTaskGuard;
use rneter::session::{ConnectionRequest as ManagerConnectionRequest, ExecutionContext};

mod config_fetch;
mod flow_upload;
mod orchestration;
mod standard;
mod tx;
mod tx_workflow;

pub use config_fetch::{fetch_config, fetch_config_batch};
pub use flow_upload::{execute_command_flow, execute_flow_batch, execute_upload};
pub use orchestration::{execute_orchestration, execute_orchestration_async};
pub use standard::{
    ShowObjectsQuery, exec_command, exec_command_async, execute_exec_batch, execute_show,
    execute_show_batch, execute_template, execute_template_async, list_show_objects,
    render_template,
};
pub use tx::{execute_tx_block, execute_tx_block_async};
pub use tx_workflow::{execute_tx_workflow, execute_tx_workflow_async};

/// Stage and message prefix used for the terminal "failed" task event.
struct TaskFailureEvent {
    stage: &'static str,
    message_prefix: &'static str,
}

/// History metadata recorded alongside a captured session recording.
struct RecordedHistory<'a> {
    kind: &'a str,
    name: &'a str,
    mode: Option<&'a str>,
}

/// Creates the task report context and running-task guard, then emits the
/// "started" event. Shared prologue for the synchronous execute handlers.
fn begin_reported_task(
    state: &Arc<AppState>,
    operation: TaskOperation,
    task_id: Option<String>,
    started: TaskEventInput,
) -> (Option<TaskReportContext>, Option<RunningTaskGuard>) {
    let task_ctx = TaskReportContext::from_request(operation, task_id, state.is_managed());
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(state, &task_ctx, started);
    (task_ctx, task_guard)
}

/// Emits the terminal task events, reports the task callback, and converts
/// the execution result into the HTTP response. Shared epilogue for the
/// synchronous execute handlers.
///
/// `on_ok` emits the handler-specific success events; `response_failure`
/// returns a failure message when a structurally-Ok response should still be
/// reported as a failed task callback (e.g. an uncommitted tx block).
fn finish_reported_task<T: Serialize>(
    state: Arc<AppState>,
    task_ctx: Option<TaskReportContext>,
    task_guard: Option<RunningTaskGuard>,
    result: Result<T, ApiError>,
    failure: TaskFailureEvent,
    on_ok: impl FnOnce(&Arc<AppState>, &Option<TaskReportContext>, &T),
    response_failure: impl FnOnce(&T) -> Option<&'static str>,
) -> Result<Json<T>, ApiError> {
    drop(task_guard);
    match &result {
        Ok(response) => on_ok(&state, &task_ctx, response),
        Err(err) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new(
                "failed",
                format!("{}: {}", failure.message_prefix, err.message),
            )
            .with_stage(failure.stage)
            .with_level("error"),
        ),
    }
    if let (Some(task_ctx_ref), Ok(response)) = (task_ctx.as_ref(), &result)
        && let Some(message) = response_failure(response)
    {
        let callback = build_failed_task_callback(&state, task_ctx_ref, message, Some(response));
        spawn_prepared_task_callback(state, task_ctx, callback);
        return result.map(Json);
    }
    spawn_task_callback(state, task_ctx, &result);
    result.map(Json)
}

/// Runs a MANAGER-backed execution, optionally with live session recording,
/// and returns the execution result plus the recording JSONL when the caller
/// requested a record level. Shared by the tx block and tx workflow handlers.
async fn run_recorded_manager_execution<R, F>(
    state: &Arc<AppState>,
    task_ctx: &Option<TaskReportContext>,
    conn: &ResolvedConnection,
    record_level: Option<RecordLevel>,
    recording_plan: RecordingEventPlan,
    history: RecordedHistory<'_>,
    execute: F,
) -> Result<(R, Option<String>), ApiError>
where
    F: AsyncFnOnce(ManagerConnectionRequest, ExecutionContext) -> Result<R, ApiError>,
{
    let requested_record_level = to_record_level(record_level);
    let live_record_level = if task_ctx.is_some() {
        requested_record_level.or(Some(SessionRecordLevel::KeyEventsOnly))
    } else {
        requested_record_level
    };
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    if let Some(level) = live_record_level {
        let request = manager_connection_request(
            conn.username.clone(),
            conn.host.clone(),
            conn.port,
            conn.auth.clone(),
            conn.enable_password.clone(),
            handler,
        );
        let recorder = crate::config::session_recording::redacting_recorder(
            level,
            &conn.auth,
            conn.enable_password.as_deref(),
        );
        let (_sender, recorder) = MANAGER
            .get_with_recorder_and_context(
                request,
                manager_execution_context_with_security(
                    None,
                    conn.ssh_security,
                    conn.connect_timeout_secs,
                ),
                recorder,
            )
            .await?;
        let forwarder = spawn_recording_event_forwarder(state, task_ctx, &recorder, recording_plan);
        let handler_for_execution = template_loader::load_device_profile_for_connection(
            &conn.device_profile,
            conn.linux_shell_flavor,
        )?;
        let request = manager_connection_request(
            conn.username.clone(),
            conn.host.clone(),
            conn.port,
            conn.auth.clone(),
            conn.enable_password.clone(),
            handler_for_execution,
        );
        let execution_result = execute(
            request,
            manager_execution_context_with_security(
                None,
                conn.ssh_security,
                conn.connect_timeout_secs,
            ),
        )
        .await;
        let expected_entries = recorder.entries().map_err(ApiError::from)?.len();
        if let Some(forwarder) = forwarder {
            forwarder.finish(expected_entries).await;
        }
        let result = execution_result?;
        let recording_jsonl = if requested_record_level.is_some() {
            let jsonl_raw = recorder.to_jsonl().map_err(ApiError::from)?;
            let jsonl = normalize_recording_jsonl_for_web_level(record_level, &jsonl_raw);
            if let Err(e) = history_store::save_recording(
                HistoryBinding {
                    connection_name: conn.connection_name.as_deref(),
                    host: &conn.host,
                    port: conn.port,
                    username: &conn.username,
                    device_profile: &conn.device_profile,
                },
                history.kind,
                history.name,
                history.mode,
                record_level_name(record_level),
                &jsonl,
            ) {
                warn!("failed to persist execution history: {}", e);
            }
            Some(jsonl)
        } else {
            None
        };
        Ok((result, recording_jsonl))
    } else {
        let request = manager_connection_request(
            conn.username.clone(),
            conn.host.clone(),
            conn.port,
            conn.auth.clone(),
            conn.enable_password.clone(),
            handler,
        );
        let result = execute(
            request,
            manager_execution_context_with_security(
                None,
                conn.ssh_security,
                conn.connect_timeout_secs,
            ),
        )
        .await?;
        Ok((result, None))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cli::GlobalOpts;

    fn unmanaged_state() -> Arc<AppState> {
        AppState::new(
            GlobalOpts {
                credential: None,
                host: None,
                port: None,
                ssh_security: None,
                linux_shell_flavor: None,
                device_profile: None,
                template_dir: None,
                force_autodetect: false,
                connection: None,
                save_connection: None,
            },
            None,
            None,
        )
    }

    #[tokio::test]
    async fn begin_reported_task_is_inert_without_managed_context() {
        let state = unmanaged_state();
        let (task_ctx, task_guard) = begin_reported_task(
            &state,
            TaskOperation::Exec,
            Some("task-1".to_string()),
            TaskEventInput::new("started", "Starting"),
        );
        assert!(task_ctx.is_none());
        assert!(task_guard.is_none());
    }

    #[tokio::test]
    async fn finish_reported_task_maps_success_and_invokes_on_ok() {
        let state = unmanaged_state();
        let mut on_ok_called = false;
        let response = finish_reported_task(
            state,
            None,
            None,
            Ok::<_, ApiError>(json!({"ok": true})),
            TaskFailureEvent {
                stage: "test",
                message_prefix: "Test failed",
            },
            |_, _, _| on_ok_called = true,
            |_| Some("unused without a task context"),
        )
        .expect("success result should map to Json");
        assert!(on_ok_called);
        assert_eq!(response.0["ok"], json!(true));
    }

    #[tokio::test]
    async fn finish_reported_task_passes_through_errors_without_on_ok() {
        let state = unmanaged_state();
        let mut on_ok_called = false;
        let err = finish_reported_task::<Value>(
            state,
            None,
            None,
            Err(ApiError::bad_request("boom")),
            TaskFailureEvent {
                stage: "test",
                message_prefix: "Test failed",
            },
            |_, _, _| on_ok_called = true,
            |_| None,
        )
        .expect_err("error result should pass through");
        assert!(!on_ok_called);
        assert_eq!(err.message, "boom");
    }
}
