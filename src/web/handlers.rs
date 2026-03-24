use crate::agent::registration::{AsyncErrorReportInput, current_agent_name};
use crate::cli::RecordLevelOpt;
use crate::config::command_blacklist;
use crate::config::device_profile::DeviceProfile;
use crate::config::template_loader;
use crate::config::{backup, connection_store, connection_store::SavedConnection, content_store};
use crate::config::{history_store, history_store::HistoryBinding};
use crate::device::DeviceClient;
use crate::orchestrator;
use crate::template::renderer::Renderer;
use crate::web::error::ApiError;
use crate::web::models::{
    AsyncTaskAcceptedResponse, BackupCreateRequest, BackupCreateResponse, BackupMeta,
    BackupRestoreRequest, BackupRestoreResponse, BlacklistCheckRequest, BlacklistCheckResponse,
    BlacklistDeleteResponse, BlacklistPatternEntry, BlacklistUpsertRequest,
    BlacklistUpsertResponse, BuiltinProfileDetail, CommandResult, ConnectionHistoryDetailResponse,
    ConnectionHistoryEntry, ConnectionRequest, ConnectionTestRequest, ConnectionTestResponse,
    CreateTemplateRequest, CustomProfileDetail, DeviceProfileModesResponse, DeviceProfilesOverview,
    ExecRequest, ExecResponse, ExecuteOrchestrationRequest, ExecuteOrchestrationResponse,
    ExecuteTemplateRequest, ExecuteTemplateResponse, ExecuteTxBlockRequest, ExecuteTxBlockResponse,
    ExecuteTxWorkflowRequest, ExecuteTxWorkflowResponse, InteractiveCommandRequest,
    InteractiveCommandResponse, InteractiveStartRequest, InteractiveStartResponse,
    InteractiveStopResponse, ProfileDiagnoseRequest, ProfileDiagnoseResponse, RecordLevel,
    RenderRequest, RenderResponse, ReplayContextDto, ReplayOutputDto, ReplayRequest,
    ReplayResponse, SavedConnectionDetail, SavedConnectionMeta, TaskCallback, TaskEvent,
    TemplateDetail, TemplateMeta, UpdateTemplateRequest, UpsertConnectionRequest,
    UpsertCustomProfileRequest,
};
use crate::web::state::{AppState, InteractiveSession, merge_connection_options};
use crate::web::storage;
use crate::{manager_connection_request, manager_execution_context_with_security};
use axum::http::StatusCode;
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, header},
    response::{IntoResponse, Response},
};
use chrono::Utc;
use rneter::session::{
    CommandBlockKind, MANAGER, RollbackPolicy, SessionEvent, SessionRecordEntry,
    SessionRecordLevel, SessionRecorder, SessionReplayer, TxBlock, TxStep,
};
use rneter::templates as rneter_templates;
use serde::Serialize;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::fs;
use std::future::Future;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use std::time::UNIX_EPOCH;
use tokio::sync::oneshot;
use tokio::task::JoinHandle;
use tracing::warn;

#[derive(Debug, serde::Deserialize)]
pub struct HistoryQuery {
    pub limit: Option<usize>,
}

#[derive(Debug, Clone)]
struct TaskReportContext {
    task_id: String,
    operation: String,
    started_at: chrono::DateTime<Utc>,
    started_instant: Instant,
}

impl TaskReportContext {
    fn from_request(operation: &str, task_id: Option<String>, managed: bool) -> Option<Self> {
        if !managed {
            return None;
        }
        let task_id = task_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)?;
        Some(Self {
            task_id,
            operation: operation.to_string(),
            started_at: Utc::now(),
            started_instant: Instant::now(),
        })
    }
}

#[derive(Debug, Clone)]
struct TaskEventInput {
    event_type: String,
    message: String,
    level: String,
    stage: Option<String>,
    progress: Option<u8>,
    details: Option<Value>,
}

impl TaskEventInput {
    fn new(event_type: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            event_type: event_type.into(),
            message: message.into(),
            level: "info".to_string(),
            stage: None,
            progress: None,
            details: None,
        }
    }

    fn with_level(mut self, level: impl Into<String>) -> Self {
        self.level = level.into();
        self
    }

    fn with_stage(mut self, stage: impl Into<String>) -> Self {
        self.stage = Some(stage.into());
        self
    }

    fn with_progress(mut self, progress: Option<u8>) -> Self {
        self.progress = progress;
        self
    }

    fn with_details(mut self, details: Option<Value>) -> Self {
        self.details = details;
        self
    }
}

#[derive(Debug, Clone)]
enum RecordingEventPlan {
    TxBlock {
        total_steps: usize,
    },
    TxWorkflow {
        total_blocks: usize,
        total_steps: usize,
        block_indices: HashMap<String, usize>,
        block_step_counts: HashMap<String, usize>,
        step_offsets: HashMap<String, usize>,
    },
}

struct RecordingEventForwarder {
    initial_entries: usize,
    finish_tx: oneshot::Sender<usize>,
    join_handle: JoinHandle<()>,
}

impl RecordingEventForwarder {
    async fn finish(self, expected_entries: usize) {
        let expected_new_entries = expected_entries.saturating_sub(self.initial_entries);
        let _ = self.finish_tx.send(expected_new_entries);
        let _ = self.join_handle.await;
    }
}

fn task_event_progress(current: usize, total: usize) -> Option<u8> {
    if total == 0 {
        return None;
    }
    let pct = ((current as f64 / total as f64) * 100.0).round() as i64;
    Some(pct.clamp(0, 100) as u8)
}

fn task_event_progress_in_range(current: usize, total: usize, start: u8, end: u8) -> Option<u8> {
    if total == 0 {
        return None;
    }
    let span = end.saturating_sub(start) as f64;
    let pct = start as f64 + ((current as f64 / total as f64) * span);
    Some((pct.round() as i64).clamp(0, 100) as u8)
}

fn recording_entry_occurred_at(ts_ms: u128) -> String {
    chrono::DateTime::<Utc>::from_timestamp_millis(ts_ms as i64)
        .unwrap_or_else(Utc::now)
        .to_rfc3339()
}

fn tx_block_step_progress(step_index: usize, total_steps: usize) -> Option<u8> {
    task_event_progress_in_range(step_index + 1, total_steps, 60, 95)
}

fn tx_workflow_step_progress(
    step_offsets: &HashMap<String, usize>,
    block_name: &str,
    step_index: usize,
    total_steps: usize,
) -> Option<u8> {
    let offset = step_offsets.get(block_name).copied().unwrap_or_default();
    task_event_progress_in_range(offset + step_index + 1, total_steps.max(1), 60, 95)
}

fn map_recording_entry_to_task_event(
    entry: &SessionRecordEntry,
    plan: &RecordingEventPlan,
) -> Option<TaskEventInput> {
    match &entry.event {
        SessionEvent::ConnectionEstablished { device_addr, .. } => Some(
            TaskEventInput::new("progress", format!("Connected to {}", device_addr))
                .with_stage("connect")
                .with_progress(Some(55)),
        ),
        SessionEvent::CommandOutput {
            command,
            mode,
            success,
            exit_code,
            content,
            all,
            ..
        } => Some(
            TaskEventInput::new("log", format!("Command output: {}", command))
                .with_stage("command")
                .with_level(if *success { "info" } else { "warning" })
                .with_details(Some(json!({
                    "command": command,
                    "mode": mode,
                    "success": success,
                    "exit_code": exit_code,
                    "content": content,
                    "all": all
                }))),
        ),
        SessionEvent::TxBlockStarted {
            block_name,
            block_kind,
        } => match plan {
            RecordingEventPlan::TxBlock { .. } => Some(
                TaskEventInput::new("step_started", format!("Tx block {} started", block_name))
                    .with_stage("tx_block")
                    .with_progress(Some(60))
                    .with_details(Some(json!({
                        "block_name": block_name,
                        "block_kind": block_kind
                    }))),
            ),
            RecordingEventPlan::TxWorkflow {
                total_blocks,
                block_indices,
                ..
            } => {
                let progress = block_indices
                    .get(block_name)
                    .and_then(|idx| task_event_progress_in_range(*idx + 1, *total_blocks, 60, 90));
                Some(
                    TaskEventInput::new(
                        "step_started",
                        format!("Workflow block {} started", block_name),
                    )
                    .with_stage("workflow")
                    .with_progress(progress)
                    .with_details(Some(json!({
                        "block_name": block_name,
                        "block_kind": block_kind
                    }))),
                )
            }
        },
        SessionEvent::TxStepSucceeded {
            block_name,
            step_index,
            mode,
            command,
        } => match plan {
            RecordingEventPlan::TxBlock { total_steps } => Some(
                TaskEventInput::new(
                    "step_completed",
                    format!("Step {} completed", step_index + 1),
                )
                .with_stage("command")
                .with_level("success")
                .with_progress(tx_block_step_progress(*step_index, *total_steps))
                .with_details(Some(json!({
                    "block_name": block_name,
                    "step_index": step_index,
                    "mode": mode,
                    "command": command
                }))),
            ),
            RecordingEventPlan::TxWorkflow {
                total_steps,
                step_offsets,
                ..
            } => Some(
                TaskEventInput::new(
                    "step_completed",
                    format!(
                        "Workflow step {} completed in {}",
                        step_index + 1,
                        block_name
                    ),
                )
                .with_stage("command")
                .with_level("success")
                .with_progress(tx_workflow_step_progress(
                    step_offsets,
                    block_name,
                    *step_index,
                    *total_steps,
                ))
                .with_details(Some(json!({
                    "block_name": block_name,
                    "step_index": step_index,
                    "mode": mode,
                    "command": command
                }))),
            ),
        },
        SessionEvent::TxStepFailed {
            block_name,
            step_index,
            mode,
            command,
            reason,
        } => match plan {
            RecordingEventPlan::TxBlock { total_steps } => Some(
                TaskEventInput::new("failed", format!("Step {} failed", step_index + 1))
                    .with_stage("command")
                    .with_level("error")
                    .with_progress(tx_block_step_progress(*step_index, *total_steps))
                    .with_details(Some(json!({
                        "block_name": block_name,
                        "step_index": step_index,
                        "mode": mode,
                        "command": command,
                        "reason": reason
                    }))),
            ),
            RecordingEventPlan::TxWorkflow {
                total_steps,
                step_offsets,
                ..
            } => Some(
                TaskEventInput::new(
                    "failed",
                    format!("Workflow step {} failed in {}", step_index + 1, block_name),
                )
                .with_stage("command")
                .with_level("error")
                .with_progress(tx_workflow_step_progress(
                    step_offsets,
                    block_name,
                    *step_index,
                    *total_steps,
                ))
                .with_details(Some(json!({
                    "block_name": block_name,
                    "step_index": step_index,
                    "mode": mode,
                    "command": command,
                    "reason": reason
                }))),
            ),
        },
        SessionEvent::TxRollbackStarted { block_name } => Some(
            TaskEventInput::new("warning", format!("Rollback started for {}", block_name))
                .with_stage("tx_block")
                .with_level("warning")
                .with_details(Some(json!({
                    "block_name": block_name
                }))),
        ),
        SessionEvent::TxRollbackStepSucceeded {
            block_name,
            step_index,
            mode,
            command,
        } => Some(
            TaskEventInput::new(
                "step_completed",
                format!("Rollback step completed for {}", block_name),
            )
            .with_stage("rollback")
            .with_level("warning")
            .with_details(Some(json!({
                "block_name": block_name,
                "step_index": step_index,
                "mode": mode,
                "command": command
            }))),
        ),
        SessionEvent::TxRollbackStepFailed {
            block_name,
            step_index,
            mode,
            command,
            reason,
        } => Some(
            TaskEventInput::new("failed", format!("Rollback step failed for {}", block_name))
                .with_stage("rollback")
                .with_level("error")
                .with_details(Some(json!({
                    "block_name": block_name,
                    "step_index": step_index,
                    "mode": mode,
                    "command": command,
                    "reason": reason
                }))),
        ),
        SessionEvent::TxBlockFinished {
            block_name,
            committed,
            rollback_attempted,
            rollback_succeeded,
        } => match plan {
            RecordingEventPlan::TxBlock { .. } => None,
            RecordingEventPlan::TxWorkflow {
                total_blocks,
                block_indices,
                block_step_counts,
                step_offsets,
                total_steps,
            } => {
                let block_progress = block_indices
                    .get(block_name)
                    .and_then(|idx| task_event_progress_in_range(*idx + 1, *total_blocks, 60, 95));
                let step_progress = block_step_counts.get(block_name).and_then(|count| {
                    count.checked_sub(1).and_then(|last_idx| {
                        tx_workflow_step_progress(step_offsets, block_name, last_idx, *total_steps)
                    })
                });
                Some(
                    TaskEventInput::new(
                        if *committed {
                            "step_completed"
                        } else {
                            "failed"
                        },
                        if *committed {
                            format!("Workflow block {} completed", block_name)
                        } else {
                            format!("Workflow block {} finished with failure", block_name)
                        },
                    )
                    .with_stage("workflow")
                    .with_level(if *committed { "success" } else { "error" })
                    .with_progress(step_progress.or(block_progress))
                    .with_details(Some(json!({
                        "block_name": block_name,
                        "committed": committed,
                        "rollback_attempted": rollback_attempted,
                        "rollback_succeeded": rollback_succeeded
                    }))),
                )
            }
        },
        SessionEvent::TxWorkflowStarted {
            workflow_name,
            total_blocks,
        } => Some(
            TaskEventInput::new("progress", format!("Workflow {} started", workflow_name))
                .with_stage("workflow")
                .with_progress(Some(60))
                .with_details(Some(json!({
                    "workflow_name": workflow_name,
                    "total_blocks": total_blocks
                }))),
        ),
        SessionEvent::TxWorkflowFinished { .. } => None,
        SessionEvent::ConnectionClosed { reason, .. } => Some(
            TaskEventInput::new("log", "Connection closed")
                .with_stage("connect")
                .with_details(Some(json!({ "reason": reason }))),
        ),
        SessionEvent::PromptChanged { .. }
        | SessionEvent::StateChanged { .. }
        | SessionEvent::RawChunk { .. } => None,
    }
}

fn build_tx_workflow_recording_plan(workflow: &rneter::session::TxWorkflow) -> RecordingEventPlan {
    let mut block_indices = HashMap::new();
    let mut block_step_counts = HashMap::new();
    let mut step_offsets = HashMap::new();
    let mut offset = 0usize;

    for (idx, block) in workflow.blocks.iter().enumerate() {
        block_indices.entry(block.name.clone()).or_insert(idx);
        block_step_counts
            .entry(block.name.clone())
            .or_insert(block.steps.len());
        step_offsets.entry(block.name.clone()).or_insert(offset);
        offset += block.steps.len();
    }

    RecordingEventPlan::TxWorkflow {
        total_blocks: workflow.blocks.len(),
        total_steps: workflow.blocks.iter().map(|block| block.steps.len()).sum(),
        block_indices,
        block_step_counts,
        step_offsets,
    }
}

fn spawn_recording_event_forwarder(
    state: &Arc<AppState>,
    task_ctx: &Option<TaskReportContext>,
    recorder: &SessionRecorder,
    plan: RecordingEventPlan,
) -> Option<RecordingEventForwarder> {
    let task_ctx = task_ctx.clone()?;
    let registrar = state.registrar()?;
    let agent_name = current_agent_name(state);
    // The recorder may already contain connection setup entries before we subscribe.
    // The forwarder only observes entries emitted after subscription, so finish()
    // must wait for the delta, not the absolute recorder length.
    let initial_entries = recorder.entries().ok().map_or(0, |entries| entries.len());
    let mut rx = recorder.subscribe();
    let (finish_tx, mut finish_rx) = oneshot::channel::<usize>();

    let join_handle = tokio::spawn(async move {
        let mut processed_entries = 0usize;
        let mut expected_entries: Option<usize> = None;

        loop {
            tokio::select! {
                result = &mut finish_rx, if expected_entries.is_none() => {
                    match result {
                        Ok(expected) => expected_entries = Some(expected),
                        Err(_) => break,
                    }
                }
                result = rx.recv() => {
                    match result {
                        Ok(entry) => {
                            processed_entries += 1;
                            if let Some(event_input) = map_recording_entry_to_task_event(&entry, &plan) {
                                let event = TaskEvent {
                                    task_id: task_ctx.task_id.clone(),
                                    agent_name: agent_name.clone(),
                                    event_type: event_input.event_type,
                                    message: event_input.message,
                                    level: event_input.level,
                                    stage: event_input.stage,
                                    progress: event_input.progress,
                                    details: event_input.details,
                                    occurred_at: recording_entry_occurred_at(entry.ts_ms),
                                };
                                registrar.report_task_event_best_effort(event).await;
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(skipped)) => {
                            processed_entries += skipped as usize;
                            let event = TaskEvent {
                                task_id: task_ctx.task_id.clone(),
                                agent_name: agent_name.clone(),
                                event_type: "warning".to_string(),
                                message: format!(
                                    "Live task event stream lagged, skipped {} recorder events",
                                    skipped
                                ),
                                level: "warning".to_string(),
                                stage: Some(task_ctx.operation.clone()),
                                progress: None,
                                details: Some(json!({ "skipped_events": skipped })),
                                occurred_at: Utc::now().to_rfc3339(),
                            };
                            registrar.report_task_event_best_effort(event).await;
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                    }
                }
            }

            if let Some(expected) = expected_entries
                && processed_entries >= expected
            {
                break;
            }
        }
    });

    Some(RecordingEventForwarder {
        initial_entries,
        finish_tx,
        join_handle,
    })
}

fn emit_task_event(
    state: &Arc<AppState>,
    task_ctx: &Option<TaskReportContext>,
    event: TaskEventInput,
) {
    let Some(task_ctx) = task_ctx.clone() else {
        return;
    };
    let Some(registrar) = state.registrar() else {
        return;
    };
    let state = state.clone();
    tokio::spawn(async move {
        let event = TaskEvent {
            task_id: task_ctx.task_id,
            agent_name: current_agent_name(&state),
            event_type: event.event_type,
            message: event.message,
            level: event.level,
            stage: event.stage,
            progress: event.progress,
            details: event.details,
            occurred_at: Utc::now().to_rfc3339(),
        };
        registrar.report_task_event_best_effort(event).await;
    });
}

fn require_managed_async_task(
    operation: &str,
    task_id: Option<String>,
    managed: bool,
) -> Result<String, ApiError> {
    if !managed {
        return Err(ApiError::bad_request(format!(
            "{} async endpoint requires agent mode",
            operation
        )));
    }
    task_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| {
            ApiError::bad_request(format!("{} async endpoint requires task_id", operation))
        })
}

fn build_async_task_accepted_response(
    task_id: String,
    operation: &str,
) -> AsyncTaskAcceptedResponse {
    AsyncTaskAcceptedResponse {
        accepted: true,
        task_id,
        operation: operation.to_string(),
        status: "queued".to_string(),
    }
}

struct AsyncTaskFailureSpec {
    task_id: String,
    operation_name: String,
    started_at: chrono::DateTime<Utc>,
    started_instant: Instant,
    failure_message: String,
    details: Value,
    fallback_reason: String,
}

async fn report_async_task_failure(state: Arc<AppState>, spec: AsyncTaskFailureSpec) {
    let Some(registrar) = state.registrar() else {
        return;
    };

    let AsyncTaskFailureSpec {
        task_id,
        operation_name,
        started_at,
        started_instant,
        failure_message,
        details,
        fallback_reason,
    } = spec;

    let agent_name = current_agent_name(&state);
    let event = TaskEvent {
        task_id: task_id.clone(),
        agent_name: agent_name.clone(),
        event_type: "failed".to_string(),
        message: failure_message.clone(),
        level: "error".to_string(),
        stage: Some(operation_name.clone()),
        progress: Some(100),
        details: Some(details),
        occurred_at: Utc::now().to_rfc3339(),
    };
    registrar.report_task_event_best_effort(event).await;

    let callback = TaskCallback {
        task_id: task_id.clone(),
        agent_name,
        status: "failed".to_string(),
        started_at: started_at.to_rfc3339(),
        completed_at: Utc::now().to_rfc3339(),
        execution_time_ms: started_instant.elapsed().as_millis() as u64,
        result: None,
        error: Some(failure_message),
    };

    if let Err(err) = registrar.send_task_callback(&callback).await {
        warn!("fallback task callback failed: {}", err);
        registrar
            .report_async_error_best_effort(
                AsyncErrorReportInput::new("task_callback_failed", err.to_string())
                    .with_task_id(Some(task_id))
                    .with_operation(Some(operation_name))
                    .with_target_url(Some(registrar.task_callback_report_target()))
                    .with_http_method(Some(registrar.report_transport_method_name().to_string()))
                    .with_details(Some(json!({
                        "task_status": callback.status,
                        "started_at": callback.started_at,
                        "completed_at": callback.completed_at,
                        "execution_time_ms": callback.execution_time_ms,
                        "fallback_reason": fallback_reason
                    }))),
            )
            .await;
    }
}

fn spawn_supervised_async_task<F>(state: Arc<AppState>, task_id: String, operation: &str, task: F)
where
    F: Future<Output = Result<(), ApiError>> + Send + 'static,
{
    let operation_name = operation.to_string();
    let accepted_at = Utc::now();
    let accepted_instant = Instant::now();
    tokio::spawn(async move {
        let worker = tokio::spawn(task);
        match worker.await {
            Ok(Ok(())) => {}
            Ok(Err(err)) => {
                warn!(
                    "background {} task returned error after handler execution: {}",
                    operation_name, err.message
                );
                let api_error_message = err.message;
                report_async_task_failure(
                    state.clone(),
                    AsyncTaskFailureSpec {
                        task_id: task_id.clone(),
                        operation_name: operation_name.clone(),
                        started_at: accepted_at,
                        started_instant: accepted_instant,
                        failure_message: api_error_message.clone(),
                        details: json!({
                            "failure_type": "task_error",
                            "operation": operation_name.clone(),
                            "api_error": api_error_message
                        }),
                        fallback_reason: api_error_message,
                    },
                )
                .await;
            }
            Err(join_err) => {
                let failure_message = if join_err.is_panic() {
                    format!("Background {} task panicked", operation_name)
                } else if join_err.is_cancelled() {
                    format!("Background {} task was cancelled", operation_name)
                } else {
                    format!("Background {} task terminated unexpectedly", operation_name)
                };
                warn!("{} for task_id={}", failure_message, task_id);
                report_async_task_failure(
                    state,
                    AsyncTaskFailureSpec {
                        task_id,
                        operation_name,
                        started_at: accepted_at,
                        started_instant: accepted_instant,
                        failure_message,
                        details: json!({
                            "failure_type": "join_error",
                            "join_error": join_err.to_string(),
                            "panic": join_err.is_panic(),
                            "cancelled": join_err.is_cancelled()
                        }),
                        fallback_reason: join_err.to_string(),
                    },
                )
                .await;
            }
        }
    });
}

pub(crate) fn queue_exec_async_task(
    state: Arc<AppState>,
    req: ExecRequest,
) -> Result<AsyncTaskAcceptedResponse, ApiError> {
    let task_id = require_managed_async_task("exec", req.task_id.clone(), state.is_managed())?;
    let background_state = state.clone();
    spawn_supervised_async_task(
        background_state.clone(),
        task_id.clone(),
        "exec",
        async move {
            exec_command(State(background_state), Json(req))
                .await
                .map(|_| ())
        },
    );
    Ok(build_async_task_accepted_response(task_id, "exec"))
}

pub(crate) fn queue_template_async_task(
    state: Arc<AppState>,
    req: ExecuteTemplateRequest,
) -> Result<AsyncTaskAcceptedResponse, ApiError> {
    let task_id =
        require_managed_async_task("template_execute", req.task_id.clone(), state.is_managed())?;
    let background_state = state.clone();
    spawn_supervised_async_task(
        background_state.clone(),
        task_id.clone(),
        "template_execute",
        async move {
            execute_template(State(background_state), Json(req))
                .await
                .map(|_| ())
        },
    );
    Ok(build_async_task_accepted_response(
        task_id,
        "template_execute",
    ))
}

pub(crate) fn queue_tx_block_async_task(
    state: Arc<AppState>,
    req: ExecuteTxBlockRequest,
) -> Result<AsyncTaskAcceptedResponse, ApiError> {
    let task_id = require_managed_async_task("tx_block", req.task_id.clone(), state.is_managed())?;
    let background_state = state.clone();
    spawn_supervised_async_task(
        background_state.clone(),
        task_id.clone(),
        "tx_block",
        async move {
            execute_tx_block(State(background_state), Json(req))
                .await
                .map(|_| ())
        },
    );
    Ok(build_async_task_accepted_response(task_id, "tx_block"))
}

pub(crate) fn queue_tx_workflow_async_task(
    state: Arc<AppState>,
    req: ExecuteTxWorkflowRequest,
) -> Result<AsyncTaskAcceptedResponse, ApiError> {
    let task_id =
        require_managed_async_task("tx_workflow", req.task_id.clone(), state.is_managed())?;
    let background_state = state.clone();
    spawn_supervised_async_task(
        background_state.clone(),
        task_id.clone(),
        "tx_workflow",
        async move {
            execute_tx_workflow(State(background_state), Json(req))
                .await
                .map(|_| ())
        },
    );
    Ok(build_async_task_accepted_response(task_id, "tx_workflow"))
}

pub(crate) fn queue_orchestration_async_task(
    state: Arc<AppState>,
    req: ExecuteOrchestrationRequest,
) -> Result<AsyncTaskAcceptedResponse, ApiError> {
    let task_id =
        require_managed_async_task("orchestrate", req.task_id.clone(), state.is_managed())?;
    let background_state = state.clone();
    spawn_supervised_async_task(
        background_state.clone(),
        task_id.clone(),
        "orchestrate",
        async move {
            execute_orchestration(State(background_state), Json(req))
                .await
                .map(|_| ())
        },
    );
    Ok(build_async_task_accepted_response(task_id, "orchestrate"))
}

fn build_task_callback<T: Serialize>(
    state: &Arc<AppState>,
    task_ctx: &TaskReportContext,
    result: &Result<T, ApiError>,
) -> TaskCallback {
    match result {
        Ok(value) => TaskCallback {
            task_id: task_ctx.task_id.clone(),
            agent_name: current_agent_name(state),
            status: "success".to_string(),
            started_at: task_ctx.started_at.to_rfc3339(),
            completed_at: Utc::now().to_rfc3339(),
            execution_time_ms: task_ctx.started_instant.elapsed().as_millis() as u64,
            result: serde_json::to_value(value).ok(),
            error: None,
        },
        Err(err) => TaskCallback {
            task_id: task_ctx.task_id.clone(),
            agent_name: current_agent_name(state),
            status: "failed".to_string(),
            started_at: task_ctx.started_at.to_rfc3339(),
            completed_at: Utc::now().to_rfc3339(),
            execution_time_ms: task_ctx.started_instant.elapsed().as_millis() as u64,
            result: None,
            error: Some(err.message.clone()),
        },
    }
}

fn build_failed_task_callback<T: Serialize>(
    state: &Arc<AppState>,
    task_ctx: &TaskReportContext,
    message: impl Into<String>,
    result: Option<&T>,
) -> TaskCallback {
    let error_message = message.into();
    TaskCallback {
        task_id: task_ctx.task_id.clone(),
        agent_name: current_agent_name(state),
        status: "failed".to_string(),
        started_at: task_ctx.started_at.to_rfc3339(),
        completed_at: Utc::now().to_rfc3339(),
        execution_time_ms: task_ctx.started_instant.elapsed().as_millis() as u64,
        result: result.and_then(|value| serde_json::to_value(value).ok()),
        error: Some(error_message),
    }
}

fn spawn_prepared_task_callback(
    state: Arc<AppState>,
    task_ctx: Option<TaskReportContext>,
    callback: TaskCallback,
) {
    let Some(task_ctx) = task_ctx else {
        return;
    };

    let registrar = state.registrar();
    tokio::spawn(async move {
        let Some(registrar) = registrar else {
            return;
        };
        let send_result = registrar.send_task_callback(&callback).await;
        if let Err(err) = send_result {
            warn!("task callback failed: {}", err);
            if let Some(registrar) = state.registrar() {
                let target_url = registrar.task_callback_report_target();
                let transport_method = registrar.report_transport_method_name().to_string();
                registrar
                    .report_async_error_best_effort(
                        AsyncErrorReportInput::new("task_callback_failed", err.to_string())
                            .with_task_id(Some(task_ctx.task_id.clone()))
                            .with_operation(Some(task_ctx.operation.clone()))
                            .with_target_url(Some(target_url))
                            .with_http_method(Some(transport_method))
                            .with_details(Some(json!({
                                "task_status": callback.status,
                                "started_at": callback.started_at,
                                "completed_at": callback.completed_at,
                                "execution_time_ms": callback.execution_time_ms
                            }))),
                    )
                    .await;
            }
        }
    });
}

fn spawn_task_callback<T: Serialize>(
    state: Arc<AppState>,
    task_ctx: Option<TaskReportContext>,
    result: &Result<T, ApiError>,
) {
    let Some(task_ctx_ref) = task_ctx.as_ref() else {
        return;
    };
    let callback = build_task_callback(&state, task_ctx_ref, result);
    spawn_prepared_task_callback(state, task_ctx, callback);
}

pub async fn health() -> Json<Value> {
    Json(json!({"status": "ok"}))
}

pub async fn list_backups() -> Result<Json<Vec<BackupMeta>>, ApiError> {
    let files = backup::list_backups()?;
    let rows = files
        .into_iter()
        .map(|path| {
            let meta = fs::metadata(&path).ok();
            let size_bytes = meta.as_ref().map(|m| m.len()).unwrap_or(0);
            let modified_ms = meta
                .as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis())
                .unwrap_or(0);
            BackupMeta {
                name: path
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or_default()
                    .to_string(),
                path: path.to_string_lossy().to_string(),
                size_bytes,
                modified_ms,
            }
        })
        .collect();
    Ok(Json(rows))
}

pub async fn create_backup(
    Json(req): Json<BackupCreateRequest>,
) -> Result<Json<BackupCreateResponse>, ApiError> {
    let output = req.output.as_deref().map(PathBuf::from);
    let saved = backup::create_backup(output.as_deref())?;
    Ok(Json(BackupCreateResponse {
        path: saved.to_string_lossy().to_string(),
    }))
}

pub async fn list_blacklist_patterns() -> Result<Json<Vec<BlacklistPatternEntry>>, ApiError> {
    let items = command_blacklist::list_patterns()
        .map_err(ApiError::from)?
        .into_iter()
        .map(|pattern| BlacklistPatternEntry { pattern })
        .collect::<Vec<_>>();
    Ok(Json(items))
}

pub async fn add_blacklist_pattern(
    Json(req): Json<BlacklistUpsertRequest>,
) -> Result<Json<BlacklistUpsertResponse>, ApiError> {
    let (added, path) = command_blacklist::add_pattern(&req.pattern)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    Ok(Json(BlacklistUpsertResponse {
        pattern: req.pattern.trim().to_string(),
        added,
        path: path.to_string_lossy().to_string(),
    }))
}

pub async fn delete_blacklist_pattern(
    Path(pattern): Path<String>,
) -> Result<Json<BlacklistDeleteResponse>, ApiError> {
    let deleted = command_blacklist::delete_pattern(&pattern)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    Ok(Json(BlacklistDeleteResponse { pattern, deleted }))
}

pub async fn check_blacklist_command(
    Json(req): Json<BlacklistCheckRequest>,
) -> Result<Json<BlacklistCheckResponse>, ApiError> {
    let blocked = command_blacklist::find_blocked_command(&req.command)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    Ok(Json(BlacklistCheckResponse {
        command: req.command.trim().to_string(),
        blocked: blocked.is_some(),
        pattern: blocked.map(|item| item.pattern),
    }))
}

pub async fn restore_backup(
    State(state): State<Arc<AppState>>,
    Json(req): Json<BackupRestoreRequest>,
) -> Result<Json<BackupRestoreResponse>, ApiError> {
    if req.archive.trim().is_empty() {
        return Err(ApiError::bad_request("archive path is required"));
    }
    let archive = PathBuf::from(req.archive.trim());
    backup::restore_backup(&archive, req.replace)?;
    crate::config::paths::ensure_default_layout().map_err(ApiError::from)?;
    if let Some(registrar) = state.registrar()
        && let Err(err) = registrar.trigger_device_inventory_sync_if_changed(5).await
    {
        warn!(
            "failed to schedule device inventory sync after backup restore: {}",
            err
        );
    }
    Ok(Json(BackupRestoreResponse {
        restored: true,
        archive: archive.to_string_lossy().to_string(),
        replace: req.replace,
    }))
}

pub async fn download_backup(Path(name): Path<String>) -> Result<Response, ApiError> {
    let path = backup::backup_path_by_name(&name)?;
    let bytes = fs::read(&path).map_err(ApiError::from)?;
    let filename = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("backup.tar.gz");
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/gzip"),
    );
    let disposition = format!("attachment; filename=\"{}\"", filename);
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition).map_err(ApiError::from)?,
    );
    Ok((headers, bytes).into_response())
}

pub async fn list_profiles(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<String>>, ApiError> {
    let _ = state;
    let profiles = template_loader::list_available_profiles()?;
    Ok(Json(profiles))
}

pub async fn profiles_overview(
    State(state): State<Arc<AppState>>,
) -> Result<Json<DeviceProfilesOverview>, ApiError> {
    let _ = state;
    let custom = storage::list_custom_profiles()?;
    Ok(Json(DeviceProfilesOverview {
        builtins: storage::builtin_profiles(),
        custom,
    }))
}

pub async fn get_builtin_profile_detail(
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<BuiltinProfileDetail>, ApiError> {
    let detail = storage::builtin_profile_detail(&name)
        .ok_or_else(|| ApiError::bad_request("builtin profile not found"))?;
    Ok(Json(detail))
}

pub async fn get_builtin_profile_form(
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<DeviceProfile>, ApiError> {
    let profile = storage::builtin_profile_form(&name)
        .ok_or_else(|| ApiError::bad_request("builtin profile not found"))?;
    Ok(Json(profile))
}

pub async fn get_custom_profile(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<CustomProfileDetail>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    let Some(stored) = content_store::load_custom_profile(&safe_name).map_err(ApiError::from)?
    else {
        return Err(ApiError::bad_request("custom profile not found"));
    };
    Ok(Json(CustomProfileDetail {
        name: safe_name,
        path: stored.locator,
        content: stored.content,
    }))
}

pub async fn create_or_update_custom_profile(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
    Json(req): Json<UpsertCustomProfileRequest>,
) -> Result<Json<CustomProfileDetail>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    let updated =
        content_store::update_custom_profile(&safe_name, &req.content).map_err(ApiError::from)?;
    if !updated {
        content_store::create_custom_profile(&safe_name, &req.content).map_err(ApiError::from)?;
    }
    let locator = content_store::custom_profile_locator(&safe_name);
    Ok(Json(CustomProfileDetail {
        name: safe_name,
        path: locator,
        content: req.content,
    }))
}

pub async fn get_custom_profile_form(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<DeviceProfile>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    let Some(stored) = content_store::load_custom_profile(&safe_name).map_err(ApiError::from)?
    else {
        return Err(ApiError::bad_request("custom profile not found"));
    };
    let content = stored.content;
    let mut profile: DeviceProfile = toml::from_str(&content).map_err(ApiError::from)?;
    profile.name = safe_name;
    Ok(Json(profile))
}

pub async fn upsert_custom_profile_form(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
    Json(mut profile): Json<DeviceProfile>,
) -> Result<Json<CustomProfileDetail>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    profile.name = safe_name.clone();
    let toml_content = toml::to_string_pretty(&profile).map_err(ApiError::from)?;
    let updated =
        content_store::update_custom_profile(&safe_name, &toml_content).map_err(ApiError::from)?;
    if !updated {
        content_store::create_custom_profile(&safe_name, &toml_content).map_err(ApiError::from)?;
    }
    let locator = content_store::custom_profile_locator(&safe_name);
    Ok(Json(CustomProfileDetail {
        name: safe_name,
        path: locator,
        content: toml_content,
    }))
}

pub async fn delete_custom_profile(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    content_store::delete_custom_profile(&safe_name).map_err(ApiError::from)?;
    Ok(Json(json!({"ok": true})))
}

pub async fn list_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<TemplateMeta>>, ApiError> {
    let _ = state;
    let templates = storage::list_templates()?;
    Ok(Json(templates))
}

pub async fn get_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_template_name(&name)?;
    let Some(stored) = content_store::load_command_template(&safe_name).map_err(ApiError::from)?
    else {
        return Err(ApiError::bad_request("template not found"));
    };
    Ok(Json(TemplateDetail {
        name: safe_name,
        path: stored.locator,
        content: stored.content,
    }))
}

pub async fn create_template(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CreateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_template_name(&req.name)?;
    let created =
        content_store::create_command_template(&safe_name, &req.content).map_err(ApiError::from)?;
    if !created {
        return Err(ApiError::bad_request("template already exists"));
    }
    let locator = content_store::template_locator(&safe_name);
    Ok(Json(TemplateDetail {
        name: safe_name,
        path: locator,
        content: req.content,
    }))
}

pub async fn update_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
    Json(req): Json<UpdateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_template_name(&name)?;
    let updated =
        content_store::update_command_template(&safe_name, &req.content).map_err(ApiError::from)?;
    if !updated {
        return Err(ApiError::bad_request("template not found"));
    }
    let locator = content_store::template_locator(&safe_name);
    Ok(Json(TemplateDetail {
        name: safe_name,
        path: locator,
        content: req.content,
    }))
}

pub async fn delete_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_template_name(&name)?;
    content_store::delete_command_template(&safe_name).map_err(ApiError::from)?;
    Ok(Json(json!({"ok": true})))
}

pub async fn render_template(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RenderRequest>,
) -> Result<Json<RenderResponse>, ApiError> {
    let _ = state;
    let _ = req.template_dir.as_ref();
    let renderer = Renderer::new();
    let rendered = renderer.render_file(&req.template, req.vars)?;

    Ok(Json(RenderResponse {
        rendered_commands: rendered,
    }))
}

fn to_record_level(level: Option<RecordLevel>) -> Option<SessionRecordLevel> {
    match level {
        Some(RecordLevel::Off) => None,
        Some(RecordLevel::KeyEventsOnly) => Some(SessionRecordLevel::KeyEventsOnly),
        Some(RecordLevel::Full) => Some(SessionRecordLevel::Full),
        None => Some(SessionRecordLevel::KeyEventsOnly),
    }
}

fn to_cli_record_level(level: Option<RecordLevel>) -> RecordLevelOpt {
    match level {
        Some(RecordLevel::Off) => RecordLevelOpt::Off,
        Some(RecordLevel::KeyEventsOnly) | None => RecordLevelOpt::KeyEventsOnly,
        Some(RecordLevel::Full) => RecordLevelOpt::Full,
    }
}

fn record_level_name(level: Option<RecordLevel>) -> &'static str {
    match level {
        Some(RecordLevel::Off) => "off",
        Some(RecordLevel::KeyEventsOnly) | None => "key-events-only",
        Some(RecordLevel::Full) => "full",
    }
}

fn persist_history_if_recorded(
    conn: &crate::web::state::ResolvedConnection,
    client: &DeviceClient,
    operation: &str,
    command_label: &str,
    mode: Option<&str>,
    level: Option<RecordLevel>,
) {
    if matches!(level, Some(RecordLevel::Off)) {
        return;
    }
    let Some(jsonl) = client.recording_jsonl().ok().flatten() else {
        return;
    };
    if let Err(e) = history_store::save_recording(
        HistoryBinding {
            connection_name: conn.connection_name.as_deref(),
            host: &conn.host,
            port: conn.port,
            username: &conn.username,
            device_profile: &conn.device_profile,
        },
        operation,
        command_label,
        mode,
        record_level_name(level),
        &jsonl,
    ) {
        warn!("failed to persist execution history: {}", e);
    }
}

fn resolve_effective_mode(
    requested_mode: Option<&str>,
    device_profile: &str,
) -> Result<String, ApiError> {
    template_loader::resolve_profile_mode(device_profile, requested_mode)
        .map_err(|e| ApiError::bad_request(e.to_string()))
}

pub async fn diagnose_profile(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ProfileDiagnoseRequest>,
) -> Result<Json<ProfileDiagnoseResponse>, ApiError> {
    let name = req.name.trim();
    if name.is_empty() {
        return Err(ApiError::bad_request("profile name is required"));
    }

    let _ = state;
    let _ = req.template_dir.as_ref();
    let handler = template_loader::load_device_profile(name)?;

    let diagnostics = handler.diagnose_state_machine();

    Ok(Json(ProfileDiagnoseResponse {
        name: name.to_string(),
        diagnostics,
    }))
}

pub async fn get_profile_modes(
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<DeviceProfileModesResponse>, ApiError> {
    let safe_name = name.trim();
    if safe_name.is_empty() {
        return Err(ApiError::bad_request("profile name is required"));
    }
    let modes = template_loader::list_profile_modes(safe_name).map_err(ApiError::from)?;
    let default_mode = template_loader::default_profile_mode(safe_name).map_err(ApiError::from)?;
    Ok(Json(DeviceProfileModesResponse {
        name: safe_name.to_string(),
        default_mode,
        modes,
    }))
}

pub async fn exec_command(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecRequest>,
) -> Result<Json<ExecResponse>, ApiError> {
    let task_ctx = TaskReportContext::from_request("exec", req.task_id.clone(), state.is_managed());
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting direct command execution")
            .with_stage("connect")
            .with_progress(Some(0))
            .with_details(Some(json!({
                "command": req.command,
                "mode": req.mode
            }))),
    );
    let result: Result<ExecResponse, ApiError> = async {
        let record_level = req.record_level;
        command_blacklist::ensure_command_allowed(&req.command, "direct execution")
            .map_err(|e| ApiError::bad_request(e.to_string()))?;
        let conn = merge_connection_options(&state.defaults, req.connection)?;
        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Connecting to target device")
                .with_stage("connect")
                .with_progress(Some(10))
                .with_details(Some(json!({
                    "host": conn.host,
                    "connection_name": conn.connection_name
                }))),
        );
        let handler = template_loader::load_device_profile(&conn.device_profile)?;
        let effective_mode = resolve_effective_mode(req.mode.as_deref(), &conn.device_profile)?;
        let client = if let Some(level) = to_record_level(record_level) {
            DeviceClient::connect_with_recording(
                conn.host.clone(),
                conn.port,
                conn.username.clone(),
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                template_loader::default_profile_mode(&conn.device_profile)?,
                level,
                conn.ssh_security,
            )
            .await?
        } else {
            DeviceClient::connect(
                conn.host.clone(),
                conn.port,
                conn.username.clone(),
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                template_loader::default_profile_mode(&conn.device_profile)?,
                conn.ssh_security,
            )
            .await?
        };

        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Executing command")
                .with_stage("command")
                .with_progress(Some(60))
                .with_details(Some(json!({
                    "command": req.command
                }))),
        );
        let output = client
            .execute_output(&req.command, Some(effective_mode.as_str()))
            .await?;
        let exit_code = output.exit_code;
        persist_history_if_recorded(
            &conn,
            &client,
            "exec",
            &req.command,
            Some(effective_mode.as_str()),
            record_level,
        );
        Ok(ExecResponse {
            output: output.content,
            exit_code,
            recording_jsonl: client.recording_jsonl()?,
        })
    }
    .await;
    drop(task_guard);
    match &result {
        Ok(response) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("completed", "Direct command execution completed")
                .with_stage("command")
                .with_level("success")
                .with_progress(Some(100))
                .with_details(Some(json!({
                    "exit_code": response.exit_code
                }))),
        ),
        Err(err) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new(
                "failed",
                format!("Direct command execution failed: {}", err.message),
            )
            .with_stage("command")
            .with_level("error"),
        ),
    }
    spawn_task_callback(state, task_ctx, &result);
    result.map(Json)
}

pub async fn exec_command_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecRequest>,
) -> Result<(StatusCode, Json<AsyncTaskAcceptedResponse>), ApiError> {
    let response = queue_exec_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(response)))
}

pub async fn interactive_start(
    State(state): State<Arc<AppState>>,
    Json(req): Json<InteractiveStartRequest>,
) -> Result<Json<InteractiveStartResponse>, ApiError> {
    let record_level = req.record_level;
    let conn = merge_connection_options(&state.defaults, req.connection)?;
    let handler = template_loader::load_device_profile(&conn.device_profile)?;
    let client = if let Some(level) = to_record_level(record_level) {
        DeviceClient::connect_with_recording(
            conn.host.clone(),
            conn.port,
            conn.username.clone(),
            conn.password.clone(),
            conn.enable_password.clone(),
            handler,
            template_loader::default_profile_mode(&conn.device_profile)?,
            level,
            conn.ssh_security,
        )
        .await?
    } else {
        DeviceClient::connect(
            conn.host.clone(),
            conn.port,
            conn.username.clone(),
            conn.password.clone(),
            conn.enable_password.clone(),
            handler,
            template_loader::default_profile_mode(&conn.device_profile)?,
            conn.ssh_security,
        )
        .await?
    };

    let session_id = state.next_interactive_id();
    let session = InteractiveSession {
        client,
        conn,
        record_level,
        last_used: Instant::now(),
    };
    let mut sessions = state.interactive_sessions.lock().await;
    sessions.insert(session_id.clone(), session);

    Ok(Json(InteractiveStartResponse { session_id }))
}

pub async fn interactive_command(
    State(state): State<Arc<AppState>>,
    Json(req): Json<InteractiveCommandRequest>,
) -> Result<Json<InteractiveCommandResponse>, ApiError> {
    command_blacklist::ensure_command_allowed(&req.command, "interactive execution")
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let mut sessions = state.interactive_sessions.lock().await;
    let mut session = sessions
        .remove(&req.session_id)
        .ok_or_else(|| ApiError::bad_request("interactive session not found"))?;
    drop(sessions);

    let effective_mode = resolve_effective_mode(req.mode.as_deref(), &session.conn.device_profile)?;
    let output = session
        .client
        .execute_output(&req.command, Some(effective_mode.as_str()))
        .await?;
    session.last_used = Instant::now();

    let mut sessions = state.interactive_sessions.lock().await;
    sessions.insert(req.session_id, session);

    Ok(Json(InteractiveCommandResponse {
        output: output.content,
        exit_code: output.exit_code,
    }))
}

pub async fn interactive_stop(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<InteractiveStopResponse>, ApiError> {
    let mut sessions = state.interactive_sessions.lock().await;
    let session = sessions
        .remove(&id)
        .ok_or_else(|| ApiError::bad_request("interactive session not found"))?;
    drop(sessions);

    persist_history_if_recorded(
        &session.conn,
        &session.client,
        "interactive",
        "interactive session",
        Some(session.client.default_mode()),
        session.record_level,
    );
    let recording_jsonl = session.client.recording_jsonl()?;

    Ok(Json(InteractiveStopResponse {
        ok: true,
        recording_jsonl,
    }))
}

pub async fn test_connection(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ConnectionTestRequest>,
) -> Result<Json<ConnectionTestResponse>, ApiError> {
    let conn = merge_connection_options(&state.defaults, req.connection)?;
    let handler = template_loader::load_device_profile(&conn.device_profile)?;
    let _client = DeviceClient::connect(
        conn.host.clone(),
        conn.port,
        conn.username.clone(),
        conn.password,
        conn.enable_password,
        handler,
        template_loader::default_profile_mode(&conn.device_profile)?,
        conn.ssh_security,
    )
    .await?;

    Ok(Json(ConnectionTestResponse {
        ok: true,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        ssh_security: conn.ssh_security,
        device_profile: conn.device_profile,
    }))
}

pub async fn list_connections() -> Result<Json<Vec<SavedConnectionMeta>>, ApiError> {
    let names = connection_store::list_connections().map_err(ApiError::from)?;
    let mut items = Vec::new();
    for name in names {
        if let Ok(data) = connection_store::load_connection_raw(&name) {
            items.push(SavedConnectionMeta {
                name,
                path: connection_store::storage_path()
                    .to_string_lossy()
                    .to_string(),
                has_password: connection_store::has_saved_password(&data),
            });
        }
    }
    Ok(Json(items))
}

fn saved_connection_detail_response(
    name: &str,
    path: &std::path::Path,
    data: &SavedConnection,
) -> SavedConnectionDetail {
    SavedConnectionDetail {
        name: name.to_string(),
        path: path.to_string_lossy().to_string(),
        has_password: connection_store::has_saved_password(data),
        connection: ConnectionRequest {
            connection_name: Some(name.to_string()),
            host: data.host.clone(),
            username: data.username.clone(),
            password: None,
            port: data.port,
            enable_password: None,
            ssh_security: data.ssh_security,
            device_profile: data.device_profile.clone(),
            template_dir: data.template_dir.clone(),
        },
    }
}

fn merged_saved_secret(
    save_password: bool,
    incoming: Option<String>,
    existing: Option<&String>,
) -> Option<String> {
    if !save_password {
        return None;
    }
    incoming.or_else(|| existing.cloned())
}

fn should_persist_secret(save_password: bool, incoming_secret: Option<&str>) -> bool {
    save_password || incoming_secret.is_some_and(|value| !value.trim().is_empty())
}

pub async fn get_connection(
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<SavedConnectionDetail>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let data = connection_store::load_connection_raw(&safe)
        .map_err(|_| ApiError::bad_request("saved connection not found"))?;
    let path = connection_store::storage_path();
    Ok(Json(saved_connection_detail_response(&safe, &path, &data)))
}

pub async fn get_connection_history(
    axum::extract::Path(name): axum::extract::Path<String>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<Vec<ConnectionHistoryEntry>>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let limit = query.limit.unwrap_or(20);
    let rows =
        history_store::list_history_by_connection_name(&safe, limit).map_err(ApiError::from)?;
    let items = rows
        .into_iter()
        .map(|row| ConnectionHistoryEntry {
            id: row.id,
            ts_ms: row.ts_ms,
            connection_key: row.connection_key,
            connection_name: row.connection_name,
            host: row.host,
            port: row.port,
            username: row.username,
            device_profile: row.device_profile,
            operation: row.operation,
            command_label: row.command_label,
            mode: row.mode,
            record_level: row.record_level,
            record_path: row.record_path,
        })
        .collect::<Vec<_>>();
    Ok(Json(items))
}

pub async fn get_connection_history_detail(
    axum::extract::Path((name, id)): axum::extract::Path<(String, String)>,
) -> Result<Json<ConnectionHistoryDetailResponse>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let rows = history_store::list_history_by_connection_name(&safe, 0).map_err(ApiError::from)?;
    let row = rows
        .into_iter()
        .find(|item| item.id == id)
        .ok_or_else(|| ApiError::bad_request("history record not found"))?;

    let jsonl = history_store::load_recording_jsonl_by_key(&row.connection_key, &row.id)
        .map_err(ApiError::from)?
        .ok_or_else(|| ApiError::bad_request("history record body not found"))?;
    let recorder = SessionRecorder::from_jsonl(&jsonl).map_err(ApiError::from)?;
    let entries = recorder.entries().map_err(ApiError::from)?;

    Ok(Json(ConnectionHistoryDetailResponse {
        meta: ConnectionHistoryEntry {
            id: row.id,
            ts_ms: row.ts_ms,
            connection_key: row.connection_key,
            connection_name: row.connection_name,
            host: row.host,
            port: row.port,
            username: row.username,
            device_profile: row.device_profile,
            operation: row.operation,
            command_label: row.command_label,
            mode: row.mode,
            record_level: row.record_level,
            record_path: row.record_path,
        },
        entries,
    }))
}

pub async fn delete_connection_history(
    axum::extract::Path((name, id)): axum::extract::Path<(String, String)>,
) -> Result<Json<Value>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let deleted =
        history_store::delete_history_by_connection_name(&safe, &id).map_err(ApiError::from)?;
    Ok(Json(json!({ "ok": true, "deleted": deleted })))
}

pub async fn upsert_connection(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
    Json(req): Json<UpsertConnectionRequest>,
) -> Result<Json<SavedConnectionDetail>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let c = req.connection;
    let save_password = should_persist_secret(req.save_password, c.password.as_deref())
        || should_persist_secret(req.save_password, c.enable_password.as_deref());
    let existing = connection_store::load_connection_raw(&safe).ok();
    let existing_password = connection_store::load_saved_secret(
        existing
            .as_ref()
            .and_then(|item| item.password_encrypted.as_deref()),
    )
    .map_err(ApiError::from)?;
    let existing_enable_password = connection_store::load_saved_secret(
        existing
            .as_ref()
            .and_then(|item| item.enable_password_encrypted.as_deref()),
    )
    .map_err(ApiError::from)?;
    let data = SavedConnection {
        host: c.host,
        username: c.username,
        password: merged_saved_secret(save_password, c.password, existing_password.as_ref()),
        password_encrypted: None,
        port: c.port,
        enable_password: merged_saved_secret(
            save_password,
            c.enable_password,
            existing_enable_password.as_ref(),
        ),
        enable_password_encrypted: None,
        ssh_security: c
            .ssh_security
            .or_else(|| existing.as_ref().and_then(|item| item.ssh_security)),
        device_profile: c.device_profile,
        template_dir: c.template_dir,
    };
    let path = connection_store::save_connection(&safe, &data).map_err(ApiError::from)?;
    if let Some(registrar) = state.registrar()
        && let Err(err) = registrar.trigger_device_inventory_sync_if_changed(5).await
    {
        warn!(
            "failed to schedule device inventory sync after connection upsert: {}",
            err
        );
    }

    Ok(Json(saved_connection_detail_response(&safe, &path, &data)))
}

pub async fn delete_connection(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let deleted = connection_store::delete_connection(&safe).map_err(ApiError::from)?;
    if deleted
        && let Some(registrar) = state.registrar()
        && let Err(err) = registrar.trigger_device_inventory_sync_if_changed(5).await
    {
        warn!(
            "failed to schedule device inventory sync after connection delete: {}",
            err
        );
    }
    Ok(Json(json!({ "ok": true, "deleted": deleted })))
}

pub async fn execute_template(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTemplateRequest>,
) -> Result<Json<ExecuteTemplateResponse>, ApiError> {
    let task_ctx = TaskReportContext::from_request(
        "template_execute",
        req.task_id.clone(),
        state.is_managed(),
    );
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting template execution")
            .with_stage("render")
            .with_progress(Some(0))
            .with_details(Some(json!({
                "template": req.template,
                "mode": req.mode
            }))),
    );
    let result: Result<ExecuteTemplateResponse, ApiError> = async {
        let record_level = req.record_level;
        let _ = req.template_dir.as_ref();
        let renderer = Renderer::new();
        let rendered_commands = renderer.render_file(&req.template, req.vars)?;
        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Template rendered")
                .with_stage("render")
                .with_progress(Some(20))
                .with_details(Some(json!({
                    "template": req.template,
                    "rendered_command_count": rendered_commands.lines().filter(|line| !line.trim().is_empty()).count()
                }))),
        );

        if req.dry_run.unwrap_or(false) {
            return Ok(ExecuteTemplateResponse {
                rendered_commands,
                executed: Vec::new(),
                recording_jsonl: None,
            });
        }

        let lines: Vec<String> = rendered_commands
            .lines()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        command_blacklist::ensure_commands_allowed(
            lines.iter().map(String::as_str),
            "template execution",
        )
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

        let conn = merge_connection_options(&state.defaults, req.connection)?;
        let handler = template_loader::load_device_profile(&conn.device_profile)?;
        let effective_mode = resolve_effective_mode(req.mode.as_deref(), &conn.device_profile)?;
        let client = if let Some(level) = to_record_level(record_level) {
            DeviceClient::connect_with_recording(
                conn.host.clone(),
                conn.port,
                conn.username.clone(),
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                template_loader::default_profile_mode(&conn.device_profile)?,
                level,
                conn.ssh_security,
            )
            .await?
        } else {
            DeviceClient::connect(
                conn.host.clone(),
                conn.port,
                conn.username.clone(),
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                template_loader::default_profile_mode(&conn.device_profile)?,
                conn.ssh_security,
            )
            .await?
        };

        let mut executed = Vec::with_capacity(lines.len());
        let total_commands = lines.len();
        for (idx, cmd) in lines.into_iter().enumerate() {
            emit_task_event(
                &state,
                &task_ctx,
                TaskEventInput::new(
                    "step_started",
                    format!("Executing command {}/{}", idx + 1, total_commands),
                )
                .with_stage("command")
                .with_progress(task_event_progress(idx + 1, total_commands))
                .with_details(Some(json!({
                    "command": cmd,
                    "index": idx + 1,
                    "total": total_commands
                }))),
            );
            match client.execute_output(&cmd, Some(effective_mode.as_str())).await {
                Ok(output) => {
                    emit_task_event(
                        &state,
                        &task_ctx,
                        TaskEventInput::new(
                            "step_completed",
                            format!("Command {}/{} completed", idx + 1, total_commands),
                        )
                        .with_stage("command")
                        .with_level("success")
                        .with_progress(task_event_progress(idx + 1, total_commands))
                        .with_details(Some(json!({
                            "command": cmd,
                            "index": idx + 1,
                            "total": total_commands,
                            "exit_code": output.exit_code
                        }))),
                    );
                    executed.push(CommandResult {
                        command: cmd,
                        success: true,
                        exit_code: output.exit_code,
                        output: Some(output.content),
                        error: None,
                    })
                }
                Err(e) => {
                    emit_task_event(
                        &state,
                        &task_ctx,
                        TaskEventInput::new(
                            "warning",
                            format!("Command {}/{} failed", idx + 1, total_commands),
                        )
                        .with_stage("command")
                        .with_level("warning")
                        .with_progress(task_event_progress(idx + 1, total_commands))
                        .with_details(Some(json!({
                            "command": cmd,
                            "index": idx + 1,
                            "total": total_commands,
                            "error": e.to_string()
                        }))),
                    );
                    executed.push(CommandResult {
                        command: cmd,
                        success: false,
                        exit_code: None,
                        output: None,
                        error: Some(e.to_string()),
                    })
                }
            }
        }

        persist_history_if_recorded(
            &conn,
            &client,
            "template_execute",
            &format!("template: {}", req.template),
            Some(effective_mode.as_str()),
            record_level,
        );

        Ok(ExecuteTemplateResponse {
            rendered_commands,
            executed,
            recording_jsonl: client.recording_jsonl()?,
        })
    }
    .await;
    drop(task_guard);
    match &result {
        Ok(response) => {
            let failed_commands = response.executed.iter().filter(|cmd| !cmd.success).count();
            let event = if failed_commands == 0 {
                TaskEventInput::new("completed", "Template execution completed")
                    .with_stage("command")
                    .with_level("success")
                    .with_progress(Some(100))
            } else {
                TaskEventInput::new(
                    "completed",
                    format!(
                        "Template execution completed with {} failed command(s)",
                        failed_commands
                    ),
                )
                .with_stage("command")
                .with_level("warning")
                .with_progress(Some(100))
            };
            emit_task_event(&state, &task_ctx, event);
        }
        Err(err) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new(
                "failed",
                format!("Template execution failed: {}", err.message),
            )
            .with_stage("render")
            .with_level("error"),
        ),
    }
    spawn_task_callback(state, task_ctx, &result);
    result.map(Json)
}

pub async fn execute_template_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTemplateRequest>,
) -> Result<(StatusCode, Json<AsyncTaskAcceptedResponse>), ApiError> {
    let response = queue_template_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(response)))
}

fn resolve_tx_commands(
    renderer: &Renderer,
    template: Option<&str>,
    vars: Value,
    commands: &[String],
) -> Result<Vec<String>, ApiError> {
    let mut all = Vec::new();
    if let Some(name) = template {
        let rendered = renderer.render_file(name, vars)?;
        all.extend(
            rendered
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
        );
    }
    all.extend(
        commands
            .iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
    );
    if all.is_empty() {
        return Err(ApiError::bad_request(
            "tx requires at least one command or a template",
        ));
    }
    Ok(all)
}

pub async fn execute_tx_block(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxBlockRequest>,
) -> Result<Json<ExecuteTxBlockResponse>, ApiError> {
    let task_ctx =
        TaskReportContext::from_request("tx_block", req.task_id.clone(), state.is_managed());
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting tx block execution")
            .with_stage("tx_block")
            .with_progress(Some(0)),
    );
    let result: Result<ExecuteTxBlockResponse, ApiError> = async {
        let record_level = req.record_level;
        let requested_record_level = to_record_level(record_level);
        let live_record_level = if task_ctx.is_some() {
            requested_record_level.or(Some(SessionRecordLevel::KeyEventsOnly))
        } else {
            requested_record_level
        };
        let template_key = req
            .template_profile
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.to_string())
            .or_else(|| {
                req.connection
                    .as_ref()
                    .and_then(|c| c.device_profile.as_ref())
                    .filter(|s| !s.trim().is_empty())
                    .cloned()
            })
            .or_else(|| {
                state
                    .defaults
                    .device_profile
                    .as_ref()
                    .filter(|s| !s.trim().is_empty())
                    .cloned()
            })
            .unwrap_or_else(|| "cisco".to_string());
        let block_name = req
            .name
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or("tx-block")
            .to_string();
        let mode = req
            .mode
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .map(|mode| {
                template_loader::resolve_profile_mode(&template_key, Some(mode))
                    .map_err(|e| ApiError::bad_request(e.to_string()))
            })
            .transpose()?
            .unwrap_or_else(|| "Config".to_string());

        let renderer = Renderer::new();
        let resolved_commands =
            resolve_tx_commands(&renderer, req.template.as_deref(), req.vars, &req.commands)?;

        if req.rollback_trigger_step_index.is_some() && req.resource_rollback_command.is_none() {
            return Err(ApiError::bad_request(
                "rollback_trigger_step_index requires resource_rollback_command",
            ));
        }

        let mut rollback_commands = req.rollback_commands;
        while rollback_commands.len() > resolved_commands.len()
            && rollback_commands
                .last()
                .map(|s| s.trim().is_empty())
                .unwrap_or(false)
        {
            rollback_commands.pop();
        }

        let tx_block = if !rollback_commands.is_empty() {
            if rollback_commands.len() > resolved_commands.len() {
                return Err(ApiError::bad_request(
                    "rollback_commands length must not exceed commands length",
                ));
            }
            while rollback_commands.len() < resolved_commands.len() {
                rollback_commands.push(String::new());
            }
            let steps: Vec<TxStep> = resolved_commands
                .iter()
                .enumerate()
                .map(|(idx, cmd)| TxStep {
                    mode: mode.to_string(),
                    command: cmd.clone(),
                    timeout_secs: req.timeout_secs,
                    rollback_command: if rollback_commands[idx].trim().is_empty() {
                        None
                    } else {
                        Some(rollback_commands[idx].clone())
                    },
                    rollback_on_failure: req.rollback_on_failure.unwrap_or(false),
                })
                .collect();
            let tx_block = TxBlock {
                name: block_name.to_string(),
                kind: CommandBlockKind::Config,
                rollback_policy: RollbackPolicy::PerStep,
                steps,
                fail_fast: true,
            };
            tx_block.validate().map_err(ApiError::from)?;
            tx_block
        } else {
            let mut tx_block = rneter_templates::build_tx_block(
                &template_key,
                &block_name,
                &mode,
                &resolved_commands,
                req.timeout_secs,
                req.resource_rollback_command,
            )?;
            if req.rollback_on_failure.unwrap_or(false) {
                for step in tx_block.steps.iter_mut() {
                    step.rollback_on_failure = true;
                }
            }
            if let Some(trigger) = req.rollback_trigger_step_index {
                match tx_block.rollback_policy {
                    RollbackPolicy::WholeResource {
                        mode,
                        undo_command,
                        timeout_secs,
                        ..
                    } => {
                        tx_block.rollback_policy = RollbackPolicy::WholeResource {
                            mode,
                            undo_command,
                            timeout_secs,
                            trigger_step_index: trigger,
                        };
                    }
                    _ => {
                        return Err(ApiError::bad_request(
                            "rollback_trigger_step_index requires whole_resource rollback",
                        ));
                    }
                }
            }
            tx_block
        };
        let tx_block_value = serde_json::to_value(&tx_block).map_err(ApiError::from)?;
        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Tx block built")
                .with_stage("tx_block")
                .with_progress(Some(20))
                .with_details(Some(json!({
                    "name": block_name,
                    "steps": tx_block.steps.len()
                }))),
        );
        if req.dry_run.unwrap_or(false) {
            return Ok(ExecuteTxBlockResponse {
                tx_block: tx_block_value,
                tx_result: None,
                recording_jsonl: None,
            });
        }

        command_blacklist::ensure_tx_block_allowed(
            &tx_block,
            &format!("tx block '{}'", block_name),
        )
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

        let conn = merge_connection_options(&state.defaults, req.connection)?;
        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Executing tx block")
                .with_stage("tx_block")
                .with_progress(Some(60))
                .with_details(Some(json!({
                    "name": block_name,
                    "host": conn.host,
                    "connection_name": conn.connection_name
                }))),
        );
        let handler = template_loader::load_device_profile(&conn.device_profile)?;
        let (tx_result, recording_jsonl) = if let Some(level) = live_record_level {
            let request = manager_connection_request(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
            );
            let (_sender, recorder) = MANAGER
                .get_with_recording_level_and_context(
                    request,
                    manager_execution_context_with_security(None, conn.ssh_security),
                    level,
                )
                .await?;
            let forwarder = spawn_recording_event_forwarder(
                &state,
                &task_ctx,
                &recorder,
                RecordingEventPlan::TxBlock {
                    total_steps: tx_block.steps.len(),
                },
            );
            let handler_for_tx = template_loader::load_device_profile(&conn.device_profile)?;
            let request = manager_connection_request(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler_for_tx,
            );
            let execution_result = MANAGER
                .execute_tx_block_with_context(
                    request,
                    tx_block.clone(),
                    manager_execution_context_with_security(None, conn.ssh_security),
                )
                .await;
            let expected_entries = recorder.entries().map_err(ApiError::from)?.len();
            if let Some(forwarder) = forwarder {
                forwarder.finish(expected_entries).await;
            }
            let result = execution_result?;
            let jsonl = if requested_record_level.is_some() {
                let jsonl = recorder.to_jsonl().map_err(ApiError::from)?;
                if let Err(e) = history_store::save_recording(
                    HistoryBinding {
                        connection_name: conn.connection_name.as_deref(),
                        host: &conn.host,
                        port: conn.port,
                        username: &conn.username,
                        device_profile: &conn.device_profile,
                    },
                    "tx_block",
                    &block_name,
                    Some(&mode),
                    record_level_name(record_level),
                    &jsonl,
                ) {
                    warn!("failed to persist execution history: {}", e);
                }
                Some(jsonl)
            } else {
                None
            };
            (result, jsonl)
        } else {
            let request = manager_connection_request(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
            );
            let result = MANAGER
                .execute_tx_block_with_context(
                    request,
                    tx_block.clone(),
                    manager_execution_context_with_security(None, conn.ssh_security),
                )
                .await?;
            (result, None)
        };

        let tx_result_value = serde_json::to_value(&tx_result).map_err(ApiError::from)?;
        if task_ctx.is_some() && tx_result.rollback_attempted {
            emit_task_event(
                &state,
                &task_ctx,
                TaskEventInput::new("warning", "Tx block performed rollback")
                    .with_stage("tx_block")
                    .with_level(if tx_result.rollback_succeeded {
                        "warning"
                    } else {
                        "error"
                    })
                    .with_details(Some(json!({
                        "name": block_name,
                        "rollback_succeeded": tx_result.rollback_succeeded,
                        "rollback_steps": tx_result.rollback_steps,
                        "rollback_errors": tx_result.rollback_errors
                    }))),
            );
        }

        Ok(ExecuteTxBlockResponse {
            tx_block: tx_block_value,
            tx_result: Some(tx_result_value),
            recording_jsonl,
        })
    }
    .await;
    drop(task_guard);
    match &result {
        Ok(response) if task_ctx.is_some() => {
            let committed = response
                .tx_result
                .as_ref()
                .and_then(|value| value.get("committed"))
                .and_then(Value::as_bool)
                .unwrap_or(true);
            let response_details = serde_json::to_value(response).ok();
            let input = if committed {
                TaskEventInput::new("completed", "Tx block completed")
                    .with_stage("tx_block")
                    .with_level("success")
                    .with_progress(Some(100))
                    .with_details(response_details)
            } else {
                TaskEventInput::new("failed", "Tx block execution finished with failure")
                    .with_stage("tx_block")
                    .with_level("error")
                    .with_progress(Some(100))
                    .with_details(response_details)
            };
            emit_task_event(&state, &task_ctx, input);
        }
        Ok(_) => {}
        Err(err) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("failed", format!("Tx block failed: {}", err.message))
                .with_stage("tx_block")
                .with_level("error"),
        ),
    }
    if let (Some(task_ctx_ref), Ok(response)) = (task_ctx.as_ref(), &result) {
        let committed = response
            .tx_result
            .as_ref()
            .and_then(|value| value.get("committed"))
            .and_then(Value::as_bool)
            .unwrap_or(true);
        if !committed {
            let callback = build_failed_task_callback(
                &state,
                task_ctx_ref,
                "Tx block execution finished with failure",
                Some(response),
            );
            spawn_prepared_task_callback(state, task_ctx, callback);
            return result.map(Json);
        }
    }
    spawn_task_callback(state, task_ctx, &result);
    result.map(Json)
}

pub async fn execute_tx_block_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxBlockRequest>,
) -> Result<(StatusCode, Json<AsyncTaskAcceptedResponse>), ApiError> {
    let response = queue_tx_block_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(response)))
}

pub async fn execute_tx_workflow(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxWorkflowRequest>,
) -> Result<Json<ExecuteTxWorkflowResponse>, ApiError> {
    let task_ctx =
        TaskReportContext::from_request("tx_workflow", req.task_id.clone(), state.is_managed());
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting tx workflow execution")
            .with_stage("workflow")
            .with_progress(Some(0)),
    );
    let result: Result<ExecuteTxWorkflowResponse, ApiError> = async {
        let record_level = req.record_level;
        let requested_record_level = to_record_level(record_level);
        let live_record_level = if task_ctx.is_some() {
            requested_record_level.or(Some(SessionRecordLevel::KeyEventsOnly))
        } else {
            requested_record_level
        };
        let workflow: rneter::session::TxWorkflow =
            serde_json::from_value(req.workflow.clone()).map_err(ApiError::from)?;
        let workflow_value = serde_json::to_value(&workflow).map_err(ApiError::from)?;
        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Workflow loaded")
                .with_stage("workflow")
                .with_progress(Some(15))
                .with_details(Some(json!({
                    "workflow_name": workflow.name,
                    "blocks": workflow.blocks.len()
                }))),
        );

        if req.dry_run.unwrap_or(false) {
            return Ok(ExecuteTxWorkflowResponse {
                workflow: workflow_value,
                tx_workflow_result: None,
                recording_jsonl: None,
            });
        }

        command_blacklist::ensure_tx_workflow_allowed(
            &workflow,
            &format!("tx workflow '{}'", workflow.name),
        )
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

        let conn = merge_connection_options(&state.defaults, req.connection)?;
        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Executing workflow")
                .with_stage("workflow")
                .with_progress(Some(60))
                .with_details(Some(json!({
                    "workflow_name": workflow.name,
                    "host": conn.host,
                    "connection_name": conn.connection_name
                }))),
        );
        let handler = template_loader::load_device_profile(&conn.device_profile)?;
        let (workflow_result, recording_jsonl) = if let Some(level) = live_record_level {
            let request = manager_connection_request(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
            );
            let (_sender, recorder) = MANAGER
                .get_with_recording_level_and_context(
                    request,
                    manager_execution_context_with_security(None, conn.ssh_security),
                    level,
                )
                .await?;
            let forwarder = spawn_recording_event_forwarder(
                &state,
                &task_ctx,
                &recorder,
                build_tx_workflow_recording_plan(&workflow),
            );
            let handler_for_tx = template_loader::load_device_profile(&conn.device_profile)?;
            let request = manager_connection_request(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler_for_tx,
            );
            let execution_result = MANAGER
                .execute_tx_workflow_with_context(
                    request,
                    workflow.clone(),
                    manager_execution_context_with_security(None, conn.ssh_security),
                )
                .await;
            let expected_entries = recorder.entries().map_err(ApiError::from)?.len();
            if let Some(forwarder) = forwarder {
                forwarder.finish(expected_entries).await;
            }
            let result = execution_result?;
            let jsonl = if requested_record_level.is_some() {
                let jsonl = recorder.to_jsonl().map_err(ApiError::from)?;
                if let Err(e) = history_store::save_recording(
                    HistoryBinding {
                        connection_name: conn.connection_name.as_deref(),
                        host: &conn.host,
                        port: conn.port,
                        username: &conn.username,
                        device_profile: &conn.device_profile,
                    },
                    "tx_workflow",
                    &workflow.name,
                    None,
                    record_level_name(record_level),
                    &jsonl,
                ) {
                    warn!("failed to persist execution history: {}", e);
                }
                Some(jsonl)
            } else {
                None
            };
            (result, jsonl)
        } else {
            let request = manager_connection_request(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
            );
            let result = MANAGER
                .execute_tx_workflow_with_context(
                    request,
                    workflow.clone(),
                    manager_execution_context_with_security(None, conn.ssh_security),
                )
                .await?;
            (result, None)
        };

        Ok(ExecuteTxWorkflowResponse {
            workflow: workflow_value,
            tx_workflow_result: Some(
                serde_json::to_value(&workflow_result).map_err(ApiError::from)?,
            ),
            recording_jsonl,
        })
    }
    .await;
    drop(task_guard);
    match &result {
        Ok(response) if task_ctx.is_some() => {
            if let Some(workflow_result) = &response.tx_workflow_result {
                if let Some(blocks) = workflow_result
                    .get("block_results")
                    .and_then(Value::as_array)
                {
                    let total_blocks = blocks.len().max(1);
                    for (idx, block) in blocks.iter().enumerate() {
                        let block_name = block
                            .get("block_name")
                            .and_then(Value::as_str)
                            .unwrap_or("block");
                        let committed = block
                            .get("committed")
                            .and_then(Value::as_bool)
                            .unwrap_or(true);
                        emit_task_event(
                            &state,
                            &task_ctx,
                            TaskEventInput::new(
                                "step_completed",
                                format!("Workflow block {} completed", block_name),
                            )
                            .with_stage("workflow")
                            .with_level(if committed { "success" } else { "error" })
                            .with_progress(task_event_progress(idx + 1, total_blocks))
                            .with_details(Some(block.clone())),
                        );
                    }
                }
                let committed = workflow_result
                    .get("committed")
                    .and_then(Value::as_bool)
                    .unwrap_or(true);
                emit_task_event(
                    &state,
                    &task_ctx,
                    TaskEventInput::new(
                        if committed { "completed" } else { "failed" },
                        if committed {
                            "Tx workflow completed"
                        } else {
                            "Tx workflow finished with failure"
                        },
                    )
                    .with_stage("workflow")
                    .with_level(if committed { "success" } else { "error" })
                    .with_progress(Some(100))
                    .with_details(serde_json::to_value(response).ok()),
                );
            }
        }
        Ok(_) => {}
        Err(err) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("failed", format!("Tx workflow failed: {}", err.message))
                .with_stage("workflow")
                .with_level("error"),
        ),
    }
    if let (Some(task_ctx_ref), Ok(response)) = (task_ctx.as_ref(), &result) {
        let committed = response
            .tx_workflow_result
            .as_ref()
            .and_then(|value| value.get("committed"))
            .and_then(Value::as_bool)
            .unwrap_or(true);
        if !committed {
            let callback = build_failed_task_callback(
                &state,
                task_ctx_ref,
                "Tx workflow finished with failure",
                Some(response),
            );
            spawn_prepared_task_callback(state, task_ctx, callback);
            return result.map(Json);
        }
    }
    spawn_task_callback(state, task_ctx, &result);
    result.map(Json)
}

pub async fn execute_tx_workflow_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxWorkflowRequest>,
) -> Result<(StatusCode, Json<AsyncTaskAcceptedResponse>), ApiError> {
    let response = queue_tx_workflow_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(response)))
}

pub async fn execute_orchestration(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteOrchestrationRequest>,
) -> Result<Json<ExecuteOrchestrationResponse>, ApiError> {
    let task_ctx =
        TaskReportContext::from_request("orchestrate", req.task_id.clone(), state.is_managed());
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting orchestration execution")
            .with_stage("orchestrate")
            .with_progress(Some(0)),
    );
    let result: Result<ExecuteOrchestrationResponse, ApiError> = async {
        let plan_root = req
            .base_dir
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));
        let (plan, inventory) = orchestrator::load_plan_from_value(req.plan.clone(), &plan_root)
            .map_err(ApiError::from)?;
        let plan_value = serde_json::to_value(&plan).map_err(ApiError::from)?;
        let inventory_value = serde_json::to_value(&inventory).map_err(ApiError::from)?;
        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Orchestration plan loaded")
                .with_stage("orchestrate")
                .with_progress(Some(15))
                .with_details(Some(json!({
                    "plan_name": plan.name,
                    "stages": plan.stages.len()
                }))),
        );

        if req.dry_run.unwrap_or(false) {
            return Ok(ExecuteOrchestrationResponse {
                plan: plan_value,
                inventory: inventory_value,
                orchestration_result: None,
            });
        }

        let event_state = state.clone();
        let event_ctx = task_ctx.clone();
        let event_hook: orchestrator::OrchestrationEventHook = Arc::new(move |event| {
            emit_task_event(
                &event_state,
                &event_ctx,
                TaskEventInput {
                    event_type: event.event_type,
                    message: event.message,
                    level: event.level,
                    stage: event.stage,
                    progress: event.progress,
                    details: event.details,
                },
            );
        });

        let orchestration_result = orchestrator::execute_loaded_plan_with_events(
            &plan,
            &inventory,
            &plan_root,
            &state.defaults,
            to_cli_record_level(req.record_level),
            Some(event_hook),
        )
        .await
        .map_err(ApiError::from)?;

        Ok(ExecuteOrchestrationResponse {
            plan: plan_value,
            inventory: inventory_value,
            orchestration_result: Some(
                serde_json::to_value(&orchestration_result).map_err(ApiError::from)?,
            ),
        })
    }
    .await;
    drop(task_guard);
    match &result {
        Ok(response) => {
            let succeeded = response
                .orchestration_result
                .as_ref()
                .and_then(|value| value.get("success"))
                .and_then(Value::as_bool)
                .unwrap_or(true);
            let event = if succeeded {
                TaskEventInput::new("completed", "Orchestration completed")
                    .with_stage("orchestrate")
                    .with_level("success")
                    .with_progress(Some(100))
                    .with_details(serde_json::to_value(response).ok())
            } else {
                TaskEventInput::new("failed", "Orchestration finished with failure")
                    .with_stage("orchestrate")
                    .with_level("error")
                    .with_progress(Some(100))
                    .with_details(serde_json::to_value(response).ok())
            };
            emit_task_event(&state, &task_ctx, event);
        }
        Err(err) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("failed", format!("Orchestration failed: {}", err.message))
                .with_stage("orchestrate")
                .with_level("error"),
        ),
    }
    if let (Some(task_ctx_ref), Ok(response)) = (task_ctx.as_ref(), &result) {
        let succeeded = response
            .orchestration_result
            .as_ref()
            .and_then(|value| value.get("success"))
            .and_then(Value::as_bool)
            .unwrap_or(true);
        if !succeeded {
            let callback = build_failed_task_callback(
                &state,
                task_ctx_ref,
                "Orchestration finished with failure",
                Some(response),
            );
            spawn_prepared_task_callback(state, task_ctx, callback);
            return result.map(Json);
        }
    }
    spawn_task_callback(state, task_ctx, &result);
    result.map(Json)
}

pub async fn execute_orchestration_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteOrchestrationRequest>,
) -> Result<(StatusCode, Json<AsyncTaskAcceptedResponse>), ApiError> {
    let response = queue_orchestration_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(response)))
}

pub async fn replay_session(
    Json(req): Json<ReplayRequest>,
) -> Result<Json<ReplayResponse>, ApiError> {
    let mut replayer = SessionReplayer::from_jsonl(&req.jsonl).map_err(ApiError::from)?;
    let context = replayer.initial_context().map(|ctx| ReplayContextDto {
        device_addr: ctx.device_addr,
        prompt: ctx.prompt,
        fsm_prompt: ctx.fsm_prompt,
    });

    let entries = if req.list {
        let recorder = SessionRecorder::from_jsonl(&req.jsonl).map_err(ApiError::from)?;
        recorder.entries().map_err(ApiError::from)?
    } else {
        Vec::new()
    };

    let output = if let Some(command) = req.command.as_deref() {
        let out = if let Some(mode) = req.mode.as_deref() {
            replayer.replay_next_in_mode(command, mode)
        } else {
            replayer.replay_next(command)
        }
        .map_err(ApiError::from)?;
        Some(ReplayOutputDto {
            success: out.success,
            content: out.content,
            all: out.all,
            prompt: out.prompt,
        })
    } else {
        None
    };

    Ok(Json(ReplayResponse {
        context,
        entries,
        output,
    }))
}

#[cfg(test)]
mod tests {
    use super::{
        TaskReportContext, merged_saved_secret, require_managed_async_task,
        saved_connection_detail_response, should_persist_secret,
    };
    use crate::config::connection_store::SavedConnection;
    use crate::config::ssh_security::SshSecurityProfile;
    use std::path::PathBuf;

    #[test]
    fn saved_connection_detail_response_redacts_secrets() {
        let detail = saved_connection_detail_response(
            "lab1",
            &PathBuf::from("/tmp/lab1.toml"),
            &SavedConnection {
                host: Some("192.0.2.10".to_string()),
                username: Some("admin".to_string()),
                password: Some("secret".to_string()),
                password_encrypted: None,
                port: Some(22),
                enable_password: Some("enable-secret".to_string()),
                enable_password_encrypted: None,
                ssh_security: Some(SshSecurityProfile::Balanced),
                device_profile: Some("cisco_ios".to_string()),
                template_dir: Some("/tmp/templates".to_string()),
            },
        );

        assert!(detail.has_password);
        assert_eq!(detail.connection.connection_name.as_deref(), Some("lab1"));
        assert_eq!(detail.connection.host.as_deref(), Some("192.0.2.10"));
        assert_eq!(detail.connection.username.as_deref(), Some("admin"));
        assert_eq!(detail.connection.port, Some(22));
        assert_eq!(
            detail.connection.ssh_security,
            Some(SshSecurityProfile::Balanced)
        );
        assert_eq!(
            detail.connection.device_profile.as_deref(),
            Some("cisco_ios")
        );
        assert_eq!(
            detail.connection.template_dir.as_deref(),
            Some("/tmp/templates")
        );
        assert_eq!(detail.connection.password, None);
        assert_eq!(detail.connection.enable_password, None);
    }

    #[test]
    fn merged_saved_secret_preserves_existing_secret_when_request_is_blank() {
        let existing = "stored-secret".to_string();
        assert_eq!(
            merged_saved_secret(true, None, Some(&existing)),
            Some("stored-secret".to_string())
        );
        assert_eq!(
            merged_saved_secret(true, Some("new-secret".to_string()), Some(&existing)),
            Some("new-secret".to_string())
        );
        assert_eq!(merged_saved_secret(false, None, Some(&existing)), None);
    }

    #[test]
    fn explicit_secret_input_implies_secret_should_be_persisted() {
        assert!(should_persist_secret(false, Some("secret")));
        assert!(should_persist_secret(true, None));
        assert!(!should_persist_secret(false, None));
        assert!(!should_persist_secret(false, Some("   ")));
    }

    #[test]
    fn managed_mode_allows_task_callback_with_task_id_only() {
        let managed = TaskReportContext::from_request("exec", Some("task-1".to_string()), true);
        assert!(managed.is_some());

        let local = TaskReportContext::from_request("exec", Some("task-1".to_string()), false);
        assert!(local.is_none());
    }

    #[test]
    fn managed_async_task_requires_agent_mode_and_task_id() {
        assert!(require_managed_async_task("tx_block", Some("task-1".to_string()), true).is_ok());
        assert!(require_managed_async_task("tx_block", Some("   ".to_string()), true).is_err());
        assert!(require_managed_async_task("tx_block", None, true).is_err());
        assert!(require_managed_async_task("tx_block", Some("task-1".to_string()), false).is_err());
    }
}
