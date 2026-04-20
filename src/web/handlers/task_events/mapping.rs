use super::types::{RecordingEventPlan, TaskEventInput};
use super::*;

fn task_event_progress_in_range(current: usize, total: usize, start: u8, end: u8) -> Option<u8> {
    if total == 0 {
        return None;
    }
    let span = end.saturating_sub(start) as f64;
    let pct = start as f64 + ((current as f64 / total as f64) * span);
    Some((pct.round() as i64).clamp(0, 100) as u8)
}

pub(crate) fn recording_entry_occurred_at(ts_ms: u128) -> String {
    chrono::DateTime::<Utc>::from_timestamp_millis(ts_ms as i64)
        .unwrap_or_else(Utc::now)
        .to_rfc3339()
}

pub(crate) fn parse_task_event_type(raw: &str) -> TaskEventType {
    TaskEventType::parse(raw).unwrap_or(TaskEventType::Log)
}

pub(crate) fn parse_task_event_level(raw: &str) -> TaskEventLevel {
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

pub(crate) fn map_recording_entry_to_task_event(
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

pub(crate) fn build_tx_workflow_recording_plan(
    workflow: &rneter::session::TxWorkflow,
) -> RecordingEventPlan {
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
