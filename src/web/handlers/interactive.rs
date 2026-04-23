use super::{persist_history_if_recorded, resolve_effective_mode, to_record_level};
use crate::config::command_blacklist;
use crate::config::template_loader;
use crate::device::DeviceClient;
use crate::web::error::ApiError;
use crate::web::models::{
    InteractiveCommandRequest, InteractiveCommandResponse, InteractiveStartRequest,
    InteractiveStartResponse, InteractiveStopResponse,
};
use crate::web::state::{AppState, InteractiveSession, merge_connection_options};
use axum::Json;
use axum::extract::{Path, State};
use std::sync::Arc;
use std::time::Instant;
use tracing::info;

fn connection_settings_changed(
    current: &crate::web::state::ResolvedConnection,
    refreshed: &crate::web::state::ResolvedConnection,
) -> bool {
    current.host != refreshed.host
        || current.port != refreshed.port
        || current.username != refreshed.username
        || current.password != refreshed.password
        || current.enable_password != refreshed.enable_password
        || current.ssh_security != refreshed.ssh_security
        || current.linux_shell_flavor != refreshed.linux_shell_flavor
        || current.device_profile != refreshed.device_profile
}

fn profile_fingerprint(
    profile_name: &str,
    linux_shell_flavor: Option<crate::config::linux_shell::LinuxShellFlavor>,
) -> Result<String, ApiError> {
    let mut profile = template_loader::load_device_profile_form(profile_name)?;
    if let Some(flavor) = linux_shell_flavor {
        profile.apply_shell_flavor_override(flavor.to_device_shell_flavor());
    }
    toml::to_string(&profile).map_err(ApiError::from)
}

async fn refresh_interactive_session_if_needed(
    state: &Arc<AppState>,
    session: &mut InteractiveSession,
) -> Result<(), ApiError> {
    let refreshed_connection = session
        .source_connection
        .clone()
        .or_else(|| {
            session.conn.connection_name.as_ref().map(|name| {
                crate::web::models::ConnectionRequest {
                    connection_name: Some(name.clone()),
                    ..Default::default()
                }
            })
        })
        .map(|connection| merge_connection_options(&state.defaults, Some(connection)))
        .transpose()?;

    let latest_profile_fingerprint = profile_fingerprint(
        &session.conn.device_profile,
        session.conn.linux_shell_flavor,
    )?;
    let profile_changed = latest_profile_fingerprint != session.profile_fingerprint;
    let connection_changed = refreshed_connection
        .as_ref()
        .is_some_and(|refreshed| connection_settings_changed(&session.conn, refreshed));

    if !profile_changed && !connection_changed {
        return Ok(());
    }

    let updated_conn =
        refreshed_connection.unwrap_or_else(|| crate::web::state::ResolvedConnection {
            connection_name: session.conn.connection_name.clone(),
            host: session.conn.host.clone(),
            username: session.conn.username.clone(),
            password: session.conn.password.clone(),
            port: session.conn.port,
            enable_password: session.conn.enable_password.clone(),
            ssh_security: session.conn.ssh_security,
            linux_shell_flavor: session.conn.linux_shell_flavor,
            device_profile: session.conn.device_profile.clone(),
            vars: session.conn.vars.clone(),
        });

    let handler = template_loader::load_device_profile_for_connection(
        &updated_conn.device_profile,
        updated_conn.linux_shell_flavor,
    )?;
    let default_mode = template_loader::default_profile_mode(&updated_conn.device_profile)?;
    let new_client = if let Some(level) = to_record_level(session.record_level) {
        DeviceClient::connect_with_recording(
            updated_conn.host.clone(),
            updated_conn.port,
            updated_conn.username.clone(),
            updated_conn.password.clone(),
            updated_conn.enable_password.clone(),
            handler,
            default_mode,
            level,
            updated_conn.ssh_security,
        )
        .await?
    } else {
        DeviceClient::connect(
            updated_conn.host.clone(),
            updated_conn.port,
            updated_conn.username.clone(),
            updated_conn.password.clone(),
            updated_conn.enable_password.clone(),
            handler,
            default_mode,
            updated_conn.ssh_security,
        )
        .await?
    };

    info!(
        "interactive session refreshed (connection_changed={}, profile_changed={}, connection_name={:?}, host={}:{} )",
        connection_changed,
        profile_changed,
        updated_conn.connection_name,
        updated_conn.host,
        updated_conn.port
    );

    session.client = new_client;
    session.conn = updated_conn;
    session.profile_fingerprint = profile_fingerprint(
        &session.conn.device_profile,
        session.conn.linux_shell_flavor,
    )?;
    Ok(())
}

pub async fn interactive_start(
    State(state): State<Arc<AppState>>,
    Json(req): Json<InteractiveStartRequest>,
) -> Result<Json<InteractiveStartResponse>, ApiError> {
    let source_connection = req.connection.clone();
    let record_level = req.record_level;
    let conn = merge_connection_options(&state.defaults, req.connection)?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let client = if let Some(level) = to_record_level(record_level) {
        DeviceClient::connect_with_recording(
            conn.host.clone(),
            conn.port,
            conn.username.clone(),
            conn.password.clone(),
            conn.enable_password.clone(),
            handler,
            template_loader::default_profile_mode(&conn.device_profile)?,
            level,
            conn.ssh_security,
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
            template_loader::default_profile_mode(&conn.device_profile)?,
            conn.ssh_security,
        )
        .await?
    };

    let session_id = state.next_interactive_id();
    let profile_fingerprint = profile_fingerprint(&conn.device_profile, conn.linux_shell_flavor)?;
    let session = InteractiveSession {
        client,
        conn,
        source_connection,
        profile_fingerprint,
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
    command_blacklist::ensure_command_allowed(&req.command, "interactive execution")
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let mut sessions = state.interactive_sessions.lock().await;
    let mut session = sessions
        .remove(&req.session_id)
        .ok_or_else(|| ApiError::bad_request("interactive session not found"))?;
    drop(sessions);

    refresh_interactive_session_if_needed(&state, &mut session).await?;

    let effective_mode = resolve_effective_mode(req.mode.as_deref(), &session.conn.device_profile)?;
    let output = session
        .client
        .execute_output(&req.command, Some(effective_mode.as_str()))
        .await?;
    session.last_used = Instant::now();

    let mut sessions = state.interactive_sessions.lock().await;
    sessions.insert(req.session_id, session);

    Ok(Json(InteractiveCommandResponse {
        output: output.content,
        exit_code: output.exit_code,
    }))
}

pub async fn interactive_stop(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
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
        Some(session.client.default_mode()),
        session.record_level,
    );
    let recording_jsonl = session.client.recording_jsonl()?;

    Ok(Json(InteractiveStopResponse {
        ok: true,
        recording_jsonl,
    }))
}

#[cfg(test)]
mod tests {
    use super::connection_settings_changed;
    use crate::config::ssh_security::SshSecurityProfile;
    use crate::web::state::ResolvedConnection;

    fn sample_connection() -> ResolvedConnection {
        ResolvedConnection {
            connection_name: Some("edge1".to_string()),
            host: "10.0.0.1".to_string(),
            username: "admin".to_string(),
            password: "pwd".to_string(),
            port: 22,
            enable_password: Some("enable".to_string()),
            ssh_security: SshSecurityProfile::default(),
            linux_shell_flavor: None,
            device_profile: "linux".to_string(),
            vars: serde_json::json!({}),
        }
    }

    #[test]
    fn connection_settings_changed_detects_profile_change() {
        let current = sample_connection();
        let mut refreshed = sample_connection();
        refreshed.device_profile = "custom-linux".to_string();
        assert!(connection_settings_changed(&current, &refreshed));
    }

    #[test]
    fn connection_settings_changed_ignores_non_connection_vars() {
        let current = sample_connection();
        let mut refreshed = sample_connection();
        refreshed.vars = serde_json::json!({"site":"dc-a"});
        assert!(!connection_settings_changed(&current, &refreshed));
    }
}
