use crate::cli::{GlobalOpts, RecordLevelOpt};
use crate::config::autodetect_cache;
use crate::config::command_flow_template::CommandFlowTemplate;
use crate::config::command_flow_vars::{
    ConnectionParamContext, resolve_command_flow_runtime_vars, resolve_runtime_var_aliases,
};
use crate::config::connection_store::{SavedConnection, load_connection, save_connection};
use crate::config::history_store::{self, HistoryBinding};
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::session_recording;
use crate::config::ssh_security::SshSecurityProfile;
use crate::config::template_loader::{self, AUTODETECT_DEVICE_PROFILE};
use crate::device::DeviceClient;
use anyhow::Result;
use rneter::device::DeviceHandler;
use rneter::session::{
    ConnectionRequest as ManagerConnectionRequest, DetectRequest, ExecutionContext,
    SessionRecordLevel,
};
use rneter::templates::{DetectConnectPolicy, autodetect_with_builtin_and_templates_and_context};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tracing::{error, info, warn};

pub(crate) fn manager_connection_request(
    username: String,
    host: String,
    port: u16,
    password: String,
    enable_password: Option<String>,
    handler: DeviceHandler,
) -> ManagerConnectionRequest {
    ManagerConnectionRequest::new(username, host, port, password, enable_password, handler)
}

pub(crate) fn manager_execution_context_with_security(
    sys: Option<String>,
    ssh_security: SshSecurityProfile,
    connect_timeout_secs: Option<u64>,
) -> ExecutionContext {
    let context = ExecutionContext::new()
        .with_security_options(ssh_security.to_connection_security_options())
        .with_sys(sys);
    match connect_timeout_secs {
        Some(timeout_secs) => context.with_connect_timeout_secs(timeout_secs),
        None => context,
    }
}

#[derive(Debug, Clone)]
pub(crate) struct EffectiveConnection {
    pub(crate) connection_name: Option<String>,
    pub(crate) host: String,
    pub(crate) username: String,
    pub(crate) password: String,
    pub(crate) port: u16,
    pub(crate) connect_timeout_secs: Option<u64>,
    pub(crate) enable_password: Option<String>,
    pub(crate) ssh_security: SshSecurityProfile,
    pub(crate) linux_shell_flavor: Option<LinuxShellFlavor>,
    pub(crate) device_profile: String,
    pub(crate) vars: serde_json::Value,
    pub(crate) template_dir: Option<PathBuf>,
    pub(crate) force_autodetect: bool,
}

pub(crate) fn resolve_effective_connection(opts: &GlobalOpts) -> Result<EffectiveConnection> {
    let saved = if let Some(name) = &opts.connection {
        Some(load_connection(name)?)
    } else {
        None
    };

    let host = opts
        .host
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.host.clone()))
        .ok_or_else(|| anyhow::anyhow!("host is required"))?;
    let username = opts
        .username
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.username.clone()))
        .unwrap_or_else(|| "admin".to_string());
    let password = opts
        .password
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.password.clone()))
        .or_else(|| std::env::var("RAUTO_PASSWORD").ok())
        .unwrap_or_default();
    let port = opts
        .port
        .or_else(|| saved.as_ref().and_then(|s| s.port))
        .unwrap_or(22);
    let connect_timeout_secs = saved
        .as_ref()
        .and_then(|connection| connection.connect_timeout_secs);
    let ssh_security = opts
        .ssh_security
        .or_else(|| saved.as_ref().and_then(|s| s.ssh_security))
        .unwrap_or_default();
    let linux_shell_flavor = opts
        .linux_shell_flavor
        .or_else(|| saved.as_ref().and_then(|s| s.linux_shell_flavor));
    let device_profile = opts
        .device_profile
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.device_profile.clone()))
        .unwrap_or_else(|| AUTODETECT_DEVICE_PROFILE.to_string());
    let template_dir = opts.template_dir.clone().or_else(|| {
        saved
            .as_ref()
            .and_then(|s| s.template_dir.clone().map(PathBuf::from))
    });
    let vars = saved
        .as_ref()
        .map(|s| s.vars.clone())
        .unwrap_or_else(|| serde_json::json!({}));
    let enable_password = opts
        .enable_password
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.enable_password.clone()))
        .or_else(|| Some(String::new()));

    Ok(EffectiveConnection {
        connection_name: opts
            .connection
            .clone()
            .or_else(|| opts.save_connection.clone()),
        host,
        username,
        password,
        port,
        connect_timeout_secs,
        enable_password,
        ssh_security,
        linux_shell_flavor,
        device_profile,
        vars,
        template_dir,
        force_autodetect: opts.force_autodetect,
    })
}

pub(crate) async fn resolve_autodetect_connection(
    mut conn: EffectiveConnection,
) -> Result<EffectiveConnection> {
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

    let request = DetectRequest::new(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
    );
    let context =
        manager_execution_context_with_security(None, conn.ssh_security, conn.connect_timeout_secs);
    let report = autodetect_with_builtin_and_templates_and_context(
        request,
        context,
        template_loader::custom_detect_template_definitions()?,
    )
    .await?;
    let policy = DetectConnectPolicy::default();
    let best = report
        .best_match
        .as_ref()
        .filter(|candidate| {
            candidate
                .confidence
                .satisfies_minimum(policy.minimum_confidence)
        })
        .ok_or_else(|| {
            anyhow::anyhow!(
                "device profile autodetect failed: no candidate met minimum confidence {:?}",
                policy.minimum_confidence
            )
        })?;
    info!(
        "Device profile autodetected as '{}' (confidence={:?}, score={})",
        best.template_name, best.confidence, best.score
    );
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

pub(crate) fn maybe_save_connection_profile(
    opts: &GlobalOpts,
    conn: &EffectiveConnection,
) -> Result<()> {
    let Some(name) = &opts.save_connection else {
        return Ok(());
    };

    let path = save_named_connection(name, conn)?;
    println!("Saved device '{}' to '{}'", name, path.to_string_lossy());
    Ok(())
}

pub(crate) fn save_named_connection(name: &str, conn: &EffectiveConnection) -> Result<PathBuf> {
    let data = SavedConnection {
        host: Some(conn.host.clone()),
        username: Some(conn.username.clone()),
        password: Some(conn.password.clone()),
        password_ref: None,
        port: Some(conn.port),
        connect_timeout_secs: conn.connect_timeout_secs,
        enable_password: conn.enable_password.clone(),
        enable_password_ref: None,
        enable_password_empty_enter: conn.enable_password == Some(String::new()),
        ssh_security: Some(conn.ssh_security),
        linux_shell_flavor: conn.linux_shell_flavor,
        device_profile: Some(conn.device_profile.clone()),
        template_dir: conn
            .template_dir
            .as_ref()
            .map(|p| p.to_string_lossy().to_string()),
        enabled: true,
        labels: vec![],
        vars: conn.vars.clone(),
        groups: vec![],
    };

    save_connection(name, &data)
}

fn current_connection_param_context(conn: &EffectiveConnection) -> ConnectionParamContext {
    ConnectionParamContext::new(
        conn.connection_name.as_deref(),
        Some(&conn.host),
        Some(&conn.username),
        Some(&conn.password),
        Some(conn.port),
        conn.enable_password.as_deref(),
        Some(conn.ssh_security),
        conn.linux_shell_flavor,
        Some(&conn.device_profile),
        &conn.vars,
    )
}

pub(crate) fn resolve_flow_runtime_vars(
    template: &CommandFlowTemplate,
    vars: Value,
    conn: &EffectiveConnection,
) -> Result<Value> {
    resolve_command_flow_runtime_vars(template, vars, Some(current_connection_param_context(conn)))
}

pub(crate) fn resolve_runtime_vars_for_connection(
    vars: Value,
    conn: &EffectiveConnection,
) -> Result<Value> {
    resolve_runtime_var_aliases(vars, Some(current_connection_param_context(conn)))
}

pub(crate) fn read_required_text_input(
    file: Option<&PathBuf>,
    content: Option<&str>,
) -> Result<String> {
    match (
        file.map(|path| path.as_path()),
        content.map(str::trim).filter(|value| !value.is_empty()),
    ) {
        (Some(path), None) => Ok(fs::read_to_string(path)?),
        (None, Some(inline)) => Ok(inline.to_string()),
        (Some(_), Some(_)) => Err(anyhow::anyhow!(
            "choose either --file or --content, not both"
        )),
        (None, None) => Err(anyhow::anyhow!("one of --file or --content is required")),
    }
}

pub(crate) fn to_record_level(level: RecordLevelOpt) -> SessionRecordLevel {
    match level {
        RecordLevelOpt::KeyEventsOnly => SessionRecordLevel::KeyEventsOnly,
        RecordLevelOpt::Full => SessionRecordLevel::Full,
    }
}

pub(crate) fn record_level_name(level: RecordLevelOpt) -> &'static str {
    match level {
        RecordLevelOpt::KeyEventsOnly => "key-events-only",
        RecordLevelOpt::Full => "full",
    }
}

pub(crate) fn normalize_recording_jsonl_for_cli_level(
    jsonl: &str,
    level: RecordLevelOpt,
) -> String {
    if !matches!(level, RecordLevelOpt::KeyEventsOnly) {
        return jsonl.to_string();
    }
    match session_recording::command_output_only_jsonl(jsonl) {
        Ok(value) => value,
        Err(err) => {
            warn!(
                "failed to apply audit recording filter, fallback to raw jsonl: {}",
                err
            );
            jsonl.to_string()
        }
    }
}

pub(crate) fn persist_auto_recording_history(
    client: &DeviceClient,
    conn: &EffectiveConnection,
    operation: &str,
    command_label: &str,
    mode: Option<&str>,
    record_level: RecordLevelOpt,
) -> Result<()> {
    let Some(jsonl) = client.recording_jsonl()? else {
        return Ok(());
    };
    let jsonl = normalize_recording_jsonl_for_cli_level(&jsonl, record_level);
    let result = history_store::save_recording(
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
        record_level_name(record_level),
        &jsonl,
    );
    match result {
        Ok(entry) => {
            info!(
                "Auto-saved recording history: {} -> {}",
                entry.connection_key, entry.record_path
            );
        }
        Err(e) => {
            error!("Failed to auto-save recording history: {}", e);
        }
    }
    Ok(())
}

pub(crate) fn write_recording_if_requested(
    record_file: Option<&PathBuf>,
    client: &DeviceClient,
    record_level: RecordLevelOpt,
) -> Result<()> {
    let Some(path) = record_file else {
        return Ok(());
    };
    let Some(jsonl) = client.recording_jsonl()? else {
        return Ok(());
    };
    let jsonl = normalize_recording_jsonl_for_cli_level(&jsonl, record_level);

    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, jsonl.as_bytes())?;
    println!("Saved session recording to '{}'", path.to_string_lossy());
    Ok(())
}

pub(crate) fn persist_auto_recording_history_jsonl(
    jsonl: &str,
    conn: &EffectiveConnection,
    operation: &str,
    command_label: &str,
    mode: Option<&str>,
    record_level: RecordLevelOpt,
) -> Result<()> {
    let jsonl = normalize_recording_jsonl_for_cli_level(jsonl, record_level);
    let result = history_store::save_recording(
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
        record_level_name(record_level),
        &jsonl,
    );
    match result {
        Ok(entry) => {
            info!(
                "Auto-saved recording history: {} -> {}",
                entry.connection_key, entry.record_path
            );
        }
        Err(e) => {
            error!("Failed to auto-save recording history: {}", e);
        }
    }
    Ok(())
}

pub(crate) fn write_recording_text_if_requested(
    record_file: Option<&PathBuf>,
    jsonl: &str,
    record_level: RecordLevelOpt,
) -> Result<()> {
    let Some(path) = record_file else {
        return Ok(());
    };
    let jsonl = normalize_recording_jsonl_for_cli_level(jsonl, record_level);
    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, jsonl.as_bytes())?;
    println!("Saved session recording to '{}'", path.to_string_lossy());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        EffectiveConnection, manager_execution_context_with_security, save_named_connection,
    };
    use crate::config::connection_store;
    use crate::config::linux_shell::LinuxShellFlavor;
    use crate::config::ssh_security::SshSecurityProfile;
    use crate::db;
    use anyhow::Result;
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};
    use std::time::Duration;
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    struct TestEnvGuard {
        original_home: Option<std::ffi::OsString>,
        _root: PathBuf,
        _guard: std::sync::MutexGuard<'static, ()>,
    }

    impl TestEnvGuard {
        fn new() -> Result<Self> {
            let guard = TEST_ENV_LOCK
                .get_or_init(|| Mutex::new(()))
                .lock()
                .expect("test env lock poisoned");
            let root = std::env::temp_dir().join(format!(
                "rauto-cli-runtime-test-{}",
                SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos()
            ));
            let original_home = std::env::var_os("RAUTO_HOME");
            unsafe {
                std::env::set_var("RAUTO_HOME", &root);
            }
            Ok(Self {
                original_home,
                _root: root,
                _guard: guard,
            })
        }
    }

    impl Drop for TestEnvGuard {
        fn drop(&mut self) {
            if let Some(value) = &self.original_home {
                unsafe {
                    std::env::set_var("RAUTO_HOME", value);
                }
            } else {
                unsafe {
                    std::env::remove_var("RAUTO_HOME");
                }
            }
        }
    }

    #[test]
    fn manager_execution_context_applies_optional_connect_timeout() {
        let default_context =
            manager_execution_context_with_security(None, SshSecurityProfile::default(), None);
        assert_eq!(default_context.connect_timeout, Duration::from_secs(60));

        let custom_context =
            manager_execution_context_with_security(None, SshSecurityProfile::default(), Some(23));
        assert_eq!(custom_context.connect_timeout, Duration::from_secs(23));
    }

    #[test]
    fn save_named_connection_persists_passwords_by_default() -> Result<()> {
        let _env_guard = TestEnvGuard::new()?;
        db::init_sync()?;

        save_named_connection(
            "cli_saved_secret",
            &EffectiveConnection {
                connection_name: None,
                host: "192.0.2.10".to_string(),
                username: "admin".to_string(),
                password: "login-secret".to_string(),
                port: 22,
                connect_timeout_secs: Some(25),
                enable_password: Some("enable-secret".to_string()),
                ssh_security: SshSecurityProfile::LegacyCompatible,
                linux_shell_flavor: Some(LinuxShellFlavor::Posix),
                device_profile: "cisco_ios".to_string(),
                vars: serde_json::json!({"site":"lab"}),
                template_dir: None,
                force_autodetect: false,
            },
        )?;

        let saved = connection_store::load_connection("cli_saved_secret")?;
        assert_eq!(saved.password.as_deref(), Some("login-secret"));
        assert_eq!(saved.enable_password.as_deref(), Some("enable-secret"));
        assert_eq!(saved.connect_timeout_secs, Some(25));
        assert!(connection_store::has_saved_password(&saved));
        assert!(connection_store::has_saved_enable_password(&saved));
        Ok(())
    }
}
