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
