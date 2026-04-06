use crate::task::TaskOperation;
use serde::Serialize;
use serde::{Deserialize, Serialize as SerdeSerialize};
use serde_json::Value;
use std::fmt;

#[derive(Debug, Clone, Copy, SerdeSerialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TaskResultOutcome {
    Success,
    PartialSuccess,
    Failed,
    DryRun,
}

impl TaskResultOutcome {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Success => "success",
            Self::PartialSuccess => "partial_success",
            Self::Failed => "failed",
            Self::DryRun => "dry_run",
        }
    }
}

impl fmt::Display for TaskResultOutcome {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, SerdeSerialize, Deserialize)]
pub struct TaskResultCounts {
    pub total: u64,
    pub succeeded: u64,
    pub failed: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped: Option<u64>,
}

#[derive(Debug, Clone, SerdeSerialize, Deserialize)]
pub struct TaskResultSummary {
    pub operation: TaskOperation,
    pub outcome: TaskResultOutcome,
    pub success: bool,
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub counts: Option<TaskResultCounts>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recording_available: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

pub fn count_non_empty_lines(content: &str) -> u64 {
    content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .count() as u64
}

pub fn result_counts(total: u64, succeeded: u64, failed: u64) -> TaskResultCounts {
    TaskResultCounts {
        total,
        succeeded,
        failed,
        skipped: None,
    }
}

pub fn result_counts_with_skipped(
    total: u64,
    succeeded: u64,
    failed: u64,
    skipped: u64,
) -> TaskResultCounts {
    TaskResultCounts {
        total,
        succeeded,
        failed,
        skipped: Some(skipped),
    }
}

pub fn build_result_summary(
    operation: TaskOperation,
    outcome: TaskResultOutcome,
    summary: impl Into<String>,
) -> TaskResultSummary {
    TaskResultSummary {
        operation,
        outcome,
        success: matches!(
            outcome,
            TaskResultOutcome::Success | TaskResultOutcome::DryRun
        ),
        summary: summary.into(),
        counts: None,
        recording_available: None,
        details: None,
    }
}

pub fn task_result_with_counts(
    mut summary: TaskResultSummary,
    counts: TaskResultCounts,
) -> TaskResultSummary {
    summary.counts = Some(counts);
    summary
}

pub fn task_result_with_recording(
    mut summary: TaskResultSummary,
    recording_jsonl: &Option<String>,
) -> TaskResultSummary {
    summary.recording_available = Some(recording_jsonl.is_some());
    summary
}

pub fn task_result_with_details(
    mut summary: TaskResultSummary,
    details: Value,
) -> TaskResultSummary {
    summary.details = Some(details);
    summary
}

pub fn extract_result_summary<T: Serialize>(value: &T) -> Option<TaskResultSummary> {
    serde_json::to_value(value)
        .ok()
        .and_then(|json| json.get("result_summary").cloned())
        .and_then(|json| serde_json::from_value(json).ok())
}

pub fn build_error_result_summary(
    operation: TaskOperation,
    message: impl Into<String>,
) -> TaskResultSummary {
    let message = message.into();
    task_result_with_details(
        build_result_summary(operation, TaskResultOutcome::Failed, &message),
        serde_json::json!({ "error": message }),
    )
}

pub fn task_name_to_operation(name: &str) -> TaskOperation {
    match name {
        "exec" => TaskOperation::Exec,
        "template_execute" => TaskOperation::TemplateExecute,
        "tx_block" => TaskOperation::TxBlock,
        "tx_workflow" => TaskOperation::TxWorkflow,
        "orchestrate" => TaskOperation::Orchestrate,
        _ => TaskOperation::Exec,
    }
}
