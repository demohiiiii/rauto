use crate::config::content_store;
use crate::template::renderer::Renderer;
use crate::web::error::ApiError;
use crate::web::models::{
    CreateTemplateRequest, TemplateDetail, TemplateMeta, TxWorkflowTemplatePreviewRequest,
    TxWorkflowTemplatePreviewResponse, UpdateTemplateRequest,
};
use crate::web::state::AppState;
use crate::web::storage;
use axum::Json;
use axum::extract::{Path, State};
use serde_json::{Value, json};
use std::sync::Arc;

fn normalize_json_template_content(content: &str) -> Result<String, ApiError> {
    let value: Value = serde_json::from_str(content).map_err(ApiError::from)?;
    serde_json::to_string_pretty(&value).map_err(ApiError::from)
}

fn workflow_preview_context(workflow_vars: Value) -> Value {
    let mut context = serde_json::Map::new();
    context.insert("vars".to_string(), workflow_vars.clone());
    if let Some(vars) = workflow_vars.as_object() {
        for (key, value) in vars {
            context.insert(key.clone(), value.clone());
        }
    }
    Value::Object(context)
}

fn render_workflow_preview_value(
    value: Value,
    path: &str,
    context: &Value,
    renderer: &Renderer<'_>,
    unresolved_paths: &mut Vec<String>,
) -> Value {
    match value {
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(key, value)| {
                    let child_path = format!("{}.{}", path, key);
                    (
                        key,
                        render_workflow_preview_value(
                            value,
                            &child_path,
                            context,
                            renderer,
                            unresolved_paths,
                        ),
                    )
                })
                .collect(),
        ),
        Value::Array(items) => Value::Array(
            items
                .into_iter()
                .enumerate()
                .map(|(index, value)| {
                    render_workflow_preview_value(
                        value,
                        &format!("{}[{}]", path, index),
                        context,
                        renderer,
                        unresolved_paths,
                    )
                })
                .collect(),
        ),
        Value::String(text) if text.contains("{{") || text.contains("{%") => {
            let Ok(rendered) = renderer.render_string(&text, context.clone()) else {
                unresolved_paths.push(path.to_string());
                return Value::String(text);
            };
            let trimmed = rendered.trim();
            if trimmed.is_empty() {
                Value::String(rendered)
            } else {
                serde_json::from_str(trimmed).unwrap_or(Value::String(rendered))
            }
        }
        other => other,
    }
}

fn render_workflow_template_preview(
    workflow: Value,
    workflow_vars: Value,
) -> Result<TxWorkflowTemplatePreviewResponse, ApiError> {
    let context = workflow_preview_context(workflow_vars);
    let renderer = Renderer::new();
    let mut unresolved_paths = Vec::new();
    let workflow =
        render_workflow_preview_value(workflow, "$", &context, &renderer, &mut unresolved_paths);
    Ok(TxWorkflowTemplatePreviewResponse {
        workflow,
        unresolved_paths,
    })
}

pub async fn list_tx_block_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<TemplateMeta>>, ApiError> {
    let _ = state;
    let items = storage::list_tx_block_templates()?;
    Ok(Json(items))
}

pub async fn get_tx_block_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    let Some(stored) = content_store::load_tx_block_template(&safe_name).map_err(ApiError::from)?
    else {
        return Err(ApiError::bad_request("tx block template not found"));
    };
    Ok(Json(TemplateDetail {
        name: safe_name,
        content: stored.content,
    }))
}

pub async fn create_tx_block_template(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CreateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&req.name)?;
    let content = normalize_json_template_content(&req.content)?;
    let created =
        content_store::create_tx_block_template(&safe_name, &content).map_err(ApiError::from)?;
    if !created {
        return Err(ApiError::bad_request("tx block template already exists"));
    }
    Ok(Json(TemplateDetail {
        name: safe_name.clone(),
        content,
    }))
}

pub async fn update_tx_block_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<UpdateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    let content = normalize_json_template_content(&req.content)?;
    let updated =
        content_store::update_tx_block_template(&safe_name, &content).map_err(ApiError::from)?;
    if !updated {
        return Err(ApiError::bad_request("tx block template not found"));
    }
    Ok(Json(TemplateDetail {
        name: safe_name.clone(),
        content,
    }))
}

pub async fn delete_tx_block_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    content_store::delete_tx_block_template(&safe_name).map_err(ApiError::from)?;
    Ok(Json(json!({"ok": true})))
}

pub async fn list_tx_workflow_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<TemplateMeta>>, ApiError> {
    let _ = state;
    let items = storage::list_tx_workflow_templates()?;
    Ok(Json(items))
}

pub async fn get_tx_workflow_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    let Some(stored) =
        content_store::load_tx_workflow_template(&safe_name).map_err(ApiError::from)?
    else {
        return Err(ApiError::bad_request("tx workflow template not found"));
    };
    Ok(Json(TemplateDetail {
        name: safe_name,
        content: stored.content,
    }))
}

pub async fn preview_tx_workflow_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<TxWorkflowTemplatePreviewRequest>,
) -> Result<Json<TxWorkflowTemplatePreviewResponse>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    let Some(stored) =
        content_store::load_tx_workflow_template(&safe_name).map_err(ApiError::from)?
    else {
        return Err(ApiError::bad_request("tx workflow template not found"));
    };
    let workflow = serde_json::from_str(&stored.content).map_err(ApiError::from)?;
    Ok(Json(render_workflow_template_preview(
        workflow,
        req.workflow_vars,
    )?))
}

pub async fn create_tx_workflow_template(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CreateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&req.name)?;
    let content = normalize_json_template_content(&req.content)?;
    let created =
        content_store::create_tx_workflow_template(&safe_name, &content).map_err(ApiError::from)?;
    if !created {
        return Err(ApiError::bad_request("tx workflow template already exists"));
    }
    Ok(Json(TemplateDetail {
        name: safe_name.clone(),
        content,
    }))
}

pub async fn update_tx_workflow_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<UpdateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    let content = normalize_json_template_content(&req.content)?;
    let updated =
        content_store::update_tx_workflow_template(&safe_name, &content).map_err(ApiError::from)?;
    if !updated {
        return Err(ApiError::bad_request("tx workflow template not found"));
    }
    Ok(Json(TemplateDetail {
        name: safe_name.clone(),
        content,
    }))
}

pub async fn delete_tx_workflow_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    content_store::delete_tx_workflow_template(&safe_name).map_err(ApiError::from)?;
    Ok(Json(json!({"ok": true})))
}

pub async fn list_orchestration_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<TemplateMeta>>, ApiError> {
    let _ = state;
    let items = storage::list_orchestration_templates()?;
    Ok(Json(items))
}

pub async fn get_orchestration_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    let Some(stored) =
        content_store::load_orchestration_template(&safe_name).map_err(ApiError::from)?
    else {
        return Err(ApiError::bad_request("orchestration template not found"));
    };
    Ok(Json(TemplateDetail {
        name: safe_name,
        content: stored.content,
    }))
}

pub async fn create_orchestration_template(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<CreateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&req.name)?;
    let content = normalize_json_template_content(&req.content)?;
    let created = content_store::create_orchestration_template(&safe_name, &content)
        .map_err(ApiError::from)?;
    if !created {
        return Err(ApiError::bad_request(
            "orchestration template already exists",
        ));
    }
    Ok(Json(TemplateDetail {
        name: safe_name.clone(),
        content,
    }))
}

pub async fn update_orchestration_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<UpdateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    let content = normalize_json_template_content(&req.content)?;
    let updated = content_store::update_orchestration_template(&safe_name, &content)
        .map_err(ApiError::from)?;
    if !updated {
        return Err(ApiError::bad_request("orchestration template not found"));
    }
    Ok(Json(TemplateDetail {
        name: safe_name.clone(),
        content,
    }))
}

pub async fn delete_orchestration_template(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_json_template_name(&name)?;
    content_store::delete_orchestration_template(&safe_name).map_err(ApiError::from)?;
    Ok(Json(json!({"ok": true})))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workflow_preview_renders_vars_and_preserves_connection_expressions() {
        let source = json!({
            "name": "deploy-{{ version }}",
            "blocks": [{
                "name": "{{ connection.name }}",
                "steps": [{
                    "run": {
                        "kind": "command",
                        "mode": "User",
                        "command": "copy image-{{ version }} {{ connection.host }}"
                    }
                }]
            }]
        });

        let preview = render_workflow_template_preview(source, json!({"version": "17.9"}))
            .expect("workflow preview");

        assert_eq!(preview.workflow["name"], "deploy-17.9");
        assert_eq!(
            preview.workflow["blocks"][0]["name"],
            "{{ connection.name }}"
        );
        assert_eq!(
            preview.workflow["blocks"][0]["steps"][0]["run"]["command"],
            "copy image-{{ version }} {{ connection.host }}"
        );
        assert_eq!(
            preview.unresolved_paths,
            vec![
                "$.blocks[0].name".to_string(),
                "$.blocks[0].steps[0].run.command".to_string()
            ]
        );
    }

    #[test]
    fn workflow_preview_coerces_rendered_json_scalars() {
        let source = json!({
            "name": "preview",
            "blocks": [],
            "fail_fast": "{{ fail_fast }}"
        });

        let preview = render_workflow_template_preview(source, json!({"fail_fast": true}))
            .expect("workflow preview");

        assert_eq!(preview.workflow["fail_fast"], true);
        assert!(preview.unresolved_paths.is_empty());
    }
}
