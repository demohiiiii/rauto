use crate::agent::config::AgentConfig;
use crate::agent::grpc_client::ManagerGrpcClient;
use crate::agent::{
    collect_reported_device_statuses, collect_reported_inventory_devices, count_connections,
    count_templates, default_agent_name, device_inventory_signature, list_agent_capabilities,
};
use crate::manager_grpc::rauto::manager::v1::{
    HeartbeatRequest, OfflineRequest, RegisterAgentRequest, ReportDevicesRequest,
    ReportErrorRequest, ReportedDeviceStatus as GrpcReportedDeviceStatus,
    ReportedInventoryDevice as GrpcReportedInventoryDevice, TaskCallbackRequest,
    UpdateDeviceStatusRequest,
};
use crate::web::models::TaskCallback;
use crate::web::state::AppState;
use anyhow::{Context, Result, anyhow};
use chrono::Utc;
use serde_json::{Value, json};
use std::net::{IpAddr, ToSocketAddrs, UdpSocket};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Mutex;
use tokio::time::{Duration, MissedTickBehavior, interval, sleep, timeout};
use tracing::{error, info, warn};

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

impl AgentRegistrar {
    pub fn new(config: AgentConfig) -> Self {
        Self {
            grpc: ManagerGrpcClient::new(config.manager.url.clone(), config.manager.token.clone()),
            config,
            runtime: Arc::new(Mutex::new(RegistrarRuntime::default())),
            syncing_inventory: Arc::new(AtomicBool::new(false)),
            updating_status: Arc::new(AtomicBool::new(false)),
        }
    }

    pub async fn snapshot(&self) -> RegistrarSnapshot {
        let runtime = self.runtime.lock().await;
        RegistrarSnapshot {
            registered_at: runtime.registered_at.clone(),
            last_heartbeat_at: runtime.last_heartbeat_at.clone(),
        }
    }

    pub async fn register(&self, state: &Arc<AppState>, bind: &str, port: u16) -> Result<()> {
        {
            let mut runtime = self.runtime.lock().await;
            runtime.bind = Some(bind.to_string());
            runtime.port = Some(port);
        }

        let mut delay_secs = 5u64;
        let mut attempts = 0u64;
        loop {
            attempts += 1;
            match self.try_register_once(state, bind, port).await {
                Ok(()) => {
                    if let Err(err) = self.sync_device_inventory().await {
                        warn!("initial device inventory sync failed: {}", err);
                    }
                    if let Err(err) = self.update_device_statuses(5).await {
                        warn!("initial device status update failed: {}", err);
                    }
                    info!("agent '{}' registered to manager", self.config.agent.name);
                    return Ok(());
                }
                Err(err) => {
                    warn!("agent registration attempt {} failed: {}", attempts, err);
                    sleep(Duration::from_secs(delay_secs)).await;
                    delay_secs = (delay_secs.saturating_mul(2)).min(60);
                }
            }
        }
    }

    pub async fn start_heartbeat_loop(self: Arc<Self>, state: Arc<AppState>) {
        let mut ticker = interval(Duration::from_secs(self.config.agent.heartbeat_interval));
        let mut consecutive_failures = 0u32;

        loop {
            ticker.tick().await;
            match self.send_heartbeat(&state).await {
                Ok(()) => {
                    consecutive_failures = 0;
                    if let Err(err) = self.trigger_device_inventory_sync_if_changed(5).await {
                        warn!("device inventory change detection failed: {}", err);
                    }
                }
                Err(err) => {
                    consecutive_failures += 1;
                    if consecutive_failures >= 5 {
                        error!(
                            "agent heartbeat failed {} times, retrying registration: {}",
                            consecutive_failures, err
                        );
                        let (bind, port) = {
                            let runtime = self.runtime.lock().await;
                            (runtime.bind.clone(), runtime.port)
                        };
                        if let (Some(bind), Some(port)) = (bind, port) {
                            if let Err(register_err) = self.register(&state, &bind, port).await {
                                error!("agent re-registration failed: {}", register_err);
                            } else {
                                consecutive_failures = 0;
                            }
                        }
                    } else if consecutive_failures >= 3 {
                        error!(
                            "agent heartbeat failed {} times: {}",
                            consecutive_failures, err
                        );
                    } else {
                        warn!("agent heartbeat failed: {}", err);
                    }
                }
            }
        }
    }

    pub async fn start_probe_report_loop(self: Arc<Self>) {
        let interval_secs = self.config.agent.probe_report_interval;
        if interval_secs == 0 {
            info!(
                "periodic device probe reporting disabled for agent '{}'",
                self.config.agent.name
            );
            return;
        }

        info!(
            "periodic device probe reporting enabled for agent '{}' every {}s",
            self.config.agent.name, interval_secs
        );
        let mut ticker = interval(Duration::from_secs(interval_secs));
        ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);
        ticker.tick().await;

        loop {
            ticker.tick().await;
            match self.update_device_statuses_if_idle(5).await {
                Ok(true) => {}
                Ok(false) => {}
                Err(err) => warn!("periodic device probe report failed: {}", err),
            }
        }
    }

    async fn try_register_once(&self, state: &Arc<AppState>, bind: &str, port: u16) -> Result<()> {
        let advertise_host = resolve_advertise_host(bind, &self.config.manager.url)
            .with_context(|| format!("failed to resolve advertise host from bind '{}'", bind))?;
        let payload = RegisterAgentRequest {
            name: self.config.agent.name.clone(),
            host: advertise_host.clone(),
            port: port as u32,
            version: env!("CARGO_PKG_VERSION").to_string(),
            capabilities: list_agent_capabilities(state.defaults.template_dir.as_ref())?,
            connections_count: count_connections()?,
            templates_count: count_templates(state.defaults.template_dir.as_ref())
                .map_err(|e| anyhow!(e.message))?,
        };
        self.grpc.register_agent(payload).await?;

        info!(
            "agent '{}' registration advertised address {}:{}",
            self.config.agent.name, advertise_host, port
        );
        let mut runtime = self.runtime.lock().await;
        runtime.registered_at = Some(Utc::now().to_rfc3339());
        Ok(())
    }

    async fn send_heartbeat(&self, state: &Arc<AppState>) -> Result<()> {
        let active_sessions = state.active_session_count().await;
        let running_tasks = state.running_task_count();
        let payload = HeartbeatRequest {
            name: self.config.agent.name.clone(),
            status: if active_sessions > 0 || running_tasks > 0 {
                "busy".to_string()
            } else {
                "online".to_string()
            },
            active_sessions,
            running_tasks,
            connections_count: count_connections()?,
            templates_count: count_templates(state.defaults.template_dir.as_ref())
                .map_err(|e| anyhow!(e.message))?,
            uptime_seconds: state.uptime_seconds(),
        };
        self.grpc.send_heartbeat(payload).await?;

        let mut runtime = self.runtime.lock().await;
        runtime.last_heartbeat_at = Some(Utc::now().to_rfc3339());
        Ok(())
    }

    pub async fn shutdown_notify(&self) {
        let payload = OfflineRequest {
            name: self.config.agent.name.clone(),
        };
        let request = self.grpc.notify_offline(payload);
        match timeout(Duration::from_secs(3), request).await {
            Ok(Ok(_)) => {}
            Ok(Err(err)) => warn!("agent shutdown notification failed: {}", err),
            Err(err) => warn!("agent shutdown notification timed out: {}", err),
        }
    }

    pub async fn send_task_callback(&self, callback: &TaskCallback) -> Result<()> {
        let payload = TaskCallbackRequest {
            agent_name: self.config.agent.name.clone(),
            task_id: callback.task_id.clone(),
            status: callback.status.clone(),
            started_at: callback.started_at.clone(),
            completed_at: callback.completed_at.clone(),
            execution_time_ms: callback.execution_time_ms,
            result_json: callback
                .result
                .as_ref()
                .map(serde_json::to_string)
                .transpose()?,
            error: callback.error.clone(),
        };
        self.grpc.report_task_callback(payload).await?;
        Ok(())
    }

    pub async fn report_async_error(&self, input: AsyncErrorReportInput) -> Result<()> {
        let payload = ReportErrorRequest {
            name: self.config.agent.name.clone(),
            category: input.category,
            kind: input.kind,
            severity: input.severity,
            occurred_at: Utc::now().to_rfc3339(),
            task_id: input.task_id,
            operation: input.operation,
            target_url: input.target_url,
            http_method: input.http_method,
            http_status: input.http_status.map(u32::from),
            retryable: input.retryable,
            message: input.message,
            details_json: input.details.map(|value| value.to_string()),
        };
        self.grpc
            .report_error(payload)
            .await
            .context("failed to send async error report to manager")?;
        Ok(())
    }

    pub async fn report_async_error_best_effort(&self, input: AsyncErrorReportInput) {
        if let Err(err) = self.report_async_error(input).await {
            warn!("manager async error report failed: {}", err);
        }
    }

    fn manager_endpoint(&self, path: &str) -> String {
        format!(
            "{}/{}",
            self.config.manager.url.trim_end_matches('/'),
            path.trim_start_matches('/')
        )
    }

    pub async fn sync_device_inventory(&self) -> Result<u32> {
        let signature = device_inventory_signature()?;
        self.sync_device_inventory_with_signature(signature).await
    }

    pub async fn update_device_statuses(&self, timeout_secs: u64) -> Result<u32> {
        let devices = collect_reported_device_statuses(timeout_secs).await?;
        let payload = UpdateDeviceStatusRequest {
            name: self.config.agent.name.clone(),
            devices: devices
                .iter()
                .map(|device| GrpcReportedDeviceStatus {
                    name: device.name.clone(),
                    host: device.host.clone(),
                    reachable: device.reachable,
                })
                .collect(),
        };
        let target_url = self
            .manager_endpoint("/grpc/rauto.manager.v1.AgentReportingService/UpdateDeviceStatus");
        let response = self.grpc.update_device_status(payload).await;
        let response = match response {
            Ok(response) => response,
            Err(err) => {
                self.report_async_error_best_effort(
                    AsyncErrorReportInput::new("device_status_update_failed", err.to_string())
                        .with_category("sync")
                        .with_operation(Some("agent_device_status_update".to_string()))
                        .with_target_url(Some(target_url))
                        .with_http_method(Some("POST".to_string()))
                        .with_details(Some(json!({
                            "devices_count": devices.len(),
                            "probe_timeout_secs": timeout_secs
                        }))),
                )
                .await;
                return Err(err);
            }
        };
        let updated = response.updated.max(devices.len() as u32);
        info!(
            "updated {} device statuses for agent '{}'",
            updated, self.config.agent.name
        );
        Ok(updated)
    }

    pub async fn update_device_statuses_if_idle(&self, timeout_secs: u64) -> Result<bool> {
        if !self.begin_status_update() {
            return Ok(false);
        }

        let result = self.update_device_statuses(timeout_secs).await;
        self.finish_status_update();
        result.map(|_| true)
    }

    pub async fn trigger_device_inventory_sync_if_changed(
        &self,
        timeout_secs: u64,
    ) -> Result<bool> {
        let signature = device_inventory_signature()?;
        let should_report = {
            let runtime = self.runtime.lock().await;
            runtime.last_inventory_signature.as_deref() != Some(signature.as_str())
        };
        if !should_report {
            return Ok(false);
        }
        if !self.begin_inventory_sync() {
            return Ok(false);
        }

        let registrar = self.clone();
        tokio::spawn(async move {
            let result = registrar
                .sync_device_inventory_with_signature(signature)
                .await;
            registrar.finish_inventory_sync();
            match result {
                Ok(_) => {
                    if let Err(err) = registrar.update_device_statuses_if_idle(timeout_secs).await {
                        warn!("device status update after inventory sync failed: {}", err);
                    }
                }
                Err(err) => warn!("device inventory sync failed: {}", err),
            }
        });
        Ok(true)
    }

    async fn sync_device_inventory_with_signature(&self, signature: String) -> Result<u32> {
        let devices = collect_reported_inventory_devices()?;
        let payload = ReportDevicesRequest {
            name: self.config.agent.name.clone(),
            devices: devices
                .iter()
                .map(|device| GrpcReportedInventoryDevice {
                    name: device.name.clone(),
                    host: device.host.clone(),
                    port: device.port as u32,
                    device_profile: device.device_profile.clone(),
                })
                .collect(),
        };
        let target_url =
            self.manager_endpoint("/grpc/rauto.manager.v1.AgentReportingService/ReportDevices");
        let response = self.grpc.report_devices(payload).await;
        let response = match response {
            Ok(response) => response,
            Err(err) => {
                self.report_async_error_best_effort(
                    AsyncErrorReportInput::new("device_inventory_sync_failed", err.to_string())
                        .with_category("sync")
                        .with_operation(Some("agent_device_inventory_sync".to_string()))
                        .with_target_url(Some(target_url))
                        .with_http_method(Some("POST".to_string()))
                        .with_details(Some(json!({
                            "devices_count": devices.len()
                        }))),
                )
                .await;
                return Err(err);
            }
        };
        let synced = response.synced.max(devices.len() as u32);
        info!(
            "synced {} devices for agent '{}'",
            synced, self.config.agent.name
        );
        let mut runtime = self.runtime.lock().await;
        runtime.last_inventory_signature = Some(signature);
        Ok(synced)
    }

    fn begin_inventory_sync(&self) -> bool {
        self.syncing_inventory
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Relaxed)
            .is_ok()
    }

    fn finish_inventory_sync(&self) {
        self.syncing_inventory.store(false, Ordering::Release);
    }

    fn begin_status_update(&self) -> bool {
        self.updating_status
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Relaxed)
            .is_ok()
    }

    fn finish_status_update(&self) {
        self.updating_status.store(false, Ordering::Release);
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
