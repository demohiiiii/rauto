use crate::config::custom_textfsm_store;
use crate::web::error::ApiError;
use axum::Json;
use axum::extract::{Path, Query};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Debug, Deserialize)]
pub struct TextfsmMappingQuery {
    #[serde(default)]
    pub profile: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTextfsmTemplateRequest {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTextfsmTemplateRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct UpsertTextfsmMappingRequest {
    pub device_profile: String,
    pub command: String,
    pub template_name: String,
}

#[derive(Debug, Deserialize)]
pub struct DeleteTextfsmMappingRequest {
    pub device_profile: String,
    pub command: String,
}

#[derive(Debug, Serialize)]
pub struct TextfsmTemplateMeta {
    pub name: String,
    pub kind: String,
    pub source: String,
    pub content_type: String,
    pub size_bytes: u64,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Serialize)]
pub struct TextfsmTemplateDetail {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct TextfsmMappingDto {
    pub device_profile: String,
    pub command: String,
    pub template_name: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

pub async fn list_textfsm_templates() -> Result<Json<Vec<TextfsmTemplateMeta>>, ApiError> {
    let items = custom_textfsm_store::list_templates().map_err(ApiError::from)?;
    Ok(Json(items.into_iter().map(template_meta).collect()))
}

pub async fn get_textfsm_template(
    Path(name): Path<String>,
) -> Result<Json<TextfsmTemplateDetail>, ApiError> {
    let Some(item) = custom_textfsm_store::load_template(&name).map_err(ApiError::from)? else {
        return Err(ApiError::bad_request("TextFSM template not found"));
    };
    Ok(Json(TextfsmTemplateDetail {
        name: item.name,
        content: item.content,
    }))
}

pub async fn create_textfsm_template(
    Json(req): Json<CreateTextfsmTemplateRequest>,
) -> Result<Json<TextfsmTemplateDetail>, ApiError> {
    let created =
        custom_textfsm_store::create_template(&req.name, &req.content).map_err(ApiError::from)?;
    if !created {
        return Err(ApiError::bad_request("TextFSM template already exists"));
    }
    Ok(Json(TextfsmTemplateDetail {
        name: req.name,
        content: req.content,
    }))
}

pub async fn update_textfsm_template(
    Path(name): Path<String>,
    Json(req): Json<UpdateTextfsmTemplateRequest>,
) -> Result<Json<TextfsmTemplateDetail>, ApiError> {
    let updated =
        custom_textfsm_store::update_template(&name, &req.content).map_err(ApiError::from)?;
    if !updated {
        return Err(ApiError::bad_request("TextFSM template not found"));
    }
    Ok(Json(TextfsmTemplateDetail {
        name,
        content: req.content,
    }))
}

pub async fn delete_textfsm_template(Path(name): Path<String>) -> Result<Json<Value>, ApiError> {
    let deleted = custom_textfsm_store::delete_template(&name).map_err(ApiError::from)?;
    if !deleted {
        return Err(ApiError::bad_request("TextFSM template not found"));
    }
    Ok(Json(json!({"ok": true})))
}

pub async fn list_textfsm_mappings(
    Query(query): Query<TextfsmMappingQuery>,
) -> Result<Json<Vec<TextfsmMappingDto>>, ApiError> {
    let items =
        custom_textfsm_store::list_mappings(query.profile.as_deref()).map_err(ApiError::from)?;
    Ok(Json(items.into_iter().map(mapping_dto).collect()))
}

pub async fn upsert_textfsm_mapping(
    Json(req): Json<UpsertTextfsmMappingRequest>,
) -> Result<Json<TextfsmMappingDto>, ApiError> {
    custom_textfsm_store::upsert_mapping(&req.device_profile, &req.command, &req.template_name)
        .map_err(ApiError::from)?;
    let item = custom_textfsm_store::list_mappings(Some(&req.device_profile))
        .map_err(ApiError::from)?
        .into_iter()
        .find(|item| item.command == req.command.split_whitespace().collect::<Vec<_>>().join(" "))
        .ok_or_else(|| ApiError::bad_request("TextFSM mapping not found after save"))?;
    Ok(Json(mapping_dto(item)))
}

pub async fn delete_textfsm_mapping(
    Json(req): Json<DeleteTextfsmMappingRequest>,
) -> Result<Json<Value>, ApiError> {
    let deleted = custom_textfsm_store::delete_mapping(&req.device_profile, &req.command)
        .map_err(ApiError::from)?;
    if !deleted {
        return Err(ApiError::bad_request("TextFSM mapping not found"));
    }
    Ok(Json(json!({"ok": true})))
}

fn template_meta(item: custom_textfsm_store::CustomTextfsmTemplate) -> TextfsmTemplateMeta {
    TextfsmTemplateMeta {
        size_bytes: item.content.len() as u64,
        name: item.name,
        kind: "textfsm".to_string(),
        source: "database".to_string(),
        content_type: "text/plain".to_string(),
        created_at_ms: item.created_at_ms,
        updated_at_ms: item.updated_at_ms,
    }
}

fn mapping_dto(item: custom_textfsm_store::CustomTextfsmMapping) -> TextfsmMappingDto {
    TextfsmMappingDto {
        device_profile: item.device_profile,
        command: item.command,
        template_name: item.template_name,
        created_at_ms: item.created_at_ms,
        updated_at_ms: item.updated_at_ms,
    }
}
