use super::{ConnectionRequest, RecordLevel};
use rneter::session::SessionRecordEntry;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ReplayRequest {
    pub jsonl: String,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub list: bool,
}

#[derive(Debug, Serialize)]
pub struct ReplayContextDto {
    pub device_addr: String,
    pub prompt: String,
    pub fsm_prompt: String,
}

#[derive(Debug, Serialize)]
pub struct ReplayOutputDto {
    pub success: bool,
    pub content: String,
    pub all: String,
    pub prompt: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ReplayResponse {
    pub context: Option<ReplayContextDto>,
    pub entries: Vec<SessionRecordEntry>,
    pub output: Option<ReplayOutputDto>,
}

#[derive(Debug, Deserialize)]
pub struct InteractiveStartRequest {
    #[serde(default)]
    pub connection: Option<ConnectionRequest>,
    pub record_level: Option<RecordLevel>,
}

#[derive(Debug, Serialize)]
pub struct InteractiveStartResponse {
    pub session_id: String,
}

#[derive(Debug, Deserialize)]
pub struct InteractiveCommandRequest {
    pub session_id: String,
    pub command: String,
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InteractiveCommandResponse {
    pub output: String,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct InteractiveStopResponse {
    pub ok: bool,
    pub recording_jsonl: Option<String>,
}
