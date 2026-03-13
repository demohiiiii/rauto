use crate::agent::config::AgentConfig;
use crate::agent::registration::AgentRegistrar;
use crate::cli::GlobalOpts;
use crate::device::DeviceClient;
use crate::web::error::ApiError;
use crate::web::models::ConnectionRequest;
use crate::web::models::RecordLevel;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::time::Instant;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct AppState {
    pub defaults: GlobalOpts,
    pub interactive_sessions: Arc<Mutex<HashMap<String, InteractiveSession>>>,
    interactive_seq: Arc<AtomicU64>,
    pub agent_config: Option<AgentConfig>,
    pub api_token: Option<String>,
    pub started_at: Instant,
    registrar: Arc<OnceLock<Arc<AgentRegistrar>>>,
    running_tasks: Arc<AtomicU32>,
}

impl AppState {
    pub fn new(
        defaults: GlobalOpts,
        agent_config: Option<AgentConfig>,
        api_token: Option<String>,
    ) -> Arc<Self> {
        Arc::new(Self {
            defaults,
            interactive_sessions: Arc::new(Mutex::new(HashMap::new())),
            interactive_seq: Arc::new(AtomicU64::new(1)),
            agent_config,
            api_token,
            started_at: Instant::now(),
            registrar: Arc::new(OnceLock::new()),
            running_tasks: Arc::new(AtomicU32::new(0)),
        })
    }

    pub fn next_interactive_id(&self) -> String {
        let id = self.interactive_seq.fetch_add(1, Ordering::Relaxed);
        format!("interactive-{}", id)
    }

    pub fn agent_name(&self) -> Option<String> {
        self.agent_config.as_ref().map(|cfg| cfg.agent.name.clone())
    }

    pub fn uptime_seconds(&self) -> u64 {
        self.started_at.elapsed().as_secs()
    }

    pub async fn active_session_count(&self) -> u32 {
        self.interactive_sessions.lock().await.len() as u32
    }

    pub fn running_task_count(&self) -> u32 {
        self.running_tasks.load(Ordering::Relaxed)
    }

    pub fn inc_running_tasks(&self) {
        self.running_tasks.fetch_add(1, Ordering::Relaxed);
    }

    pub fn dec_running_tasks(&self) {
        self.running_tasks.fetch_sub(1, Ordering::Relaxed);
    }

    pub fn is_managed(&self) -> bool {
        self.agent_config.is_some()
    }

    pub fn set_registrar(&self, registrar: Arc<AgentRegistrar>) {
        let _ = self.registrar.set(registrar);
    }

    pub fn registrar(&self) -> Option<Arc<AgentRegistrar>> {
        self.registrar.get().cloned()
    }

    pub fn acquire_task_guard(self: &Arc<Self>, enabled: bool) -> Option<RunningTaskGuard> {
        if !enabled {
            return None;
        }
        self.inc_running_tasks();
        Some(RunningTaskGuard {
            state: Some(self.clone()),
        })
    }
}

pub struct RunningTaskGuard {
    state: Option<Arc<AppState>>,
}

impl Drop for RunningTaskGuard {
    fn drop(&mut self) {
        if let Some(state) = self.state.take() {
            state.dec_running_tasks();
        }
    }
}

pub struct ResolvedConnection {
    pub connection_name: Option<String>,
    pub host: String,
    pub username: String,
    pub password: String,
    pub port: u16,
    pub enable_password: Option<String>,
    pub device_profile: String,
    pub template_dir: Option<PathBuf>,
}

pub struct InteractiveSession {
    pub client: DeviceClient,
    pub conn: ResolvedConnection,
    pub record_level: Option<RecordLevel>,
    pub last_used: Instant,
}

pub fn merge_connection_options(
    defaults: &GlobalOpts,
    incoming: Option<ConnectionRequest>,
) -> Result<ResolvedConnection, ApiError> {
    let incoming = incoming.unwrap_or(ConnectionRequest {
        connection_name: None,
        host: None,
        username: None,
        password: None,
        port: None,
        enable_password: None,
        device_profile: None,
        template_dir: None,
    });

    let host = incoming
        .host
        .or_else(|| defaults.host.clone())
        .ok_or_else(|| ApiError::bad_request("host is required"))?;

    let username = incoming
        .username
        .or_else(|| defaults.username.clone())
        .unwrap_or_else(|| "admin".to_string());

    let password = incoming
        .password
        .or_else(|| defaults.password.clone())
        .unwrap_or_default();

    let port = incoming.port.or(defaults.port).unwrap_or(22);
    let enable_password = incoming
        .enable_password
        .or_else(|| defaults.enable_password.clone());
    let device_profile = incoming
        .device_profile
        .or_else(|| defaults.device_profile.clone())
        .unwrap_or_else(|| "cisco".to_string());
    let template_dir = incoming
        .template_dir
        .map(PathBuf::from)
        .or_else(|| defaults.template_dir.clone());
    let connection_name = incoming
        .connection_name
        .or_else(|| defaults.connection.clone());

    Ok(ResolvedConnection {
        connection_name,
        host,
        username,
        password,
        port,
        enable_password,
        device_profile,
        template_dir,
    })
}
