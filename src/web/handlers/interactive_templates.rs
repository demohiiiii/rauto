use crate::config::content_store;
use crate::config::interactive_template::{
    InteractiveTemplate, cisco_like_copy_interactive_template, normalize_interactive_template_body,
    parse_interactive_template,
};
use crate::config::interactive_vars::interactive_runtime_var_names;
use crate::web::error::ApiError;
use crate::web::models::{
    CreateInteractiveTemplateRequest, InspectInteractiveTemplateRequest, InteractiveTemplateDetail,
    InteractiveTemplateMeta, InteractiveTemplateVarField, UpdateInteractiveTemplateRequest,
};
use crate::web::state::AppState;
use crate::web::storage;
use axum::Json;
use axum::extract::{Path, State};
use serde_json::{Value, json};
use std::sync::Arc;

const BUILTIN_FLOW_TEMPLATE_PREFIX: &str = "builtin:";
const BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY: &str = "cisco-like-copy";

fn normalize_interactive_template_content(name: &str, content: &str) -> Result<String, ApiError> {
    normalize_interactive_template_body(name, content)
        .map_err(|error| ApiError::bad_request(error.to_string()))
}

fn normalize_builtin_interactive_template_name(raw: &str) -> String {
    raw.trim().to_ascii_lowercase().replace('_', "-")
}

pub(super) fn parse_builtin_interactive_template_token(raw: &str) -> Option<String> {
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
    let normalized = normalize_builtin_interactive_template_name(suffix);
    (!normalized.is_empty()).then_some(normalized)
}

pub(super) fn builtin_interactive_template_by_name(name: &str) -> Option<InteractiveTemplate> {
    let normalized = normalize_builtin_interactive_template_name(name);
    match normalized.as_str() {
        BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY => {
            let mut template = cisco_like_copy_interactive_template().ok()?;
            template.name = BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY.to_string();
            Some(template)
        }
        _ => None,
    }
}

fn builtin_interactive_template_metas() -> Vec<InteractiveTemplateMeta> {
    let Ok(template) = cisco_like_copy_interactive_template() else {
        return Vec::new();
    };
    let content = toml::to_string_pretty(&template).unwrap_or_default();
    vec![InteractiveTemplateMeta {
        name: BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY.to_string(),
        kind: "interactive".to_string(),
        source: "builtin".to_string(),
        content_type: "application/toml".to_string(),
        size_bytes: content.len() as u64,
        created_at_ms: 0,
        updated_at_ms: 0,
    }]
}

fn interactive_template_var_fields(
    template: &InteractiveTemplate,
    builtin: bool,
) -> Vec<InteractiveTemplateVarField> {
    interactive_runtime_var_names(template)
        .into_iter()
        .map(|name| {
            let allow_empty =
                builtin && matches!(name.as_str(), "transfer_username" | "transfer_password");
            InteractiveTemplateVarField::inferred(name, allow_empty)
        })
        .collect()
}

fn interactive_template_detail_from_content(
    name: &str,
    content: String,
) -> Result<InteractiveTemplateDetail, ApiError> {
    let content = normalize_interactive_template_body(name, &content).map_err(ApiError::from)?;
    let template = parse_interactive_template(&content, Some(name)).map_err(ApiError::from)?;
    Ok(InteractiveTemplateDetail {
        name: name.to_string(),
        vars_schema: interactive_template_var_fields(&template, false),
        content,
    })
}

fn inspect_interactive_template_content(
    content: &str,
) -> Result<InteractiveTemplateDetail, ApiError> {
    let template = parse_interactive_template(content, None)
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    let normalized_content =
        normalize_interactive_template_body(&template.name, content).map_err(ApiError::from)?;
    Ok(InteractiveTemplateDetail {
        name: template.name.clone(),
        vars_schema: interactive_template_var_fields(&template, false),
        content: normalized_content,
    })
}

fn interactive_template_detail_from_template(
    template: InteractiveTemplate,
) -> Result<InteractiveTemplateDetail, ApiError> {
    let name = template.name.clone();
    let content = toml::to_string_pretty(&template).map_err(ApiError::from)?;
    Ok(InteractiveTemplateDetail {
        name,
        vars_schema: interactive_template_var_fields(&template, true),
        content,
    })
}

pub async fn list_interactive_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<InteractiveTemplateMeta>>, ApiError> {
    let _ = state;
    let items = storage::list_interactive_templates()?;
    Ok(Json(items))
}

pub async fn list_builtin_interactive_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<InteractiveTemplateMeta>>, ApiError> {
    let _ = state;
    Ok(Json(builtin_interactive_template_metas()))
}

pub async fn inspect_interactive_template(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<InspectInteractiveTemplateRequest>,
) -> Result<Json<InteractiveTemplateDetail>, ApiError> {
    Ok(Json(inspect_interactive_template_content(&req.content)?))
}

pub async fn get_interactive_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<InteractiveTemplateDetail>, ApiError> {
    let safe_name = storage::safe_interactive_template_name(&name)?;
    let Some(stored) =
        content_store::load_interactive_template(&safe_name).map_err(ApiError::from)?
    else {
        return Err(ApiError::bad_request(
            "interactive command template not found",
        ));
    };
    Ok(Json(interactive_template_detail_from_content(
        &safe_name,
        stored.content,
    )?))
}

pub async fn get_builtin_interactive_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<InteractiveTemplateDetail>, ApiError> {
    let normalized = parse_builtin_interactive_template_token(&name)
        .unwrap_or_else(|| normalize_builtin_interactive_template_name(&name));
    if normalized.is_empty() {
        return Err(ApiError::bad_request(
            "builtin interactive command template name is required",
        ));
    }
    let template = builtin_interactive_template_by_name(&normalized)
        .ok_or_else(|| ApiError::bad_request("builtin interactive command template not found"))?;
    Ok(Json(interactive_template_detail_from_template(template)?))
}

pub async fn create_interactive_template(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CreateInteractiveTemplateRequest>,
) -> Result<Json<InteractiveTemplateDetail>, ApiError> {
    let safe_name = storage::safe_interactive_template_name(&req.name)?;
    let content = normalize_interactive_template_content(&safe_name, &req.content)?;
    let created =
        content_store::create_interactive_template(&safe_name, &content).map_err(ApiError::from)?;
    if !created {
        return Err(ApiError::bad_request(
            "interactive command template already exists",
        ));
    }
    Ok(Json(interactive_template_detail_from_content(
        &safe_name, content,
    )?))
}

pub async fn update_interactive_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<UpdateInteractiveTemplateRequest>,
) -> Result<Json<InteractiveTemplateDetail>, ApiError> {
    let safe_name = storage::safe_interactive_template_name(&name)?;
    let content = normalize_interactive_template_content(&safe_name, &req.content)?;
    let updated =
        content_store::update_interactive_template(&safe_name, &content).map_err(ApiError::from)?;
    if !updated {
        return Err(ApiError::bad_request(
            "interactive command template not found",
        ));
    }
    Ok(Json(interactive_template_detail_from_content(
        &safe_name, content,
    )?))
}

pub async fn delete_interactive_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_interactive_template_name(&name)?;
    content_store::delete_interactive_template(&safe_name).map_err(ApiError::from)?;
    Ok(Json(json!({"ok": true})))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn custom_template_schema_infers_runtime_roots_and_filters_current_fields() {
        let detail = interactive_template_detail_from_content(
            "deploy",
            r#"
name = "deploy"

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
        let template =
            builtin_interactive_template_by_name("cisco-like-copy").expect("builtin copy template");
        let detail = interactive_template_detail_from_template(template).expect("detail");

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
    fn inspects_unsaved_interactive_content_without_persisting_it() {
        let detail = inspect_interactive_template_content(
            r#"
name = "temporary-copy"

command = "copy {{source}} {{peer.host}} {{host}} {{api_token}}"
"#,
        )
        .expect("inspect temporary interactive");

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
    fn rejects_invalid_unsaved_interactive_content() {
        let error =
            inspect_interactive_template_content("name = [").expect_err("invalid TOML must fail");
        assert_eq!(error.status, axum::http::StatusCode::BAD_REQUEST);
        assert!(
            error
                .message
                .contains("invalid interactive command template TOML")
        );
    }
}
