use crate::config::ssh_security::SshSecurityProfile;
use rneter::{device::StateMachineDiagnostics, session::SessionRecordEntry};
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
    pub ssh_security: Option<SshSecurityProfile>,
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
    pub ssh_security: SshSecurityProfile,
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
pub struct BackupMeta {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub modified_ms: u128,
}

#[derive(Debug, Serialize)]
pub struct BackupCreateResponse {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct BackupCreateRequest {
    pub output: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BackupRestoreRequest {
    pub archive: String,
    #[serde(default)]
    pub replace: bool,
}

#[derive(Debug, Serialize)]
pub struct BackupRestoreResponse {
    pub restored: bool,
    pub archive: String,
    pub replace: bool,
}

#[derive(Debug, Serialize)]
pub struct BlacklistPatternEntry {
    pub pattern: String,
}

#[derive(Debug, Deserialize)]
pub struct BlacklistUpsertRequest {
    pub pattern: String,
}

#[derive(Debug, Serialize)]
pub struct BlacklistUpsertResponse {
    pub pattern: String,
    pub added: bool,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct BlacklistDeleteResponse {
    pub pattern: String,
    pub deleted: bool,
}

#[derive(Debug, Deserialize)]
pub struct BlacklistCheckRequest {
    pub command: String,
}

#[derive(Debug, Serialize)]
pub struct BlacklistCheckResponse {
    pub command: String,
    pub blocked: bool,
    pub pattern: Option<String>,
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
    #[serde(default)]
    pub task_id: Option<String>,
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
    #[serde(default)]
    pub task_id: Option<String>,
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

#[derive(Debug, Deserialize)]
pub struct ExecuteTxBlockRequest {
    pub name: Option<String>,
    pub template: Option<String>,
    #[serde(default)]
    pub vars: Value,
    #[serde(default)]
    pub commands: Vec<String>,
    #[serde(default)]
    pub rollback_commands: Vec<String>,
    #[serde(default)]
    pub rollback_on_failure: Option<bool>,
    pub rollback_trigger_step_index: Option<usize>,
    pub mode: Option<String>,
    pub timeout_secs: Option<u64>,
    pub resource_rollback_command: Option<String>,
    pub template_profile: Option<String>,
    pub dry_run: Option<bool>,
    #[serde(default)]
    pub connection: Option<ConnectionRequest>,
    pub record_level: Option<RecordLevel>,
    #[serde(default)]
    pub task_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExecuteTxBlockResponse {
    pub tx_block: Value,
    pub tx_result: Option<Value>,
    pub recording_jsonl: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteTxWorkflowRequest {
    pub workflow: Value,
    pub dry_run: Option<bool>,
    #[serde(default)]
    pub connection: Option<ConnectionRequest>,
    pub record_level: Option<RecordLevel>,
    #[serde(default)]
    pub task_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExecuteTxWorkflowResponse {
    pub workflow: Value,
    pub tx_workflow_result: Option<Value>,
    pub recording_jsonl: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteOrchestrationRequest {
    pub plan: Value,
    pub base_dir: Option<String>,
    pub dry_run: Option<bool>,
    pub record_level: Option<RecordLevel>,
    #[serde(default)]
    pub task_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExecuteOrchestrationResponse {
    pub plan: Value,
    pub inventory: Value,
    pub orchestration_result: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct AgentInfoResponse {
    pub name: String,
    pub version: String,
    pub capabilities: Vec<String>,
    pub uptime_seconds: u64,
    pub connections_count: u32,
    pub templates_count: u32,
    pub custom_profiles_count: u32,
    pub managed: bool,
}

#[derive(Debug, Serialize)]
pub struct AgentStatusResponse {
    pub status: String,
    pub active_sessions: u32,
    pub running_tasks: u32,
    pub last_heartbeat_at: Option<String>,
    pub registered_at: Option<String>,
    pub system: SystemInfo,
}

#[derive(Debug, Serialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub hostname: String,
}

#[derive(Debug, Deserialize)]
pub struct DeviceProbeRequest {
    pub connections: Vec<String>,
    #[serde(default = "default_probe_timeout")]
    pub timeout_secs: u32,
}

fn default_probe_timeout() -> u32 {
    10
}

#[derive(Debug, Serialize)]
pub struct DeviceProbeResult {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub device_profile: String,
    pub reachable: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DeviceProbeResponse {
    pub results: Vec<DeviceProbeResult>,
    pub total: u32,
    pub reachable_count: u32,
    pub unreachable_count: u32,
}

#[derive(Debug, Serialize)]
pub struct TaskCallback {
    pub task_id: String,
    pub agent_name: String,
    pub status: String,
    pub started_at: String,
    pub completed_at: String,
    pub execution_time_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
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
}

#[derive(Debug, Serialize)]
pub struct InteractiveStopResponse {
    pub ok: bool,
    pub recording_jsonl: Option<String>,
}
