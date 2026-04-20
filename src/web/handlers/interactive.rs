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
use axum::extract::{Path, State};
use axum::Json;
use std::sync::Arc;
use std::time::Instant;

pub async fn interactive_start(
    State(state): State<Arc<AppState>>,
    Json(req): Json<InteractiveStartRequest>,
) -> Result<Json<InteractiveStartResponse>, ApiError> {
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
    command_blacklist::ensure_command_allowed(&req.command, "interactive execution")
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let mut sessions = state.interactive_sessions.lock().await;
    let mut session = sessions
        .remove(&req.session_id)
        .ok_or_else(|| ApiError::bad_request("interactive session not found"))?;
    drop(sessions);

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
