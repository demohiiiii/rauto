use crate::config::custom_show_object_store;
use crate::web::error::ApiError;
use axum::Json;
use axum::extract::Query;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Debug, Deserialize)]
pub struct CustomShowObjectQuery {
    #[serde(default)]
    pub profile: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertCustomShowObjectRequest {
    pub device_profile: String,
    pub object: String,
    pub command: String,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub textfsm_mapping_command: Option<String>,
    #[serde(default)]
    pub textfsm_template_name: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct DeleteCustomShowObjectRequest {
    pub device_profile: String,
    pub object: String,
}

#[derive(Debug, Serialize)]
pub struct CustomShowObjectDto {
    pub device_profile: String,
    pub object: String,
    pub command: String,
    pub mode: Option<String>,
    pub textfsm_mapping_command: Option<String>,
    pub textfsm_template_name: Option<String>,
    pub enabled: bool,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

pub async fn list_custom_show_objects(
    Query(query): Query<CustomShowObjectQuery>,
) -> Result<Json<Vec<CustomShowObjectDto>>, ApiError> {
    let items = custom_show_object_store::list(query.profile.as_deref()).map_err(ApiError::from)?;
    Ok(Json(
        items.into_iter().map(custom_show_object_dto).collect(),
    ))
}

pub async fn upsert_custom_show_object(
    Json(req): Json<UpsertCustomShowObjectRequest>,
) -> Result<Json<CustomShowObjectDto>, ApiError> {
    custom_show_object_store::upsert(
        &req.device_profile,
        &req.object,
        &req.command,
        req.mode.as_deref(),
        req.textfsm_mapping_command.as_deref(),
        req.textfsm_template_name.as_deref(),
        req.enabled,
    )
    .map_err(ApiError::from)?;
    let item = custom_show_object_store::list(Some(&req.device_profile))
        .map_err(ApiError::from)?
        .into_iter()
        .find(|item| item.object == normalized_object_for_lookup(&req.object))
        .ok_or_else(|| ApiError::bad_request("custom show object not found after save"))?;
    Ok(Json(custom_show_object_dto(item)))
}

pub async fn delete_custom_show_object(
    Json(req): Json<DeleteCustomShowObjectRequest>,
) -> Result<Json<Value>, ApiError> {
    let deleted = custom_show_object_store::delete(&req.device_profile, &req.object)
        .map_err(ApiError::from)?;
    if !deleted {
        return Err(ApiError::bad_request("custom show object not found"));
    }
    Ok(Json(json!({"ok": true})))
}

fn custom_show_object_dto(item: custom_show_object_store::CustomShowObject) -> CustomShowObjectDto {
    CustomShowObjectDto {
        device_profile: item.device_profile,
        object: item.object,
        command: item.command,
        mode: item.mode,
        textfsm_mapping_command: item.textfsm_mapping_command,
        textfsm_template_name: item.textfsm_template_name,
        enabled: item.enabled,
        created_at_ms: item.created_at_ms,
        updated_at_ms: item.updated_at_ms,
    }
}

fn normalized_object_for_lookup(raw: &str) -> String {
    crate::config::show_catalog::normalize_show_object(raw)
        .unwrap_or_else(|| raw.trim().to_string())
}

fn default_enabled() -> bool {
    true
}
