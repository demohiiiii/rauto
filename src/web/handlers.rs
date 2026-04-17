use crate::agent::registration::{AsyncErrorReportInput, current_agent_name};
use crate::cli::RecordLevelOpt;
use crate::config::command_blacklist;
use crate::config::command_flow_template::{
    CommandFlowTemplate, CommandFlowTemplateVar, ParsedCommandFlowTemplate,
    build_command_flow_runtime, command_flow_var_kind_label, normalize_command_flow_template_body,
    parse_command_flow_template_str, parse_command_flow_template_with_extensions,
    resolve_command_flow_runtime_default_mode,
};
use crate::config::command_flow_vars::{
    ConnectionParamContext, resolve_command_flow_runtime_vars, resolve_runtime_var_aliases,
};
use crate::config::device_profile::DeviceProfile;
use crate::config::inventory_store;
use crate::config::template_connection_refs::{
    enrich_context_with_connection_refs_from_template,
    enrich_context_with_connection_refs_from_value,
};
use crate::config::template_loader;
use crate::config::{
    backup, connection_import, connection_store, connection_store::SavedConnection, content_store,
    task_store,
};
use crate::config::{history_store, history_store::HistoryBinding};
use crate::device::DeviceClient;
use crate::orchestrator;
use crate::task::{
    TaskCallback, TaskEventLevel, TaskEventType, TaskOperation, TaskResultEnvelope,
    TaskResultOutcome, TaskStatus, build_error_result_summary, build_result_summary,
    count_non_empty_lines, extract_result_summary, result_counts, result_counts_with_skipped,
    task_name_to_operation, task_result_with_counts, task_result_with_details,
    task_result_with_recording,
};
use crate::template::renderer::Renderer;
use crate::web::error::ApiError;
use crate::web::models::{
    AsyncTaskAcceptedResponse, BackupCreateRequest, BackupCreateResponse, BackupMeta,
    BackupRestoreRequest, BackupRestoreResponse, BlacklistCheckRequest, BlacklistCheckResponse,
    BlacklistDeleteResponse, BlacklistPatternEntry, BlacklistUpsertRequest,
    BlacklistUpsertResponse, BuiltinProfileDetail, CommandFlowTemplateDetail,
    CommandFlowTemplateMeta, CommandFlowTemplateVarField, CommandResult,
    ConnectionHistoryDetailResponse, ConnectionHistoryEntry, ConnectionRequest,
    ConnectionTestRequest, ConnectionTestResponse, CreateCommandFlowTemplateRequest,
    CreateTemplateRequest, CustomProfileDetail, DeviceProfileModesResponse, DeviceProfilesOverview,
    ExecRequest, ExecResponse, ExecuteCommandFlowRequest, ExecuteCommandFlowResponse,
    ExecuteOrchestrationRequest, ExecuteOrchestrationResponse, ExecuteTemplateRequest,
    ExecuteTemplateResponse, ExecuteTxBlockRequest, ExecuteTxBlockResponse,
    ExecuteTxWorkflowRequest, ExecuteTxWorkflowResponse, ExecuteUploadRequest,
    ExecuteUploadResponse, InteractiveCommandRequest, InteractiveCommandResponse,
    InteractiveStartRequest, InteractiveStartResponse, InteractiveStopResponse, InventoryGroup,
    ProfileDiagnoseRequest, ProfileDiagnoseResponse, RecordLevel, RenderRequest, RenderResponse,
    ReplayContextDto, ReplayOutputDto, ReplayRequest, ReplayResponse, ResolveInventoryVarsRequest,
    ResolveInventoryVarsResponse, SavedConnectionDetail, SavedConnectionMeta, TaskArtifactDto,
    TaskEvent, TaskEventDto, TaskRunDetailResponse, TaskRunListItem, TaskRunsQuery, TemplateDetail,
    TemplateMeta, UpdateCommandFlowTemplateRequest,
    UpdateTemplateRequest, UpsertConnectionRequest, UpsertCustomProfileRequest,
    UpsertInventoryGroupRequest,
};
use crate::web::state::{
    AppState, InteractiveSession, ResolvedConnection, merge_connection_options,
};
use crate::web::storage;
use crate::{manager_connection_request, manager_execution_context_with_security};
use axum::http::StatusCode;
use axum::{
    Json,
    extract::{Multipart, Path, Query, State},
    http::{HeaderMap, HeaderValue, header},
    response::{IntoResponse, Response},
};
use chrono::Utc;
use rneter::session::{
    MANAGER, SessionEvent, SessionRecordEntry, SessionRecordLevel, SessionRecorder,
    SessionReplayer, TxBlock,
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

#[derive(Debug, serde::Deserialize)]
pub struct ConnectionImportTemplateQuery {
    pub lang: Option<String>,
}

fn to_task_run_list_item(record: task_store::TaskRunRecord) -> TaskRunListItem {
    TaskRunListItem {
        task_id: record.task_id,
        operation: record.operation,
        status: record.status,
        outcome: record.outcome,
        summary: record.summary,
        success: record.success,
        agent_name: record.agent_name,
        source: record.source,
        target_label: record.target_label,
        started_at: record.started_at,
        completed_at: record.completed_at,
        execution_time_ms: record.execution_time_ms,
        has_recording: record.has_recording,
        has_error: record.has_error,
    }
}

fn to_task_event_dto(record: task_store::TaskEventRecord) -> TaskEventDto {
    TaskEventDto {
        seq: record.seq,
        task_id: record.task_id,
        operation: record.operation,
        event_type: record.event_type,
        level: record.level,
        stage: record.stage,
        message: record.message,
        progress: record.progress,
        details: record.details,
        occurred_at: record.occurred_at,
    }
}

fn to_task_artifact_dto(record: task_store::TaskArtifactRecord) -> TaskArtifactDto {
    TaskArtifactDto {
        id: record.id,
        artifact_type: record.artifact_type,
        name: record.name,
        storage_ref: record.storage_ref,
        content_type: record.content_type,
        size_bytes: record.size_bytes,
        content_text: record.content_text,
        created_at: record.created_at,
    }
}

#[derive(Debug, Clone)]
struct TaskReportContext {
    task_id: String,
    operation: TaskOperation,
    started_at: chrono::DateTime<Utc>,
    started_instant: Instant,
}

impl TaskReportContext {
    fn from_request(
        operation: TaskOperation,
        task_id: Option<String>,
        managed: bool,
    ) -> Option<Self> {
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
            operation,
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

fn parse_task_event_type(raw: &str) -> TaskEventType {
    TaskEventType::parse(raw).unwrap_or(TaskEventType::Log)
}

fn parse_task_event_level(raw: &str) -> TaskEventLevel {
    TaskEventLevel::parse(raw).unwrap_or(TaskEventLevel::Info)
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
        SessionEvent::TxBlockStarted { block_name } => match plan {
            RecordingEventPlan::TxBlock { .. } => Some(
                TaskEventInput::new("step_started", format!("Tx block {} started", block_name))
                    .with_stage("tx_block")
                    .with_progress(Some(60))
                    .with_details(Some(json!({
                        "block_name": block_name
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
                        "block_name": block_name
                    }))),
                )
            }
        },
        SessionEvent::TxStepSucceeded {
            block_name,
            step_index,
            mode,
            operation_summary,
            operation_steps,
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
                    "operation_summary": operation_summary,
                    "operation_steps": operation_steps
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
                    "operation_summary": operation_summary,
                    "operation_steps": operation_steps
                }))),
            ),
        },
        SessionEvent::TxStepFailed {
            block_name,
            step_index,
            mode,
            operation_summary,
            operation_steps,
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
                        "operation_summary": operation_summary,
                        "operation_steps": operation_steps,
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
                    "operation_summary": operation_summary,
                    "operation_steps": operation_steps,
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
            operation_summary,
            operation_steps,
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
                "operation_summary": operation_summary,
                "operation_steps": operation_steps
            }))),
        ),
        SessionEvent::TxRollbackStepFailed {
            block_name,
            step_index,
            mode,
            operation_summary,
            operation_steps,
            reason,
        } => Some(
            TaskEventInput::new("failed", format!("Rollback step failed for {}", block_name))
                .with_stage("rollback")
                .with_level("error")
                .with_details(Some(json!({
                    "block_name": block_name,
                    "step_index": step_index,
                    "mode": mode,
                    "operation_summary": operation_summary,
                    "operation_steps": operation_steps,
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
        SessionEvent::FileUploadStarted {
            local_path,
            remote_path,
        } => Some(
            TaskEventInput::new("progress", format!("Uploading file to {}", remote_path))
                .with_stage("file_transfer")
                .with_progress(Some(75))
                .with_details(Some(json!({
                    "local_path": local_path,
                    "remote_path": remote_path
                }))),
        ),
        SessionEvent::FileUploadFinished {
            local_path,
            remote_path,
            success,
            error,
        } => Some(
            TaskEventInput::new(
                if *success { "completed" } else { "failed" },
                if *success {
                    format!("File upload finished: {}", remote_path)
                } else {
                    format!("File upload failed: {}", remote_path)
                },
            )
            .with_stage("file_transfer")
            .with_level(if *success { "success" } else { "error" })
            .with_progress(Some(100))
            .with_details(Some(json!({
                "local_path": local_path,
                "remote_path": remote_path,
                "success": success,
                "error": error
            }))),
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
                                    event_type: parse_task_event_type(&event_input.event_type),
                                    message: event_input.message,
                                    level: parse_task_event_level(&event_input.level),
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
                                event_type: TaskEventType::Warning,
                                message: format!(
                                    "Live task event stream lagged, skipped {} recorder events",
                                    skipped
                                ),
                                level: TaskEventLevel::Warning,
                                stage: Some(task_ctx.operation.to_string()),
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
            event_type: parse_task_event_type(&event.event_type),
            message: event.message,
            level: parse_task_event_level(&event.level),
            stage: event.stage,
            progress: event.progress,
            details: event.details,
            occurred_at: Utc::now().to_rfc3339(),
        };
        if let Err(err) = task_store::append_task_event(&event.task_id, task_ctx.operation, &event)
        {
            warn!("failed to persist task event {}: {}", event.task_id, err);
        }
        registrar.report_task_event_best_effort(event).await;
    });
}

fn require_managed_async_task(
    operation: TaskOperation,
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
    operation: TaskOperation,
) -> AsyncTaskAcceptedResponse {
    if let Err(err) = task_store::save_task_accepted(&task_id, operation) {
        warn!("failed to persist accepted task {}: {}", task_id, err);
    }
    AsyncTaskAcceptedResponse {
        accepted: true,
        task_id,
        operation,
        status: TaskStatus::Queued,
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
        event_type: TaskEventType::Failed,
        message: failure_message.clone(),
        level: TaskEventLevel::Error,
        stage: Some(operation_name.to_string()),
        progress: Some(100),
        details: Some(details),
        occurred_at: Utc::now().to_rfc3339(),
    };
    registrar.report_task_event_best_effort(event).await;

    let callback = TaskCallback {
        task_id: task_id.clone(),
        agent_name,
        status: TaskStatus::Failed,
        started_at: started_at.to_rfc3339(),
        completed_at: Utc::now().to_rfc3339(),
        execution_time_ms: started_instant.elapsed().as_millis() as u64,
        result_summary: Some(build_error_result_summary(
            task_name_to_operation(&operation_name),
            failure_message.clone(),
        )),
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
    let task_id = require_managed_async_task(
        TaskOperation::Exec,
        req.task.task_id.clone(),
        state.is_managed(),
    )?;
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
    Ok(build_async_task_accepted_response(
        task_id,
        TaskOperation::Exec,
    ))
}

pub(crate) fn queue_template_async_task(
    state: Arc<AppState>,
    req: ExecuteTemplateRequest,
) -> Result<AsyncTaskAcceptedResponse, ApiError> {
    let task_id = require_managed_async_task(
        TaskOperation::TemplateExecute,
        req.task.task_id.clone(),
        state.is_managed(),
    )?;
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
        TaskOperation::TemplateExecute,
    ))
}

pub(crate) fn queue_tx_block_async_task(
    state: Arc<AppState>,
    req: ExecuteTxBlockRequest,
) -> Result<AsyncTaskAcceptedResponse, ApiError> {
    let task_id = require_managed_async_task(
        TaskOperation::TxBlock,
        req.task.task_id.clone(),
        state.is_managed(),
    )?;
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
    Ok(build_async_task_accepted_response(
        task_id,
        TaskOperation::TxBlock,
    ))
}

pub(crate) fn queue_tx_workflow_async_task(
    state: Arc<AppState>,
    req: ExecuteTxWorkflowRequest,
) -> Result<AsyncTaskAcceptedResponse, ApiError> {
    let task_id = require_managed_async_task(
        TaskOperation::TxWorkflow,
        req.task.task_id.clone(),
        state.is_managed(),
    )?;
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
    Ok(build_async_task_accepted_response(
        task_id,
        TaskOperation::TxWorkflow,
    ))
}

pub(crate) fn queue_orchestration_async_task(
    state: Arc<AppState>,
    req: ExecuteOrchestrationRequest,
) -> Result<AsyncTaskAcceptedResponse, ApiError> {
    let task_id = require_managed_async_task(
        TaskOperation::Orchestrate,
        req.task.task_id.clone(),
        state.is_managed(),
    )?;
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
    Ok(build_async_task_accepted_response(
        task_id,
        TaskOperation::Orchestrate,
    ))
}

fn build_task_callback<T: Serialize>(
    state: &Arc<AppState>,
    task_ctx: &TaskReportContext,
    result: &Result<T, ApiError>,
) -> TaskCallback {
    match result {
        Ok(value) => {
            let result_json = serde_json::to_value(value).ok();
            callback_from_result_envelope(
                state,
                TaskResultEnvelope {
                    task_id: task_ctx.task_id.clone(),
                    operation: task_ctx.operation,
                    status: TaskStatus::Success,
                    started_at: task_ctx.started_at.to_rfc3339(),
                    completed_at: Utc::now().to_rfc3339(),
                    execution_time_ms: task_ctx.started_instant.elapsed().as_millis() as u64,
                    result_summary: extract_result_summary(value).unwrap_or_else(|| {
                        build_error_result_summary(
                            task_ctx.operation,
                            "missing result_summary in successful task response",
                        )
                    }),
                    result: result_json,
                    error: None,
                },
            )
        }
        Err(err) => callback_from_result_envelope(
            state,
            TaskResultEnvelope {
                task_id: task_ctx.task_id.clone(),
                operation: task_ctx.operation,
                status: TaskStatus::Failed,
                started_at: task_ctx.started_at.to_rfc3339(),
                completed_at: Utc::now().to_rfc3339(),
                execution_time_ms: task_ctx.started_instant.elapsed().as_millis() as u64,
                result_summary: build_error_result_summary(task_ctx.operation, err.message.clone()),
                result: None,
                error: Some(err.message.clone()),
            },
        ),
    }
}

fn callback_from_result_envelope(
    state: &Arc<AppState>,
    envelope: TaskResultEnvelope,
) -> TaskCallback {
    TaskCallback {
        task_id: envelope.task_id,
        agent_name: current_agent_name(state),
        status: envelope.status,
        started_at: envelope.started_at,
        completed_at: envelope.completed_at,
        execution_time_ms: envelope.execution_time_ms,
        result_summary: Some(envelope.result_summary),
        result: envelope.result,
        error: envelope.error,
    }
}

fn build_failed_task_callback<T: Serialize>(
    state: &Arc<AppState>,
    task_ctx: &TaskReportContext,
    message: impl Into<String>,
    result: Option<&T>,
) -> TaskCallback {
    let error_message = message.into();
    callback_from_result_envelope(
        state,
        TaskResultEnvelope {
            task_id: task_ctx.task_id.clone(),
            operation: task_ctx.operation,
            status: TaskStatus::Failed,
            started_at: task_ctx.started_at.to_rfc3339(),
            completed_at: Utc::now().to_rfc3339(),
            execution_time_ms: task_ctx.started_instant.elapsed().as_millis() as u64,
            result_summary: result.and_then(extract_result_summary).unwrap_or_else(|| {
                build_error_result_summary(task_ctx.operation, error_message.clone())
            }),
            result: result.and_then(|value| serde_json::to_value(value).ok()),
            error: Some(error_message),
        },
    )
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
        if let Err(err) = task_store::save_task_callback(&callback, task_ctx.operation) {
            warn!(
                "failed to persist task callback {}: {}",
                task_ctx.task_id, err
            );
        }
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
                            .with_operation(Some(task_ctx.operation.to_string()))
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

pub async fn list_task_runs(
    Query(query): Query<TaskRunsQuery>,
) -> Result<Json<Vec<TaskRunListItem>>, ApiError> {
    let limit = query.limit.unwrap_or(50);
    let rows =
        task_store::list_task_runs(limit, query.operation.as_deref(), query.status.as_deref())
            .map_err(ApiError::from)?;
    Ok(Json(rows.into_iter().map(to_task_run_list_item).collect()))
}

pub async fn get_task_run_detail(
    Path(task_id): Path<String>,
) -> Result<Json<TaskRunDetailResponse>, ApiError> {
    let run = task_store::load_task_run(&task_id)
        .map_err(ApiError::from)?
        .ok_or_else(|| ApiError::bad_request("task not found"))?;
    let events = task_store::list_task_events(&task_id)
        .map_err(ApiError::from)?
        .into_iter()
        .map(to_task_event_dto)
        .collect::<Vec<_>>();
    let artifacts = task_store::list_task_artifacts(&task_id)
        .map_err(ApiError::from)?
        .into_iter()
        .map(to_task_artifact_dto)
        .collect::<Vec<_>>();
    Ok(Json(TaskRunDetailResponse {
        task_id: run.task_id,
        operation: run.operation,
        status: run.status,
        outcome: run.outcome,
        summary: run.summary,
        success: run.success,
        agent_name: run.agent_name,
        source: run.source,
        target_label: run.target_label,
        started_at: run.started_at,
        completed_at: run.completed_at,
        execution_time_ms: run.execution_time_ms,
        has_recording: run.has_recording,
        has_error: run.has_error,
        result_summary: run.result_summary,
        result: run.result,
        error: run.error,
        created_at: run.created_at,
        updated_at: run.updated_at,
        events,
        artifacts,
    }))
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

pub async fn download_connection_import_template(
    Query(query): Query<ConnectionImportTemplateQuery>,
) -> Result<Response, ApiError> {
    let is_zh = query.lang.as_deref().map(str::trim).is_some_and(|value| {
        value.eq_ignore_ascii_case("zh") || value.eq_ignore_ascii_case("zh-cn")
    });
    let filename = if is_zh {
        "rauto-connection-import-template-zh.csv"
    } else {
        "rauto-connection-import-template-en.csv"
    };
    let content = if is_zh {
        "\u{feff}连接名,主机地址,用户名,密码,端口,特权密码,SSH安全级别,Linux Shell,设备模板,模板目录\n"
    } else {
        "name,host,username,password,port,enable_password,ssh_security,linux_shell_flavor,device_profile,template_dir\n"
    };
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/csv; charset=utf-8"),
    );
    let disposition = format!("attachment; filename=\"{}\"", filename);
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition).map_err(ApiError::from)?,
    );
    Ok((headers, content.as_bytes().to_vec()).into_response())
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

fn normalize_command_flow_template_content(name: &str, content: &str) -> Result<String, ApiError> {
    normalize_command_flow_template_body(name, content).map_err(ApiError::from)
}

const BUILTIN_FLOW_TEMPLATE_PREFIX: &str = "builtin:";
const BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY: &str = "cisco-like-copy";

fn normalize_builtin_command_flow_template_name(raw: &str) -> String {
    raw.trim().to_ascii_lowercase().replace('_', "-")
}

fn parse_builtin_command_flow_template_token(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if !trimmed
        .get(..BUILTIN_FLOW_TEMPLATE_PREFIX.len())
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case(BUILTIN_FLOW_TEMPLATE_PREFIX))
    {
        return None;
    }
    let suffix = trimmed
        .get(BUILTIN_FLOW_TEMPLATE_PREFIX.len()..)
        .unwrap_or("");
    let normalized = normalize_builtin_command_flow_template_name(suffix);
    (!normalized.is_empty()).then_some(normalized)
}

fn builtin_command_flow_template_by_name(name: &str) -> Option<CommandFlowTemplate> {
    let normalized = normalize_builtin_command_flow_template_name(name);
    match normalized.as_str() {
        BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY => {
            let mut template = rneter_templates::cisco_like_copy_template();
            template.name = BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY.to_string();
            Some(template)
        }
        _ => None,
    }
}

fn builtin_command_flow_template_metas() -> Vec<CommandFlowTemplateMeta> {
    vec![CommandFlowTemplateMeta {
        name: BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY.to_string(),
        path: format!(
            "builtin://command-flow-templates/{}",
            BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY
        ),
    }]
}

fn to_command_flow_template_var_field(var: &CommandFlowTemplateVar) -> CommandFlowTemplateVarField {
    CommandFlowTemplateVarField {
        name: var.name.clone(),
        label: var.display_label().to_string(),
        description: var.description.clone(),
        kind: command_flow_var_kind_label(var.kind).to_string(),
        required: var.required,
        placeholder: var.placeholder.clone(),
        options: var.options.clone(),
        default_value: var.default_value.clone(),
    }
}

fn command_flow_template_detail_from_content(
    name: &str,
    content: String,
    path: String,
) -> Result<CommandFlowTemplateDetail, ApiError> {
    let template = parse_command_flow_template_str(&content, Some(name)).map_err(ApiError::from)?;
    Ok(CommandFlowTemplateDetail {
        name: name.to_string(),
        path,
        vars_schema: template
            .vars
            .iter()
            .map(to_command_flow_template_var_field)
            .collect(),
        content,
    })
}

fn command_flow_template_detail_from_template(
    template: CommandFlowTemplate,
    path: String,
) -> Result<CommandFlowTemplateDetail, ApiError> {
    let name = template.name.clone();
    let content = toml::to_string_pretty(&template).map_err(ApiError::from)?;
    command_flow_template_detail_from_content(&name, content, path)
}

pub async fn list_command_flow_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<CommandFlowTemplateMeta>>, ApiError> {
    let _ = state;
    let items = storage::list_command_flow_templates()?;
    Ok(Json(items))
}

pub async fn list_builtin_command_flow_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<CommandFlowTemplateMeta>>, ApiError> {
    let _ = state;
    Ok(Json(builtin_command_flow_template_metas()))
}

pub async fn get_command_flow_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<CommandFlowTemplateDetail>, ApiError> {
    let safe_name = storage::safe_command_flow_template_name(&name)?;
    let Some(stored) =
        content_store::load_command_flow_template(&safe_name).map_err(ApiError::from)?
    else {
        return Err(ApiError::bad_request("command flow template not found"));
    };
    Ok(Json(command_flow_template_detail_from_content(
        &safe_name,
        stored.content,
        content_store::command_flow_template_locator(&stored.name),
    )?))
}

pub async fn get_builtin_command_flow_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<CommandFlowTemplateDetail>, ApiError> {
    let normalized = parse_builtin_command_flow_template_token(&name)
        .unwrap_or_else(|| normalize_builtin_command_flow_template_name(&name));
    if normalized.is_empty() {
        return Err(ApiError::bad_request(
            "builtin command flow template name is required",
        ));
    }
    let template = builtin_command_flow_template_by_name(&normalized)
        .ok_or_else(|| ApiError::bad_request("builtin command flow template not found"))?;
    Ok(Json(command_flow_template_detail_from_template(
        template,
        format!("builtin://command-flow-templates/{normalized}"),
    )?))
}

pub async fn create_command_flow_template(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CreateCommandFlowTemplateRequest>,
) -> Result<Json<CommandFlowTemplateDetail>, ApiError> {
    let safe_name = storage::safe_command_flow_template_name(&req.name)?;
    let content = normalize_command_flow_template_content(&safe_name, &req.content)?;
    let created = content_store::create_command_flow_template(&safe_name, &content)
        .map_err(ApiError::from)?;
    if !created {
        return Err(ApiError::bad_request(
            "command flow template already exists",
        ));
    }
    Ok(Json(command_flow_template_detail_from_content(
        &safe_name,
        content,
        content_store::command_flow_template_locator(&safe_name),
    )?))
}

pub async fn update_command_flow_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
    Json(req): Json<UpdateCommandFlowTemplateRequest>,
) -> Result<Json<CommandFlowTemplateDetail>, ApiError> {
    let safe_name = storage::safe_command_flow_template_name(&name)?;
    let content = normalize_command_flow_template_content(&safe_name, &req.content)?;
    let updated = content_store::update_command_flow_template(&safe_name, &content)
        .map_err(ApiError::from)?;
    if !updated {
        return Err(ApiError::bad_request("command flow template not found"));
    }
    Ok(Json(command_flow_template_detail_from_content(
        &safe_name,
        content,
        content_store::command_flow_template_locator(&safe_name),
    )?))
}

pub async fn delete_command_flow_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_command_flow_template_name(&name)?;
    content_store::delete_command_flow_template(&safe_name).map_err(ApiError::from)?;
    Ok(Json(json!({"ok": true})))
}

fn normalize_json_template_content(content: &str) -> Result<String, ApiError> {
    let value: Value = serde_json::from_str(content).map_err(ApiError::from)?;
    serde_json::to_string_pretty(&value).map_err(ApiError::from)
}

fn load_json_template_from_input(
    template_name: Option<&str>,
    template_content: Option<&str>,
    inline_value: &Value,
    load_by_name: impl Fn(&str) -> Result<Option<String>, ApiError>,
    missing_error: &'static str,
) -> Result<Value, ApiError> {
    match (
        template_name
            .map(str::trim)
            .filter(|value| !value.is_empty()),
        template_content
            .map(str::trim)
            .filter(|value| !value.is_empty()),
    ) {
        (Some(name), None) => {
            let content =
                load_by_name(name)?.ok_or_else(|| ApiError::bad_request(missing_error))?;
            serde_json::from_str(&content).map_err(ApiError::from)
        }
        (None, Some(content)) => serde_json::from_str(content).map_err(ApiError::from),
        (Some(_), Some(_)) => Err(ApiError::bad_request(
            "use either template_name or template_content",
        )),
        (None, None) => Ok(inline_value.clone()),
    }
}

fn build_json_template_context(
    vars: Value,
    conn: Option<&crate::web::state::ResolvedConnection>,
) -> Value {
    let vars_for_root = vars.clone();
    let mut root = serde_json::Map::new();
    root.insert("vars".to_string(), vars_for_root);
    root.insert(
        "now".to_string(),
        json!({
            "rfc3339": Utc::now().to_rfc3339(),
            "timestamp_ms": Utc::now().timestamp_millis()
        }),
    );
    let mut flattened = serde_json::Map::new();
    if let Some(conn) = conn {
        let mut connection = json!({
            "name": conn.connection_name,
            "host": conn.host,
            "username": conn.username,
            "password": conn.password,
            "port": conn.port,
            "enable_password": conn.enable_password,
            "ssh_security": conn.ssh_security,
            "linux_shell_flavor": conn.linux_shell_flavor,
            "device_profile": conn.device_profile,
            "vars": conn.vars
        });
        if let Some(name) = conn.connection_name.as_deref()
            && let Ok(saved) = connection_store::load_connection(name)
        {
            connection["saved"] = json!({
                "enabled": saved.enabled,
                "labels": saved.labels,
                "groups": saved.groups,
                "vars": saved.vars
            });
        }
        root.insert("connection".to_string(), connection);

        if let Some(name) = conn.connection_name.as_deref()
            && !name.trim().is_empty()
        {
            flattened.insert("name".to_string(), Value::String(name.to_string()));
            flattened.insert(
                "connection_name".to_string(),
                Value::String(name.to_string()),
            );
        }
        flattened.insert("host".to_string(), Value::String(conn.host.clone()));
        flattened.insert("username".to_string(), Value::String(conn.username.clone()));
        flattened.insert("password".to_string(), Value::String(conn.password.clone()));
        flattened.insert("port".to_string(), Value::Number(conn.port.into()));
        if let Some(value) = conn.enable_password.clone() {
            flattened.insert("enable_password".to_string(), Value::String(value));
        }
        flattened.insert(
            "ssh_security".to_string(),
            Value::String(conn.ssh_security.to_string()),
        );
        if let Some(value) = conn.linux_shell_flavor {
            flattened.insert(
                "linux_shell_flavor".to_string(),
                Value::String(value.to_string()),
            );
        }
        flattened.insert(
            "device_profile".to_string(),
            Value::String(conn.device_profile.clone()),
        );
        if let Some(map) = conn.vars.as_object() {
            for (key, value) in map {
                flattened
                    .entry(key.clone())
                    .or_insert_with(|| value.clone());
            }
        }
    }
    if let Some(map) = vars.as_object() {
        for (key, value) in map {
            flattened.insert(key.clone(), value.clone());
        }
    }
    for (key, value) in flattened {
        if matches!(key.as_str(), "vars" | "connection" | "now" | "defaults") {
            continue;
        }
        root.insert(key, value);
    }
    Value::Object(root)
}

fn render_json_template_value(
    input: &Value,
    context: &mut Value,
    renderer: &Renderer<'_>,
) -> Result<Value, ApiError> {
    match input {
        Value::Object(map) => {
            let mut out = serde_json::Map::with_capacity(map.len());
            for (k, v) in map {
                out.insert(k.clone(), render_json_template_value(v, context, renderer)?);
            }
            Ok(Value::Object(out))
        }
        Value::Array(items) => {
            let mut out = Vec::with_capacity(items.len());
            for item in items {
                out.push(render_json_template_value(item, context, renderer)?);
            }
            Ok(Value::Array(out))
        }
        Value::String(text) => {
            if !text.contains("{{") && !text.contains("{%") {
                return Ok(Value::String(text.clone()));
            }
            enrich_context_with_connection_refs_from_template(context, text)
                .map_err(ApiError::from)?;
            let rendered = renderer
                .render_string(text, context.clone())
                .map_err(ApiError::from)?;
            let trimmed = rendered.trim();
            if trimmed.is_empty() {
                return Ok(Value::String(rendered));
            }
            if let Ok(parsed) = serde_json::from_str::<Value>(trimmed) {
                return Ok(parsed);
            }
            Ok(Value::String(rendered))
        }
        _ => Ok(input.clone()),
    }
}

pub async fn list_tx_block_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<TemplateMeta>>, ApiError> {
    let _ = state;
    let items = storage::list_tx_block_templates()?;
    Ok(Json(items))
}

pub async fn get_tx_block_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    let Some(stored) = content_store::load_tx_block_template(&safe_name).map_err(ApiError::from)?
    else {
        return Err(ApiError::bad_request("tx block template not found"));
    };
    Ok(Json(TemplateDetail {
        name: safe_name,
        path: stored.locator,
        content: stored.content,
    }))
}

pub async fn create_tx_block_template(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CreateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&req.name)?;
    let content = normalize_json_template_content(&req.content)?;
    let created =
        content_store::create_tx_block_template(&safe_name, &content).map_err(ApiError::from)?;
    if !created {
        return Err(ApiError::bad_request("tx block template already exists"));
    }
    Ok(Json(TemplateDetail {
        name: safe_name.clone(),
        path: content_store::tx_block_template_locator(&safe_name),
        content,
    }))
}

pub async fn update_tx_block_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
    Json(req): Json<UpdateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    let content = normalize_json_template_content(&req.content)?;
    let updated =
        content_store::update_tx_block_template(&safe_name, &content).map_err(ApiError::from)?;
    if !updated {
        return Err(ApiError::bad_request("tx block template not found"));
    }
    Ok(Json(TemplateDetail {
        name: safe_name.clone(),
        path: content_store::tx_block_template_locator(&safe_name),
        content,
    }))
}

pub async fn delete_tx_block_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    content_store::delete_tx_block_template(&safe_name).map_err(ApiError::from)?;
    Ok(Json(json!({"ok": true})))
}

pub async fn list_tx_workflow_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<TemplateMeta>>, ApiError> {
    let _ = state;
    let items = storage::list_tx_workflow_templates()?;
    Ok(Json(items))
}

pub async fn get_tx_workflow_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    let Some(stored) =
        content_store::load_tx_workflow_template(&safe_name).map_err(ApiError::from)?
    else {
        return Err(ApiError::bad_request("tx workflow template not found"));
    };
    Ok(Json(TemplateDetail {
        name: safe_name,
        path: stored.locator,
        content: stored.content,
    }))
}

pub async fn create_tx_workflow_template(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CreateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&req.name)?;
    let content = normalize_json_template_content(&req.content)?;
    let created =
        content_store::create_tx_workflow_template(&safe_name, &content).map_err(ApiError::from)?;
    if !created {
        return Err(ApiError::bad_request("tx workflow template already exists"));
    }
    Ok(Json(TemplateDetail {
        name: safe_name.clone(),
        path: content_store::tx_workflow_template_locator(&safe_name),
        content,
    }))
}

pub async fn update_tx_workflow_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
    Json(req): Json<UpdateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    let content = normalize_json_template_content(&req.content)?;
    let updated =
        content_store::update_tx_workflow_template(&safe_name, &content).map_err(ApiError::from)?;
    if !updated {
        return Err(ApiError::bad_request("tx workflow template not found"));
    }
    Ok(Json(TemplateDetail {
        name: safe_name.clone(),
        path: content_store::tx_workflow_template_locator(&safe_name),
        content,
    }))
}

pub async fn delete_tx_workflow_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    content_store::delete_tx_workflow_template(&safe_name).map_err(ApiError::from)?;
    Ok(Json(json!({"ok": true})))
}

pub async fn list_orchestration_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<TemplateMeta>>, ApiError> {
    let _ = state;
    let items = storage::list_orchestration_templates()?;
    Ok(Json(items))
}

pub async fn get_orchestration_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    let Some(stored) =
        content_store::load_orchestration_template(&safe_name).map_err(ApiError::from)?
    else {
        return Err(ApiError::bad_request("orchestration template not found"));
    };
    Ok(Json(TemplateDetail {
        name: safe_name,
        path: stored.locator,
        content: stored.content,
    }))
}

pub async fn create_orchestration_template(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CreateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&req.name)?;
    let content = normalize_json_template_content(&req.content)?;
    let created = content_store::create_orchestration_template(&safe_name, &content)
        .map_err(ApiError::from)?;
    if !created {
        return Err(ApiError::bad_request(
            "orchestration template already exists",
        ));
    }
    Ok(Json(TemplateDetail {
        name: safe_name.clone(),
        path: content_store::orchestration_template_locator(&safe_name),
        content,
    }))
}

pub async fn update_orchestration_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
    Json(req): Json<UpdateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    let content = normalize_json_template_content(&req.content)?;
    let updated = content_store::update_orchestration_template(&safe_name, &content)
        .map_err(ApiError::from)?;
    if !updated {
        return Err(ApiError::bad_request("orchestration template not found"));
    }
    Ok(Json(TemplateDetail {
        name: safe_name.clone(),
        path: content_store::orchestration_template_locator(&safe_name),
        content,
    }))
}

pub async fn delete_orchestration_template(
    State(_state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    content_store::delete_orchestration_template(&safe_name).map_err(ApiError::from)?;
    Ok(Json(json!({"ok": true})))
}

fn load_command_flow_template_form(name: &str) -> Result<ParsedCommandFlowTemplate, ApiError> {
    if let Some(builtin_name) = parse_builtin_command_flow_template_token(name) {
        return builtin_command_flow_template_by_name(&builtin_name)
            .map(|template| ParsedCommandFlowTemplate {
                template,
                current_connection_alias: None,
            })
            .ok_or_else(|| ApiError::bad_request("builtin command flow template not found"));
    }
    let safe_name = storage::safe_command_flow_template_name(name)?;
    let stored = content_store::load_command_flow_template(&safe_name)
        .map_err(ApiError::from)?
        .ok_or_else(|| ApiError::bad_request("command flow template not found"))?;
    parse_command_flow_template_with_extensions(&stored.content, Some(&safe_name))
        .map_err(ApiError::from)
}

fn load_command_flow_template_from_input(
    template_name: Option<&str>,
    builtin_template_name: Option<&str>,
    content: Option<&str>,
    inline_name: &str,
) -> Result<ParsedCommandFlowTemplate, ApiError> {
    let template_name = template_name
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let builtin_template_name = builtin_template_name
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let content = content.map(str::trim).filter(|value| !value.is_empty());

    match (template_name, builtin_template_name, content) {
        (Some(_), Some(_), _) => Err(ApiError::bad_request(
            "use either template_name or builtin_template_name for command flow execution",
        )),
        (Some(_), None, Some(_)) | (None, Some(_), Some(_)) => Err(ApiError::bad_request(
            "use either template_name/builtin_template_name or content for command flow execution",
        )),
        (Some(name), None, None) => load_command_flow_template_form(name),
        (None, Some(name), None) => builtin_command_flow_template_by_name(name)
            .map(|template| ParsedCommandFlowTemplate {
                template,
                current_connection_alias: None,
            })
            .ok_or_else(|| ApiError::bad_request("builtin command flow template not found")),
        (None, None, Some(content)) => {
            let mut parsed = parse_command_flow_template_with_extensions(content, None)
                .map_err(ApiError::from)?;
            if parsed.template.name.trim().is_empty() {
                parsed.template.name = inline_name.to_string();
            }
            Ok(parsed)
        }
        (None, None, None) => Err(ApiError::bad_request(
            "command flow execution requires template_name, builtin_template_name, or content",
        )),
    }
}

fn current_connection_param_context(conn: &ResolvedConnection) -> ConnectionParamContext {
    ConnectionParamContext::new(
        conn.connection_name.as_deref(),
        Some(&conn.host),
        Some(&conn.username),
        Some(&conn.password),
        Some(conn.port),
        conn.enable_password.as_deref(),
        Some(conn.ssh_security),
        conn.linux_shell_flavor,
        Some(&conn.device_profile),
        &conn.vars,
    )
}

fn resolve_flow_runtime_vars(
    template: &CommandFlowTemplate,
    vars: Value,
    conn: &ResolvedConnection,
    current_connection_alias: Option<&str>,
) -> Result<Value, ApiError> {
    resolve_command_flow_runtime_vars(
        template,
        vars,
        Some(current_connection_param_context(conn)),
        current_connection_alias,
    )
    .map_err(ApiError::from)
}

fn resolve_runtime_vars_with_connection(
    vars: Value,
    conn: Option<&ResolvedConnection>,
) -> Result<Value, ApiError> {
    let context = conn.map(current_connection_param_context);
    resolve_runtime_var_aliases(vars, context).map_err(ApiError::from)
}

fn resolve_template_runtime_vars_with_connection(
    vars: Value,
    conn: Option<&ResolvedConnection>,
) -> Result<Value, ApiError> {
    if !vars.is_null() && !vars.is_object() {
        return Err(ApiError::bad_request("template vars must be a JSON object"));
    }
    resolve_runtime_vars_with_connection(vars, conn)
}

fn is_sensitive_key_name(key: &str) -> bool {
    let normalized = key.trim().to_ascii_lowercase().replace('-', "_");
    normalized.contains("password")
        || normalized.contains("passwd")
        || normalized == "pass"
        || normalized.ends_with("_pass")
        || normalized.contains("secret")
        || normalized.contains("token")
        || normalized == "enable_password"
        || normalized.contains("private_key")
}

fn collect_sensitive_strings(value: &Value, parent_key: Option<&str>, out: &mut Vec<String>) {
    match value {
        Value::Object(map) => {
            for (key, item) in map {
                collect_sensitive_strings(item, Some(key), out);
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_sensitive_strings(item, parent_key, out);
            }
        }
        Value::String(text) => {
            if let Some(key) = parent_key
                && is_sensitive_key_name(key)
                && !text.trim().is_empty()
            {
                out.push(text.clone());
            }
        }
        _ => {}
    }
}

fn sanitize_rendered_output_for_response(rendered: &str, context: &Value) -> String {
    let mut secrets = Vec::new();
    collect_sensitive_strings(context, None, &mut secrets);
    if secrets.is_empty() {
        return rendered.to_string();
    }
    secrets.sort_by(|a, b| b.len().cmp(&a.len()));
    secrets.dedup();
    let mut masked = rendered.to_string();
    for secret in secrets {
        if secret.trim().is_empty() {
            continue;
        }
        masked = masked.replace(&secret, "******");
    }
    masked
}

fn has_non_empty_object(value: &Value) -> bool {
    value
        .as_object()
        .map(|map| !map.is_empty())
        .unwrap_or(false)
}

fn resolve_render_connection_context_fallback(
    defaults: &crate::cli::GlobalOpts,
    incoming: Option<ConnectionRequest>,
) -> Option<ResolvedConnection> {
    let incoming = incoming.unwrap_or(ConnectionRequest {
        connection_name: None,
        host: None,
        username: None,
        password: None,
        port: None,
        enable_password: None,
        ssh_security: None,
        linux_shell_flavor: None,
        device_profile: None,
        template_dir: None,
        enabled: true,
        labels: vec![],
        groups: vec![],
        vars: serde_json::json!({}),
    });

    let connection_name = incoming
        .connection_name
        .clone()
        .or_else(|| defaults.connection.clone());

    let saved_raw = connection_name
        .as_ref()
        .and_then(|name| connection_store::load_connection_raw(name).ok());

    let vars = if has_non_empty_object(&incoming.vars) {
        incoming.vars.clone()
    } else {
        saved_raw
            .as_ref()
            .map(|saved| saved.vars.clone())
            .filter(has_non_empty_object)
            .unwrap_or_else(|| serde_json::json!({}))
    };

    let host = incoming
        .host
        .clone()
        .or_else(|| saved_raw.as_ref().and_then(|saved| saved.host.clone()))
        .or_else(|| defaults.host.clone())
        .unwrap_or_default();

    let username = incoming
        .username
        .clone()
        .or_else(|| saved_raw.as_ref().and_then(|saved| saved.username.clone()))
        .or_else(|| defaults.username.clone())
        .unwrap_or_else(|| "admin".to_string());

    let password = incoming
        .password
        .clone()
        .or_else(|| defaults.password.clone())
        .unwrap_or_default();

    let port = incoming
        .port
        .or_else(|| saved_raw.as_ref().and_then(|saved| saved.port))
        .or(defaults.port)
        .unwrap_or(22);

    let enable_password = incoming
        .enable_password
        .clone()
        .or_else(|| defaults.enable_password.clone());

    let ssh_security = incoming
        .ssh_security
        .or_else(|| saved_raw.as_ref().and_then(|saved| saved.ssh_security))
        .or(defaults.ssh_security)
        .unwrap_or_default();

    let linux_shell_flavor = incoming
        .linux_shell_flavor
        .or_else(|| {
            saved_raw
                .as_ref()
                .and_then(|saved| saved.linux_shell_flavor)
        })
        .or(defaults.linux_shell_flavor);

    let device_profile = incoming
        .device_profile
        .clone()
        .or_else(|| {
            saved_raw
                .as_ref()
                .and_then(|saved| saved.device_profile.clone())
        })
        .or_else(|| defaults.device_profile.clone())
        .unwrap_or_else(|| template_loader::DEFAULT_DEVICE_PROFILE.to_string());

    if connection_name.is_none() && host.trim().is_empty() && !has_non_empty_object(&vars) {
        return None;
    }

    Some(ResolvedConnection {
        connection_name,
        host,
        username,
        password,
        port,
        enable_password,
        ssh_security,
        linux_shell_flavor,
        device_profile,
        vars,
    })
}

fn render_commands_with_runtime_context(
    template_name: &str,
    vars: Value,
    conn: Option<&ResolvedConnection>,
) -> Result<(String, String), ApiError> {
    let resolved_vars = resolve_template_runtime_vars_with_connection(vars, conn)?;
    let mut render_context = build_json_template_context(resolved_vars, conn);
    if let Some(stored) =
        content_store::load_command_template(template_name).map_err(ApiError::from)?
    {
        enrich_context_with_connection_refs_from_template(&mut render_context, &stored.content)
            .map_err(ApiError::from)?;
    }
    let renderer = Renderer::new();
    let rendered = renderer
        .render_file(template_name, render_context.clone())
        .map_err(ApiError::from)?;
    let masked = sanitize_rendered_output_for_response(&rendered, &render_context);
    Ok((rendered, masked))
}

#[derive(Debug, serde::Deserialize)]
struct TxWorkflowBlockTemplateRefPayload {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    fail_fast: Option<bool>,
    #[serde(default)]
    tx_block_template_name: Option<String>,
    #[serde(default)]
    tx_block_template_content: Option<String>,
    #[serde(default)]
    tx_block_template_vars: Value,
}

fn resolve_tx_block_value_from_input(
    tx_block: Value,
    template_name: Option<&str>,
    template_content: Option<&str>,
    template_vars: Value,
    conn: Option<&ResolvedConnection>,
) -> Result<Value, ApiError> {
    let has_template_name = template_name
        .map(str::trim)
        .is_some_and(|value| !value.is_empty());
    let has_template_content = template_content
        .map(str::trim)
        .is_some_and(|value| !value.is_empty());

    if !has_template_name && !has_template_content {
        if tx_block.is_null() {
            return Err(ApiError::bad_request(
                "tx_block JSON is required when no tx block template is provided",
            ));
        }
        return Ok(tx_block);
    }

    let source = load_json_template_from_input(
        template_name,
        template_content,
        &Value::Null,
        |name| {
            let safe_name = storage::safe_json_template_name(name)?;
            let content = content_store::load_tx_block_template(&safe_name)
                .map_err(ApiError::from)?
                .map(|item| item.content);
            Ok(content)
        },
        "tx block template not found",
    )?;
    let renderer = Renderer::new();
    let resolved_template_vars = resolve_runtime_vars_with_connection(template_vars, conn)?;
    let mut context = build_json_template_context(resolved_template_vars, conn);
    enrich_context_with_connection_refs_from_value(&mut context, &source)
        .map_err(ApiError::from)?;
    render_json_template_value(&source, &mut context, &renderer)
}

fn tx_block_primary_mode(tx_block: &TxBlock) -> String {
    tx_block
        .steps
        .first()
        .and_then(|step| step.run.summary().ok())
        .map(|summary| summary.mode)
        .unwrap_or_else(|| "-".to_string())
}

fn build_tx_block_from_request(
    req: ExecuteTxBlockRequest,
    conn: Option<&ResolvedConnection>,
) -> Result<(TxBlock, String, String), ApiError> {
    let tx_block_value = resolve_tx_block_value_from_input(
        req.tx_block,
        req.tx_block_template_name.as_deref(),
        req.tx_block_template_content.as_deref(),
        req.tx_block_template_vars,
        conn,
    )?;
    let tx_block: TxBlock = serde_json::from_value(tx_block_value).map_err(ApiError::from)?;
    tx_block.validate().map_err(ApiError::from)?;
    let block_name = if tx_block.name.trim().is_empty() {
        "tx-block".to_string()
    } else {
        tx_block.name.clone()
    };
    let effective_mode = tx_block_primary_mode(&tx_block);
    Ok((tx_block, effective_mode, block_name))
}

fn resolve_tx_workflow_blocks_from_templates(
    workflow: Value,
    conn: Option<&ResolvedConnection>,
) -> Result<Value, ApiError> {
    let mut root = match workflow {
        Value::Object(map) => map,
        other => return Ok(other),
    };
    let blocks = root
        .get("blocks")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if blocks.is_empty() {
        return Ok(Value::Object(root));
    }

    let mut resolved_blocks = Vec::with_capacity(blocks.len());
    for block in blocks {
        let Some(block_obj) = block.as_object() else {
            resolved_blocks.push(block);
            continue;
        };
        let has_template_name = block_obj
            .get("tx_block_template_name")
            .and_then(Value::as_str)
            .map(str::trim)
            .is_some_and(|value| !value.is_empty());
        let has_template_content = block_obj
            .get("tx_block_template_content")
            .and_then(Value::as_str)
            .map(str::trim)
            .is_some_and(|value| !value.is_empty());
        if !has_template_name && !has_template_content {
            resolved_blocks.push(block);
            continue;
        }

        let block_ref: TxWorkflowBlockTemplateRefPayload =
            serde_json::from_value(Value::Object(block_obj.clone())).map_err(ApiError::from)?;
        let rendered_value = resolve_tx_block_value_from_input(
            Value::Null,
            block_ref.tx_block_template_name.as_deref(),
            block_ref.tx_block_template_content.as_deref(),
            block_ref.tx_block_template_vars,
            conn,
        )?;
        let mut tx_block: TxBlock =
            serde_json::from_value(rendered_value).map_err(ApiError::from)?;
        if let Some(name) = block_ref.name.filter(|value| !value.trim().is_empty()) {
            tx_block.name = name;
        }
        if let Some(fail_fast) = block_ref.fail_fast {
            tx_block.fail_fast = fail_fast;
        }
        tx_block.validate().map_err(ApiError::from)?;
        resolved_blocks.push(serde_json::to_value(&tx_block).map_err(ApiError::from)?);
    }

    root.insert("blocks".to_string(), Value::Array(resolved_blocks));
    Ok(Value::Object(root))
}

fn resolve_tx_block_request_from_template(
    req: ExecuteTxBlockRequest,
    defaults: &crate::cli::GlobalOpts,
) -> Result<ExecuteTxBlockRequest, ApiError> {
    let connection_for_context =
        merge_connection_options(defaults, req.target.connection.clone()).ok();
    let rendered_value = resolve_tx_block_value_from_input(
        req.tx_block,
        req.tx_block_template_name.as_deref(),
        req.tx_block_template_content.as_deref(),
        req.tx_block_template_vars.clone(),
        connection_for_context.as_ref(),
    )?;
    Ok(ExecuteTxBlockRequest {
        tx_block_template_name: None,
        tx_block_template_content: None,
        tx_block_template_vars: Value::Null,
        tx_block: rendered_value,
        run: req.run,
        target: req.target,
        task: req.task,
    })
}

fn persist_history_jsonl(
    conn: &crate::web::state::ResolvedConnection,
    operation: &str,
    command_label: &str,
    mode: Option<&str>,
    level: Option<RecordLevel>,
    jsonl: &str,
) {
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
        jsonl,
    ) {
        warn!("failed to persist execution history: {}", e);
    }
}

pub async fn render_template(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RenderRequest>,
) -> Result<Json<RenderResponse>, ApiError> {
    let incoming_connection = req.connection.clone();
    let resolved_conn = match merge_connection_options(&state.defaults, incoming_connection.clone())
    {
        Ok(conn) => Some(conn),
        Err(err) => {
            let fallback =
                resolve_render_connection_context_fallback(&state.defaults, incoming_connection);
            if fallback.is_none() {
                warn!("render template context fallback skipped: {:?}", err);
            }
            fallback
        }
    };
    let _ = req.template_dir.as_ref();
    let (_, masked_rendered) =
        render_commands_with_runtime_context(&req.template, req.vars, resolved_conn.as_ref())?;

    Ok(Json(RenderResponse {
        rendered_commands: masked_rendered,
    }))
}

fn to_record_level(level: Option<RecordLevel>) -> Option<SessionRecordLevel> {
    match level {
        Some(RecordLevel::KeyEventsOnly) => Some(SessionRecordLevel::KeyEventsOnly),
        Some(RecordLevel::Full) => Some(SessionRecordLevel::Full),
        None => Some(SessionRecordLevel::KeyEventsOnly),
    }
}

fn to_cli_record_level(level: Option<RecordLevel>) -> RecordLevelOpt {
    match level {
        Some(RecordLevel::KeyEventsOnly) | None => RecordLevelOpt::KeyEventsOnly,
        Some(RecordLevel::Full) => RecordLevelOpt::Full,
    }
}

fn record_level_name(level: Option<RecordLevel>) -> &'static str {
    match level {
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
    let task_ctx = TaskReportContext::from_request(
        TaskOperation::Exec,
        req.task.task_id.clone(),
        state.is_managed(),
    );
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
        let record_level = req.target.record_level;
        command_blacklist::ensure_command_allowed(&req.command, "direct execution")
            .map_err(|e| ApiError::bad_request(e.to_string()))?;
        let conn = merge_connection_options(&state.defaults, req.target.connection)?;
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
        let handler = template_loader::load_device_profile_for_connection(
            &conn.device_profile,
            conn.linux_shell_flavor,
        )?;
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
        let recording_jsonl = client.recording_jsonl()?;
        Ok(ExecResponse {
            output: output.content,
            exit_code,
            result_summary: task_result_with_details(
                task_result_with_recording(
                    build_result_summary(
                        TaskOperation::Exec,
                        if exit_code.unwrap_or(0) == 0 {
                            TaskResultOutcome::Success
                        } else {
                            TaskResultOutcome::Failed
                        },
                        if exit_code.unwrap_or(0) == 0 {
                            "Command executed successfully"
                        } else {
                            "Command finished with a non-zero exit code"
                        },
                    ),
                    &recording_jsonl,
                ),
                json!({
                    "exit_code": exit_code,
                    "mode": effective_mode,
                    "command": req.command
                }),
            ),
            recording_jsonl,
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
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
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
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
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
        linux_shell_flavor: conn.linux_shell_flavor,
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
                host: data.host.clone(),
                username: data.username.clone(),
                port: data.port,
                linux_shell_flavor: data.linux_shell_flavor,
                device_profile: data.device_profile.clone(),
                enabled: data.enabled,
                labels: data.labels.clone(),
                groups: data.groups.clone(),
                vars: data.vars.clone(),
            });
        }
    }
    Ok(Json(items))
}

pub async fn import_connections(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<connection_import::ConnectionImportReport>, ApiError> {
    let mut file_name = None;
    let mut file_bytes = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::bad_request(format!("failed to read upload field: {}", e)))?
    {
        if field.name() != Some("file") {
            continue;
        }
        file_name = field.file_name().map(ToOwned::to_owned);
        file_bytes =
            Some(field.bytes().await.map_err(|e| {
                ApiError::bad_request(format!("failed to read upload file: {}", e))
            })?);
        break;
    }

    let file_name = file_name
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| ApiError::bad_request("upload file name is required"))?;
    let file_bytes = file_bytes.ok_or_else(|| ApiError::bad_request("upload file is required"))?;

    let report = connection_import::import_connections_from_bytes(&file_name, &file_bytes)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    if report.imported > 0
        && let Some(registrar) = state.registrar()
        && let Err(err) = registrar.trigger_device_inventory_sync_if_changed(5).await
    {
        warn!(
            "failed to schedule device inventory sync after connection import: {}",
            err
        );
    }

    Ok(Json(report))
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
            linux_shell_flavor: data.linux_shell_flavor,
            device_profile: data.device_profile.clone(),
            template_dir: data.template_dir.clone(),
            enabled: data.enabled,
            labels: data.labels.clone(),
            groups: data.groups.clone(),
            vars: data.vars.clone(),
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
            .and_then(|item| item.password_ref.as_deref()),
    )
    .map_err(ApiError::from)?;
    let existing_enable_password = connection_store::load_saved_secret(
        existing
            .as_ref()
            .and_then(|item| item.enable_password_ref.as_deref()),
    )
    .map_err(ApiError::from)?;
    let data = SavedConnection {
        host: c.host,
        username: c.username,
        password: merged_saved_secret(save_password, c.password, existing_password.as_ref()),
        password_ref: None,
        port: c.port,
        enable_password: merged_saved_secret(
            save_password,
            c.enable_password,
            existing_enable_password.as_ref(),
        ),
        enable_password_ref: None,
        ssh_security: c
            .ssh_security
            .or_else(|| existing.as_ref().and_then(|item| item.ssh_security)),
        linux_shell_flavor: c
            .linux_shell_flavor
            .or_else(|| existing.as_ref().and_then(|item| item.linux_shell_flavor)),
        device_profile: c.device_profile,
        template_dir: c.template_dir,
        enabled: c.enabled,
        labels: c.labels,
        groups: c.groups,
        vars: c.vars,
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

pub async fn list_inventory_groups() -> Result<Json<Vec<InventoryGroup>>, ApiError> {
    let items = inventory_store::list_groups().map_err(ApiError::from)?;
    Ok(Json(items))
}

pub async fn get_inventory_group(
    Path(name): Path<String>,
) -> Result<Json<InventoryGroup>, ApiError> {
    let item = inventory_store::get_group(&name)
        .map_err(ApiError::from)?
        .ok_or_else(|| ApiError::bad_request("inventory group not found"))?;
    Ok(Json(item))
}

pub async fn upsert_inventory_group(
    Path(name): Path<String>,
    Json(req): Json<UpsertInventoryGroupRequest>,
) -> Result<Json<InventoryGroup>, ApiError> {
    inventory_store::upsert_group(&name, &req.group).map_err(ApiError::from)?;
    let item = inventory_store::get_group(&name)
        .map_err(ApiError::from)?
        .ok_or_else(|| ApiError::internal("inventory group was not persisted"))?;
    Ok(Json(item))
}

pub async fn delete_inventory_group(Path(name): Path<String>) -> Result<Json<Value>, ApiError> {
    let deleted = inventory_store::delete_group(&name).map_err(ApiError::from)?;
    Ok(Json(json!({ "ok": true, "deleted": deleted })))
}

pub async fn resolve_inventory_vars(
    Json(req): Json<ResolveInventoryVarsRequest>,
) -> Result<Json<ResolveInventoryVarsResponse>, ApiError> {
    let resolution =
        inventory_store::resolve_vars(req.host_name.as_deref(), &req.group_names, req.runtime_vars)
            .map_err(ApiError::from)?;
    Ok(Json(ResolveInventoryVarsResponse { resolution }))
}

pub async fn execute_template(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTemplateRequest>,
) -> Result<Json<ExecuteTemplateResponse>, ApiError> {
    let task_ctx = TaskReportContext::from_request(
        TaskOperation::TemplateExecute,
        req.task.task_id.clone(),
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
        let record_level = req.target.record_level;
        let dry_run = req.run.dry_run.unwrap_or(false);
        let incoming_connection = req.target.connection.clone();
        let render_conn = if dry_run {
            merge_connection_options(&state.defaults, incoming_connection.clone()).ok()
        } else {
            Some(merge_connection_options(
                &state.defaults,
                incoming_connection.clone(),
            )?)
        };
        let _ = req.template_dir.as_ref();
        let (rendered_commands, masked_rendered_commands) = render_commands_with_runtime_context(
            &req.template,
            req.vars,
            render_conn.as_ref(),
        )?;
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

        if dry_run {
            let rendered_count = count_non_empty_lines(&rendered_commands);
                return Ok(ExecuteTemplateResponse {
                result_summary: task_result_with_details(
                    task_result_with_counts(
                        build_result_summary(
                            TaskOperation::TemplateExecute,
                            TaskResultOutcome::DryRun,
                            "Template rendered successfully (dry run)",
                        ),
                        result_counts(rendered_count, 0, 0),
                    ),
                    json!({
                        "template": req.template,
                        "mode": req.mode,
                        "rendered_command_count": rendered_count
                    }),
                ),
                    rendered_commands: masked_rendered_commands,
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

        let conn = match render_conn {
            Some(conn) => conn,
            None => merge_connection_options(&state.defaults, incoming_connection)?,
        };
        let handler = template_loader::load_device_profile_for_connection(
            &conn.device_profile,
            conn.linux_shell_flavor,
        )?;
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

        let executed_count = executed.len() as u64;
        let succeeded = executed.iter().filter(|item| item.success).count() as u64;
        let failed = executed_count - succeeded;
        let recording_jsonl = client.recording_jsonl()?;
        Ok(ExecuteTemplateResponse {
            rendered_commands: masked_rendered_commands,
            executed,
            result_summary: task_result_with_details(
                task_result_with_recording(
                    task_result_with_counts(
                        build_result_summary(
                            TaskOperation::TemplateExecute,
                            if failed == 0 {
                                TaskResultOutcome::Success
                            } else if succeeded > 0 {
                                TaskResultOutcome::PartialSuccess
                            } else {
                                TaskResultOutcome::Failed
                            },
                            if failed == 0 {
                                "Template execution completed successfully"
                            } else if succeeded > 0 {
                                "Template execution completed with failed commands"
                            } else {
                                "Template execution failed for all commands"
                            },
                        ),
                        result_counts(executed_count, succeeded, failed),
                    ),
                    &recording_jsonl,
                ),
                json!({
                    "template": req.template,
                    "mode": effective_mode
                }),
            ),
            recording_jsonl,
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

pub async fn execute_command_flow(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteCommandFlowRequest>,
) -> Result<Json<ExecuteCommandFlowResponse>, ApiError> {
    let record_level = req.target.record_level;
    let conn = merge_connection_options(&state.defaults, req.target.connection)?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let profile_default_mode = template_loader::default_profile_mode(&conn.device_profile)?;

    let parsed_template = load_command_flow_template_from_input(
        req.template_name.as_deref(),
        req.builtin_template_name.as_deref(),
        req.content.as_deref(),
        "inline_flow",
    )?;
    let runtime_vars = resolve_flow_runtime_vars(
        &parsed_template.template,
        req.vars,
        &conn,
        parsed_template.current_connection_alias.as_deref(),
    )?;

    let runtime_default_mode = resolve_command_flow_runtime_default_mode(
        None,
        parsed_template.template.default_mode.as_deref(),
        &profile_default_mode,
    );
    let effective_flow_mode = runtime_default_mode
        .clone()
        .or_else(|| {
            parsed_template
                .template
                .default_mode
                .as_deref()
                .map(str::trim)
                .filter(|mode| !mode.is_empty())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| profile_default_mode.clone());

    let flow = parsed_template
        .template
        .to_command_flow(&build_command_flow_runtime(
            runtime_default_mode,
            conn.connection_name.as_deref(),
            &conn.host,
            &conn.username,
            &conn.device_profile,
            runtime_vars,
        ))
        .map_err(ApiError::from)?;

    command_blacklist::ensure_commands_allowed(
        flow.steps.iter().map(|command| command.command.as_str()),
        "command flow",
    )
    .map_err(|e| ApiError::bad_request(e.to_string()))?;
    if flow.steps.is_empty() {
        return Err(ApiError::bad_request("command flow has no steps"));
    }

    let flow_commands = flow
        .steps
        .iter()
        .map(|step| step.command.clone())
        .collect::<Vec<_>>();

    let client = if let Some(level) = to_record_level(record_level) {
        DeviceClient::connect_with_recording(
            conn.host.clone(),
            conn.port,
            conn.username.clone(),
            conn.password.clone(),
            conn.enable_password.clone(),
            handler,
            profile_default_mode.clone(),
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
            profile_default_mode.clone(),
            conn.ssh_security,
        )
        .await?
    };

    let result = client.execute_command_flow(flow).await?;
    persist_history_if_recorded(
        &conn,
        &client,
        "command_flow",
        &format!("template: {}", parsed_template.template.name),
        Some(effective_flow_mode.as_str()),
        record_level,
    );

    let outputs: Vec<CommandResult> = result
        .outputs
        .into_iter()
        .enumerate()
        .map(|(index, output)| CommandResult {
            command: flow_commands
                .get(index)
                .cloned()
                .unwrap_or_else(|| format!("step {}", index + 1)),
            success: output.success,
            exit_code: output.exit_code,
            output: Some(output.content),
            error: None,
        })
        .collect();

    let succeeded = outputs.iter().filter(|item| item.success).count() as u64;
    let failed = outputs.len() as u64 - succeeded;
    let recording_jsonl = client.recording_jsonl()?;

    Ok(Json(ExecuteCommandFlowResponse {
        success: result.success,
        template_name: parsed_template.template.name.clone(),
        result_summary: task_result_with_details(
            task_result_with_recording(
                task_result_with_counts(
                    build_result_summary(
                        TaskOperation::CommandFlow,
                        if result.success {
                            TaskResultOutcome::Success
                        } else if succeeded > 0 {
                            TaskResultOutcome::PartialSuccess
                        } else {
                            TaskResultOutcome::Failed
                        },
                        if result.success {
                            "Command flow completed successfully"
                        } else if succeeded > 0 {
                            "Command flow finished with failed steps"
                        } else {
                            "Command flow failed"
                        },
                    ),
                    result_counts(outputs.len() as u64, succeeded, failed),
                ),
                &recording_jsonl,
            ),
            json!({
                "template_name": parsed_template.template.name,
                "mode": effective_flow_mode
            }),
        ),
        outputs,
        recording_jsonl,
    }))
}

pub async fn execute_upload(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteUploadRequest>,
) -> Result<Json<ExecuteUploadResponse>, ApiError> {
    let record_level = req.target.record_level;
    let conn = merge_connection_options(&state.defaults, req.target.connection)?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let local_path = PathBuf::from(req.local_path.trim());
    if !local_path.is_file() {
        return Err(ApiError::bad_request(format!(
            "local upload file '{}' does not exist or is not a file",
            local_path.to_string_lossy()
        )));
    }

    let mut upload = rneter::session::FileUploadRequest::new(
        local_path.to_string_lossy().to_string(),
        req.remote_path.trim().to_string(),
    )
    .with_timeout_secs(req.timeout_secs.unwrap_or(300))
    .with_progress_reporting(req.show_progress);
    if let Some(buffer_size) = req.buffer_size {
        if buffer_size == 0 {
            return Err(ApiError::bad_request(
                "buffer_size must be greater than 0 when provided",
            ));
        }
        upload = upload.with_buffer_size(buffer_size);
    }

    let request = manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
        conn.enable_password.clone(),
        handler,
    );
    let context = manager_execution_context_with_security(None, conn.ssh_security);

    let recording_jsonl = if let Some(level) = to_record_level(record_level) {
        let (_sender, recorder) = MANAGER
            .get_with_recording_level_and_context(request, context.clone(), level)
            .await?;
        let handler_for_upload = template_loader::load_device_profile_for_connection(
            &conn.device_profile,
            conn.linux_shell_flavor,
        )?;
        let request = manager_connection_request(
            conn.username.clone(),
            conn.host.clone(),
            conn.port,
            conn.password.clone(),
            conn.enable_password.clone(),
            handler_for_upload,
        );
        MANAGER
            .upload_file_with_context(request, upload, context)
            .await?;
        let jsonl = recorder.to_jsonl().map_err(ApiError::from)?;
        persist_history_jsonl(
            &conn,
            "sftp_upload",
            &format!(
                "{} -> {}",
                local_path.to_string_lossy(),
                req.remote_path.trim()
            ),
            None,
            record_level,
            &jsonl,
        );
        Some(jsonl)
    } else {
        MANAGER
            .upload_file_with_context(request, upload, context)
            .await?;
        None
    };

    let local_path_str = local_path.to_string_lossy().to_string();
    let remote_path = req.remote_path.trim().to_string();
    Ok(Json(ExecuteUploadResponse {
        ok: true,
        local_path: local_path_str.clone(),
        remote_path: remote_path.clone(),
        result_summary: task_result_with_details(
            task_result_with_recording(
                build_result_summary(
                    TaskOperation::Upload,
                    TaskResultOutcome::Success,
                    "File uploaded successfully",
                ),
                &recording_jsonl,
            ),
            json!({
                "local_path": local_path_str,
                "remote_path": remote_path
            }),
        ),
        recording_jsonl,
    }))
}

pub async fn execute_tx_block(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxBlockRequest>,
) -> Result<Json<ExecuteTxBlockResponse>, ApiError> {
    let req = resolve_tx_block_request_from_template(req, &state.defaults)?;
    let task_ctx = TaskReportContext::from_request(
        TaskOperation::TxBlock,
        req.task.task_id.clone(),
        state.is_managed(),
    );
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting tx block execution")
            .with_stage("tx_block")
            .with_progress(Some(0)),
    );
    let result: Result<ExecuteTxBlockResponse, ApiError> = async {
        let conn = merge_connection_options(&state.defaults, req.target.connection.clone())?;
        let record_level = req.target.record_level;
        let requested_record_level = to_record_level(record_level);
        let live_record_level = if task_ctx.is_some() {
            requested_record_level.or(Some(SessionRecordLevel::KeyEventsOnly))
        } else {
            requested_record_level
        };
        let dry_run = req.run.dry_run.unwrap_or(false);
        let (tx_block, effective_mode, block_name) = build_tx_block_from_request(req, Some(&conn))?;
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
        if dry_run {
            return Ok(ExecuteTxBlockResponse {
                tx_block: tx_block_value,
                tx_result: None,
                recording_jsonl: None,
                result_summary: task_result_with_details(
                    task_result_with_counts(
                        build_result_summary(
                            TaskOperation::TxBlock,
                            TaskResultOutcome::DryRun,
                            "Tx block built successfully (dry run)",
                        ),
                        result_counts(tx_block.steps.len() as u64, 0, 0),
                    ),
                    json!({
                        "name": block_name,
                        "mode": effective_mode
                    }),
                ),
            });
        }

        command_blacklist::ensure_tx_block_allowed(
            &tx_block,
            &format!("tx block '{}'", block_name),
        )
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
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
        let handler = template_loader::load_device_profile_for_connection(
            &conn.device_profile,
            conn.linux_shell_flavor,
        )?;
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
            let handler_for_tx = template_loader::load_device_profile_for_connection(
                &conn.device_profile,
                conn.linux_shell_flavor,
            )?;
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
                    Some(&effective_mode),
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

        let recording_available = recording_jsonl.is_some();
        Ok(ExecuteTxBlockResponse {
            tx_block: tx_block_value,
            tx_result: Some(tx_result_value),
            recording_jsonl,
            result_summary: task_result_with_details(
                {
                    let mut summary = task_result_with_counts(
                        build_result_summary(
                            TaskOperation::TxBlock,
                            if tx_result.committed {
                                TaskResultOutcome::Success
                            } else {
                                TaskResultOutcome::Failed
                            },
                            if tx_result.committed {
                                "Tx block committed successfully"
                            } else {
                                "Tx block finished with failure"
                            },
                        ),
                        result_counts(
                            tx_block.steps.len() as u64,
                            tx_result.executed_steps as u64,
                            if tx_result.committed { 0 } else { 1 },
                        ),
                    );
                    summary.recording_available = Some(recording_available);
                    summary
                },
                json!({
                    "name": block_name,
                    "mode": effective_mode,
                    "committed": tx_result.committed,
                    "rollback_attempted": tx_result.rollback_attempted,
                    "rollback_succeeded": tx_result.rollback_succeeded,
                    "failed_step": tx_result.failed_step
                }),
            ),
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
    let task_ctx = TaskReportContext::from_request(
        TaskOperation::TxWorkflow,
        req.task.task_id.clone(),
        state.is_managed(),
    );
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting tx workflow execution")
            .with_stage("workflow")
            .with_progress(Some(0)),
    );
    let result: Result<ExecuteTxWorkflowResponse, ApiError> = async {
        let record_level = req.target.record_level;
        let requested_record_level = to_record_level(record_level);
        let live_record_level = if task_ctx.is_some() {
            requested_record_level.or(Some(SessionRecordLevel::KeyEventsOnly))
        } else {
            requested_record_level
        };
        let connection_for_context =
            merge_connection_options(&state.defaults, req.target.connection.clone()).ok();
        let workflow_source = load_json_template_from_input(
            req.workflow_template_name.as_deref(),
            req.workflow_template_content.as_deref(),
            &req.workflow,
            |name| {
                let safe_name = storage::safe_json_template_name(name)?;
                let content = content_store::load_tx_workflow_template(&safe_name)
                    .map_err(ApiError::from)?
                    .map(|item| item.content);
                Ok(content)
            },
            "tx workflow template not found",
        )?;
        let renderer = Renderer::new();
        let resolved_workflow_vars = resolve_runtime_vars_with_connection(
            req.workflow_vars.clone(),
            connection_for_context.as_ref(),
        )?;
        let mut workflow_context =
            build_json_template_context(resolved_workflow_vars, connection_for_context.as_ref());
        enrich_context_with_connection_refs_from_value(&mut workflow_context, &workflow_source)
            .map_err(ApiError::from)?;
        let workflow_value =
            render_json_template_value(&workflow_source, &mut workflow_context, &renderer)?;
        let workflow_value = resolve_tx_workflow_blocks_from_templates(
            workflow_value,
            connection_for_context.as_ref(),
        )?;
        let workflow: rneter::session::TxWorkflow =
            serde_json::from_value(workflow_value.clone()).map_err(ApiError::from)?;
        let workflow_response_value = serde_json::to_value(&workflow).map_err(ApiError::from)?;
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

        if req.run.dry_run.unwrap_or(false) {
            return Ok(ExecuteTxWorkflowResponse {
                workflow: workflow_response_value,
                tx_workflow_result: None,
                recording_jsonl: None,
                result_summary: task_result_with_details(
                    build_result_summary(
                        TaskOperation::TxWorkflow,
                        TaskResultOutcome::DryRun,
                        "Tx workflow built successfully (dry run)",
                    ),
                    json!({
                        "workflow_name": workflow.name,
                        "total_blocks": workflow.blocks.len()
                    }),
                ),
            });
        }

        command_blacklist::ensure_tx_workflow_allowed(
            &workflow,
            &format!("tx workflow '{}'", workflow.name),
        )
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

        let conn = if let Some(conn) = connection_for_context {
            conn
        } else {
            merge_connection_options(&state.defaults, req.target.connection.clone())?
        };
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
        let handler = template_loader::load_device_profile_for_connection(
            &conn.device_profile,
            conn.linux_shell_flavor,
        )?;
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
            let handler_for_tx = template_loader::load_device_profile_for_connection(
                &conn.device_profile,
                conn.linux_shell_flavor,
            )?;
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

        let succeeded_blocks = workflow_result
            .block_results
            .iter()
            .filter(|item| item.committed)
            .count() as u64;
        let failed_blocks = workflow_result.block_results.len() as u64 - succeeded_blocks;
        let recording_available = recording_jsonl.is_some();
        Ok(ExecuteTxWorkflowResponse {
            workflow: workflow_response_value,
            tx_workflow_result: Some(
                serde_json::to_value(&workflow_result).map_err(ApiError::from)?,
            ),
            recording_jsonl,
            result_summary: task_result_with_details(
                {
                    let mut summary = task_result_with_counts(
                        build_result_summary(
                            TaskOperation::TxWorkflow,
                            if workflow_result.committed {
                                TaskResultOutcome::Success
                            } else if succeeded_blocks > 0 {
                                TaskResultOutcome::PartialSuccess
                            } else {
                                TaskResultOutcome::Failed
                            },
                            if workflow_result.committed {
                                "Tx workflow committed successfully"
                            } else if succeeded_blocks > 0 {
                                "Tx workflow finished with failed blocks"
                            } else {
                                "Tx workflow failed"
                            },
                        ),
                        result_counts(
                            workflow_result.block_results.len() as u64,
                            succeeded_blocks,
                            failed_blocks,
                        ),
                    );
                    summary.recording_available = Some(recording_available);
                    summary
                },
                json!({
                    "workflow_name": workflow_result.workflow_name,
                    "committed": workflow_result.committed,
                    "rollback_attempted": workflow_result.rollback_attempted,
                    "rollback_succeeded": workflow_result.rollback_succeeded,
                    "failed_block": workflow_result.failed_block
                }),
            ),
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
    let task_ctx = TaskReportContext::from_request(
        TaskOperation::Orchestrate,
        req.task.task_id.clone(),
        state.is_managed(),
    );
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting orchestration execution")
            .with_stage("orchestrate")
            .with_progress(Some(0)),
    );
    let result: Result<ExecuteOrchestrationResponse, ApiError> = async {
        let connection_for_context =
            merge_connection_options(&state.defaults, req.target.connection.clone()).ok();
        let plan_source = load_json_template_from_input(
            req.plan_template_name.as_deref(),
            req.plan_template_content.as_deref(),
            &req.plan,
            |name| {
                let safe_name = storage::safe_json_template_name(name)?;
                let content = content_store::load_orchestration_template(&safe_name)
                    .map_err(ApiError::from)?
                    .map(|item| item.content);
                Ok(content)
            },
            "orchestration template not found",
        )?;
        let renderer = Renderer::new();
        let resolved_plan_vars = resolve_runtime_vars_with_connection(
            req.plan_vars.clone(),
            connection_for_context.as_ref(),
        )?;
        let mut plan_context =
            build_json_template_context(resolved_plan_vars, connection_for_context.as_ref());
        if let Value::Object(map) = &mut plan_context {
            map.insert(
                "defaults".to_string(),
                json!({
                    "host": state.defaults.host.clone(),
                    "username": state.defaults.username.clone(),
                    "password": state.defaults.password.clone(),
                    "port": state.defaults.port,
                    "enable_password": state.defaults.enable_password.clone(),
                    "ssh_security": state.defaults.ssh_security,
                    "linux_shell_flavor": state.defaults.linux_shell_flavor,
                    "device_profile": state.defaults.device_profile.clone(),
                    "connection": state.defaults.connection.clone()
                }),
            );
        }
        enrich_context_with_connection_refs_from_value(&mut plan_context, &plan_source)
            .map_err(ApiError::from)?;
        let rendered_plan = render_json_template_value(&plan_source, &mut plan_context, &renderer)?;
        let plan_root = req
            .base_dir
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));
        let (plan, inventory) = orchestrator::load_plan_from_value(rendered_plan, &plan_root)
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

        if req.run.dry_run.unwrap_or(false) {
            return Ok(ExecuteOrchestrationResponse {
                plan: plan_value,
                inventory: inventory_value,
                orchestration_result: None,
                result_summary: task_result_with_details(
                    task_result_with_counts(
                        build_result_summary(
                            TaskOperation::Orchestrate,
                            TaskResultOutcome::DryRun,
                            "Orchestration plan loaded successfully (dry run)",
                        ),
                        result_counts(plan.stages.len() as u64, 0, 0),
                    ),
                    json!({
                        "plan_name": plan.name,
                        "base_dir": plan_root
                    }),
                ),
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
            to_cli_record_level(req.target.record_level),
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
            result_summary: task_result_with_details(
                task_result_with_counts(
                    build_result_summary(
                        TaskOperation::Orchestrate,
                        if orchestration_result.success {
                            TaskResultOutcome::Success
                        } else {
                            TaskResultOutcome::Failed
                        },
                        if orchestration_result.success {
                            "Orchestration completed successfully"
                        } else {
                            "Orchestration finished with failure"
                        },
                    ),
                    result_counts_with_skipped(
                        orchestration_result.total_stages as u64,
                        orchestration_result
                            .stages
                            .iter()
                            .filter(|stage| {
                                matches!(stage.status, orchestrator::StageStatus::Success)
                            })
                            .count() as u64,
                        orchestration_result
                            .stages
                            .iter()
                            .filter(|stage| {
                                matches!(stage.status, orchestrator::StageStatus::Failed)
                            })
                            .count() as u64,
                        orchestration_result
                            .stages
                            .iter()
                            .filter(|stage| {
                                matches!(stage.status, orchestrator::StageStatus::Skipped)
                            })
                            .count() as u64,
                    ),
                ),
                json!({
                    "plan_name": orchestration_result.plan_name,
                    "fail_fast": orchestration_result.fail_fast,
                    "executed_stages": orchestration_result.executed_stages
                }),
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
        TaskReportContext, build_json_template_context, builtin_command_flow_template_by_name,
        merged_saved_secret, parse_builtin_command_flow_template_token, require_managed_async_task,
        sanitize_rendered_output_for_response, saved_connection_detail_response,
        should_persist_secret,
    };
    use crate::config::connection_store::SavedConnection;
    use crate::config::linux_shell::LinuxShellFlavor;
    use crate::config::ssh_security::SshSecurityProfile;
    use crate::task::TaskOperation;
    use crate::web::state::ResolvedConnection;
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
                password_ref: None,
                port: Some(22),
                enable_password: Some("enable-secret".to_string()),
                enable_password_ref: None,
                ssh_security: Some(SshSecurityProfile::Balanced),
                linux_shell_flavor: None,
                device_profile: Some("cisco_ios".to_string()),
                template_dir: Some("/tmp/templates".to_string()),
                enabled: true,
                labels: vec!["edge".to_string()],
                vars: serde_json::json!({"site":"lab"}),
                groups: vec!["access".to_string()],
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
        let managed =
            TaskReportContext::from_request(TaskOperation::Exec, Some("task-1".to_string()), true);
        assert!(managed.is_some());

        let local =
            TaskReportContext::from_request(TaskOperation::Exec, Some("task-1".to_string()), false);
        assert!(local.is_none());
    }

    #[test]
    fn managed_async_task_requires_agent_mode_and_task_id() {
        assert!(
            require_managed_async_task(TaskOperation::TxBlock, Some("task-1".to_string()), true)
                .is_ok()
        );
        assert!(
            require_managed_async_task(TaskOperation::TxBlock, Some("   ".to_string()), true)
                .is_err()
        );
        assert!(require_managed_async_task(TaskOperation::TxBlock, None, true).is_err());
        assert!(
            require_managed_async_task(TaskOperation::TxBlock, Some("task-1".to_string()), false)
                .is_err()
        );
    }

    #[test]
    fn json_template_context_supports_flat_lookup_with_runtime_precedence() {
        let conn = ResolvedConnection {
            connection_name: None,
            host: "192.168.30.92".to_string(),
            username: "admin".to_string(),
            password: "secret-92".to_string(),
            port: 22,
            enable_password: None,
            ssh_security: SshSecurityProfile::Balanced,
            linux_shell_flavor: Some(LinuxShellFlavor::Fish),
            device_profile: "linux".to_string(),
            vars: serde_json::json!({
                "site": "lab-a",
                "peer_host": "192.168.30.94"
            }),
        };
        let context = build_json_template_context(
            serde_json::json!({
                "peer_host": "edge-94.host",
                "deploy_env": "prod"
            }),
            Some(&conn),
        );
        assert_eq!(context["peer_host"], serde_json::json!("edge-94.host"));
        assert_eq!(context["deploy_env"], serde_json::json!("prod"));
        assert_eq!(context["site"], serde_json::json!("lab-a"));
        assert_eq!(context["host"], serde_json::json!("192.168.30.92"));
        assert_eq!(
            context["vars"]["peer_host"],
            serde_json::json!("edge-94.host")
        );
    }

    #[test]
    fn sanitize_rendered_output_masks_password_like_values() {
        let context = serde_json::json!({
            "host": "192.168.30.92",
            "password": "secret-pass",
            "enable_password": "enable-pass",
            "api_token": "token-123",
            "vars": {
                "db_password": "db-pass"
            }
        });
        let rendered = "ssh admin@192.168.30.92 password=secret-pass enable=enable-pass token=token-123 db=db-pass";
        let masked = sanitize_rendered_output_for_response(rendered, &context);

        assert!(!masked.contains("secret-pass"));
        assert!(!masked.contains("enable-pass"));
        assert!(!masked.contains("token-123"));
        assert!(!masked.contains("db-pass"));
        assert!(masked.contains("192.168.30.92"));
        assert!(masked.matches("******").count() >= 4);
    }

    #[test]
    fn parse_builtin_flow_template_token_supports_prefix() {
        assert_eq!(
            parse_builtin_command_flow_template_token("builtin:cisco_like_copy").as_deref(),
            Some("cisco-like-copy")
        );
        assert_eq!(
            parse_builtin_command_flow_template_token("BUILTIN:cisco-like-copy").as_deref(),
            Some("cisco-like-copy")
        );
        assert_eq!(
            parse_builtin_command_flow_template_token("cisco-like-copy"),
            None
        );
    }

    #[test]
    fn builtin_flow_template_can_be_loaded() {
        let template = builtin_command_flow_template_by_name("cisco_like_copy")
            .expect("builtin flow template should exist");
        assert_eq!(template.name, "cisco-like-copy");
        assert!(!template.steps.is_empty());
    }
}
