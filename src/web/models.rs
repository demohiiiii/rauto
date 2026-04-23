pub use crate::config::inventory_store::InventoryGroup;
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::ssh_security::SshSecurityProfile;
pub use crate::task::TaskEvent;
pub use crate::task::{AsyncTaskAcceptedResponse, TaskCallback};
use rneter::session::SessionRecordEntry;
use serde::{Deserialize, Serialize};
use serde_json::Value;

mod agent;
mod execution;
mod profiles_templates;
mod replay_interactive;
mod task_runs;
pub use self::agent::*;
pub use self::execution::*;
pub use self::profiles_templates::*;
pub use self::replay_interactive::*;
pub use self::task_runs::*;

#[derive(Debug, Deserialize)]
pub struct RenderRequest {
    pub template: String,
    #[serde(default)]
    pub vars: Value,
    #[serde(default)]
    pub connection: Option<ConnectionRequest>,
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
    #[serde(default)]
    pub enable_password_empty_enter: Option<bool>,
    pub ssh_security: Option<SshSecurityProfile>,
    pub linux_shell_flavor: Option<LinuxShellFlavor>,
    pub device_profile: Option<String>,
    pub template_dir: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub labels: Vec<String>,
    #[serde(default)]
    pub groups: Vec<String>,
    #[serde(default = "default_vars")]
    pub vars: Value,
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
    pub linux_shell_flavor: Option<LinuxShellFlavor>,
    pub device_profile: String,
}

#[derive(Debug, Serialize)]
pub struct SavedConnectionMeta {
    pub name: String,
    pub path: String,
    pub has_password: bool,
    pub has_enable_password: bool,
    pub enable_password_empty_enter: bool,
    pub host: Option<String>,
    pub username: Option<String>,
    pub port: Option<u16>,
    pub ssh_security: Option<SshSecurityProfile>,
    pub linux_shell_flavor: Option<LinuxShellFlavor>,
    pub device_profile: Option<String>,
    pub enabled: bool,
    pub labels: Vec<String>,
    pub groups: Vec<String>,
    pub vars: Value,
}

#[derive(Debug, Serialize)]
pub struct SavedConnectionDetail {
    pub name: String,
    pub path: String,
    pub has_password: bool,
    pub connection: ConnectionRequest,
}

#[derive(Debug, Deserialize)]
pub struct UpsertInventoryGroupRequest {
    pub group: InventoryGroup,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryLabel {
    pub name: String,
    #[serde(default)]
    pub hosts: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertInventoryLabelRequest {
    #[serde(default)]
    pub hosts: Vec<String>,
}

fn default_enabled() -> bool {
    true
}

fn default_vars() -> Value {
    Value::Object(Default::default())
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
