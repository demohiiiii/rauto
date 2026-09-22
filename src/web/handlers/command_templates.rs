use crate::config::content_store;
use crate::config::interactive_vars::inline_runtime_var_names;
use crate::web::error::ApiError;
use crate::web::models::{
    CommandTemplateInspection, CreateTemplateRequest, InspectCommandTemplateRequest,
    InteractiveTemplateVarField, TemplateDetail, TemplateMeta, UpdateTemplateRequest,
};
use crate::web::state::AppState;
use crate::web::storage;
use axum::Json;
use axum::extract::{Path, State};
use serde_json::{Value, json};
use std::sync::Arc;

fn inspect_command_template_content(content: &str) -> Result<CommandTemplateInspection, ApiError> {
    Ok(CommandTemplateInspection {
        vars_schema: inline_runtime_var_names(content)
            .map_err(|error| ApiError::bad_request(error.to_string()))?
            .into_iter()
            .map(|name| InteractiveTemplateVarField::inferred(name, false))
            .collect(),
    })
}

pub async fn inspect_command_template(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<InspectCommandTemplateRequest>,
) -> Result<Json<CommandTemplateInspection>, ApiError> {
    Ok(Json(inspect_command_template_content(&req.content)?))
}

pub async fn list_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<TemplateMeta>>, ApiError> {
    let _ = state;
    let templates = storage::list_templates()?;
    Ok(Json(templates))
}

pub async fn get_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_template_name(&name)?;
    let Some(stored) = content_store::load_command_template(&safe_name).map_err(ApiError::from)?
    else {
        return Err(ApiError::bad_request("template not found"));
    };
    Ok(Json(TemplateDetail {
        name: safe_name,
        content: stored.content,
    }))
}

pub async fn create_template(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CreateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_template_name(&req.name)?;
    let created =
        content_store::create_command_template(&safe_name, &req.content).map_err(ApiError::from)?;
    if !created {
        return Err(ApiError::bad_request("template already exists"));
    }
    Ok(Json(TemplateDetail {
        name: safe_name,
        content: req.content,
    }))
}

pub async fn update_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<UpdateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_template_name(&name)?;
    let updated =
        content_store::update_command_template(&safe_name, &req.content).map_err(ApiError::from)?;
    if !updated {
        return Err(ApiError::bad_request("template not found"));
    }
    Ok(Json(TemplateDetail {
        name: safe_name,
        content: req.content,
    }))
}

pub async fn delete_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_template_name(&name)?;
    content_store::delete_command_template(&safe_name).map_err(ApiError::from)?;
    Ok(Json(json!({"ok": true})))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_template_inspection_returns_ordered_runtime_fields() {
        let detail = inspect_command_template_content(
            "copy {{source}} {{peer.host}}\nverify {{source}} {{transfer_password}}",
        )
        .unwrap();
        assert_eq!(
            detail
                .vars_schema
                .iter()
                .map(|field| field.name.as_str())
                .collect::<Vec<_>>(),
            vec!["peer", "source", "transfer_password"]
        );
        assert_eq!(detail.vars_schema[2].kind, "secret");
    }

    #[test]
    fn command_template_inspection_returns_filtered_and_loop_inputs() {
        let detail = inspect_command_template_content(
            "interface {{ iface }}\n description {{ description | upper }}\n\
             {% if enabled %}{% for vlan in vlans %}vlan {{ vlan.id }}{% endfor %}{% endif %}",
        )
        .unwrap();
        assert_eq!(
            detail
                .vars_schema
                .iter()
                .map(|field| field.name.as_str())
                .collect::<Vec<_>>(),
            vec!["description", "enabled", "iface", "vlans"]
        );
    }

    #[test]
    fn command_template_inspection_returns_bad_request_for_invalid_syntax() {
        let error = inspect_command_template_content("{{ description | }}").unwrap_err();
        assert_eq!(error.status, axum::http::StatusCode::BAD_REQUEST);
        assert!(error.message.contains("Failed to inspect template"));
    }
}
