use crate::config::device_profile::DeviceProfile;
use crate::config::template_loader;
use crate::device::DeviceClient;
use crate::template::renderer::Renderer;
use crate::web::error::ApiError;
use crate::web::models::{
    BuiltinProfileDetail, CommandResult, ConnectionTestRequest, ConnectionTestResponse,
    CreateTemplateRequest, CustomProfileDetail, DeviceProfilesOverview, ExecRequest, ExecResponse,
    ExecuteTemplateRequest, ExecuteTemplateResponse, RenderRequest, RenderResponse, TemplateDetail,
    TemplateMeta, UpdateTemplateRequest, UpsertCustomProfileRequest,
};
use crate::web::state::{AppState, merge_connection_options};
use crate::web::storage;
use axum::{Json, extract::State};
use serde_json::{Value, json};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

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

pub async fn exec_command(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecRequest>,
) -> Result<Json<ExecResponse>, ApiError> {
    let conn = merge_connection_options(&state.defaults, req.connection)?;
    let handler =
        template_loader::load_device_profile(&conn.device_profile, conn.template_dir.as_ref())?;

    let client = DeviceClient::connect(
        conn.host,
        conn.port,
        conn.username,
        conn.password,
        conn.enable_password,
        handler,
    )
    .await?;

    let output = client.execute(&req.command, req.mode.as_deref()).await?;
    Ok(Json(ExecResponse { output }))
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

pub async fn execute_template(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTemplateRequest>,
) -> Result<Json<ExecuteTemplateResponse>, ApiError> {
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
        }));
    }

    let conn = merge_connection_options(&state.defaults, req.connection)?;
    let handler =
        template_loader::load_device_profile(&conn.device_profile, conn.template_dir.as_ref())?;
    let client = DeviceClient::connect(
        conn.host,
        conn.port,
        conn.username,
        conn.password,
        conn.enable_password,
        handler,
    )
    .await?;

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

    Ok(Json(ExecuteTemplateResponse {
        rendered_commands,
        executed,
    }))
}
