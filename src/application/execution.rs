pub(crate) use crate::agent::registration::{AsyncErrorReportInput, current_agent_name};
pub(crate) use crate::application::error::ApiError;
pub(crate) use crate::application::state::{
    AppState, ResolvedConnection, apply_session_retry_options, merge_connection_options,
    resolve_autodetect_connection,
};
pub(crate) use crate::cli::RecordLevelOpt;
pub(crate) use crate::config::interactive_template::{
    InteractiveTemplate, build_interactive_runtime, parse_interactive_template,
    resolve_interactive_runtime_default_mode,
};
pub(crate) use crate::config::interactive_vars::{
    ConnectionParamContext, resolve_interactive_runtime_vars, resolve_runtime_var_aliases,
};
pub(crate) use crate::config::template_connection_refs::{
    enrich_context_with_connection_refs_from_template,
    enrich_context_with_connection_refs_from_value,
};
pub(crate) use crate::config::template_loader;
pub(crate) use crate::config::{command_blacklist, custom_textfsm_store, show_catalog};
pub(crate) use crate::config::{connection_store, content_store, task_store};
pub(crate) use crate::config::{history_store, history_store::HistoryBinding};
pub(crate) use crate::device::DeviceClient;
pub(crate) use crate::interfaces::api::models::{
    ApiResponse, AsyncTaskAcceptedResponse, CommandResult, ConfigBatchFetchRequest,
    ConfigBatchFetchResponse, ConfigFetchRequest, ConfigFetchResponse, ConfigFetchTargetResponse,
    ConnectionRequest, ExecBatchExecuteRequest, ExecBatchExecuteResponse, ExecBatchTargetResponse,
    ExecRequest, ExecResponse, ExecuteInteractiveRequest, ExecuteInteractiveResponse,
    ExecuteOrchestrationRequest, ExecuteOrchestrationResponse, ExecuteTemplateRequest,
    ExecuteTemplateResponse, ExecuteTxWorkflowRequest, ExecuteTxWorkflowResponse,
    ExecuteUploadRequest, ExecuteUploadResponse, InteractiveBatchExecuteRequest,
    InteractiveBatchExecuteResponse, InteractiveBatchTargetResponse, RecordLevel, RenderRequest,
    RenderResponse, SessionRetryOptions, ShowBatchExecuteRequest, ShowBatchExecuteResponse,
    ShowBatchTargetResponse, ShowExecuteRequest, ShowExecuteResponse, ShowObjectEntry,
    ShowObjectsResponse, TaskEvent,
};
pub(crate) use crate::manager_connection_request;
pub(crate) use crate::orchestrator;
pub(crate) use crate::task::{
    TaskCallback, TaskEventLevel, TaskEventType, TaskOperation, TaskResultEnvelope,
    TaskResultOutcome, TaskStatus, build_error_result_summary, build_result_summary,
    extract_result_summary, result_counts, result_counts_with_skipped, task_name_to_operation,
    task_result_with_counts, task_result_with_details, task_result_with_recording,
};
pub(crate) use crate::template::renderer::Renderer;
pub(crate) use crate::web::storage;
pub(crate) use chrono::Utc;
pub(crate) use rneter::session::{
    Command, CommandDynamicParams, CommandInteraction, MANAGER, MultilineMode, SessionEvent,
    SessionRecordEntry, SessionRecordLevel, SessionRecorder,
};
pub(crate) use serde::Serialize;
pub(crate) use serde_json::{Value, json};
pub(crate) use std::collections::{BTreeSet, HashMap};
pub(crate) use std::future::Future;
pub(crate) use std::path::PathBuf;
pub(crate) use std::sync::Arc;
pub(crate) use std::time::Instant;
pub(crate) use tokio::sync::oneshot;
pub(crate) use tokio::task::JoinHandle;
pub(crate) use tracing::warn;

pub(crate) use crate::application::async_tasks::*;
pub(crate) use crate::application::runtime::*;
pub(crate) use crate::application::task_events::*;

pub(crate) use crate::application::state::RunningTaskGuard;
pub(crate) use rneter::session::{ConnectionRequest as ManagerConnectionRequest, ExecutionContext};

mod config_fetch;
mod interactive_upload;
mod orchestration;
mod standard;
mod tx_workflow;

use crate::interfaces::api::models::{CommandErrorPolicy, JsonInputMode};

pub(crate) use orchestration::execute_orchestration_with_input_mode;
pub(crate) use standard::execute_template_with_error_policy;
pub(crate) use tx_workflow::execute_tx_workflow_with_input_mode;

pub(crate) use config_fetch::execute_scheduled_config_batch;
pub use config_fetch::{fetch_config, fetch_config_batch};
pub use interactive_upload::{execute_interactive, execute_interactive_batch, execute_upload};
pub use orchestration::execute_orchestration;
pub(crate) use orchestration::execute_scheduled_orchestration;
pub use standard::{
    ShowObjectsQuery, exec_command, execute_exec_batch, execute_show, execute_show_batch,
    execute_template, list_show_objects, render_template,
};
pub(crate) use tx_workflow::execute_scheduled_tx_workflow;
pub use tx_workflow::execute_tx_workflow;

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
    begin_reported_task_with_tracking(state, operation, task_id, started, state.is_managed())
}

fn begin_reported_task_with_tracking(
    state: &Arc<AppState>,
    operation: TaskOperation,
    task_id: Option<String>,
    started: TaskEventInput,
    tracking_enabled: bool,
) -> (Option<TaskReportContext>, Option<RunningTaskGuard>) {
    let task_ctx = TaskReportContext::from_request(operation, task_id, tracking_enabled);
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
) -> Result<ApiResponse<T>, ApiError> {
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
    let response_failure_message = result.as_ref().ok().and_then(response_failure);
    let envelope_result = result.and_then(|response| {
        let summary = extract_result_summary(&response)
            .ok_or_else(|| ApiError::internal("execution response is missing result_summary"))?;
        Ok(ApiResponse::completed(response, summary))
    });
    if let (Some(task_ctx_ref), Ok(response), Some(message)) = (
        task_ctx.as_ref(),
        &envelope_result,
        response_failure_message,
    ) {
        let callback = build_failed_task_callback(&state, task_ctx_ref, message, Some(response));
        spawn_prepared_task_callback(state, task_ctx, callback);
        return envelope_result;
    }
    spawn_task_callback(state, task_ctx, &envelope_result);
    envelope_result
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
    F: AsyncFnOnce(
        ManagerConnectionRequest,
        ExecutionContext,
        Option<SessionRecorder>,
    ) -> Result<R, ApiError>,
{
    let _lease = crate::application::limits::ExecutionLease::acquire(&conn.host, conn.port).await;
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
    let result = if let Some(level) = live_record_level {
        let request = manager_connection_request(
            conn.username.clone(),
            conn.host.clone(),
            conn.port,
            conn.auth.clone(),
            conn.enable_password.clone(),
            handler,
            conn.output_encoding,
        );
        let recorder = crate::config::session_recording::redacting_recorder(
            level,
            &conn.auth,
            conn.enable_password.as_deref(),
        );
        let forwarder = spawn_recording_event_forwarder(state, task_ctx, &recorder, recording_plan);
        let execution_result = execute(
            request,
            // Per-run recorder pools must still expire after this execution.
            conn.execution_context().with_keep_alive(false),
            Some(recorder.clone()),
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
        (result, recording_jsonl)
    } else {
        let request = manager_connection_request(
            conn.username.clone(),
            conn.host.clone(),
            conn.port,
            conn.auth.clone(),
            conn.enable_password.clone(),
            handler,
            conn.output_encoding,
        );
        let result = execute(request, conn.execution_context(), None).await?;
        (result, None)
    };
    remember_connection(state, conn)?;
    Ok(result)
}

fn remember_connection(state: &AppState, conn: &ResolvedConnection) -> Result<(), ApiError> {
    let Some(name) = &state.defaults.save_connection else {
        return Ok(());
    };
    connection_store::save_connection(
        name,
        &crate::config::connection_store::SavedConnection {
            credential_id: conn.credential_id.clone(),
            host: Some(conn.host.clone()),
            port: Some(conn.port),
            connect_timeout_secs: conn.connect_timeout_secs,
            device_model: None,
            software_version: None,
            ssh_security: Some(conn.ssh_security),
            linux_shell_flavor: conn.linux_shell_flavor,
            output_encoding: conn.output_encoding,
            device_profile: Some(conn.device_profile.clone()),
            enabled: true,
            labels: vec![],
            groups: vec![],
            vars: conn.vars.clone(),
        },
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

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
                force_autodetect: false,
                session_retries: 0,
                retry_initial_backoff_ms: 200,
                retry_max_backoff_ms: 2000,
                retry_authentication_errors: false,
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
        let summary = build_result_summary(
            TaskOperation::Exec,
            TaskResultOutcome::Success,
            "Command completed",
        );
        let response = finish_reported_task(
            state,
            None,
            None,
            Ok::<_, ApiError>(json!({
                "ok": true,
                "result_summary": summary
            })),
            TaskFailureEvent {
                stage: "test",
                message_prefix: "Test failed",
            },
            |_, _, _| on_ok_called = true,
            |_| Some("unused without a task context"),
        )
        .expect("success result should map to Json");
        assert!(on_ok_called);
        let response = serde_json::to_value(response).expect("serialize response");
        assert_eq!(response["success"], json!(true));
        assert!(response["error"].is_null());
        assert_eq!(response["data"]["ok"], json!(true));
        assert!(response.get("ok").is_none());
    }

    #[tokio::test]
    async fn finish_reported_task_preserves_failed_business_data() {
        let state = unmanaged_state();
        let summary = build_result_summary(
            TaskOperation::Exec,
            TaskResultOutcome::Failed,
            "Command failed",
        );
        let response = finish_reported_task(
            state,
            None,
            None,
            Ok::<_, ApiError>(json!({
                "output": "partial output",
                "result_summary": summary
            })),
            TaskFailureEvent {
                stage: "test",
                message_prefix: "Test failed",
            },
            |_, _, _| {},
            |_| Some("Command failed"),
        )
        .expect("business failure should remain an HTTP response");
        let response = serde_json::to_value(response).expect("serialize response");
        assert_eq!(response["success"], json!(false));
        assert_eq!(response["error"]["code"], json!("execution_failed"));
        assert_eq!(response["data"]["output"], json!("partial output"));
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
