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
    ConnectionTestResponse, InventoryGroup, InventoryLabel, SavedConnectionDetail,
    SavedConnectionMeta, UpsertConnectionRequest, UpsertInventoryGroupRequest,
    UpsertInventoryLabelRequest,
};
use crate::web::state::{AppState, merge_connection_options, resolve_autodetect_connection};
use axum::Json;
use axum::extract::{Multipart, Path, Query, State};
use rneter::session::SessionRecorder;
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use tracing::warn;

fn resolve_enable_password_update(
    save_password: bool,
    incoming_enable_password: Option<String>,
    incoming_empty_enter: Option<bool>,
    existing_enable_password: Option<&String>,
    existing_empty_enter: bool,
) -> (Option<String>, bool) {
    let explicit_empty_enable_password = incoming_enable_password
        .as_ref()
        .is_some_and(|value| value.trim().is_empty());
    let has_existing_enable_password =
        existing_enable_password.is_some_and(|value| !value.is_empty());
    let final_empty_enter = incoming_empty_enter.unwrap_or_else(|| {
        explicit_empty_enable_password
            || (incoming_enable_password.is_none()
                && (!has_existing_enable_password || existing_empty_enter))
    });
    let normalized_incoming_enable_password =
        if final_empty_enter && incoming_enable_password.is_none() {
            Some(String::new())
        } else {
            incoming_enable_password
        };
    let persist_enable_password = should_persist_secret(
        save_password,
        normalized_incoming_enable_password.as_deref(),
    );
    let merged_enable_password = merged_saved_secret(
        persist_enable_password,
        normalized_incoming_enable_password,
        existing_enable_password,
    );
    (merged_enable_password, final_empty_enter)
}

pub async fn test_connection(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ConnectionTestRequest>,
) -> Result<Json<ConnectionTestResponse>, ApiError> {
    let conn =
        resolve_autodetect_connection(merge_connection_options(&state.defaults, req.connection)?)
            .await?;
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
                has_enable_password: connection_store::has_saved_enable_password(&data),
                enable_password_empty_enter: data.enable_password_empty_enter,
                host: data.host.clone(),
                username: data.username.clone(),
                port: data.port,
                ssh_security: data.ssh_security,
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

pub(super) fn upsert_connection_target_name(
    route_name: &str,
    request_connection_name: Option<&str>,
) -> Result<String, anyhow::Error> {
    let requested = request_connection_name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(route_name);
    connection_store::safe_connection_name(requested)
}

pub async fn upsert_connection(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<UpsertConnectionRequest>,
) -> Result<Json<SavedConnectionDetail>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let c = req.connection;
    let target_safe = upsert_connection_target_name(&safe, c.connection_name.as_deref())
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    if target_safe != safe && connection_store::load_connection_raw(&target_safe).is_ok() {
        return Err(ApiError::bad_request(format!(
            "saved connection '{}' already exists",
            target_safe
        )));
    }
    let persist_password = should_persist_secret(true, c.password.as_deref());
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
    let (enable_password, enable_password_empty_enter) = resolve_enable_password_update(
        true,
        c.enable_password,
        c.enable_password_empty_enter,
        existing_enable_password.as_ref(),
        existing
            .as_ref()
            .is_some_and(|item| item.enable_password_empty_enter),
    );
    let data = SavedConnection {
        host: c.host,
        username: c.username,
        password: merged_saved_secret(persist_password, c.password, existing_password.as_ref()),
        password_ref: None,
        port: c.port,
        enable_password,
        enable_password_ref: None,
        enable_password_empty_enter,
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
    let path = connection_store::save_connection(&target_safe, &data).map_err(ApiError::from)?;
    if target_safe != safe && existing.is_some() {
        connection_store::delete_connection(&safe).map_err(ApiError::from)?;
    }
    if let Some(registrar) = state.registrar()
        && let Err(err) = registrar.trigger_device_inventory_sync_if_changed(5).await
    {
        warn!(
            "failed to schedule device inventory sync after connection upsert: {}",
            err
        );
    }

    Ok(Json(saved_connection_detail_response(
        &target_safe,
        &path,
        &data,
    )))
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

fn normalize_inventory_label_name(raw: &str) -> Result<String, ApiError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(ApiError::bad_request("label name is required"));
    }
    if !trimmed
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.'))
    {
        return Err(ApiError::bad_request(format!(
            "invalid label name '{}', use only letters/numbers/_/./-",
            raw
        )));
    }
    Ok(trimmed.to_string())
}

fn list_labels_snapshot() -> Result<Vec<InventoryLabel>, ApiError> {
    let names = connection_store::list_connections().map_err(ApiError::from)?;
    let mut by_label: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for connection_name in names {
        let data =
            connection_store::load_connection_raw(&connection_name).map_err(ApiError::from)?;
        for label in data.labels {
            by_label
                .entry(label)
                .or_default()
                .insert(connection_name.clone());
        }
    }
    Ok(by_label
        .into_iter()
        .map(|(name, hosts)| InventoryLabel {
            name,
            hosts: hosts.into_iter().collect(),
        })
        .collect())
}

fn upsert_label_hosts(name: &str, hosts: &[String]) -> Result<InventoryLabel, ApiError> {
    let label = normalize_inventory_label_name(name)?;
    let mut desired_hosts = BTreeSet::new();
    for host in hosts {
        let safe = connection_store::safe_connection_name(host).map_err(ApiError::from)?;
        connection_store::load_connection_raw(&safe).map_err(ApiError::from)?;
        desired_hosts.insert(safe);
    }

    let names = connection_store::list_connections().map_err(ApiError::from)?;
    for connection_name in names {
        let mut data =
            connection_store::load_connection_raw(&connection_name).map_err(ApiError::from)?;
        let has_label = data.labels.iter().any(|item| item == &label);
        let should_have_label = desired_hosts.contains(&connection_name);
        if has_label == should_have_label {
            continue;
        }
        if should_have_label {
            data.labels.push(label.clone());
            data.labels.sort();
            data.labels.dedup();
        } else {
            data.labels.retain(|item| item != &label);
        }
        connection_store::save_connection(&connection_name, &data).map_err(ApiError::from)?;
    }

    Ok(InventoryLabel {
        name: label,
        hosts: desired_hosts.into_iter().collect(),
    })
}

pub async fn list_inventory_labels() -> Result<Json<Vec<InventoryLabel>>, ApiError> {
    Ok(Json(list_labels_snapshot()?))
}

pub async fn get_inventory_label(
    Path(name): Path<String>,
) -> Result<Json<InventoryLabel>, ApiError> {
    let normalized = normalize_inventory_label_name(&name)?;
    let items = list_labels_snapshot()?;
    let item = items
        .into_iter()
        .find(|item| item.name == normalized)
        .ok_or_else(|| ApiError::bad_request("inventory label not found"))?;
    Ok(Json(item))
}

pub async fn upsert_inventory_label(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<UpsertInventoryLabelRequest>,
) -> Result<Json<InventoryLabel>, ApiError> {
    let item = upsert_label_hosts(&name, &req.hosts)?;
    if let Some(registrar) = state.registrar()
        && let Err(err) = registrar.trigger_device_inventory_sync_if_changed(5).await
    {
        warn!(
            "failed to schedule device inventory sync after inventory label upsert: {}",
            err
        );
    }
    Ok(Json(item))
}

pub async fn delete_inventory_label(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let label = normalize_inventory_label_name(&name)?;
    let existed = list_labels_snapshot()?
        .into_iter()
        .any(|item| item.name == label);
    if existed {
        let _ = upsert_label_hosts(&label, &[])?;
        if let Some(registrar) = state.registrar()
            && let Err(err) = registrar.trigger_device_inventory_sync_if_changed(5).await
        {
            warn!(
                "failed to schedule device inventory sync after inventory label delete: {}",
                err
            );
        }
    }
    Ok(Json(json!({ "ok": true, "deleted": existed })))
}

#[cfg(test)]
mod tests {
    use super::resolve_enable_password_update;

    #[test]
    fn empty_enable_password_mode_clears_existing_secret() {
        let existing = "stored-enable".to_string();
        let (enable_password, empty_enter) =
            resolve_enable_password_update(true, None, Some(true), Some(&existing), false);
        assert_eq!(enable_password, Some(String::new()));
        assert!(empty_enter);
    }

    #[test]
    fn explicit_empty_enable_password_enables_empty_enter_when_unspecified() {
        let (enable_password, empty_enter) =
            resolve_enable_password_update(false, Some("".to_string()), None, None, false);
        assert_eq!(enable_password, Some(String::new()));
        assert!(empty_enter);
    }
}
