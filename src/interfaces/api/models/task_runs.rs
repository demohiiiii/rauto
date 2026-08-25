use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct TaskRunsQuery {
    pub limit: Option<usize>,
    pub operation: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TaskRunListItem {
    pub task_id: String,
    pub operation: String,
    pub status: String,
    pub outcome: Option<String>,
    pub summary: String,
    pub success: bool,
    pub agent_name: Option<String>,
    pub source: Option<String>,
    pub target_label: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub execution_time_ms: Option<u64>,
    pub has_recording: bool,
    pub has_error: bool,
}

#[derive(Debug, Serialize)]
pub struct TaskEventDto {
    pub seq: u64,
    pub task_id: String,
    pub operation: String,
    pub event_type: String,
    pub level: String,
    pub stage: Option<String>,
    pub message: String,
    pub progress: Option<u8>,
    pub details: Option<Value>,
    pub occurred_at: String,
}

#[derive(Debug, Serialize)]
pub struct TaskArtifactDto {
    pub id: u64,
    pub artifact_type: String,
    pub name: String,
    pub storage_ref: Option<String>,
    pub content_type: Option<String>,
    pub size_bytes: Option<u64>,
    pub content_text: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct TaskRunDetailResponse {
    pub task_id: String,
    pub operation: String,
    pub status: String,
    pub outcome: Option<String>,
    pub summary: String,
    pub success: bool,
    pub agent_name: Option<String>,
    pub source: Option<String>,
    pub target_label: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub execution_time_ms: Option<u64>,
    pub has_recording: bool,
    pub has_error: bool,
    pub result_summary: Option<Value>,
    pub result: Option<Value>,
    pub error: Option<Value>,
    pub created_at: String,
    pub updated_at: String,
    pub events: Vec<TaskEventDto>,
    pub artifacts: Vec<TaskArtifactDto>,
}
