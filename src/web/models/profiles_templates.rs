use rneter::device::StateMachineDiagnostics;
use serde::{Deserialize, Serialize};
use serde_json::Value;

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
pub struct DeviceProfileModesResponse {
    pub name: String,
    pub default_mode: String,
    pub modes: Vec<String>,
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
    pub kind: String,
    pub source: String,
    pub content_type: String,
    pub size_bytes: u64,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Serialize)]
pub struct TemplateDetail {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct CommandFlowTemplateMeta {
    pub name: String,
    pub kind: String,
    pub source: String,
    pub content_type: String,
    pub size_bytes: u64,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Serialize)]
pub struct CommandFlowTemplateVarField {
    pub name: String,
    pub label: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub kind: String,
    pub required: bool,
    pub allow_empty: bool,
    pub placeholder: Option<String>,
    pub options: Vec<String>,
    #[serde(rename = "default")]
    pub default_value: Option<Value>,
}

impl CommandFlowTemplateVarField {
    pub fn inferred(name: String, allow_empty: bool) -> Self {
        let normalized_name = name.to_ascii_lowercase();
        let secret = ["password", "passwd", "secret", "token"]
            .iter()
            .any(|marker| normalized_name.contains(marker));
        Self {
            label: name.clone(),
            name,
            description: None,
            kind: if secret { "secret" } else { "string" }.to_string(),
            required: true,
            allow_empty,
            placeholder: None,
            options: Vec::new(),
            default_value: None,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct InspectCommandTemplateRequest {
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct CommandTemplateInspection {
    pub vars_schema: Vec<CommandFlowTemplateVarField>,
}

#[derive(Debug, Serialize)]
pub struct CommandFlowTemplateDetail {
    pub name: String,
    pub content: String,
    pub vars_schema: Vec<CommandFlowTemplateVarField>,
}

#[derive(Debug, Deserialize)]
pub struct InspectCommandFlowTemplateRequest {
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

#[derive(Debug, Deserialize)]
pub struct TxWorkflowTemplatePreviewRequest {
    #[serde(default)]
    pub workflow_vars: Value,
}

#[derive(Debug, Serialize)]
pub struct TxWorkflowTemplatePreviewResponse {
    pub workflow: Value,
    pub unresolved_paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCommandFlowTemplateRequest {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCommandFlowTemplateRequest {
    pub content: String,
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
