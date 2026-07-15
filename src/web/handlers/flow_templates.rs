use crate::config::command_flow_template::{
    CommandFlowTemplate, cisco_like_copy_command_flow_template,
    normalize_command_flow_template_body, parse_command_flow_template,
};
use crate::config::command_flow_vars::command_flow_runtime_var_names;
use crate::config::content_store;
use crate::web::error::ApiError;
use crate::web::models::{
    CommandFlowTemplateDetail, CommandFlowTemplateMeta, CommandFlowTemplateVarField,
    CreateCommandFlowTemplateRequest, InspectCommandFlowTemplateRequest,
    UpdateCommandFlowTemplateRequest,
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
            let mut template = cisco_like_copy_command_flow_template().ok()?;
            template.name = BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY.to_string();
            Some(template)
        }
        _ => None,
    }
}

fn builtin_command_flow_template_metas() -> Vec<CommandFlowTemplateMeta> {
    let Ok(template) = cisco_like_copy_command_flow_template() else {
        return Vec::new();
    };
    let content = toml::to_string_pretty(&template).unwrap_or_default();
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

fn command_flow_template_var_fields(
    template: &CommandFlowTemplate,
    builtin: bool,
) -> Vec<CommandFlowTemplateVarField> {
    command_flow_runtime_var_names(template)
        .into_iter()
        .map(|name| {
            let allow_empty =
                builtin && matches!(name.as_str(), "transfer_username" | "transfer_password");
            CommandFlowTemplateVarField::inferred(name, allow_empty)
        })
        .collect()
}

fn command_flow_template_detail_from_content(
    name: &str,
    content: String,
) -> Result<CommandFlowTemplateDetail, ApiError> {
    let content = normalize_command_flow_template_body(name, &content).map_err(ApiError::from)?;
    let template = parse_command_flow_template(&content, Some(name)).map_err(ApiError::from)?;
    Ok(CommandFlowTemplateDetail {
        name: name.to_string(),
        vars_schema: command_flow_template_var_fields(&template, false),
        content,
    })
}

fn inspect_command_flow_template_content(
    content: &str,
) -> Result<CommandFlowTemplateDetail, ApiError> {
    let template = parse_command_flow_template(content, None)
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    let normalized_content =
        normalize_command_flow_template_body(&template.name, content).map_err(ApiError::from)?;
    Ok(CommandFlowTemplateDetail {
        name: template.name.clone(),
        vars_schema: command_flow_template_var_fields(&template, false),
        content: normalized_content,
    })
}

fn command_flow_template_detail_from_template(
    template: CommandFlowTemplate,
) -> Result<CommandFlowTemplateDetail, ApiError> {
    let name = template.name.clone();
    let content = toml::to_string_pretty(&template).map_err(ApiError::from)?;
    Ok(CommandFlowTemplateDetail {
        name,
        vars_schema: command_flow_template_var_fields(&template, true),
        content,
    })
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

pub async fn inspect_command_flow_template(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<InspectCommandFlowTemplateRequest>,
) -> Result<Json<CommandFlowTemplateDetail>, ApiError> {
    Ok(Json(inspect_command_flow_template_content(&req.content)?))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn custom_template_schema_infers_runtime_roots_and_filters_current_fields() {
        let detail = command_flow_template_detail_from_content(
            "deploy",
            r#"
name = "deploy"

[[steps]]
command = "scp {{local_path}} {{peer.username}}@{{peer.host}}:{{remote_path}} {{host}} {{api_token}}"
"#
            .to_string(),
        )
        .expect("template detail");

        let fields = detail
            .vars_schema
            .iter()
            .map(|field| (field.name.as_str(), field.kind.as_str()))
            .collect::<Vec<_>>();
        assert_eq!(
            fields,
            vec![
                ("api_token", "secret"),
                ("local_path", "string"),
                ("peer", "string"),
                ("remote_path", "string"),
            ]
        );
    }

    #[test]
    fn builtin_copy_schema_keeps_explicit_empty_credentials() {
        let template = builtin_command_flow_template_by_name("cisco-like-copy")
            .expect("builtin copy template");
        let detail = command_flow_template_detail_from_template(template).expect("detail");

        let username = detail
            .vars_schema
            .iter()
            .find(|field| field.name == "transfer_username")
            .expect("transfer username");
        let password = detail
            .vars_schema
            .iter()
            .find(|field| field.name == "transfer_password")
            .expect("transfer password");
        let overwrite = detail
            .vars_schema
            .iter()
            .find(|field| field.name == "overwrite_answer")
            .expect("overwrite answer");

        assert!(username.required);
        assert!(username.allow_empty);
        assert!(password.required);
        assert!(password.allow_empty);
        assert_eq!(password.kind, "secret");
        assert!(overwrite.required);
        assert!(!overwrite.allow_empty);
    }

    #[test]
    fn inspects_unsaved_command_flow_content_without_persisting_it() {
        let detail = inspect_command_flow_template_content(
            r#"
name = "temporary-copy"

[[steps]]
command = "copy {{source}} {{peer.host}} {{host}} {{api_token}}"
"#,
        )
        .expect("inspect temporary flow");

        assert_eq!(detail.name, "temporary-copy");
        assert_eq!(
            detail
                .vars_schema
                .iter()
                .map(|field| (field.name.as_str(), field.kind.as_str()))
                .collect::<Vec<_>>(),
            vec![
                ("api_token", "secret"),
                ("peer", "string"),
                ("source", "string"),
            ]
        );
    }

    #[test]
    fn rejects_invalid_unsaved_command_flow_content() {
        let error =
            inspect_command_flow_template_content("name = [").expect_err("invalid TOML must fail");
        assert_eq!(error.status, axum::http::StatusCode::BAD_REQUEST);
        assert!(error.message.contains("invalid command flow template TOML"));
    }
}
