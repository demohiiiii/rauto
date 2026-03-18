use crate::config::paths::rauto_home_dir;
use crate::config::secret_store::{self, SecretKind};
use crate::config::ssh_security::SshSecurityProfile;
use anyhow::{Context, Result, anyhow};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedConnection {
    pub host: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password_ref: Option<String>,
    pub port: Option<u16>,
    pub enable_password: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enable_password_ref: Option<String>,
    pub ssh_security: Option<SshSecurityProfile>,
    pub device_profile: Option<String>,
    pub template_dir: Option<String>,
}

pub fn connections_dir() -> PathBuf {
    rauto_home_dir().join("connections")
}

pub fn list_connections() -> Result<Vec<String>> {
    let dir = connections_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut names = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path
            .extension()
            .and_then(|s| s.to_str())
            .is_some_and(|ext| ext == "toml")
            && let Some(name) = path.file_stem().and_then(|s| s.to_str())
        {
            names.push(name.to_string());
        }
    }
    names.sort();
    Ok(names)
}

pub fn load_connection_raw(name: &str) -> Result<SavedConnection> {
    let safe = safe_connection_name(name)?;
    let path = connections_dir().join(format!("{}.toml", safe));
    if !path.exists() {
        return Err(anyhow!("saved connection '{}' not found", safe));
    }
    let content = fs::read_to_string(&path)
        .with_context(|| format!("failed to read saved connection '{}'", safe))?;
    let data: SavedConnection = toml::from_str(&content)
        .with_context(|| format!("failed to parse saved connection '{}'", safe))?;
    Ok(data)
}

pub fn load_connection(name: &str) -> Result<SavedConnection> {
    let safe = safe_connection_name(name)?;
    let mut data = load_connection_raw(&safe)?;
    resolve_secret_field(
        &safe,
        "password",
        &mut data.password,
        data.password_ref.as_deref(),
    )?;
    resolve_secret_field(
        &safe,
        "enable_password",
        &mut data.enable_password,
        data.enable_password_ref.as_deref(),
    )?;
    Ok(data)
}

pub fn save_connection(name: &str, data: &SavedConnection) -> Result<PathBuf> {
    let safe = safe_connection_name(name)?;
    let dir = connections_dir();
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{}.toml", safe));
    let existing = load_connection_raw(&safe).ok();
    let mut stored = data.clone();

    stored.password_ref = sync_connection_secret(
        &safe,
        SecretKind::Password,
        data.password.as_deref(),
        data.password_ref.as_deref(),
        existing
            .as_ref()
            .and_then(|item| item.password_ref.as_deref()),
    )?;
    stored.enable_password_ref = sync_connection_secret(
        &safe,
        SecretKind::EnablePassword,
        data.enable_password.as_deref(),
        data.enable_password_ref.as_deref(),
        existing
            .as_ref()
            .and_then(|item| item.enable_password_ref.as_deref()),
    )?;
    stored.password = None;
    stored.enable_password = None;

    let content = toml::to_string_pretty(&stored)?;
    fs::write(&path, content.as_bytes())?;
    set_connection_file_permissions(&path)?;
    Ok(path)
}

pub fn delete_connection(name: &str) -> Result<bool> {
    let safe = safe_connection_name(name)?;
    let path = connections_dir().join(format!("{}.toml", safe));
    if !path.exists() {
        return Ok(false);
    }
    if let Ok(data) = load_connection_raw(&safe) {
        let password_ref = data
            .password_ref
            .unwrap_or_else(|| secret_store::connection_secret_ref(&safe, SecretKind::Password));
        let enable_password_ref = data.enable_password_ref.unwrap_or_else(|| {
            secret_store::connection_secret_ref(&safe, SecretKind::EnablePassword)
        });
        secret_store::delete_secret(&password_ref)?;
        secret_store::delete_secret(&enable_password_ref)?;
    }
    fs::remove_file(path)?;
    Ok(true)
}

pub fn has_saved_password(data: &SavedConnection) -> bool {
    has_non_empty_value(data.password.as_deref())
        || has_non_empty_value(data.password_ref.as_deref())
}

pub fn has_saved_enable_password(data: &SavedConnection) -> bool {
    has_non_empty_value(data.enable_password.as_deref())
        || has_non_empty_value(data.enable_password_ref.as_deref())
}

pub fn safe_connection_name(raw: &str) -> Result<String> {
    let normalized = raw.trim().trim_end_matches(".toml");
    if normalized.is_empty()
        || !normalized
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
    {
        return Err(anyhow!(
            "invalid connection name '{}', use only letters/numbers/_/-",
            raw
        ));
    }
    Ok(normalized.to_string())
}

fn resolve_secret_field(
    connection_name: &str,
    field_name: &str,
    field: &mut Option<String>,
    secret_ref: Option<&str>,
) -> Result<()> {
    if has_non_empty_value(field.as_deref()) || secret_ref.is_none() {
        return Ok(());
    }
    let secret_ref = secret_ref.expect("checked above");
    *field = secret_store::get_secret(secret_ref)?.filter(|value| !value.is_empty());
    if field.is_none() {
        return Err(anyhow!(
            "saved connection '{}' is missing {} in keychain '{}'",
            connection_name,
            field_name,
            secret_ref
        ));
    }
    Ok(())
}

fn sync_connection_secret(
    connection_name: &str,
    kind: SecretKind,
    secret_value: Option<&str>,
    incoming_ref: Option<&str>,
    existing_ref: Option<&str>,
) -> Result<Option<String>> {
    if let Some(secret_value) = secret_value.filter(|value| !value.is_empty()) {
        let secret_ref = secret_store::connection_secret_ref(connection_name, kind);
        secret_store::set_secret(&secret_ref, secret_value)?;
        cleanup_previous_ref(&secret_ref, incoming_ref, existing_ref)?;
        return Ok(Some(secret_ref));
    }

    if let Some(secret_ref) = incoming_ref.filter(|value| !value.is_empty()) {
        cleanup_previous_ref(secret_ref, None, existing_ref)?;
        return Ok(Some(secret_ref.to_string()));
    }

    if let Some(secret_ref) = existing_ref.filter(|value| !value.is_empty()) {
        secret_store::delete_secret(secret_ref)?;
    } else {
        let derived_ref = secret_store::connection_secret_ref(connection_name, kind);
        secret_store::delete_secret(&derived_ref)?;
    }
    Ok(None)
}

fn cleanup_previous_ref(
    active_ref: &str,
    incoming_ref: Option<&str>,
    existing_ref: Option<&str>,
) -> Result<()> {
    for old_ref in [incoming_ref, existing_ref].into_iter().flatten() {
        if old_ref != active_ref {
            secret_store::delete_secret(old_ref)?;
        }
    }
    Ok(())
}

fn has_non_empty_value(value: Option<&str>) -> bool {
    value.is_some_and(|item| !item.is_empty())
}

#[cfg(unix)]
fn set_connection_file_permissions(path: &std::path::Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let perms = fs::Permissions::from_mode(0o600);
    fs::set_permissions(path, perms)?;
    Ok(())
}

#[cfg(not(unix))]
fn set_connection_file_permissions(_path: &std::path::Path) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        SavedConnection, delete_connection, has_saved_enable_password, has_saved_password,
        load_connection, load_connection_raw, save_connection,
    };
    use crate::config::paths::rauto_home_dir;
    use crate::config::secret_store;
    use crate::config::ssh_security::SshSecurityProfile;
    use anyhow::Result;
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    #[test]
    fn save_connection_moves_secrets_out_of_file_and_resolves_them_on_load() -> Result<()> {
        let _secret_guard = secret_store::install_test_backend();
        let _env_guard = TestEnvGuard::new()?;

        let saved = SavedConnection {
            host: Some("192.0.2.10".to_string()),
            username: Some("admin".to_string()),
            password: Some("ssh-secret".to_string()),
            password_ref: None,
            port: Some(22),
            enable_password: Some("enable-secret".to_string()),
            enable_password_ref: None,
            ssh_security: Some(SshSecurityProfile::Balanced),
            device_profile: Some("cisco_ios".to_string()),
            template_dir: Some("/tmp/templates".to_string()),
        };

        let path = save_connection("lab1", &saved)?;
        let file_content = std::fs::read_to_string(&path)?;
        assert!(!file_content.contains("ssh-secret"));
        assert!(!file_content.contains("enable-secret"));
        assert!(file_content.contains("password_ref"));
        assert!(file_content.contains("enable_password_ref"));

        let raw = load_connection_raw("lab1")?;
        assert!(raw.password.is_none());
        assert!(raw.enable_password.is_none());
        assert!(has_saved_password(&raw));
        assert!(has_saved_enable_password(&raw));

        let resolved = load_connection("lab1")?;
        assert_eq!(resolved.password.as_deref(), Some("ssh-secret"));
        assert_eq!(resolved.enable_password.as_deref(), Some("enable-secret"));

        Ok(())
    }

    #[test]
    fn save_connection_without_password_clears_existing_secret_refs() -> Result<()> {
        let _secret_guard = secret_store::install_test_backend();
        let _env_guard = TestEnvGuard::new()?;

        save_connection(
            "lab2",
            &SavedConnection {
                host: Some("192.0.2.20".to_string()),
                username: Some("admin".to_string()),
                password: Some("stored-secret".to_string()),
                password_ref: None,
                port: Some(22),
                enable_password: None,
                enable_password_ref: None,
                ssh_security: None,
                device_profile: None,
                template_dir: None,
            },
        )?;

        save_connection(
            "lab2",
            &SavedConnection {
                host: Some("192.0.2.20".to_string()),
                username: Some("admin".to_string()),
                password: None,
                password_ref: None,
                port: Some(22),
                enable_password: None,
                enable_password_ref: None,
                ssh_security: None,
                device_profile: None,
                template_dir: None,
            },
        )?;

        let raw = load_connection_raw("lab2")?;
        assert!(!has_saved_password(&raw));
        assert!(load_connection("lab2")?.password.is_none());

        delete_connection("lab2")?;
        Ok(())
    }

    struct TestEnvGuard {
        original_home: Option<std::ffi::OsString>,
        root: PathBuf,
        _guard: std::sync::MutexGuard<'static, ()>,
    }

    impl TestEnvGuard {
        fn new() -> Result<Self> {
            let guard = TEST_ENV_LOCK
                .get_or_init(|| Mutex::new(()))
                .lock()
                .expect("test env lock poisoned");
            let root = std::env::temp_dir().join(format!(
                "rauto-connection-store-test-{}",
                SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos()
            ));
            let original_home = std::env::var_os("RAUTO_HOME");
            unsafe {
                std::env::set_var("RAUTO_HOME", &root);
            }
            Ok(Self {
                original_home,
                root,
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
            let _ = std::fs::remove_dir_all(rauto_home_dir());
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }
}
