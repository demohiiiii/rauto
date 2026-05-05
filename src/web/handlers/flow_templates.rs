use crate::config::command_flow_template::{
    CommandFlowTemplate, CommandFlowTemplateVar, command_flow_var_kind_label,
    normalize_command_flow_template_body, parse_command_flow_template_str,
};
use crate::config::content_store;
use crate::web::error::ApiError;
use crate::web::models::{
    CommandFlowTemplateDetail, CommandFlowTemplateMeta, CommandFlowTemplateVarField,
    CreateCommandFlowTemplateRequest, UpdateCommandFlowTemplateRequest,
};
use crate::web::state::AppState;
use crate::web::storage;
use axum::Json;
use axum::extract::{Path, State};
use serde_json::{Value, json};
use std::sync::Arc;

const BUILTIN_FLOW_TEMPLATE_PREFIX: &str = "builtin:";
const BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY: &str = "cisco-like-copy";

fn normalize_command_flow_template_content(name: &str, content: &str) -> Result<String, ApiError> {
    normalize_command_flow_template_body(name, content).map_err(ApiError::from)
}

fn normalize_builtin_command_flow_template_name(raw: &str) -> String {
    raw.trim().to_ascii_lowercase().replace('_', "-")
}

pub(super) fn parse_builtin_command_flow_template_token(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if !trimmed
        .get(..BUILTIN_FLOW_TEMPLATE_PREFIX.len())
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case(BUILTIN_FLOW_TEMPLATE_PREFIX))
    {
        return None;
    }
    let suffix = trimmed
        .get(BUILTIN_FLOW_TEMPLATE_PREFIX.len()..)
        .unwrap_or("");
    let normalized = normalize_builtin_command_flow_template_name(suffix);
    (!normalized.is_empty()).then_some(normalized)
}

pub(super) fn builtin_command_flow_template_by_name(name: &str) -> Option<CommandFlowTemplate> {
    let normalized = normalize_builtin_command_flow_template_name(name);
    match normalized.as_str() {
        BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY => {
            let mut template = rneter::templates::cisco_like_copy_template();
            template.name = BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY.to_string();
            Some(template)
        }
        _ => None,
    }
}

fn builtin_command_flow_template_metas() -> Vec<CommandFlowTemplateMeta> {
    let content =
        toml::to_string_pretty(&rneter::templates::cisco_like_copy_template()).unwrap_or_default();
    vec![CommandFlowTemplateMeta {
        name: BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY.to_string(),
        kind: "command_flow".to_string(),
        source: "builtin".to_string(),
        content_type: "application/toml".to_string(),
        size_bytes: content.len() as u64,
        created_at_ms: 0,
        updated_at_ms: 0,
    }]
}

fn to_command_flow_template_var_field(var: &CommandFlowTemplateVar) -> CommandFlowTemplateVarField {
    CommandFlowTemplateVarField {
        name: var.name.clone(),
        label: var.display_label().to_string(),
        description: var.description.clone(),
        kind: command_flow_var_kind_label(var.kind).to_string(),
        required: var.required,
        placeholder: var.placeholder.clone(),
        options: var.options.clone(),
        default_value: var.default_value.clone(),
    }
}

fn command_flow_template_detail_from_content(
    name: &str,
    content: String,
) -> Result<CommandFlowTemplateDetail, ApiError> {
    let template = parse_command_flow_template_str(&content, Some(name)).map_err(ApiError::from)?;
    Ok(CommandFlowTemplateDetail {
        name: name.to_string(),
        vars_schema: template
            .vars
            .iter()
            .map(to_command_flow_template_var_field)
            .collect(),
        content,
    })
}

fn command_flow_template_detail_from_template(
    template: CommandFlowTemplate,
) -> Result<CommandFlowTemplateDetail, ApiError> {
    let name = template.name.clone();
    let content = toml::to_string_pretty(&template).map_err(ApiError::from)?;
    command_flow_template_detail_from_content(&name, content)
}

pub async fn list_command_flow_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<CommandFlowTemplateMeta>>, ApiError> {
    let _ = state;
    let items = storage::list_command_flow_templates()?;
    Ok(Json(items))
}

pub async fn list_builtin_command_flow_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<CommandFlowTemplateMeta>>, ApiError> {
    let _ = state;
    Ok(Json(builtin_command_flow_template_metas()))
}

pub async fn get_command_flow_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<CommandFlowTemplateDetail>, ApiError> {
    let safe_name = storage::safe_command_flow_template_name(&name)?;
    let Some(stored) =
        content_store::load_command_flow_template(&safe_name).map_err(ApiError::from)?
    else {
        return Err(ApiError::bad_request("command flow template not found"));
    };
    Ok(Json(command_flow_template_detail_from_content(
        &safe_name,
        stored.content,
    )?))
}

pub async fn get_builtin_command_flow_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<CommandFlowTemplateDetail>, ApiError> {
    let normalized = parse_builtin_command_flow_template_token(&name)
        .unwrap_or_else(|| normalize_builtin_command_flow_template_name(&name));
    if normalized.is_empty() {
        return Err(ApiError::bad_request(
            "builtin command flow template name is required",
        ));
    }
    let template = builtin_command_flow_template_by_name(&normalized)
        .ok_or_else(|| ApiError::bad_request("builtin command flow template not found"))?;
    Ok(Json(command_flow_template_detail_from_template(template)?))
}

pub async fn create_command_flow_template(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CreateCommandFlowTemplateRequest>,
) -> Result<Json<CommandFlowTemplateDetail>, ApiError> {
    let safe_name = storage::safe_command_flow_template_name(&req.name)?;
    let content = normalize_command_flow_template_content(&safe_name, &req.content)?;
    let created = content_store::create_command_flow_template(&safe_name, &content)
        .map_err(ApiError::from)?;
    if !created {
        return Err(ApiError::bad_request(
            "command flow template already exists",
        ));
    }
    Ok(Json(command_flow_template_detail_from_content(
        &safe_name, content,
    )?))
}

pub async fn update_command_flow_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<UpdateCommandFlowTemplateRequest>,
) -> Result<Json<CommandFlowTemplateDetail>, ApiError> {
    let safe_name = storage::safe_command_flow_template_name(&name)?;
    let content = normalize_command_flow_template_content(&safe_name, &req.content)?;
    let updated = content_store::update_command_flow_template(&safe_name, &content)
        .map_err(ApiError::from)?;
    if !updated {
        return Err(ApiError::bad_request("command flow template not found"));
    }
    Ok(Json(command_flow_template_detail_from_content(
        &safe_name, content,
    )?))
}

pub async fn delete_command_flow_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_command_flow_template_name(&name)?;
    content_store::delete_command_flow_template(&safe_name).map_err(ApiError::from)?;
    Ok(Json(json!({"ok": true})))
}
