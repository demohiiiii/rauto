use crate::config::{backup, command_blacklist, task_store};
use crate::web::error::ApiError;
use crate::web::models::{
    BackupCreateRequest, BackupCreateResponse, BackupMeta, BackupRestoreRequest,
    BackupRestoreResponse, BlacklistCheckRequest, BlacklistCheckResponse, BlacklistDeleteResponse,
    BlacklistPatternEntry, BlacklistUpsertRequest, BlacklistUpsertResponse, TaskArtifactDto,
    TaskEventDto, TaskRunDetailResponse, TaskRunListItem, TaskRunsQuery,
};
use crate::web::state::AppState;
use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, HeaderValue, header};
use axum::response::{IntoResponse, Response};
use serde_json::{Value, json};
use std::fs;
use std::sync::Arc;
use std::time::UNIX_EPOCH;
use tracing::warn;

#[derive(Debug, serde::Deserialize)]
pub(crate) struct ImportTemplateQuery {
    lang: Option<String>,
}

fn to_task_run_list_item(record: task_store::TaskRunRecord) -> TaskRunListItem {
    TaskRunListItem {
        task_id: record.task_id,
        operation: record.operation,
        status: record.status,
        outcome: record.outcome,
        summary: record.summary,
        success: record.success,
        agent_name: record.agent_name,
        source: record.source,
        target_label: record.target_label,
        started_at: record.started_at,
        completed_at: record.completed_at,
        execution_time_ms: record.execution_time_ms,
        has_recording: record.has_recording,
        has_error: record.has_error,
    }
}

fn to_task_event_dto(record: task_store::TaskEventRecord) -> TaskEventDto {
    TaskEventDto {
        seq: record.seq,
        task_id: record.task_id,
        operation: record.operation,
        event_type: record.event_type,
        level: record.level,
        stage: record.stage,
        message: record.message,
        progress: record.progress,
        details: record.details,
        occurred_at: record.occurred_at,
    }
}

fn to_task_artifact_dto(record: task_store::TaskArtifactRecord) -> TaskArtifactDto {
    TaskArtifactDto {
        id: record.id,
        artifact_type: record.artifact_type,
        name: record.name,
        storage_ref: record.storage_ref,
        content_type: record.content_type,
        size_bytes: record.size_bytes,
        content_text: record.content_text,
        created_at: record.created_at,
    }
}

pub async fn health() -> Json<Value> {
    Json(json!({"status": "ok"}))
}

pub async fn list_task_runs(
    Query(query): Query<TaskRunsQuery>,
) -> Result<Json<Vec<TaskRunListItem>>, ApiError> {
    let limit = query.limit.unwrap_or(50);
    let rows =
        task_store::list_task_runs(limit, query.operation.as_deref(), query.status.as_deref())
            .map_err(ApiError::from)?;
    Ok(Json(rows.into_iter().map(to_task_run_list_item).collect()))
}

pub async fn get_task_run_detail(
    Path(task_id): Path<String>,
) -> Result<Json<TaskRunDetailResponse>, ApiError> {
    let run = task_store::load_task_run(&task_id)
        .map_err(ApiError::from)?
        .ok_or_else(|| ApiError::bad_request("task not found"))?;
    let events = task_store::list_task_events(&task_id)
        .map_err(ApiError::from)?
        .into_iter()
        .map(to_task_event_dto)
        .collect::<Vec<_>>();
    let artifacts = task_store::list_task_artifacts(&task_id)
        .map_err(ApiError::from)?
        .into_iter()
        .map(to_task_artifact_dto)
        .collect::<Vec<_>>();
    Ok(Json(TaskRunDetailResponse {
        task_id: run.task_id,
        operation: run.operation,
        status: run.status,
        outcome: run.outcome,
        summary: run.summary,
        success: run.success,
        agent_name: run.agent_name,
        source: run.source,
        target_label: run.target_label,
        started_at: run.started_at,
        completed_at: run.completed_at,
        execution_time_ms: run.execution_time_ms,
        has_recording: run.has_recording,
        has_error: run.has_error,
        result_summary: run.result_summary,
        result: run.result,
        error: run.error,
        created_at: run.created_at,
        updated_at: run.updated_at,
        events,
        artifacts,
    }))
}

pub async fn list_backups() -> Result<Json<Vec<BackupMeta>>, ApiError> {
    let files = backup::list_backups()?;
    let rows = files
        .into_iter()
        .map(|path| {
            let meta = fs::metadata(&path).ok();
            let size_bytes = meta.as_ref().map(|m| m.len()).unwrap_or(0);
            let modified_ms = meta
                .as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis())
                .unwrap_or(0);
            let name = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or_default()
                .to_string();
            BackupMeta {
                path: name.clone(),
                name,
                size_bytes,
                modified_ms,
            }
        })
        .collect();
    Ok(Json(rows))
}

pub async fn create_backup(
    Json(req): Json<BackupCreateRequest>,
) -> Result<Json<BackupCreateResponse>, ApiError> {
    if req
        .output
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
    {
        return Err(ApiError::bad_request(
            "custom backup output paths are not supported by the Web API",
        ));
    }
    let saved = backup::create_backup(None)?;
    let name = saved
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| ApiError::bad_request("generated backup name is invalid"))?;
    Ok(Json(BackupCreateResponse {
        path: name.to_string(),
    }))
}

pub async fn list_blacklist_patterns() -> Result<Json<Vec<BlacklistPatternEntry>>, ApiError> {
    let items = command_blacklist::list_patterns()
        .map_err(ApiError::from)?
        .into_iter()
        .map(|pattern| BlacklistPatternEntry { pattern })
        .collect::<Vec<_>>();
    Ok(Json(items))
}

pub async fn add_blacklist_pattern(
    Json(req): Json<BlacklistUpsertRequest>,
) -> Result<Json<BlacklistUpsertResponse>, ApiError> {
    let (added, path) = command_blacklist::add_pattern(&req.pattern)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    Ok(Json(BlacklistUpsertResponse {
        pattern: req.pattern.trim().to_string(),
        added,
        path: path.to_string_lossy().to_string(),
    }))
}

pub async fn delete_blacklist_pattern(
    Path(pattern): Path<String>,
) -> Result<Json<BlacklistDeleteResponse>, ApiError> {
    let deleted = command_blacklist::delete_pattern(&pattern)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    Ok(Json(BlacklistDeleteResponse { pattern, deleted }))
}

pub async fn check_blacklist_command(
    Json(req): Json<BlacklistCheckRequest>,
) -> Result<Json<BlacklistCheckResponse>, ApiError> {
    let blocked = command_blacklist::find_blocked_command(&req.command)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    Ok(Json(BlacklistCheckResponse {
        command: req.command.trim().to_string(),
        blocked: blocked.is_some(),
        pattern: blocked.map(|item| item.pattern),
    }))
}

pub async fn restore_backup(
    State(state): State<Arc<AppState>>,
    Json(req): Json<BackupRestoreRequest>,
) -> Result<Json<BackupRestoreResponse>, ApiError> {
    let archive_name = req.archive.trim();
    let archive = backup::backup_path_by_name(archive_name)
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    backup::restore_backup(&archive, req.replace)?;
    crate::config::paths::ensure_default_layout().map_err(ApiError::from)?;
    if let Some(registrar) = state.registrar()
        && let Err(err) = registrar.trigger_device_inventory_sync_if_changed(5).await
    {
        warn!(
            "failed to schedule device inventory sync after backup restore: {}",
            err
        );
    }
    Ok(Json(BackupRestoreResponse {
        restored: true,
        archive: archive_name.to_string(),
        replace: req.replace,
    }))
}

pub async fn download_backup(Path(name): Path<String>) -> Result<Response, ApiError> {
    let path = backup::backup_path_by_name(&name)
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    let bytes = fs::read(&path).map_err(ApiError::from)?;
    let filename = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("backup.tar.gz");
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/gzip"),
    );
    let disposition = format!("attachment; filename=\"{}\"", filename);
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition).map_err(ApiError::from)?,
    );
    Ok((headers, bytes).into_response())
}

pub async fn download_connection_import_template(
    Query(query): Query<ImportTemplateQuery>,
) -> Result<Response, ApiError> {
    let is_zh = query.lang.as_deref().map(str::trim).is_some_and(|value| {
        value.eq_ignore_ascii_case("zh") || value.eq_ignore_ascii_case("zh-cn")
    });
    let filename = if is_zh {
        "rauto-connection-import-template-zh.csv"
    } else {
        "rauto-connection-import-template-en.csv"
    };
    let content = if is_zh {
        "\u{feff}连接名,主机地址,设备凭证,端口,连接超时秒,设备型号,软件版本,SSH安全级别,Linux Shell,设备模板\n"
    } else {
        "name,host,credential,port,connect_timeout_secs,device_model,software_version,ssh_security,linux_shell_flavor,device_profile\n"
    };
    csv_download_response(filename, content)
}

pub async fn download_credential_import_template(
    Query(query): Query<ImportTemplateQuery>,
) -> Result<Response, ApiError> {
    let is_zh = query.lang.as_deref().map(str::trim).is_some_and(|value| {
        value.eq_ignore_ascii_case("zh") || value.eq_ignore_ascii_case("zh-cn")
    });
    let filename = if is_zh {
        "rauto-credential-import-template-zh.csv"
    } else {
        "rauto-credential-import-template-en.csv"
    };
    let content = if is_zh {
        "\u{feff}凭证名称,登录用户名,认证类型,登录密钥,私钥内容,私钥口令,Enable密钥,启用Enable\n"
    } else {
        "name,login_username,auth_type,login_secret,private_key,passphrase,enable_secret,enable_enabled\n"
    };
    csv_download_response(filename, content)
}

fn csv_download_response(filename: &str, content: &str) -> Result<Response, ApiError> {
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/csv; charset=utf-8"),
    );
    let disposition = format!("attachment; filename=\"{}\"", filename);
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition).map_err(ApiError::from)?,
    );
    Ok((headers, content.as_bytes().to_vec()).into_response())
}

#[cfg(test)]
mod tests {
    use super::create_backup;
    use crate::web::models::BackupCreateRequest;
    use axum::Json;
    use axum::http::StatusCode;

    #[tokio::test]
    async fn web_backup_creation_rejects_custom_output_paths() {
        let error = create_backup(Json(BackupCreateRequest {
            output: Some("/tmp/rauto-owned.tar.gz".to_string()),
        }))
        .await
        .expect_err("custom host output path should be rejected");

        assert_eq!(error.status, StatusCode::BAD_REQUEST);
    }
}
