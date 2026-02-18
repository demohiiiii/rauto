use rneter::{
    device::StateMachineDiagnostics,
    session::SessionRecordEntry,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct RenderRequest {
    pub template: String,
    #[serde(default)]
    pub vars: Value,
    pub template_dir: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RenderResponse {
    pub rendered_commands: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ConnectionRequest {
    pub connection_name: Option<String>,
    pub host: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub port: Option<u16>,
    pub enable_password: Option<String>,
    pub device_profile: Option<String>,
    pub template_dir: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ConnectionTestRequest {
    #[serde(default)]
    pub connection: Option<ConnectionRequest>,
}

#[derive(Debug, Serialize)]
pub struct ConnectionTestResponse {
    pub ok: bool,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub device_profile: String,
}

#[derive(Debug, Serialize)]
pub struct SavedConnectionMeta {
    pub name: String,
    pub path: String,
    pub has_password: bool,
}

#[derive(Debug, Serialize)]
pub struct SavedConnectionDetail {
    pub name: String,
    pub path: String,
    pub has_password: bool,
    pub connection: ConnectionRequest,
}

#[derive(Debug, Serialize)]
pub struct ConnectionHistoryEntry {
    pub id: String,
    pub ts_ms: u128,
    pub connection_key: String,
    pub connection_name: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub device_profile: String,
    pub operation: String,
    pub command_label: String,
    pub mode: Option<String>,
    pub record_level: String,
    pub record_path: String,
}

#[derive(Debug, Serialize)]
pub struct ConnectionHistoryDetailResponse {
    pub meta: ConnectionHistoryEntry,
    pub entries: Vec<SessionRecordEntry>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertConnectionRequest {
    #[serde(default)]
    pub connection: ConnectionRequest,
    #[serde(default)]
    pub save_password: bool,
}

#[derive(Debug, Deserialize)]
pub struct ExecRequest {
    pub command: String,
    pub mode: Option<String>,
    #[serde(default)]
    pub connection: Option<ConnectionRequest>,
    pub record_level: Option<RecordLevel>,
}

#[derive(Debug, Serialize)]
pub struct ExecResponse {
    pub output: String,
    pub recording_jsonl: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteTemplateRequest {
    pub template: String,
    #[serde(default)]
    pub vars: Value,
    pub mode: Option<String>,
    pub dry_run: Option<bool>,
    pub template_dir: Option<String>,
    #[serde(default)]
    pub connection: Option<ConnectionRequest>,
    pub record_level: Option<RecordLevel>,
}

#[derive(Debug, Serialize)]
pub struct CommandResult {
    pub command: String,
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExecuteTemplateResponse {
    pub rendered_commands: String,
    pub executed: Vec<CommandResult>,
    pub recording_jsonl: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BuiltinProfileMeta {
    pub name: String,
    pub aliases: Vec<String>,
    pub summary: String,
}

#[derive(Debug, Serialize)]
pub struct BuiltinProfileDetail {
    pub name: String,
    pub aliases: Vec<String>,
    pub summary: String,
    pub source: String,
    pub notes: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct CustomProfileMeta {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct DeviceProfilesOverview {
    pub builtins: Vec<BuiltinProfileMeta>,
    pub custom: Vec<CustomProfileMeta>,
}

#[derive(Debug, Serialize)]
pub struct CustomProfileDetail {
    pub name: String,
    pub path: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct UpsertCustomProfileRequest {
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct TemplateMeta {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct TemplateDetail {
    pub name: String,
    pub path: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTemplateRequest {
    pub content: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RecordLevel {
    Off,
    KeyEventsOnly,
    Full,
}

#[derive(Debug, Deserialize)]
pub struct ProfileDiagnoseRequest {
    pub name: String,
    pub template_dir: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProfileDiagnoseResponse {
    pub name: String,
    pub diagnostics: StateMachineDiagnostics,
}

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
