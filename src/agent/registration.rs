use crate::agent::config::AgentConfig;
use crate::agent::grpc_client::ManagerGrpcClient;
use crate::agent::report_mode::ManagerReportMode;
use crate::agent::{
    collect_reported_device_statuses, collect_reported_inventory_devices, count_connections,
    count_templates, default_agent_name, device_inventory_signature, list_agent_capabilities,
};
use crate::manager_grpc::rauto::manager::v1::{
    HeartbeatRequest as GrpcHeartbeatRequest, OfflineRequest as GrpcOfflineRequest,
    RegisterAgentRequest as GrpcRegisterAgentRequest,
    ReportDevicesRequest as GrpcReportDevicesRequest, ReportErrorRequest as GrpcReportErrorRequest,
    ReportedDeviceStatus as GrpcReportedDeviceStatus,
    ReportedInventoryDevice as GrpcReportedInventoryDevice,
    TaskCallbackRequest as GrpcTaskCallbackRequest, TaskEventRequest as GrpcTaskEventRequest,
    UpdateDeviceStatusRequest as GrpcUpdateDeviceStatusRequest,
};
use crate::web::models::{TaskCallback, TaskEvent};
use crate::web::state::AppState;
use anyhow::{Context, Result, anyhow};
use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::net::{IpAddr, ToSocketAddrs, UdpSocket};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Mutex;
use tokio::time::{Duration, MissedTickBehavior, interval, sleep, timeout};
use tracing::{error, info, warn};

mod device_sync;
mod lifecycle;
mod task_reporting;

#[derive(Debug, Default)]
struct RegistrarRuntime {
    registered_at: Option<String>,
    last_heartbeat_at: Option<String>,
    last_inventory_signature: Option<String>,
    bind: Option<String>,
    port: Option<u16>,
}

#[derive(Debug, Clone)]
pub struct AgentRegistrar {
    client: Client,
    config: AgentConfig,
    grpc: ManagerGrpcClient,
    runtime: Arc<Mutex<RegistrarRuntime>>,
    syncing_inventory: Arc<AtomicBool>,
    updating_status: Arc<AtomicBool>,
}

#[derive(Debug, Clone)]
pub struct RegistrarSnapshot {
    pub registered_at: Option<String>,
    pub last_heartbeat_at: Option<String>,
}

#[derive(Debug, Serialize)]
struct HttpRegisterRequest {
    name: String,
    host: String,
    port: u16,
    version: String,
    capabilities: Vec<String>,
    connections_count: u32,
    templates_count: u32,
}

#[derive(Debug, Serialize)]
struct HttpHeartbeatRequest {
    name: String,
    status: String,
    running_tasks: u32,
    connections_count: u32,
    templates_count: u32,
    uptime_seconds: u64,
}

#[derive(Debug, Serialize)]
struct HttpOfflineRequest {
    name: String,
}

#[derive(Debug, Serialize)]
struct HttpReportDevicesRequest {
    name: String,
    devices: Vec<HttpReportedInventoryDevice>,
}

#[derive(Debug, Serialize)]
struct HttpUpdateDeviceStatusRequest {
    name: String,
    devices: Vec<HttpReportedDeviceStatus>,
}

#[derive(Debug, Serialize)]
struct HttpReportErrorRequest {
    name: String,
    category: String,
    kind: String,
    severity: String,
    occurred_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    task_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    operation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    target_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    http_method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    http_status: Option<u16>,
    retryable: bool,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<Value>,
}

#[derive(Debug, Serialize)]
struct HttpTaskEventRequest {
    task_id: String,
    agent_name: String,
    event_type: String,
    message: String,
    level: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    stage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    progress: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<Value>,
    occurred_at: String,
}

#[derive(Debug, Serialize)]
struct HttpReportedInventoryDevice {
    name: String,
    host: String,
    port: u16,
    device_profile: String,
}

#[derive(Debug, Serialize)]
struct HttpReportedDeviceStatus {
    name: String,
    host: String,
    reachable: bool,
}

#[derive(Debug, Deserialize)]
struct RegisterEnvelope {
    #[allow(dead_code)]
    success: bool,
}

#[derive(Debug, Deserialize)]
struct ReportDevicesEnvelope {
    #[allow(dead_code)]
    success: bool,
    data: Option<ReportDevicesData>,
}

#[derive(Debug, Deserialize)]
struct ReportDevicesData {
    synced: u32,
}

#[derive(Debug, Deserialize)]
struct UpdateDeviceStatusEnvelope {
    #[allow(dead_code)]
    success: bool,
    data: Option<UpdateDeviceStatusData>,
}

#[derive(Debug, Deserialize)]
struct UpdateDeviceStatusData {
    updated: u32,
}

#[derive(Debug, Clone)]
pub struct AsyncErrorReportInput {
    category: String,
    kind: String,
    severity: String,
    task_id: Option<String>,
    operation: Option<String>,
    target_url: Option<String>,
    http_method: Option<String>,
    http_status: Option<u16>,
    retryable: bool,
    message: String,
    details: Option<Value>,
}

impl AsyncErrorReportInput {
    pub fn new(kind: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            category: "async_delivery".to_string(),
            kind: kind.into(),
            severity: "error".to_string(),
            task_id: None,
            operation: None,
            target_url: None,
            http_method: None,
            http_status: None,
            retryable: true,
            message: message.into(),
            details: None,
        }
    }

    pub fn with_category(mut self, category: impl Into<String>) -> Self {
        self.category = category.into();
        self
    }

    pub fn with_task_id(mut self, task_id: Option<String>) -> Self {
        self.task_id = task_id;
        self
    }

    pub fn with_operation(mut self, operation: Option<String>) -> Self {
        self.operation = operation;
        self
    }

    pub fn with_target_url(mut self, target_url: Option<String>) -> Self {
        self.target_url = target_url;
        self
    }

    pub fn with_http_method(mut self, http_method: Option<String>) -> Self {
        self.http_method = http_method;
        self
    }

    pub fn with_details(mut self, details: Option<Value>) -> Self {
        self.details = details;
        self
    }
}

pub fn current_agent_name(state: &AppState) -> String {
    state.agent_name().unwrap_or_else(default_agent_name)
}

fn resolve_advertise_host(bind: &str, manager_url: &str) -> Result<String> {
    let normalized = bind.trim();
    if is_explicit_advertise_host(normalized) {
        return Ok(normalized.to_string());
    }

    let url = reqwest::Url::parse(manager_url)
        .with_context(|| format!("invalid manager url '{}'", manager_url))?;
    let manager_host = url
        .host_str()
        .ok_or_else(|| anyhow!("manager url '{}' missing host", manager_url))?;
    let manager_port = url.port_or_known_default().unwrap_or(80);

    for addr in (manager_host, manager_port)
        .to_socket_addrs()
        .with_context(|| format!("failed to resolve manager host '{}'", manager_host))?
    {
        let bind_addr = if addr.is_ipv6() {
            "[::]:0"
        } else {
            "0.0.0.0:0"
        };
        let socket = match UdpSocket::bind(bind_addr) {
            Ok(socket) => socket,
            Err(_) => continue,
        };
        if socket.connect(addr).is_err() {
            continue;
        }
        let local_ip = socket.local_addr()?.ip();
        if !local_ip.is_unspecified() && !local_ip.is_loopback() {
            return Ok(local_ip.to_string());
        }
    }

    Ok(normalized.to_string())
}

fn is_explicit_advertise_host(bind: &str) -> bool {
    if bind.is_empty() {
        return false;
    }
    if bind.eq_ignore_ascii_case("localhost") {
        return false;
    }
    match bind.parse::<IpAddr>() {
        Ok(ip) => !ip.is_unspecified() && !ip.is_loopback(),
        Err(_) => true,
    }
}

#[cfg(test)]
mod tests {
    use super::is_explicit_advertise_host;

    #[test]
    fn explicit_advertise_host_rejects_loopback_and_unspecified() {
        assert!(!is_explicit_advertise_host("0.0.0.0"));
        assert!(!is_explicit_advertise_host("::"));
        assert!(!is_explicit_advertise_host("127.0.0.1"));
        assert!(!is_explicit_advertise_host("localhost"));
    }

    #[test]
    fn explicit_advertise_host_accepts_real_ip_or_hostname() {
        assert!(is_explicit_advertise_host("192.168.1.10"));
        assert!(is_explicit_advertise_host("agent-beijing-01.local"));
    }
}
