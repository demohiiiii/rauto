use super::{
    HistoryQuery, merged_saved_secret, saved_connection_detail_response, should_persist_secret,
};
use crate::config::connection_import;
use crate::config::connection_store::{self, SavedConnection};
use crate::config::{history_store, inventory_store, template_loader};
use crate::device::DeviceClient;
use crate::web::error::ApiError;
use crate::web::models::{
    ConnectionHistoryDetailResponse, ConnectionHistoryEntry, ConnectionTestRequest,
    ConnectionTestResponse, InventoryGroup, ResolveInventoryVarsRequest,
    ResolveInventoryVarsResponse, SavedConnectionDetail, SavedConnectionMeta,
    UpsertConnectionRequest, UpsertInventoryGroupRequest,
};
use crate::web::state::{AppState, merge_connection_options};
use axum::Json;
use axum::extract::{Multipart, Path, Query, State};
use rneter::session::SessionRecorder;
use serde_json::{Value, json};
use std::sync::Arc;
use tracing::warn;

pub async fn test_connection(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ConnectionTestRequest>,
) -> Result<Json<ConnectionTestResponse>, ApiError> {
    let conn = merge_connection_options(&state.defaults, req.connection)?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let _client = DeviceClient::connect(
        conn.host.clone(),
        conn.port,
        conn.username.clone(),
        conn.password,
        conn.enable_password,
        handler,
        template_loader::default_profile_mode(&conn.device_profile)?,
        conn.ssh_security,
    )
    .await?;

    Ok(Json(ConnectionTestResponse {
        ok: true,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        ssh_security: conn.ssh_security,
        linux_shell_flavor: conn.linux_shell_flavor,
        device_profile: conn.device_profile,
    }))
}

pub async fn list_connections() -> Result<Json<Vec<SavedConnectionMeta>>, ApiError> {
    let names = connection_store::list_connections().map_err(ApiError::from)?;
    let mut items = Vec::new();
    for name in names {
        if let Ok(data) = connection_store::load_connection_raw(&name) {
            items.push(SavedConnectionMeta {
                name,
                path: connection_store::storage_path()
                    .to_string_lossy()
                    .to_string(),
                has_password: connection_store::has_saved_password(&data),
                host: data.host.clone(),
                username: data.username.clone(),
                port: data.port,
                linux_shell_flavor: data.linux_shell_flavor,
                device_profile: data.device_profile.clone(),
                enabled: data.enabled,
                labels: data.labels.clone(),
                groups: data.groups.clone(),
                vars: data.vars.clone(),
            });
        }
    }
    Ok(Json(items))
}

pub async fn import_connections(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<connection_import::ConnectionImportReport>, ApiError> {
    let mut file_name = None;
    let mut file_bytes = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::bad_request(format!("failed to read upload field: {}", e)))?
    {
        if field.name() != Some("file") {
            continue;
        }
        file_name = field.file_name().map(ToOwned::to_owned);
        file_bytes =
            Some(field.bytes().await.map_err(|e| {
                ApiError::bad_request(format!("failed to read upload file: {}", e))
            })?);
        break;
    }

    let file_name = file_name
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| ApiError::bad_request("upload file name is required"))?;
    let file_bytes = file_bytes.ok_or_else(|| ApiError::bad_request("upload file is required"))?;

    let report = connection_import::import_connections_from_bytes(&file_name, &file_bytes)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

    if report.imported > 0
        && let Some(registrar) = state.registrar()
        && let Err(err) = registrar.trigger_device_inventory_sync_if_changed(5).await
    {
        warn!(
            "failed to schedule device inventory sync after connection import: {}",
            err
        );
    }

    Ok(Json(report))
}

pub async fn get_connection(
    Path(name): Path<String>,
) -> Result<Json<SavedConnectionDetail>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let data = connection_store::load_connection_raw(&safe)
        .map_err(|_| ApiError::bad_request("saved connection not found"))?;
    let path = connection_store::storage_path();
    Ok(Json(saved_connection_detail_response(&safe, &path, &data)))
}

pub async fn get_connection_history(
    Path(name): Path<String>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<Vec<ConnectionHistoryEntry>>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let limit = query.limit.unwrap_or(20);
    let rows =
        history_store::list_history_by_connection_name(&safe, limit).map_err(ApiError::from)?;
    let items = rows
        .into_iter()
        .map(|row| ConnectionHistoryEntry {
            id: row.id,
            ts_ms: row.ts_ms,
            connection_key: row.connection_key,
            connection_name: row.connection_name,
            host: row.host,
            port: row.port,
            username: row.username,
            device_profile: row.device_profile,
            operation: row.operation,
            command_label: row.command_label,
            mode: row.mode,
            record_level: row.record_level,
            record_path: row.record_path,
        })
        .collect::<Vec<_>>();
    Ok(Json(items))
}

pub async fn get_connection_history_detail(
    Path((name, id)): Path<(String, String)>,
) -> Result<Json<ConnectionHistoryDetailResponse>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let rows = history_store::list_history_by_connection_name(&safe, 0).map_err(ApiError::from)?;
    let row = rows
        .into_iter()
        .find(|item| item.id == id)
        .ok_or_else(|| ApiError::bad_request("history record not found"))?;

    let jsonl = history_store::load_recording_jsonl_by_key(&row.connection_key, &row.id)
        .map_err(ApiError::from)?
        .ok_or_else(|| ApiError::bad_request("history record body not found"))?;
    let recorder = SessionRecorder::from_jsonl(&jsonl).map_err(ApiError::from)?;
    let entries = recorder.entries().map_err(ApiError::from)?;

    Ok(Json(ConnectionHistoryDetailResponse {
        meta: ConnectionHistoryEntry {
            id: row.id,
            ts_ms: row.ts_ms,
            connection_key: row.connection_key,
            connection_name: row.connection_name,
            host: row.host,
            port: row.port,
            username: row.username,
            device_profile: row.device_profile,
            operation: row.operation,
            command_label: row.command_label,
            mode: row.mode,
            record_level: row.record_level,
            record_path: row.record_path,
        },
        entries,
    }))
}

pub async fn delete_connection_history(
    Path((name, id)): Path<(String, String)>,
) -> Result<Json<Value>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let deleted =
        history_store::delete_history_by_connection_name(&safe, &id).map_err(ApiError::from)?;
    Ok(Json(json!({ "ok": true, "deleted": deleted })))
}

pub async fn upsert_connection(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<UpsertConnectionRequest>,
) -> Result<Json<SavedConnectionDetail>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let c = req.connection;
    let save_password = should_persist_secret(req.save_password, c.password.as_deref())
        || should_persist_secret(req.save_password, c.enable_password.as_deref());
    let existing = connection_store::load_connection_raw(&safe).ok();
    let existing_password = connection_store::load_saved_secret(
        existing
            .as_ref()
            .and_then(|item| item.password_ref.as_deref()),
    )
    .map_err(ApiError::from)?;
    let existing_enable_password = connection_store::load_saved_secret(
        existing
            .as_ref()
            .and_then(|item| item.enable_password_ref.as_deref()),
    )
    .map_err(ApiError::from)?;
    let data = SavedConnection {
        host: c.host,
        username: c.username,
        password: merged_saved_secret(save_password, c.password, existing_password.as_ref()),
        password_ref: None,
        port: c.port,
        enable_password: merged_saved_secret(
            save_password,
            c.enable_password,
            existing_enable_password.as_ref(),
        ),
        enable_password_ref: None,
        ssh_security: c
            .ssh_security
            .or_else(|| existing.as_ref().and_then(|item| item.ssh_security)),
        linux_shell_flavor: c
            .linux_shell_flavor
            .or_else(|| existing.as_ref().and_then(|item| item.linux_shell_flavor)),
        device_profile: c.device_profile,
        template_dir: c.template_dir,
        enabled: c.enabled,
        labels: c.labels,
        groups: c.groups,
        vars: c.vars,
    };
    let path = connection_store::save_connection(&safe, &data).map_err(ApiError::from)?;
    if let Some(registrar) = state.registrar()
        && let Err(err) = registrar.trigger_device_inventory_sync_if_changed(5).await
    {
        warn!(
            "failed to schedule device inventory sync after connection upsert: {}",
            err
        );
    }

    Ok(Json(saved_connection_detail_response(&safe, &path, &data)))
}

pub async fn delete_connection(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let deleted = connection_store::delete_connection(&safe).map_err(ApiError::from)?;
    if deleted
        && let Some(registrar) = state.registrar()
        && let Err(err) = registrar.trigger_device_inventory_sync_if_changed(5).await
    {
        warn!(
            "failed to schedule device inventory sync after connection delete: {}",
            err
        );
    }
    Ok(Json(json!({ "ok": true, "deleted": deleted })))
}

pub async fn list_inventory_groups() -> Result<Json<Vec<InventoryGroup>>, ApiError> {
    let items = inventory_store::list_groups().map_err(ApiError::from)?;
    Ok(Json(items))
}

pub async fn get_inventory_group(
    Path(name): Path<String>,
) -> Result<Json<InventoryGroup>, ApiError> {
    let item = inventory_store::get_group(&name)
        .map_err(ApiError::from)?
        .ok_or_else(|| ApiError::bad_request("inventory group not found"))?;
    Ok(Json(item))
}

pub async fn upsert_inventory_group(
    Path(name): Path<String>,
    Json(req): Json<UpsertInventoryGroupRequest>,
) -> Result<Json<InventoryGroup>, ApiError> {
    inventory_store::upsert_group(&name, &req.group).map_err(ApiError::from)?;
    let item = inventory_store::get_group(&name)
        .map_err(ApiError::from)?
        .ok_or_else(|| ApiError::internal("inventory group was not persisted"))?;
    Ok(Json(item))
}

pub async fn delete_inventory_group(Path(name): Path<String>) -> Result<Json<Value>, ApiError> {
    let deleted = inventory_store::delete_group(&name).map_err(ApiError::from)?;
    Ok(Json(json!({ "ok": true, "deleted": deleted })))
}

pub async fn resolve_inventory_vars(
    Json(req): Json<ResolveInventoryVarsRequest>,
) -> Result<Json<ResolveInventoryVarsResponse>, ApiError> {
    let resolution =
        inventory_store::resolve_vars(req.host_name.as_deref(), &req.group_names, req.runtime_vars)
            .map_err(ApiError::from)?;
    Ok(Json(ResolveInventoryVarsResponse { resolution }))
}
