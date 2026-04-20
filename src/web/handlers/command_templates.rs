use crate::config::content_store;
use crate::web::error::ApiError;
use crate::web::models::{
    CreateTemplateRequest, TemplateDetail, TemplateMeta, UpdateTemplateRequest,
};
use crate::web::state::AppState;
use crate::web::storage;
use axum::extract::{Path, State};
use axum::Json;
use serde_json::{Value, json};
use std::sync::Arc;

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
    let Some(stored) = content_store::load_command_template(&safe_name).map_err(ApiError::from)? else {
        return Err(ApiError::bad_request("template not found"));
    };
    Ok(Json(TemplateDetail {
        name: safe_name,
        path: stored.locator,
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
    let locator = content_store::template_locator(&safe_name);
    Ok(Json(TemplateDetail {
        name: safe_name,
        path: locator,
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
    let locator = content_store::template_locator(&safe_name);
    Ok(Json(TemplateDetail {
        name: safe_name,
        path: locator,
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
