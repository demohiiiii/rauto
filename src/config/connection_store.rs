use crate::config::secret_store;
use crate::config::ssh_security::SshSecurityProfile;
use crate::db;
use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedConnection {
    pub host: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password_encrypted: Option<String>,
    pub port: Option<u16>,
    pub enable_password: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enable_password_encrypted: Option<String>,
    pub ssh_security: Option<SshSecurityProfile>,
    pub device_profile: Option<String>,
    pub template_dir: Option<String>,
}

pub fn storage_path() -> PathBuf {
    db::db_path()
}

pub fn list_connections() -> Result<Vec<String>> {
    db::run_sync(async {
        let rows = sqlx::query("SELECT name FROM connections ORDER BY name ASC")
            .fetch_all(db::pool())
            .await?;
        Ok(rows
            .into_iter()
            .map(|row| row.get::<String, _>("name"))
            .collect())
    })
}

pub fn load_connection_raw(name: &str) -> Result<SavedConnection> {
    let safe = safe_connection_name(name)?;
    db::run_sync(async move {
        let row = sqlx::query(
            r#"
            SELECT host, username, password_encrypted, port, enable_password_encrypted, ssh_security, device_profile, template_dir
            FROM connections
            WHERE name = ?
            "#,
        )
        .bind(&safe)
        .fetch_optional(db::pool())
        .await?
        .ok_or_else(|| anyhow!("saved connection '{}' not found", safe))?;

        Ok(SavedConnection {
            host: row.try_get("host")?,
            username: row.try_get("username")?,
            password: None,
            password_encrypted: row.try_get("password_encrypted")?,
            port: row
                .try_get::<Option<i64>, _>("port")?
                .map(|value| value as u16),
            enable_password: None,
            enable_password_encrypted: row.try_get("enable_password_encrypted")?,
            ssh_security: row
                .try_get::<Option<String>, _>("ssh_security")?
                .map(|value| parse_ssh_security_profile(&value))
                .transpose()?,
            device_profile: row.try_get("device_profile")?,
            template_dir: row.try_get("template_dir")?,
        })
    })
}

pub fn load_connection(name: &str) -> Result<SavedConnection> {
    let safe = safe_connection_name(name)?;
    let mut data = load_connection_raw(&safe)?;
    resolve_secret_field(
        &safe,
        "password",
        &mut data.password,
        data.password_encrypted.as_deref(),
    )?;
    resolve_secret_field(
        &safe,
        "enable_password",
        &mut data.enable_password,
        data.enable_password_encrypted.as_deref(),
    )?;
    Ok(data)
}

pub fn save_connection(name: &str, data: &SavedConnection) -> Result<PathBuf> {
    let safe = safe_connection_name(name)?;
    persist_connection(&safe, data)?;
    Ok(db::db_path())
}

pub fn delete_connection(name: &str) -> Result<bool> {
    let safe = safe_connection_name(name)?;
    if load_connection_raw(&safe).is_err() {
        return Ok(false);
    }

    db::run_sync(async move {
        let deleted = sqlx::query("DELETE FROM connections WHERE name = ?")
            .bind(&safe)
            .execute(db::pool())
            .await?
            .rows_affected()
            > 0;
        Ok(deleted)
    })
}

pub fn has_saved_password(data: &SavedConnection) -> bool {
    has_non_empty_value(data.password.as_deref())
        || secret_store::has_encrypted_secret(data.password_encrypted.as_deref())
}

pub fn has_saved_enable_password(data: &SavedConnection) -> bool {
    has_non_empty_value(data.enable_password.as_deref())
        || secret_store::has_encrypted_secret(data.enable_password_encrypted.as_deref())
}

pub fn load_saved_secret(encrypted_secret: Option<&str>) -> Result<Option<String>> {
    Ok(secret_store::decrypt_secret(encrypted_secret)?.filter(|value| !value.is_empty()))
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

fn persist_connection(connection_name: &str, data: &SavedConnection) -> Result<()> {
    let mut stored = data.clone();
    stored.password_encrypted =
        sync_connection_secret(data.password.as_deref(), data.password_encrypted.as_deref())?;
    stored.enable_password_encrypted = sync_connection_secret(
        data.enable_password.as_deref(),
        data.enable_password_encrypted.as_deref(),
    )?;
    stored.password = None;
    stored.enable_password = None;

    let now_ms = now_ms();
    let name = connection_name.to_string();
    db::run_sync(async move {
        let created_at_ms =
            sqlx::query_scalar::<_, i64>("SELECT created_at_ms FROM connections WHERE name = ?")
                .bind(&name)
                .fetch_optional(db::pool())
                .await?
                .unwrap_or(now_ms as i64);

        sqlx::query(
            r#"
            INSERT INTO connections (
                name, host, username, password_encrypted, port, enable_password_encrypted, ssh_security,
                device_profile, template_dir, created_at_ms, updated_at_ms
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                host = excluded.host,
                username = excluded.username,
                password_encrypted = excluded.password_encrypted,
                port = excluded.port,
                enable_password_encrypted = excluded.enable_password_encrypted,
                ssh_security = excluded.ssh_security,
                device_profile = excluded.device_profile,
                template_dir = excluded.template_dir,
                updated_at_ms = excluded.updated_at_ms
            "#,
        )
        .bind(&name)
        .bind(&stored.host)
        .bind(&stored.username)
        .bind(&stored.password_encrypted)
        .bind(stored.port.map(i64::from))
        .bind(&stored.enable_password_encrypted)
        .bind(stored.ssh_security.map(|value| value.to_string()))
        .bind(&stored.device_profile)
        .bind(&stored.template_dir)
        .bind(created_at_ms)
        .bind(now_ms as i64)
        .execute(db::pool())
        .await?;
        Ok(())
    })
}

fn resolve_secret_field(
    connection_name: &str,
    field_name: &str,
    field: &mut Option<String>,
    encrypted_secret: Option<&str>,
) -> Result<()> {
    if has_non_empty_value(field.as_deref()) || encrypted_secret.is_none() {
        return Ok(());
    }
    *field = load_saved_secret(encrypted_secret)?;
    if field.is_none() {
        return Err(anyhow!(
            "saved connection '{}' has an unreadable {} secret; re-save the connection to repair it",
            connection_name,
            field_name,
        ));
    }
    Ok(())
}

fn sync_connection_secret(
    secret_value: Option<&str>,
    incoming_encrypted: Option<&str>,
) -> Result<Option<String>> {
    if let Some(secret_value) = secret_value.filter(|value| !value.is_empty()) {
        return secret_store::encrypt_secret(secret_value);
    }

    if let Some(encrypted) = incoming_encrypted.filter(|value| !value.is_empty()) {
        return Ok(Some(encrypted.to_string()));
    }

    Ok(None)
}

fn has_non_empty_value(value: Option<&str>) -> bool {
    value.is_some_and(|item| !item.is_empty())
}

fn parse_ssh_security_profile(value: &str) -> Result<SshSecurityProfile> {
    match value.trim() {
        "secure" => Ok(SshSecurityProfile::Secure),
        "balanced" => Ok(SshSecurityProfile::Balanced),
        "legacy-compatible" => Ok(SshSecurityProfile::LegacyCompatible),
        other => Err(anyhow!("invalid ssh security profile '{}'", other)),
    }
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::{
        SavedConnection, delete_connection, has_saved_password, load_connection, save_connection,
    };
    use crate::config::ssh_security::SshSecurityProfile;
    use crate::db;
    use anyhow::Result;
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};
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
                "rauto-connection-store-test-{}",
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
    fn save_and_load_connection_round_trips_password_via_encrypted_store() -> Result<()> {
        let _env_guard = TestEnvGuard::new()?;
        db::init_sync()?;
        let name = "conn_store_roundtrip";
        let _ = delete_connection(name);

        save_connection(
            name,
            &SavedConnection {
                host: Some("192.0.2.10".to_string()),
                username: Some("admin".to_string()),
                password: Some("secret-123".to_string()),
                password_encrypted: None,
                port: Some(22),
                enable_password: None,
                enable_password_encrypted: None,
                ssh_security: Some(SshSecurityProfile::Secure),
                device_profile: Some("cisco".to_string()),
                template_dir: None,
            },
        )?;

        let loaded = load_connection(name)?;
        assert_eq!(loaded.password.as_deref(), Some("secret-123"));
        assert!(has_saved_password(&loaded));
        Ok(())
    }

    #[test]
    fn load_connection_fails_when_encrypted_secret_is_invalid() -> Result<()> {
        let _env_guard = TestEnvGuard::new()?;
        db::init_sync()?;
        let name = "conn_store_invalid_secret";
        let _ = delete_connection(name);

        save_connection(
            name,
            &SavedConnection {
                host: Some("192.0.2.20".to_string()),
                username: Some("admin".to_string()),
                password: None,
                password_encrypted: Some("not-valid-json".to_string()),
                port: Some(22),
                enable_password: None,
                enable_password_encrypted: None,
                ssh_security: Some(SshSecurityProfile::Secure),
                device_profile: Some("h3c".to_string()),
                template_dir: None,
            },
        )?;

        let loaded_raw = super::load_connection_raw(name)?;
        assert!(has_saved_password(&loaded_raw));
        let err = load_connection(name).expect_err("invalid secret should fail");
        assert!(err.to_string().contains("invalid encrypted secret payload"));
        Ok(())
    }
}
