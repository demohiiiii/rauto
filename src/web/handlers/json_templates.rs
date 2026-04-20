use crate::config::content_store;
use crate::web::error::ApiError;
use crate::web::models::{
    CreateTemplateRequest, TemplateDetail, TemplateMeta, UpdateTemplateRequest,
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
        path: stored.locator,
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
        path: content_store::tx_block_template_locator(&safe_name),
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
        path: content_store::tx_block_template_locator(&safe_name),
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
        path: stored.locator,
        content: stored.content,
    }))
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
        path: content_store::tx_workflow_template_locator(&safe_name),
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
        path: content_store::tx_workflow_template_locator(&safe_name),
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
        path: stored.locator,
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
        path: content_store::orchestration_template_locator(&safe_name),
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
        path: content_store::orchestration_template_locator(&safe_name),
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
