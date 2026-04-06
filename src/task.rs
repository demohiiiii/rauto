use serde::{Deserialize, Serialize};
use std::fmt;

#[path = "task/envelope.rs"]
mod envelope;
#[path = "task/summary.rs"]
mod summary;

pub use envelope::{AsyncTaskAcceptedResponse, TaskCallback, TaskEvent, TaskResultEnvelope};
pub use summary::{
    TaskResultOutcome, TaskResultSummary, build_error_result_summary, build_result_summary,
    count_non_empty_lines, extract_result_summary, result_counts, result_counts_with_skipped,
    task_name_to_operation, task_result_with_counts, task_result_with_details,
    task_result_with_recording,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskOperation {
    Exec,
    TemplateExecute,
    CommandFlow,
    Upload,
    TxBlock,
    TxWorkflow,
    Orchestrate,
}

impl TaskOperation {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Exec => "exec",
            Self::TemplateExecute => "template_execute",
            Self::CommandFlow => "command_flow",
            Self::Upload => "upload",
            Self::TxBlock => "tx_block",
            Self::TxWorkflow => "tx_workflow",
            Self::Orchestrate => "orchestrate",
        }
    }
}

impl fmt::Display for TaskOperation {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Queued,
    Running,
    Success,
    Failed,
}

impl TaskStatus {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Running => "running",
            Self::Success => "success",
            Self::Failed => "failed",
        }
    }
}

impl fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskEventType {
    Started,
    Progress,
    Log,
    StepStarted,
    StepCompleted,
    Warning,
    Failed,
    Completed,
}

impl TaskEventType {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Started => "started",
            Self::Progress => "progress",
            Self::Log => "log",
            Self::StepStarted => "step_started",
            Self::StepCompleted => "step_completed",
            Self::Warning => "warning",
            Self::Failed => "failed",
            Self::Completed => "completed",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim() {
            "started" => Some(Self::Started),
            "progress" => Some(Self::Progress),
            "log" => Some(Self::Log),
            "step_started" => Some(Self::StepStarted),
            "step_completed" => Some(Self::StepCompleted),
            "warning" => Some(Self::Warning),
            "failed" => Some(Self::Failed),
            "completed" => Some(Self::Completed),
            _ => None,
        }
    }
}

impl fmt::Display for TaskEventType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskEventLevel {
    Info,
    Success,
    Warning,
    Error,
}

impl TaskEventLevel {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Info => "info",
            Self::Success => "success",
            Self::Warning => "warning",
            Self::Error => "error",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim() {
            "info" => Some(Self::Info),
            "success" => Some(Self::Success),
            "warning" => Some(Self::Warning),
            "error" => Some(Self::Error),
            _ => None,
        }
    }
}

impl fmt::Display for TaskEventLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}
