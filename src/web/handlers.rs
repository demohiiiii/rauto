use crate::config::device_profile::DeviceProfile;
use crate::config::template_loader;
use crate::config::{connection_store, connection_store::SavedConnection};
use crate::config::{history_store, history_store::HistoryBinding};
use crate::device::DeviceClient;
use crate::template::renderer::Renderer;
use crate::web::error::ApiError;
use crate::web::models::{
    BuiltinProfileDetail, CommandResult, ConnectionRequest, ConnectionTestRequest,
    ConnectionHistoryDetailResponse, ConnectionHistoryEntry, ConnectionTestResponse,
    CreateTemplateRequest, CustomProfileDetail,
    DeviceProfilesOverview, ExecRequest, ExecResponse, ExecuteTemplateRequest,
    ExecuteTemplateResponse, ExecuteTxBlockRequest, ExecuteTxBlockResponse,
    ExecuteTxWorkflowRequest, ExecuteTxWorkflowResponse,
    InteractiveCommandRequest, InteractiveCommandResponse, InteractiveStartRequest,
    InteractiveStartResponse, InteractiveStopResponse,
    ProfileDiagnoseRequest, ProfileDiagnoseResponse, RecordLevel, RenderRequest, RenderResponse,
    ReplayContextDto, ReplayOutputDto, ReplayRequest, ReplayResponse, SavedConnectionDetail,
    SavedConnectionMeta, TemplateDetail, TemplateMeta, UpdateTemplateRequest,
    UpsertConnectionRequest, UpsertCustomProfileRequest,
};
use crate::web::state::{AppState, InteractiveSession, merge_connection_options};
use crate::web::storage;
use axum::{
    Json,
    extract::{Query, State},
};
use rneter::session::{
    CommandBlockKind, RollbackPolicy, MANAGER, SessionRecordLevel, SessionRecorder,
    SessionReplayer, TxBlock, TxStep,
};
use rneter::templates as rneter_templates;
use serde_json::{Value, json};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tracing::warn;

#[derive(Debug, serde::Deserialize)]
pub struct HistoryQuery {
    pub limit: Option<usize>,
}

pub async fn health() -> Json<Value> {
    Json(json!({"status": "ok"}))
}

pub async fn list_profiles(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<String>>, ApiError> {
    let profiles = template_loader::list_available_profiles(state.defaults.template_dir.as_ref())?;
    Ok(Json(profiles))
}

pub async fn profiles_overview(
    State(state): State<Arc<AppState>>,
) -> Result<Json<DeviceProfilesOverview>, ApiError> {
    let profile_dir = storage::resolve_profiles_dir(state.defaults.template_dir.as_ref());
    let custom = storage::list_custom_profiles(&profile_dir)?;
    Ok(Json(DeviceProfilesOverview {
        builtins: storage::builtin_profiles(),
        custom,
    }))
}

pub async fn get_builtin_profile_detail(
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<BuiltinProfileDetail>, ApiError> {
    let detail = storage::builtin_profile_detail(&name)
        .ok_or_else(|| ApiError::bad_request("builtin profile not found"))?;
    Ok(Json(detail))
}

pub async fn get_builtin_profile_form(
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<DeviceProfile>, ApiError> {
    let profile = storage::builtin_profile_form(&name)
        .ok_or_else(|| ApiError::bad_request("builtin profile not found"))?;
    Ok(Json(profile))
}

pub async fn get_custom_profile(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<CustomProfileDetail>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    let profile_dir = storage::resolve_profiles_dir(state.defaults.template_dir.as_ref());
    let path = profile_dir.join(format!("{}.toml", safe_name));
    if !path.exists() {
        return Err(ApiError::bad_request("custom profile not found"));
    }
    let content = fs::read_to_string(&path).map_err(ApiError::from)?;
    Ok(Json(CustomProfileDetail {
        name: safe_name,
        path: path.to_string_lossy().to_string(),
        content,
    }))
}

pub async fn create_or_update_custom_profile(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
    Json(req): Json<UpsertCustomProfileRequest>,
) -> Result<Json<CustomProfileDetail>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    let profile_dir = storage::resolve_profiles_dir(state.defaults.template_dir.as_ref());
    storage::ensure_dir(&profile_dir)?;
    let path = profile_dir.join(format!("{}.toml", safe_name));
    fs::write(&path, req.content.as_bytes()).map_err(ApiError::from)?;
    Ok(Json(CustomProfileDetail {
        name: safe_name,
        path: path.to_string_lossy().to_string(),
        content: req.content,
    }))
}

pub async fn get_custom_profile_form(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<DeviceProfile>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    let profile_dir = storage::resolve_profiles_dir(state.defaults.template_dir.as_ref());
    let path = profile_dir.join(format!("{}.toml", safe_name));
    if !path.exists() {
        return Err(ApiError::bad_request("custom profile not found"));
    }
    let content = fs::read_to_string(&path).map_err(ApiError::from)?;
    let mut profile: DeviceProfile = toml::from_str(&content).map_err(ApiError::from)?;
    profile.name = safe_name;
    Ok(Json(profile))
}

pub async fn upsert_custom_profile_form(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
    Json(mut profile): Json<DeviceProfile>,
) -> Result<Json<CustomProfileDetail>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    let profile_dir = storage::resolve_profiles_dir(state.defaults.template_dir.as_ref());
    storage::ensure_dir(&profile_dir)?;
    profile.name = safe_name.clone();
    let toml_content = toml::to_string_pretty(&profile).map_err(ApiError::from)?;
    let path = profile_dir.join(format!("{}.toml", safe_name));
    fs::write(&path, toml_content.as_bytes()).map_err(ApiError::from)?;
    Ok(Json(CustomProfileDetail {
        name: safe_name,
        path: path.to_string_lossy().to_string(),
        content: toml_content,
    }))
}

pub async fn delete_custom_profile(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    let profile_dir = storage::resolve_profiles_dir(state.defaults.template_dir.as_ref());
    let path = profile_dir.join(format!("{}.toml", safe_name));
    if path.exists() {
        fs::remove_file(path).map_err(ApiError::from)?;
    }
    Ok(Json(json!({"ok": true})))
}

pub async fn list_templates(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<TemplateMeta>>, ApiError> {
    let commands_dir = storage::resolve_commands_dir(state.defaults.template_dir.as_ref());
    let templates = storage::list_templates(&commands_dir)?;
    Ok(Json(templates))
}

pub async fn get_template(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_template_name(&name)?;
    let commands_dir = storage::resolve_commands_dir(state.defaults.template_dir.as_ref());
    let path = commands_dir.join(&safe_name);
    if !path.exists() {
        return Err(ApiError::bad_request("template not found"));
    }
    let content = fs::read_to_string(&path).map_err(ApiError::from)?;
    Ok(Json(TemplateDetail {
        name: safe_name,
        path: path.to_string_lossy().to_string(),
        content,
    }))
}

pub async fn create_template(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_template_name(&req.name)?;
    let commands_dir = storage::resolve_commands_dir(state.defaults.template_dir.as_ref());
    storage::ensure_dir(&commands_dir)?;
    let path = commands_dir.join(&safe_name);
    fs::write(&path, req.content.as_bytes()).map_err(ApiError::from)?;
    Ok(Json(TemplateDetail {
        name: safe_name,
        path: path.to_string_lossy().to_string(),
        content: req.content,
    }))
}

pub async fn update_template(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
    Json(req): Json<UpdateTemplateRequest>,
) -> Result<Json<TemplateDetail>, ApiError> {
    let safe_name = storage::safe_template_name(&name)?;
    let commands_dir = storage::resolve_commands_dir(state.defaults.template_dir.as_ref());
    storage::ensure_dir(&commands_dir)?;
    let path = commands_dir.join(&safe_name);
    fs::write(&path, req.content.as_bytes()).map_err(ApiError::from)?;
    Ok(Json(TemplateDetail {
        name: safe_name,
        path: path.to_string_lossy().to_string(),
        content: req.content,
    }))
}

pub async fn delete_template(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_template_name(&name)?;
    let commands_dir = storage::resolve_commands_dir(state.defaults.template_dir.as_ref());
    let path = commands_dir.join(safe_name);
    if path.exists() {
        fs::remove_file(path).map_err(ApiError::from)?;
    }
    Ok(Json(json!({"ok": true})))
}

pub async fn render_template(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RenderRequest>,
) -> Result<Json<RenderResponse>, ApiError> {
    let template_dir = req
        .template_dir
        .map(PathBuf::from)
        .or_else(|| state.defaults.template_dir.clone());

    let renderer = Renderer::new(template_dir);
    let rendered = renderer.render_file(&req.template, req.vars)?;

    Ok(Json(RenderResponse {
        rendered_commands: rendered,
    }))
}

fn to_record_level(level: Option<RecordLevel>) -> Option<SessionRecordLevel> {
    match level {
        Some(RecordLevel::Off) => None,
        Some(RecordLevel::KeyEventsOnly) => Some(SessionRecordLevel::KeyEventsOnly),
        Some(RecordLevel::Full) => Some(SessionRecordLevel::Full),
        None => Some(SessionRecordLevel::KeyEventsOnly),
    }
}

fn record_level_name(level: Option<RecordLevel>) -> &'static str {
    match level {
        Some(RecordLevel::Off) => "off",
        Some(RecordLevel::KeyEventsOnly) | None => "key-events-only",
        Some(RecordLevel::Full) => "full",
    }
}

fn persist_history_if_recorded(
    conn: &crate::web::state::ResolvedConnection,
    client: &DeviceClient,
    operation: &str,
    command_label: &str,
    mode: Option<&str>,
    level: Option<RecordLevel>,
) {
    if matches!(level, Some(RecordLevel::Off)) {
        return;
    }
    let Some(jsonl) = client.recording_jsonl().ok().flatten() else {
        return;
    };
    if let Err(e) = history_store::save_recording(
        HistoryBinding {
            connection_name: conn.connection_name.as_deref(),
            host: &conn.host,
            port: conn.port,
            username: &conn.username,
            device_profile: &conn.device_profile,
        },
        operation,
        command_label,
        mode,
        record_level_name(level),
        &jsonl,
    ) {
        warn!("failed to persist execution history: {}", e);
    }
}

pub async fn diagnose_profile(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ProfileDiagnoseRequest>,
) -> Result<Json<ProfileDiagnoseResponse>, ApiError> {
    let name = req.name.trim();
    if name.is_empty() {
        return Err(ApiError::bad_request("profile name is required"));
    }

    let template_dir = req
        .template_dir
        .as_ref()
        .map(PathBuf::from)
        .or_else(|| state.defaults.template_dir.clone());

    let handler = template_loader::load_device_profile(name, template_dir.as_ref())?;

    let diagnostics = handler.diagnose_state_machine();

    Ok(Json(ProfileDiagnoseResponse {
        name: name.to_string(),
        diagnostics,
    }))
}

pub async fn exec_command(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecRequest>,
) -> Result<Json<ExecResponse>, ApiError> {
    let record_level = req.record_level;
    let conn = merge_connection_options(&state.defaults, req.connection)?;
    let handler =
        template_loader::load_device_profile(&conn.device_profile, conn.template_dir.as_ref())?;

    let client = if let Some(level) = to_record_level(record_level) {
        DeviceClient::connect_with_recording(
            conn.host.clone(),
            conn.port,
            conn.username.clone(),
            conn.password.clone(),
            conn.enable_password.clone(),
            handler,
            level,
        )
        .await?
    } else {
        DeviceClient::connect(
            conn.host.clone(),
            conn.port,
            conn.username.clone(),
            conn.password.clone(),
            conn.enable_password.clone(),
            handler,
        )
        .await?
    };

    let output = client.execute(&req.command, req.mode.as_deref()).await?;
    persist_history_if_recorded(
        &conn,
        &client,
        "exec",
        &req.command,
        req.mode.as_deref(),
        record_level,
    );
    Ok(Json(ExecResponse {
        output,
        recording_jsonl: client.recording_jsonl()?,
    }))
}

pub async fn interactive_start(
    State(state): State<Arc<AppState>>,
    Json(req): Json<InteractiveStartRequest>,
) -> Result<Json<InteractiveStartResponse>, ApiError> {
    let record_level = req.record_level;
    let conn = merge_connection_options(&state.defaults, req.connection)?;
    let handler =
        template_loader::load_device_profile(&conn.device_profile, conn.template_dir.as_ref())?;
    let client = if let Some(level) = to_record_level(record_level) {
        DeviceClient::connect_with_recording(
            conn.host.clone(),
            conn.port,
            conn.username.clone(),
            conn.password.clone(),
            conn.enable_password.clone(),
            handler,
            level,
        )
        .await?
    } else {
        DeviceClient::connect(
            conn.host.clone(),
            conn.port,
            conn.username.clone(),
            conn.password.clone(),
            conn.enable_password.clone(),
            handler,
        )
        .await?
    };

    let session_id = state.next_interactive_id();
    let session = InteractiveSession {
        client,
        conn,
        record_level,
        last_used: Instant::now(),
    };
    let mut sessions = state.interactive_sessions.lock().await;
    sessions.insert(session_id.clone(), session);

    Ok(Json(InteractiveStartResponse { session_id }))
}

pub async fn interactive_command(
    State(state): State<Arc<AppState>>,
    Json(req): Json<InteractiveCommandRequest>,
) -> Result<Json<InteractiveCommandResponse>, ApiError> {
    let mut sessions = state.interactive_sessions.lock().await;
    let mut session = sessions
        .remove(&req.session_id)
        .ok_or_else(|| ApiError::bad_request("interactive session not found"))?;
    drop(sessions);

    let output = session.client.execute(&req.command, req.mode.as_deref()).await?;
    session.last_used = Instant::now();

    let mut sessions = state.interactive_sessions.lock().await;
    sessions.insert(req.session_id, session);

    Ok(Json(InteractiveCommandResponse { output }))
}

pub async fn interactive_stop(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<InteractiveStopResponse>, ApiError> {
    let mut sessions = state.interactive_sessions.lock().await;
    let session = sessions
        .remove(&id)
        .ok_or_else(|| ApiError::bad_request("interactive session not found"))?;
    drop(sessions);

    persist_history_if_recorded(
        &session.conn,
        &session.client,
        "interactive",
        "interactive session",
        None,
        session.record_level,
    );
    let recording_jsonl = session.client.recording_jsonl()?;

    Ok(Json(InteractiveStopResponse {
        ok: true,
        recording_jsonl,
    }))
}

pub async fn test_connection(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ConnectionTestRequest>,
) -> Result<Json<ConnectionTestResponse>, ApiError> {
    let conn = merge_connection_options(&state.defaults, req.connection)?;
    let handler =
        template_loader::load_device_profile(&conn.device_profile, conn.template_dir.as_ref())?;
    let _client = DeviceClient::connect(
        conn.host.clone(),
        conn.port,
        conn.username.clone(),
        conn.password,
        conn.enable_password,
        handler,
    )
    .await?;

    Ok(Json(ConnectionTestResponse {
        ok: true,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        device_profile: conn.device_profile,
    }))
}

pub async fn list_connections() -> Result<Json<Vec<SavedConnectionMeta>>, ApiError> {
    let names = connection_store::list_connections().map_err(ApiError::from)?;
    let mut items = Vec::new();
    for name in names {
        if let Ok(data) = connection_store::load_connection(&name) {
            let path = connection_store::connections_dir().join(format!("{}.toml", name));
            items.push(SavedConnectionMeta {
                name,
                path: path.to_string_lossy().to_string(),
                has_password: data.password.as_deref().is_some_and(|s| !s.is_empty()),
            });
        }
    }
    Ok(Json(items))
}

pub async fn get_connection(
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<SavedConnectionDetail>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let data = connection_store::load_connection(&safe)
        .map_err(|_| ApiError::bad_request("saved connection not found"))?;
    let path = connection_store::connections_dir().join(format!("{}.toml", safe));
    Ok(Json(SavedConnectionDetail {
        name: safe.clone(),
        path: path.to_string_lossy().to_string(),
        has_password: data.password.as_deref().is_some_and(|s| !s.is_empty()),
        connection: ConnectionRequest {
            connection_name: Some(safe.clone()),
            host: data.host,
            username: data.username,
            password: data.password,
            port: data.port,
            enable_password: data.enable_password,
            device_profile: data.device_profile,
            template_dir: data.template_dir,
        },
    }))
}

pub async fn get_connection_history(
    axum::extract::Path(name): axum::extract::Path<String>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<Vec<ConnectionHistoryEntry>>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let limit = query.limit.unwrap_or(20);
    let rows = history_store::list_history_by_connection_name(&safe, limit).map_err(ApiError::from)?;
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
    axum::extract::Path((name, id)): axum::extract::Path<(String, String)>,
) -> Result<Json<ConnectionHistoryDetailResponse>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let rows = history_store::list_history_by_connection_name(&safe, 0).map_err(ApiError::from)?;
    let row = rows
        .into_iter()
        .find(|item| item.id == id)
        .ok_or_else(|| ApiError::bad_request("history record not found"))?;

    let jsonl = fs::read_to_string(&row.record_path).map_err(ApiError::from)?;
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
    axum::extract::Path((name, id)): axum::extract::Path<(String, String)>,
) -> Result<Json<Value>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let deleted = history_store::delete_history_by_connection_name(&safe, &id).map_err(ApiError::from)?;
    Ok(Json(json!({ "ok": true, "deleted": deleted })))
}

pub async fn upsert_connection(
    axum::extract::Path(name): axum::extract::Path<String>,
    Json(req): Json<UpsertConnectionRequest>,
) -> Result<Json<SavedConnectionDetail>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let c = req.connection;
    let save_password = req.save_password;
    let data = SavedConnection {
        host: c.host,
        username: c.username,
        password: if save_password { c.password } else { None },
        port: c.port,
        enable_password: if save_password {
            c.enable_password
        } else {
            None
        },
        device_profile: c.device_profile,
        template_dir: c.template_dir,
    };
    let path = connection_store::save_connection(&safe, &data).map_err(ApiError::from)?;

    Ok(Json(SavedConnectionDetail {
        name: safe.clone(),
        path: path.to_string_lossy().to_string(),
        has_password: data.password.as_deref().is_some_and(|s| !s.is_empty()),
        connection: ConnectionRequest {
            connection_name: Some(safe.clone()),
            host: data.host,
            username: data.username,
            password: data.password,
            port: data.port,
            enable_password: data.enable_password,
            device_profile: data.device_profile,
            template_dir: data.template_dir,
        },
    }))
}

pub async fn delete_connection(
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe = connection_store::safe_connection_name(&name)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let deleted = connection_store::delete_connection(&safe).map_err(ApiError::from)?;
    Ok(Json(json!({ "ok": true, "deleted": deleted })))
}

pub async fn execute_template(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTemplateRequest>,
) -> Result<Json<ExecuteTemplateResponse>, ApiError> {
    let record_level = req.record_level;
    let template_dir = req
        .template_dir
        .map(PathBuf::from)
        .or_else(|| state.defaults.template_dir.clone());
    let renderer = Renderer::new(template_dir);
    let rendered_commands = renderer.render_file(&req.template, req.vars)?;

    if req.dry_run.unwrap_or(false) {
        return Ok(Json(ExecuteTemplateResponse {
            rendered_commands,
            executed: Vec::new(),
            recording_jsonl: None,
        }));
    }

    let conn = merge_connection_options(&state.defaults, req.connection)?;
    let handler =
        template_loader::load_device_profile(&conn.device_profile, conn.template_dir.as_ref())?;
    let client = if let Some(level) = to_record_level(record_level) {
        DeviceClient::connect_with_recording(
            conn.host.clone(),
            conn.port,
            conn.username.clone(),
            conn.password.clone(),
            conn.enable_password.clone(),
            handler,
            level,
        )
        .await?
    } else {
        DeviceClient::connect(
            conn.host.clone(),
            conn.port,
            conn.username.clone(),
            conn.password.clone(),
            conn.enable_password.clone(),
            handler,
        )
        .await?
    };

    let lines: Vec<String> = rendered_commands
        .lines()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let mut executed = Vec::with_capacity(lines.len());
    for cmd in lines {
        match client.execute(&cmd, req.mode.as_deref()).await {
            Ok(output) => executed.push(CommandResult {
                command: cmd,
                success: true,
                output: Some(output),
                error: None,
            }),
            Err(e) => executed.push(CommandResult {
                command: cmd,
                success: false,
                output: None,
                error: Some(e.to_string()),
            }),
        }
    }

    persist_history_if_recorded(
        &conn,
        &client,
        "template_execute",
        &format!("template: {}", req.template),
        req.mode.as_deref(),
        record_level,
    );

    Ok(Json(ExecuteTemplateResponse {
        rendered_commands,
        executed,
        recording_jsonl: client.recording_jsonl()?,
    }))
}

fn resolve_tx_commands(
    renderer: &Renderer,
    template: Option<&str>,
    vars: Value,
    commands: &[String],
) -> Result<Vec<String>, ApiError> {
    let mut all = Vec::new();
    if let Some(name) = template {
        let rendered = renderer.render_file(name, vars)?;
        all.extend(
            rendered
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
        );
    }
    all.extend(
        commands
            .iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
    );
    if all.is_empty() {
        return Err(ApiError::bad_request(
            "tx requires at least one command or a template",
        ));
    }
    Ok(all)
}

pub async fn execute_tx_block(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxBlockRequest>,
) -> Result<Json<ExecuteTxBlockResponse>, ApiError> {
    let record_level = req.record_level;
    let template_key = req
        .template_profile
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .or_else(|| {
            req.connection
                .as_ref()
                .and_then(|c| c.device_profile.as_ref())
                .filter(|s| !s.trim().is_empty())
                .cloned()
        })
        .or_else(|| {
            state
                .defaults
                .device_profile
                .as_ref()
                .filter(|s| !s.trim().is_empty())
                .cloned()
        })
        .unwrap_or_else(|| "cisco".to_string());
    let block_name = req
        .name
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("tx-block")
        .to_string();
    let mode = req
        .mode
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("Config")
        .to_string();

    let template_dir = req
        .connection
        .as_ref()
        .and_then(|c| c.template_dir.as_ref())
        .map(PathBuf::from)
        .or_else(|| state.defaults.template_dir.clone());
    let renderer = Renderer::new(template_dir);
    let resolved_commands = resolve_tx_commands(
        &renderer,
        req.template.as_deref(),
        req.vars,
        &req.commands,
    )?;

    if req.rollback_trigger_step_index.is_some() && req.resource_rollback_command.is_none() {
        return Err(ApiError::bad_request(
            "rollback_trigger_step_index requires resource_rollback_command",
        ));
    }

    let mut rollback_commands = req.rollback_commands;
    while rollback_commands.len() > resolved_commands.len()
        && rollback_commands.last().map(|s| s.trim().is_empty()).unwrap_or(false)
    {
        rollback_commands.pop();
    }

    let tx_block = if !rollback_commands.is_empty() {
        if rollback_commands.len() > resolved_commands.len() {
            return Err(ApiError::bad_request(
                "rollback_commands length must not exceed commands length",
            ));
        }
        while rollback_commands.len() < resolved_commands.len() {
            rollback_commands.push(String::new());
        }
        let steps: Vec<TxStep> = resolved_commands
            .iter()
            .enumerate()
            .map(|(idx, cmd)| TxStep {
                mode: mode.to_string(),
                command: cmd.clone(),
                timeout_secs: req.timeout_secs,
                rollback_command: if rollback_commands[idx].trim().is_empty() {
                    None
                } else {
                    Some(rollback_commands[idx].clone())
                },
                rollback_on_failure: req.rollback_on_failure.unwrap_or(false),
            })
            .collect();
        let tx_block = TxBlock {
            name: block_name.to_string(),
            kind: CommandBlockKind::Config,
            rollback_policy: RollbackPolicy::PerStep,
            steps,
            fail_fast: true,
        };
        tx_block.validate().map_err(ApiError::from)?;
        tx_block
    } else {
        let mut tx_block = rneter_templates::build_tx_block(
            &template_key,
            &block_name,
            &mode,
            &resolved_commands,
            req.timeout_secs,
            req.resource_rollback_command,
        )?;
        if req.rollback_on_failure.unwrap_or(false) {
            for step in tx_block.steps.iter_mut() {
                step.rollback_on_failure = true;
            }
        }
        if let Some(trigger) = req.rollback_trigger_step_index {
            match tx_block.rollback_policy {
                RollbackPolicy::WholeResource {
                    mode,
                    undo_command,
                    timeout_secs,
                    ..
                } => {
                    tx_block.rollback_policy = RollbackPolicy::WholeResource {
                        mode,
                        undo_command,
                        timeout_secs,
                        trigger_step_index: trigger,
                    };
                }
                _ => {
                    return Err(ApiError::bad_request(
                        "rollback_trigger_step_index requires whole_resource rollback",
                    ));
                }
            }
        }
        tx_block
    };
    let tx_block_value = serde_json::to_value(&tx_block).map_err(ApiError::from)?;
    if req.dry_run.unwrap_or(false) {
        return Ok(Json(ExecuteTxBlockResponse {
            tx_block: tx_block_value,
            tx_result: None,
            recording_jsonl: None,
        }));
    }

    let conn = merge_connection_options(&state.defaults, req.connection)?;
    let handler =
        template_loader::load_device_profile(&conn.device_profile, conn.template_dir.as_ref())?;
    let (tx_result, recording_jsonl) = if let Some(level) = to_record_level(record_level) {
        let (_sender, recorder) = MANAGER
            .get_with_recording_level(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                level,
            )
            .await?;
        let handler_for_tx =
            template_loader::load_device_profile(&conn.device_profile, conn.template_dir.as_ref())?;
        let result = MANAGER
            .execute_tx_block(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler_for_tx,
                tx_block.clone(),
                None,
            )
            .await?;
        let jsonl = recorder.to_jsonl().map_err(ApiError::from)?;
        if let Err(e) = history_store::save_recording(
            HistoryBinding {
                connection_name: conn.connection_name.as_deref(),
                host: &conn.host,
                port: conn.port,
                username: &conn.username,
                device_profile: &conn.device_profile,
            },
            "tx_block",
            &block_name,
            Some(&mode),
            record_level_name(record_level),
            &jsonl,
        ) {
            warn!("failed to persist execution history: {}", e);
        }
        (result, Some(jsonl))
    } else {
        let result = MANAGER
            .execute_tx_block(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                tx_block.clone(),
                None,
            )
            .await?;
        (result, None)
    };

    Ok(Json(ExecuteTxBlockResponse {
        tx_block: tx_block_value,
        tx_result: Some(serde_json::to_value(&tx_result).map_err(ApiError::from)?),
        recording_jsonl,
    }))
}

pub async fn execute_tx_workflow(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxWorkflowRequest>,
) -> Result<Json<ExecuteTxWorkflowResponse>, ApiError> {
    let record_level = req.record_level;
    let workflow: rneter::session::TxWorkflow =
        serde_json::from_value(req.workflow.clone()).map_err(ApiError::from)?;
    let workflow_value = serde_json::to_value(&workflow).map_err(ApiError::from)?;

    if req.dry_run.unwrap_or(false) {
        return Ok(Json(ExecuteTxWorkflowResponse {
            workflow: workflow_value,
            tx_workflow_result: None,
            recording_jsonl: None,
        }));
    }

    let conn = merge_connection_options(&state.defaults, req.connection)?;
    let handler =
        template_loader::load_device_profile(&conn.device_profile, conn.template_dir.as_ref())?;
    let (workflow_result, recording_jsonl) = if let Some(level) = to_record_level(record_level) {
        let (_sender, recorder) = MANAGER
            .get_with_recording_level(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                level,
            )
            .await?;
        let handler_for_tx =
            template_loader::load_device_profile(&conn.device_profile, conn.template_dir.as_ref())?;
        let result = MANAGER
            .execute_tx_workflow(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler_for_tx,
                workflow.clone(),
                None,
            )
            .await?;
        let jsonl = recorder.to_jsonl().map_err(ApiError::from)?;
        if let Err(e) = history_store::save_recording(
            HistoryBinding {
                connection_name: conn.connection_name.as_deref(),
                host: &conn.host,
                port: conn.port,
                username: &conn.username,
                device_profile: &conn.device_profile,
            },
            "tx_workflow",
            &workflow.name,
            None,
            record_level_name(record_level),
            &jsonl,
        ) {
            warn!("failed to persist execution history: {}", e);
        }
        (result, Some(jsonl))
    } else {
        let result = MANAGER
            .execute_tx_workflow(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                workflow.clone(),
                None,
            )
            .await?;
        (result, None)
    };

    Ok(Json(ExecuteTxWorkflowResponse {
        workflow: workflow_value,
        tx_workflow_result: Some(serde_json::to_value(&workflow_result).map_err(ApiError::from)?),
        recording_jsonl,
    }))
}

pub async fn replay_session(Json(req): Json<ReplayRequest>) -> Result<Json<ReplayResponse>, ApiError> {
    let mut replayer = SessionReplayer::from_jsonl(&req.jsonl).map_err(ApiError::from)?;
    let context = replayer.initial_context().map(|ctx| ReplayContextDto {
        device_addr: ctx.device_addr,
        prompt: ctx.prompt,
        fsm_prompt: ctx.fsm_prompt,
    });

    let entries = if req.list {
        let recorder = SessionRecorder::from_jsonl(&req.jsonl).map_err(ApiError::from)?;
        recorder.entries().map_err(ApiError::from)?
    } else {
        Vec::new()
    };

    let output = if let Some(command) = req.command.as_deref() {
        let out = if let Some(mode) = req.mode.as_deref() {
            replayer.replay_next_in_mode(command, mode)
        } else {
            replayer.replay_next(command)
        }
        .map_err(ApiError::from)?;
        Some(ReplayOutputDto {
            success: out.success,
            content: out.content,
            all: out.all,
            prompt: out.prompt,
        })
    } else {
        None
    };

    Ok(Json(ReplayResponse {
        context,
        entries,
        output,
    }))
}
