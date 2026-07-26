use crate::config::{config_catalog, config_command_store};
use crate::web::error::ApiError;
use axum::Json;
use axum::extract::Query;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Debug, Deserialize)]
pub struct ConfigCatalogQuery {
    #[serde(default)]
    pub profile: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ConfigCommandDto {
    pub device_profile: String,
    pub kind: String,
    pub command: String,
    pub mode: Option<String>,
    pub source: String,
}

#[derive(Debug, Deserialize)]
pub struct UpsertConfigCommandRequest {
    pub device_profile: String,
    pub kind: String,
    pub command: String,
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeleteConfigCommandRequest {
    pub device_profile: String,
    pub kind: String,
}

#[derive(Debug, Serialize)]
pub struct VolatilePatternDto {
    pub device_profile: String,
    pub pattern: String,
    pub source: String,
}

#[derive(Debug, Deserialize)]
pub struct VolatilePatternRequest {
    pub device_profile: String,
    pub pattern: String,
}

pub async fn list_config_commands(
    Query(query): Query<ConfigCatalogQuery>,
) -> Result<Json<Vec<ConfigCommandDto>>, ApiError> {
    let commands =
        config_catalog::list_config_commands(query.profile.as_deref()).map_err(ApiError::from)?;
    Ok(Json(
        commands
            .into_iter()
            .map(|command| ConfigCommandDto {
                device_profile: command.profile,
                kind: command.kind,
                command: command.command,
                mode: command.mode,
                source: command.source.label().to_string(),
            })
            .collect(),
    ))
}

pub async fn upsert_config_command(
    Json(req): Json<UpsertConfigCommandRequest>,
) -> Result<Json<ConfigCommandDto>, ApiError> {
    config_command_store::upsert(
        &req.device_profile,
        &req.kind,
        &req.command,
        req.mode.as_deref(),
    )
    .map_err(|err| ApiError::bad_request(err.to_string()))?;
    let saved = config_catalog::resolve_config_command(&req.device_profile, &req.kind)
        .map_err(ApiError::from)?;
    Ok(Json(ConfigCommandDto {
        device_profile: saved.profile,
        kind: saved.kind,
        command: saved.command,
        mode: saved.mode,
        source: saved.source.label().to_string(),
    }))
}

pub async fn delete_config_command(
    Json(req): Json<DeleteConfigCommandRequest>,
) -> Result<Json<Value>, ApiError> {
    let deleted = config_command_store::delete(&req.device_profile, &req.kind)
        .map_err(|err| ApiError::bad_request(err.to_string()))?;
    if !deleted {
        return Err(ApiError::bad_request(
            "config fetch command override not found",
        ));
    }
    Ok(Json(json!({"ok": true})))
}

pub async fn list_config_volatile_patterns(
    Query(query): Query<ConfigCatalogQuery>,
) -> Result<Json<Vec<VolatilePatternDto>>, ApiError> {
    let entries =
        config_catalog::list_volatile_patterns(query.profile.as_deref()).map_err(ApiError::from)?;
    Ok(Json(
        entries
            .into_iter()
            .map(|entry| VolatilePatternDto {
                device_profile: entry.profile,
                pattern: entry.pattern,
                source: entry.source.label().to_string(),
            })
            .collect(),
    ))
}

pub async fn add_config_volatile_pattern(
    Json(req): Json<VolatilePatternRequest>,
) -> Result<Json<Value>, ApiError> {
    let added = config_command_store::add_volatile_pattern(&req.device_profile, &req.pattern)
        .map_err(|err| ApiError::bad_request(err.to_string()))?;
    Ok(Json(json!({"ok": true, "added": added})))
}

pub async fn remove_config_volatile_pattern(
    Json(req): Json<VolatilePatternRequest>,
) -> Result<Json<Value>, ApiError> {
    let removed = config_command_store::remove_volatile_pattern(&req.device_profile, &req.pattern)
        .map_err(|err| ApiError::bad_request(err.to_string()))?;
    if !removed {
        return Err(ApiError::bad_request(
            "custom volatile pattern not found for this profile",
        ));
    }
    Ok(Json(json!({"ok": true})))
}
