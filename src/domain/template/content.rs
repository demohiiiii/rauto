use serde_json::Value;

#[derive(Debug, Clone)]
pub struct StoredContent {
    pub name: String,
    pub content: String,
    pub locator: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone)]
pub struct CustomTextfsmTemplate {
    pub name: String,
    pub content: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone)]
pub struct CustomTextfsmMapping {
    pub device_profile: String,
    pub command: String,
    pub template_name: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone)]
pub struct ResolvedCustomTextfsmTemplate {
    pub device_profile: String,
    pub command: String,
    pub template_name: String,
    pub template_content: String,
}

#[derive(Debug, Clone)]
pub struct ParsedOutputSheet {
    pub name: String,
    pub parsed_output: Value,
}
