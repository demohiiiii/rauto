use crate::agent::config::AgentConfig;
use crate::agent::{
    count_connections, count_templates, default_agent_name, list_agent_capabilities,
};
use crate::web::models::TaskCallback;
use crate::web::state::AppState;
use anyhow::{Context, Result, anyhow};
use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{Duration, interval, sleep, timeout};
use tracing::{error, info, warn};

#[derive(Debug, Default)]
struct RegistrarRuntime {
    registered_at: Option<String>,
    last_heartbeat_at: Option<String>,
    bind: Option<String>,
    port: Option<u16>,
}

#[derive(Debug, Clone)]
pub struct AgentRegistrar {
    client: Client,
    config: AgentConfig,
    runtime: Arc<Mutex<RegistrarRuntime>>,
}

#[derive(Debug, Clone)]
pub struct RegistrarSnapshot {
    pub registered_at: Option<String>,
    pub last_heartbeat_at: Option<String>,
}

#[derive(Debug, Serialize)]
struct RegisterRequest {
    name: String,
    host: String,
    port: u16,
    version: String,
    capabilities: Vec<String>,
    connections_count: u32,
    templates_count: u32,
}

#[derive(Debug, Serialize)]
struct HeartbeatRequest {
    name: String,
    status: String,
    active_sessions: u32,
    running_tasks: u32,
    connections_count: u32,
    templates_count: u32,
    uptime_seconds: u64,
}

#[derive(Debug, Serialize)]
struct OfflineRequest {
    name: String,
}

#[derive(Debug, Deserialize)]
struct RegisterEnvelope {
    #[allow(dead_code)]
    success: bool,
}

impl AgentRegistrar {
    pub fn new(config: AgentConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            client,
            config,
            runtime: Arc::new(Mutex::new(RegistrarRuntime::default())),
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
                Ok(()) => consecutive_failures = 0,
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

    async fn try_register_once(&self, state: &Arc<AppState>, bind: &str, port: u16) -> Result<()> {
        let payload = RegisterRequest {
            name: self.config.agent.name.clone(),
            host: bind.to_string(),
            port,
            version: env!("CARGO_PKG_VERSION").to_string(),
            capabilities: list_agent_capabilities(state.defaults.template_dir.as_ref())?,
            connections_count: count_connections()?,
            templates_count: count_templates(state.defaults.template_dir.as_ref())
                .map_err(|e| anyhow!(e.message))?,
        };
        self.authed_post(self.manager_endpoint("/api/agents/register"))
            .json(&payload)
            .send()
            .await?
            .error_for_status()?
            .json::<RegisterEnvelope>()
            .await
            .ok();

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
        self.authed_post(self.manager_endpoint("/api/agents/heartbeat"))
            .json(&payload)
            .send()
            .await?
            .error_for_status()?;

        let mut runtime = self.runtime.lock().await;
        runtime.last_heartbeat_at = Some(Utc::now().to_rfc3339());
        Ok(())
    }

    pub async fn shutdown_notify(&self) {
        let payload = OfflineRequest {
            name: self.config.agent.name.clone(),
        };
        let request = self
            .authed_post(self.manager_endpoint("/api/agents/offline"))
            .json(&payload)
            .send();
        match timeout(Duration::from_secs(3), request).await {
            Ok(Ok(_)) => {}
            Ok(Err(err)) => warn!("agent shutdown notification failed: {}", err),
            Err(err) => warn!("agent shutdown notification timed out: {}", err),
        }
    }

    pub async fn send_task_callback(
        &self,
        callback_url: &str,
        callback: &TaskCallback,
    ) -> Result<()> {
        self.authed_post(callback_url.to_string())
            .json(callback)
            .send()
            .await
            .with_context(|| format!("failed to send task callback to '{}'", callback_url))?
            .error_for_status()
            .with_context(|| format!("task callback returned error for '{}'", callback_url))?;
        Ok(())
    }

    pub async fn send_task_callback_direct(
        callback_url: &str,
        api_token: Option<&str>,
        callback: &TaskCallback,
    ) -> Result<()> {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| Client::new());
        let mut req = client.post(callback_url).json(callback);
        if let Some(token) = api_token.filter(|value| !value.trim().is_empty()) {
            req = req.bearer_auth(token);
        }
        req.send()
            .await
            .with_context(|| format!("failed to send task callback to '{}'", callback_url))?
            .error_for_status()
            .with_context(|| format!("task callback returned error for '{}'", callback_url))?;
        Ok(())
    }

    fn manager_endpoint(&self, path: &str) -> String {
        format!(
            "{}/{}",
            self.config.manager.url.trim_end_matches('/'),
            path.trim_start_matches('/')
        )
    }

    fn authed_post(&self, url: String) -> reqwest::RequestBuilder {
        let req = self.client.post(url);
        match self.config.manager.token.as_deref() {
            Some(token) if !token.trim().is_empty() => req.bearer_auth(token),
            _ => req,
        }
    }
}

pub fn current_agent_name(state: &AppState) -> String {
    state.agent_name().unwrap_or_else(default_agent_name)
}
