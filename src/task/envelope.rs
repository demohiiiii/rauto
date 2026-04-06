use crate::task::{TaskEventLevel, TaskEventType, TaskOperation, TaskResultSummary, TaskStatus};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AsyncTaskAcceptedResponse {
    pub accepted: bool,
    pub task_id: String,
    pub operation: TaskOperation,
    pub status: TaskStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskCallback {
    pub task_id: String,
    pub agent_name: String,
    pub status: TaskStatus,
    pub started_at: String,
    pub completed_at: String,
    pub execution_time_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result_summary: Option<TaskResultSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResultEnvelope {
    pub task_id: String,
    pub operation: TaskOperation,
    pub status: TaskStatus,
    pub started_at: String,
    pub completed_at: String,
    pub execution_time_ms: u64,
    pub result_summary: TaskResultSummary,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskEvent {
    pub task_id: String,
    pub agent_name: String,
    pub event_type: TaskEventType,
    pub message: String,
    pub level: TaskEventLevel,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
    pub occurred_at: String,
}
