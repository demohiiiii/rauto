use crate::agent::config::AgentConfig;
use crate::agent::registration::AgentRegistrar;
use crate::cli::GlobalOpts;
use crate::config::autodetect_cache;
use crate::config::connection_resolver::ResolvedConnection as SavedResolvedConnection;
use crate::config::connection_store;
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::ssh_security::SshSecurityProfile;
use crate::config::template_loader::{self, DEFAULT_DEVICE_PROFILE};
use crate::web::error::ApiError;
use crate::web::models::{ConnectionRequest, SessionRetryOptions};
use rneter::session::{DetectRequest, MANAGER, SshAuthMethod};
use rneter::templates::DetectConnectPolicy;
use std::collections::HashMap;
use std::future::Future;
use std::sync::Arc;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, watch};
use tracing::{info, warn};

#[derive(Clone)]
pub struct AppState {
    pub defaults: GlobalOpts,
    pub agent_config: Option<AgentConfig>,
    pub api_token: Option<String>,
    pub started_at: Instant,
    registrar: Arc<OnceLock<Arc<AgentRegistrar>>>,
    running_tasks: Arc<AtomicU32>,
    discovery_cancellations: Arc<Mutex<HashMap<String, watch::Sender<bool>>>>,
    shutdown_tx: watch::Sender<bool>,
}

impl AppState {
    pub fn new(
        defaults: GlobalOpts,
        agent_config: Option<AgentConfig>,
        api_token: Option<String>,
    ) -> Arc<Self> {
        let (shutdown_tx, _shutdown_rx) = watch::channel(false);
        Arc::new(Self {
            defaults,
            agent_config,
            api_token,
            started_at: Instant::now(),
            registrar: Arc::new(OnceLock::new()),
            running_tasks: Arc::new(AtomicU32::new(0)),
            discovery_cancellations: Arc::new(Mutex::new(HashMap::new())),
            shutdown_tx,
        })
    }

    pub fn agent_name(&self) -> Option<String> {
        self.agent_config.as_ref().map(|cfg| cfg.agent.name.clone())
    }

    pub fn uptime_seconds(&self) -> u64 {
        self.started_at.elapsed().as_secs()
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

    pub fn begin_shutdown(&self) {
        let _ = self.shutdown_tx.send(true);
    }

    pub async fn run_until_shutdown<T, F>(&self, future: F) -> Result<T, ApiError>
    where
        F: Future<Output = Result<T, ApiError>>,
    {
        let mut shutdown_rx = self.shutdown_tx.subscribe();
        tokio::select! {
            result = future => result,
            _ = async {
                if *self.shutdown_tx.borrow() {
                    return;
                }
                let _ = shutdown_rx.changed().await;
            } => Err(ApiError::service_unavailable(
                "server is shutting down; cancelled in-flight request",
            )),
        }
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

    pub async fn register_discovery_run(&self, run_id: &str) -> watch::Receiver<bool> {
        let (cancel_tx, cancel_rx) = watch::channel(false);
        self.discovery_cancellations
            .lock()
            .await
            .insert(run_id.to_string(), cancel_tx);
        cancel_rx
    }

    pub async fn cancel_discovery_run(&self, run_id: &str) -> bool {
        self.discovery_cancellations
            .lock()
            .await
            .get(run_id)
            .is_some_and(|cancel_tx| cancel_tx.send(true).is_ok())
    }

    pub async fn unregister_discovery_run(&self, run_id: &str) {
        self.discovery_cancellations.lock().await.remove(run_id);
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
    pub auth: SshAuthMethod,
    pub password: String,
    pub port: u16,
    pub connect_timeout_secs: Option<u64>,
    pub enable_password: Option<String>,
    pub ssh_security: SshSecurityProfile,
    pub linux_shell_flavor: Option<LinuxShellFlavor>,
    pub device_profile: String,
    pub vars: serde_json::Value,
    pub force_autodetect: bool,
    pub retry_policy: rneter::session::RetryPolicy,
}

const MAX_SESSION_RETRIES: usize = 20;
const MAX_SESSION_RETRY_BACKOFF_MS: u64 = 300_000;

pub fn apply_session_retry_options(
    mut conn: ResolvedConnection,
    options: Option<&SessionRetryOptions>,
) -> Result<ResolvedConnection, ApiError> {
    conn.retry_policy = resolve_session_retry_policy(conn.retry_policy, options)?;
    Ok(conn)
}

fn resolve_session_retry_policy(
    current: rneter::session::RetryPolicy,
    options: Option<&SessionRetryOptions>,
) -> Result<rneter::session::RetryPolicy, ApiError> {
    let Some(options) = options else {
        return Ok(current);
    };

    if options
        .max_retries
        .is_some_and(|value| value > MAX_SESSION_RETRIES)
    {
        return Err(ApiError::bad_request(format!(
            "retry.max_retries must not exceed {MAX_SESSION_RETRIES}"
        )));
    }
    if options
        .initial_backoff_ms
        .is_some_and(|value| value > MAX_SESSION_RETRY_BACKOFF_MS)
    {
        return Err(ApiError::bad_request(format!(
            "retry.initial_backoff_ms must not exceed {MAX_SESSION_RETRY_BACKOFF_MS}"
        )));
    }
    if options
        .max_backoff_ms
        .is_some_and(|value| value > MAX_SESSION_RETRY_BACKOFF_MS)
    {
        return Err(ApiError::bad_request(format!(
            "retry.max_backoff_ms must not exceed {MAX_SESSION_RETRY_BACKOFF_MS}"
        )));
    }

    let max_retries = options.max_retries.unwrap_or(current.max_retries);
    let initial_backoff = options
        .initial_backoff_ms
        .map(Duration::from_millis)
        .unwrap_or(current.initial_backoff);
    let max_backoff = options
        .max_backoff_ms
        .map(Duration::from_millis)
        .unwrap_or(current.max_backoff);
    if max_retries > 0 && initial_backoff > max_backoff {
        return Err(ApiError::bad_request(
            "retry.initial_backoff_ms must not exceed retry.max_backoff_ms when retries are enabled",
        ));
    }

    Ok(rneter::session::RetryPolicy::new(max_retries)
        .with_backoff(initial_backoff, max_backoff)
        .with_authentication_retries(
            options
                .retry_authentication_errors
                .unwrap_or(current.retry_authentication_errors),
        ))
}

pub fn merge_connection_options(
    defaults: &GlobalOpts,
    incoming: Option<ConnectionRequest>,
) -> Result<ResolvedConnection, ApiError> {
    let incoming = incoming.unwrap_or(ConnectionRequest {
        connection_name: None,
        host: None,
        credential_id: None,
        port: None,
        connect_timeout_secs: None,
        device_model: None,
        software_version: None,
        ssh_security: None,
        linux_shell_flavor: None,
        device_profile: None,
        template_dir: None,
        enabled: true,
        labels: vec![],
        groups: vec![],
        vars: serde_json::json!({}),
    });
    let connection_name = incoming
        .connection_name
        .clone()
        .or_else(|| defaults.connection.clone());
    let saved = if let Some(name) = connection_name.as_ref() {
        Some(
            connection_store::load_connection(name)
                .map_err(|e| ApiError::bad_request(e.to_string()))?,
        )
    } else {
        None
    };

    merge_connection_sources(defaults, incoming, saved, connection_name)
}

pub async fn resolve_autodetect_connection(
    mut conn: ResolvedConnection,
) -> Result<ResolvedConnection, ApiError> {
    if !template_loader::is_autodetect_profile_name(&conn.device_profile) {
        return Ok(conn);
    }

    if conn.force_autodetect {
        info!(
            "Bypassing autodetect cache and reprobe requested for {}:{}",
            conn.host, conn.port
        );
    } else {
        match autodetect_cache::load_cached_profile(&conn.host, conn.port) {
            Ok(Some(profile)) => {
                info!(
                    "Reusing cached autodetected device profile '{}' for {}:{}",
                    profile, conn.host, conn.port
                );
                conn.device_profile = profile;
                return Ok(conn);
            }
            Ok(None) => {}
            Err(err) => {
                warn!(
                    "failed to load autodetect cache for {}:{}: {}",
                    conn.host, conn.port, err
                );
            }
        }
    }

    let request = DetectRequest::new_with_auth(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.auth.clone(),
    );
    let context = crate::manager_execution_context_with_security(
        None,
        conn.ssh_security,
        conn.connect_timeout_secs,
    );
    let policy = DetectConnectPolicy::default();
    let connected = MANAGER
        .autodetect_and_connect_with_builtin_and_templates_and_context(
            request,
            conn.enable_password.clone(),
            context,
            policy,
            template_loader::custom_detect_template_definitions().map_err(ApiError::from)?,
        )
        .await
        .map_err(ApiError::from)?;
    let best = connected
        .report
        .best_match
        .as_ref()
        .expect("rneter connected autodetect result must contain a best match");
    if let Err(err) =
        autodetect_cache::save_cached_profile(&conn.host, conn.port, &best.template_name)
    {
        warn!(
            "failed to save autodetect cache for {}:{} -> {}: {}",
            conn.host, conn.port, best.template_name, err
        );
    }
    conn.device_profile = best.template_name.clone();
    Ok(conn)
}

fn merge_connection_sources(
    defaults: &GlobalOpts,
    incoming: ConnectionRequest,
    saved: Option<SavedResolvedConnection>,
    connection_name: Option<String>,
) -> Result<ResolvedConnection, ApiError> {
    if incoming.connect_timeout_secs == Some(0) {
        return Err(ApiError::bad_request(
            "connect_timeout_secs must be a positive integer",
        ));
    }
    let saved = saved.as_ref();
    let incoming_vars = incoming.vars;
    let requested_credential_id = incoming.credential_id.clone().or_else(|| {
        defaults.credential.as_deref().and_then(|selector| {
            crate::config::device_credential_store::find_credential_by_name(selector)
                .or_else(|_| crate::config::device_credential_store::get_credential(selector))
                .ok()
                .map(|item| item.id)
        })
    });
    let credential = requested_credential_id
        .as_deref()
        .map(crate::config::device_credential_store::resolve_credential)
        .transpose()
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    let credential_id = requested_credential_id
        .or_else(|| saved.and_then(|connection| connection.credential_id.clone()));
    if credential_id.is_none() {
        return Err(ApiError::bad_request("device credential is required"));
    }

    let host = incoming
        .host
        .or_else(|| saved.and_then(|s| s.host.clone()))
        .or_else(|| defaults.host.clone())
        .ok_or_else(|| ApiError::bad_request("host is required"))?;

    let username = credential
        .as_ref()
        .map(|value| value.username.clone())
        .or_else(|| saved.and_then(|s| s.username.clone()))
        .ok_or_else(|| ApiError::bad_request("device credential is required"))?;

    let password = credential
        .as_ref()
        .map(|value| value.password.clone())
        .or_else(|| saved.and_then(|s| s.password.clone()))
        .unwrap_or_default();
    let auth = credential
        .as_ref()
        .map(|value| value.auth.clone())
        .or_else(|| saved.and_then(|connection| connection.auth.clone()))
        .ok_or_else(|| ApiError::bad_request("device credential is required"))?;

    let port = incoming
        .port
        .or_else(|| saved.and_then(|s| s.port))
        .or(defaults.port)
        .unwrap_or(22);
    let connect_timeout_secs = incoming
        .connect_timeout_secs
        .or_else(|| saved.and_then(|s| s.connect_timeout_secs));
    let vars = if has_non_empty_json_object(&incoming_vars) {
        incoming_vars
    } else {
        saved
            .map(|s| s.vars.clone())
            .filter(has_non_empty_json_object)
            .unwrap_or_else(|| serde_json::json!({}))
    };
    let enable_password = credential
        .as_ref()
        .and_then(|value| value.runtime_enable_password())
        .or_else(|| saved.and_then(|s| s.enable_password.clone()));
    let ssh_security = incoming
        .ssh_security
        .or_else(|| saved.and_then(|s| s.ssh_security))
        .or(defaults.ssh_security)
        .unwrap_or_default();
    let linux_shell_flavor = incoming
        .linux_shell_flavor
        .or_else(|| saved.and_then(|s| s.linux_shell_flavor))
        .or(defaults.linux_shell_flavor);
    let device_profile = incoming
        .device_profile
        .or_else(|| saved.and_then(|s| s.device_profile.clone()))
        .or_else(|| defaults.device_profile.clone())
        .unwrap_or_else(|| DEFAULT_DEVICE_PROFILE.to_string());
    Ok(ResolvedConnection {
        connection_name,
        host,
        username,
        auth,
        password,
        port,
        connect_timeout_secs,
        enable_password,
        ssh_security,
        linux_shell_flavor,
        device_profile,
        vars,
        force_autodetect: defaults.force_autodetect,
        retry_policy: crate::manager_retry_policy(defaults),
    })
}

fn has_non_empty_json_object(value: &serde_json::Value) -> bool {
    value
        .as_object()
        .map(|map| !map.is_empty())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::AppState;
    use super::SavedResolvedConnection;
    use super::merge_connection_sources;
    use crate::cli::GlobalOpts;
    use crate::config::connection_store::SavedConnection;
    use crate::config::ssh_security::SshSecurityProfile;
    use crate::web::error::ApiError;
    use crate::web::models::ConnectionRequest;
    use crate::web::models::SessionRetryOptions;
    use axum::http::StatusCode;
    use rneter::session::RetryPolicy;
    use tokio::time::{Duration, sleep};

    #[test]
    fn session_retry_options_preserve_server_policy_when_absent() {
        let current = RetryPolicy::new(3)
            .with_backoff(Duration::from_millis(150), Duration::from_millis(2500))
            .with_authentication_retries(true);

        assert_eq!(
            super::resolve_session_retry_policy(current, None).unwrap(),
            current
        );
    }

    #[test]
    fn session_retry_options_override_server_policy() {
        let options = SessionRetryOptions {
            max_retries: Some(4),
            initial_backoff_ms: Some(300),
            max_backoff_ms: Some(5000),
            retry_authentication_errors: Some(true),
        };

        let policy =
            super::resolve_session_retry_policy(RetryPolicy::default(), Some(&options)).unwrap();
        assert_eq!(policy.max_retries, 4);
        assert_eq!(policy.initial_backoff, Duration::from_millis(300));
        assert_eq!(policy.max_backoff, Duration::from_millis(5000));
        assert!(policy.retry_authentication_errors);
    }

    #[test]
    fn session_retry_options_reject_invalid_backoff_order() {
        let options = SessionRetryOptions {
            max_retries: Some(1),
            initial_backoff_ms: Some(2001),
            max_backoff_ms: Some(2000),
            retry_authentication_errors: None,
        };

        let error = super::resolve_session_retry_policy(RetryPolicy::default(), Some(&options))
            .expect_err("invalid retry backoff must fail");
        assert_eq!(error.status, StatusCode::BAD_REQUEST);
    }

    fn defaults() -> GlobalOpts {
        GlobalOpts {
            credential: None,
            host: Some("default-host".to_string()),
            port: Some(22),
            ssh_security: Some(SshSecurityProfile::Balanced),
            linux_shell_flavor: None,
            device_profile: Some("default-profile".to_string()),
            template_dir: None,
            force_autodetect: false,
            session_retries: 0,
            retry_initial_backoff_ms: 200,
            retry_max_backoff_ms: 2000,
            retry_authentication_errors: false,
            connection: Some("lab1".to_string()),
            save_connection: None,
        }
    }

    fn saved_connection(enable_password: Option<&str>) -> SavedResolvedConnection {
        SavedResolvedConnection {
            saved: SavedConnection {
                credential_id: Some("credential-1".to_string()),
                host: Some("saved-host".to_string()),
                port: Some(2022),
                connect_timeout_secs: Some(45),
                device_model: None,
                software_version: None,
                ssh_security: Some(SshSecurityProfile::Secure),
                linux_shell_flavor: None,
                device_profile: Some("saved-profile".to_string()),
                template_dir: Some("/tmp/saved-templates".to_string()),
                enabled: true,
                labels: vec!["core".to_string()],
                groups: vec!["access".to_string()],
                vars: serde_json::json!({"site":"lab-a"}),
            },
            username: Some("saved-user".to_string()),
            auth: Some(rneter::session::SshAuthMethod::password("saved-pass")),
            password: Some("saved-pass".to_string()),
            enable_password: enable_password.map(ToOwned::to_owned),
        }
    }

    #[test]
    fn merge_connection_sources_uses_saved_runtime_credential_and_explicit_connection_fields() {
        let incoming = ConnectionRequest {
            connection_name: Some("lab1".to_string()),
            host: Some("explicit-host".to_string()),
            credential_id: None,
            port: None,
            connect_timeout_secs: None,
            device_model: None,
            software_version: None,
            ssh_security: Some(SshSecurityProfile::LegacyCompatible),
            linux_shell_flavor: None,
            device_profile: None,
            template_dir: None,
            enabled: true,
            labels: vec![],
            groups: vec![],
            vars: serde_json::json!({}),
        };
        let resolved = merge_connection_sources(
            &defaults(),
            incoming,
            Some(saved_connection(Some("saved-enable"))),
            Some("lab1".to_string()),
        )
        .expect("resolved connection");

        assert_eq!(resolved.connection_name.as_deref(), Some("lab1"));
        assert_eq!(resolved.host, "explicit-host");
        assert_eq!(resolved.username, "saved-user");
        assert_eq!(resolved.password, "saved-pass");
        assert_eq!(resolved.port, 2022);
        assert_eq!(resolved.connect_timeout_secs, Some(45));
        assert_eq!(resolved.enable_password.as_deref(), Some("saved-enable"));
        assert_eq!(resolved.ssh_security, SshSecurityProfile::LegacyCompatible);
        assert_eq!(resolved.device_profile, "saved-profile");
        assert_eq!(resolved.vars, serde_json::json!({"site":"lab-a"}));
    }

    #[test]
    fn merge_connection_sources_preserves_enabled_stage_without_password() {
        let resolved = merge_connection_sources(
            &defaults(),
            ConnectionRequest {
                host: Some("demo-host".to_string()),
                ..ConnectionRequest::default()
            },
            Some(saved_connection(Some(""))),
            Some("lab1".to_string()),
        )
        .expect("resolved connection");
        assert_eq!(resolved.enable_password, Some(String::new()));
    }

    #[tokio::test]
    async fn shutdown_cancels_pending_request_future() {
        let state = AppState::new(
            GlobalOpts {
                credential: None,
                host: None,
                port: None,
                ssh_security: None,
                linux_shell_flavor: None,
                device_profile: None,
                template_dir: None,
                force_autodetect: false,
                session_retries: 0,
                retry_initial_backoff_ms: 200,
                retry_max_backoff_ms: 2000,
                retry_authentication_errors: false,
                connection: None,
                save_connection: None,
            },
            None,
            None,
        );
        let shutdown_state = state.clone();
        tokio::spawn(async move {
            sleep(Duration::from_millis(25)).await;
            shutdown_state.begin_shutdown();
        });

        let err = state
            .run_until_shutdown(async {
                sleep(Duration::from_secs(30)).await;
                Ok::<(), ApiError>(())
            })
            .await
            .expect_err("shutdown should cancel the in-flight request");

        assert_eq!(err.status, StatusCode::SERVICE_UNAVAILABLE);
        assert!(err.message.contains("shutting down"));
    }
}
