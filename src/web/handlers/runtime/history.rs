use super::*;

pub(crate) fn persist_history_jsonl(
    conn: &crate::web::state::ResolvedConnection,
    operation: &str,
    command_label: &str,
    mode: Option<&str>,
    level: Option<RecordLevel>,
    jsonl: &str,
) {
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
        jsonl,
    ) {
        warn!("failed to persist execution history: {}", e);
    }
}

pub(crate) fn to_record_level(level: Option<RecordLevel>) -> Option<SessionRecordLevel> {
    match level {
        Some(RecordLevel::KeyEventsOnly) => Some(SessionRecordLevel::KeyEventsOnly),
        Some(RecordLevel::Full) => Some(SessionRecordLevel::Full),
        None => Some(SessionRecordLevel::KeyEventsOnly),
    }
}

pub(crate) fn to_cli_record_level(level: Option<RecordLevel>) -> RecordLevelOpt {
    match level {
        Some(RecordLevel::KeyEventsOnly) | None => RecordLevelOpt::KeyEventsOnly,
        Some(RecordLevel::Full) => RecordLevelOpt::Full,
    }
}

pub(crate) fn record_level_name(level: Option<RecordLevel>) -> &'static str {
    match level {
        Some(RecordLevel::KeyEventsOnly) | None => "key-events-only",
        Some(RecordLevel::Full) => "full",
    }
}

pub(crate) fn persist_history_if_recorded(
    conn: &crate::web::state::ResolvedConnection,
    client: &DeviceClient,
    operation: &str,
    command_label: &str,
    mode: Option<&str>,
    level: Option<RecordLevel>,
) {
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

pub(crate) fn resolve_effective_mode(
    requested_mode: Option<&str>,
    device_profile: &str,
) -> Result<String, ApiError> {
    template_loader::resolve_profile_mode(device_profile, requested_mode)
        .map_err(|e| ApiError::bad_request(e.to_string()))
}
