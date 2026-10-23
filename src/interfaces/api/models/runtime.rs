//! Internal CLI/service contract. Files cross this boundary as content.
use super::*;

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JsonInputMode {
    #[default]
    Template,
    Literal,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CommandErrorPolicy {
    #[default]
    Stop,
    Continue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionOptions {
    pub connection: ConnectionRequest,
    pub credential: Option<String>,
    pub force_autodetect: bool,
    pub retry: SessionRetryOptions,
    pub save_device: Option<String>,
    #[serde(default)]
    pub json_input_mode: JsonInputMode,
    #[serde(default)]
    pub template_error_policy: CommandErrorPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionRequest {
    pub options: ExecutionOptions,
    pub action: ExecutionAction,
    #[serde(default)]
    pub textfsm_templates: Vec<String>,
    #[serde(default)]
    pub textfsm_strict_errors: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "request", rename_all = "snake_case")]
pub enum ExecutionAction {
    Exec(ExecRequest),
    Show(ShowExecuteRequest),
    ExecBatch(ExecBatchExecuteRequest),
    ShowBatch(ShowBatchExecuteRequest),
    Template(ExecuteTemplateRequest),
    Interactive(ExecuteInteractiveRequest),
    InteractiveBatch(InteractiveBatchExecuteRequest),
    Workflow(ExecuteTxWorkflowRequest),
    Orchestration(ExecuteOrchestrationRequest),
    Config(ConfigFetchRequest),
    ConfigBatch(ConfigBatchFetchRequest),
    Upload {
        request: ExecuteUploadRequest,
        content_base64: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "result", rename_all = "snake_case")]
pub enum ExecutionOutput {
    Exec(ExecResponse),
    Show(ShowExecuteResponse),
    ExecBatch(ExecBatchExecuteResponse),
    ShowBatch(ShowBatchExecuteResponse),
    Template(ExecuteTemplateResponse),
    Interactive(ExecuteInteractiveResponse),
    InteractiveBatch(InteractiveBatchExecuteResponse),
    Workflow(ExecuteTxWorkflowResponse),
    Orchestration(ExecuteOrchestrationResponse),
    Config(ConfigFetchResponse),
    ConfigBatch(ConfigBatchFetchResponse),
    Upload(ExecuteUploadResponse),
}
impl ExecutionOutput {
    pub fn summary(&self) -> &crate::domain::task::TaskResultSummary {
        match self {
            Self::Exec(result) => &result.result_summary,
            Self::Show(result) => &result.result_summary,
            Self::ExecBatch(result) => &result.result_summary,
            Self::ShowBatch(result) => &result.result_summary,
            Self::Template(result) => &result.result_summary,
            Self::Interactive(result) => &result.result_summary,
            Self::InteractiveBatch(result) => &result.result_summary,
            Self::Workflow(result) => &result.result_summary,
            Self::Orchestration(result) => &result.result_summary,
            Self::Config(result) => &result.result_summary,
            Self::ConfigBatch(result) => &result.result_summary,
            Self::Upload(result) => &result.result_summary,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionFailure {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "state", content = "result", rename_all = "snake_case")]
pub enum ExecutionReply {
    Completed(Box<ExecutionOutput>),
    Failed(ExecutionFailure),
}

impl ExecutionReply {
    pub fn success(&self) -> bool {
        matches!(self, Self::Completed(output) if output.summary().success)
    }
}
