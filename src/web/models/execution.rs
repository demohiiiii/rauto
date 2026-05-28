use super::ConnectionRequest;
use crate::task::TaskResultSummary;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct UpsertConnectionRequest {
    #[serde(default)]
    pub connection: ConnectionRequest,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ExecutionTargetOptions {
    #[serde(default)]
    pub connection: Option<ConnectionRequest>,
    pub record_level: Option<RecordLevel>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ManagedTaskOptions {
    #[serde(default)]
    pub task_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct DryRunOptions {
    pub dry_run: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ExecRequest {
    pub command: String,
    pub mode: Option<String>,
    #[serde(flatten)]
    pub target: ExecutionTargetOptions,
    #[serde(flatten)]
    pub task: ManagedTaskOptions,
}

#[derive(Debug, Serialize)]
pub struct ExecResponse {
    pub output: String,
    pub exit_code: Option<i32>,
    pub recording_jsonl: Option<String>,
    pub result_summary: TaskResultSummary,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteTemplateRequest {
    pub template: String,
    #[serde(default)]
    pub vars: Value,
    pub mode: Option<String>,
    #[serde(flatten)]
    pub run: DryRunOptions,
    pub template_dir: Option<String>,
    #[serde(flatten)]
    pub target: ExecutionTargetOptions,
    #[serde(flatten)]
    pub task: ManagedTaskOptions,
}

#[derive(Debug, Serialize)]
pub struct CommandResult {
    pub command: String,
    pub success: bool,
    pub exit_code: Option<i32>,
    pub output: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExecuteTemplateResponse {
    pub rendered_commands: String,
    pub executed: Vec<CommandResult>,
    pub recording_jsonl: Option<String>,
    pub result_summary: TaskResultSummary,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteCommandFlowRequest {
    #[serde(default)]
    pub template_name: Option<String>,
    #[serde(default)]
    pub builtin_template_name: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub vars: Value,
    #[serde(flatten)]
    pub target: ExecutionTargetOptions,
}

#[derive(Debug, Serialize)]
pub struct ExecuteCommandFlowResponse {
    pub success: bool,
    pub template_name: String,
    pub outputs: Vec<CommandResult>,
    pub recording_jsonl: Option<String>,
    pub result_summary: TaskResultSummary,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteUploadRequest {
    pub local_path: String,
    pub remote_path: String,
    #[serde(default)]
    pub timeout_secs: Option<u64>,
    #[serde(default)]
    pub buffer_size: Option<usize>,
    #[serde(default)]
    pub show_progress: bool,
    #[serde(flatten)]
    pub target: ExecutionTargetOptions,
}

#[derive(Debug, Serialize)]
pub struct ExecuteUploadResponse {
    pub ok: bool,
    pub local_path: String,
    pub remote_path: String,
    pub recording_jsonl: Option<String>,
    pub result_summary: TaskResultSummary,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteTxBlockRequest {
    #[serde(default)]
    pub tx_block_template_name: Option<String>,
    #[serde(default)]
    pub tx_block_template_content: Option<String>,
    #[serde(default)]
    pub tx_block_template_vars: Value,
    #[serde(default)]
    pub tx_block: Value,
    #[serde(flatten)]
    pub run: DryRunOptions,
    #[serde(flatten)]
    pub target: ExecutionTargetOptions,
    #[serde(flatten)]
    pub task: ManagedTaskOptions,
}

#[derive(Debug, Serialize)]
pub struct ExecuteTxBlockResponse {
    pub tx_block: Value,
    pub tx_result: Option<Value>,
    pub recording_jsonl: Option<String>,
    pub result_summary: TaskResultSummary,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteTxWorkflowRequest {
    #[serde(default)]
    pub workflow_template_name: Option<String>,
    #[serde(default)]
    pub workflow_template_content: Option<String>,
    #[serde(default)]
    pub workflow_vars: Value,
    pub workflow: Value,
    #[serde(flatten)]
    pub run: DryRunOptions,
    #[serde(flatten)]
    pub target: ExecutionTargetOptions,
    #[serde(flatten)]
    pub task: ManagedTaskOptions,
}

#[derive(Debug, Serialize)]
pub struct ExecuteTxWorkflowResponse {
    pub workflow: Value,
    pub tx_workflow_result: Option<Value>,
    pub recording_jsonl: Option<String>,
    pub result_summary: TaskResultSummary,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteOrchestrationRequest {
    #[serde(default)]
    pub plan_template_name: Option<String>,
    #[serde(default)]
    pub plan_template_content: Option<String>,
    #[serde(default)]
    pub plan_vars: Value,
    pub plan: Value,
    pub base_dir: Option<String>,
    #[serde(flatten)]
    pub run: DryRunOptions,
    #[serde(flatten)]
    pub target: ExecutionTargetOptions,
    #[serde(flatten)]
    pub task: ManagedTaskOptions,
}

#[derive(Debug, Serialize)]
pub struct ExecuteOrchestrationResponse {
    pub plan: Value,
    pub inventory: Value,
    pub orchestration_result: Option<Value>,
    pub result_summary: TaskResultSummary,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RecordLevel {
    KeyEventsOnly,
    Full,
}
