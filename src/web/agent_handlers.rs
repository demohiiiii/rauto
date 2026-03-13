use crate::agent::{
    count_connections, count_custom_profiles, count_templates, default_agent_name,
    list_agent_capabilities,
};
use crate::config::connection_store;
use crate::web::error::ApiError;
use crate::web::models::{
    AgentInfoResponse, AgentStatusResponse, DeviceProbeRequest, DeviceProbeResponse,
    DeviceProbeResult, SystemInfo,
};
use crate::web::state::AppState;
use axum::{Json, extract::State};
use std::sync::Arc;
use std::time::Instant;
use tokio::task::JoinSet;
use tokio::time::{Duration, timeout};

pub async fn agent_info(
    State(state): State<Arc<AppState>>,
) -> Result<Json<AgentInfoResponse>, ApiError> {
    let name = state.agent_name().unwrap_or_else(default_agent_name);
    let capabilities =
        list_agent_capabilities(state.defaults.template_dir.as_ref()).map_err(ApiError::from)?;
    let connections_count = count_connections().map_err(ApiError::from)?;
    let templates_count = count_templates(state.defaults.template_dir.as_ref())?;
    let custom_profiles_count = count_custom_profiles(state.defaults.template_dir.as_ref())?;

    Ok(Json(AgentInfoResponse {
        name,
        version: env!("CARGO_PKG_VERSION").to_string(),
        capabilities,
        uptime_seconds: state.uptime_seconds(),
        connections_count,
        templates_count,
        custom_profiles_count,
        managed: state.is_managed(),
    }))
}

pub async fn agent_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<AgentStatusResponse>, ApiError> {
    let active_sessions = state.active_session_count().await;
    let running_tasks = state.running_task_count();
    let registrar_snapshot = if let Some(registrar) = state.registrar() {
        Some(registrar.snapshot().await)
    } else {
        None
    };

    Ok(Json(AgentStatusResponse {
        status: if active_sessions > 0 || running_tasks > 0 {
            "busy".to_string()
        } else {
            "online".to_string()
        },
        active_sessions,
        running_tasks,
        last_heartbeat_at: registrar_snapshot
            .as_ref()
            .and_then(|item| item.last_heartbeat_at.clone()),
        registered_at: registrar_snapshot
            .as_ref()
            .and_then(|item| item.registered_at.clone()),
        system: SystemInfo {
            os: std::env::consts::OS.to_string(),
            arch: std::env::consts::ARCH.to_string(),
            hostname: default_agent_name(),
        },
    }))
}

pub async fn probe_devices(
    Json(req): Json<DeviceProbeRequest>,
) -> Result<Json<DeviceProbeResponse>, ApiError> {
    let timeout_secs = u64::from(req.timeout_secs.max(1));
    let mut join_set = JoinSet::new();

    for name in req.connections {
        join_set.spawn(async move { probe_one_connection(name, timeout_secs).await });
    }

    let mut results = Vec::new();
    while let Some(joined) = join_set.join_next().await {
        match joined {
            Ok(result) => results.push(result),
            Err(err) => results.push(DeviceProbeResult {
                name: "unknown".to_string(),
                host: String::new(),
                port: 0,
                device_profile: String::new(),
                reachable: false,
                latency_ms: None,
                error: Some(format!("probe task join error: {}", err)),
            }),
        }
    }

    results.sort_by(|a, b| a.name.cmp(&b.name));
    let reachable_count = results.iter().filter(|item| item.reachable).count() as u32;
    let total = results.len() as u32;

    Ok(Json(DeviceProbeResponse {
        results,
        total,
        reachable_count,
        unreachable_count: total.saturating_sub(reachable_count),
    }))
}

async fn probe_one_connection(name: String, timeout_secs: u64) -> DeviceProbeResult {
    let loaded = match connection_store::load_connection(&name) {
        Ok(value) => value,
        Err(_) => {
            return DeviceProbeResult {
                name,
                host: String::new(),
                port: 0,
                device_profile: String::new(),
                reachable: false,
                latency_ms: None,
                error: Some("Connection not found".to_string()),
            };
        }
    };

    let host = loaded.host.unwrap_or_default();
    let port = loaded.port.unwrap_or(22);
    let device_profile = loaded.device_profile.unwrap_or_else(|| "cisco".to_string());

    if host.trim().is_empty() {
        return DeviceProbeResult {
            name,
            host,
            port,
            device_profile,
            reachable: false,
            latency_ms: None,
            error: Some("Host missing in saved connection".to_string()),
        };
    }

    let started_at = Instant::now();
    let target = format!("{}:{}", host, port);
    match timeout(
        Duration::from_secs(timeout_secs),
        tokio::net::TcpStream::connect(&target),
    )
    .await
    {
        Ok(Ok(_stream)) => DeviceProbeResult {
            name,
            host,
            port,
            device_profile,
            reachable: true,
            latency_ms: Some(started_at.elapsed().as_millis() as u64),
            error: None,
        },
        Ok(Err(err)) => DeviceProbeResult {
            name,
            host,
            port,
            device_profile,
            reachable: false,
            latency_ms: None,
            error: Some(err.to_string()),
        },
        Err(_) => DeviceProbeResult {
            name,
            host,
            port,
            device_profile,
            reachable: false,
            latency_ms: None,
            error: Some(format!("Connection timed out after {}s", timeout_secs)),
        },
    }
}
