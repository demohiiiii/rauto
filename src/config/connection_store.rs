use crate::config::keyring_store;
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::ssh_security::SshSecurityProfile;
use crate::db;
use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::Row;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

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
    pub linux_shell_flavor: Option<LinuxShellFlavor>,
    pub device_profile: Option<String>,
    pub template_dir: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub labels: Vec<String>,
    #[serde(default = "default_vars")]
    pub vars: Value,
    #[serde(default)]
    pub groups: Vec<String>,
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
            SELECT host, username, password_ref, port, enable_password_ref, ssh_security, linux_shell_flavor, device_profile, template_dir
                 , enabled, labels_json, vars_json
            FROM connections
            WHERE name = ?
            "#,
        )
        .bind(&safe)
        .fetch_optional(db::pool())
        .await?
        .ok_or_else(|| anyhow!("saved connection '{}' not found", safe))?;
        let groups = load_connection_groups_async(&safe).await?;

        Ok(SavedConnection {
            host: row.try_get("host")?,
            username: row.try_get("username")?,
            password: None,
            password_ref: row.try_get("password_ref")?,
            port: row
                .try_get::<Option<i64>, _>("port")?
                .map(|value| value as u16),
            enable_password: None,
            enable_password_ref: row.try_get("enable_password_ref")?,
            ssh_security: row
                .try_get::<Option<String>, _>("ssh_security")?
                .map(|value| parse_ssh_security_profile(&value))
                .transpose()?,
            linux_shell_flavor: row
                .try_get::<Option<String>, _>("linux_shell_flavor")?
                .map(|value| parse_linux_shell_flavor(&value))
                .transpose()?,
            device_profile: row.try_get("device_profile")?,
            template_dir: row.try_get("template_dir")?,
            enabled: row.try_get::<i64, _>("enabled").unwrap_or(1) != 0,
            labels: parse_labels_json(
                row.try_get::<Option<String>, _>("labels_json")?
                    .unwrap_or_else(|| "[]".to_string()),
            )?,
            vars: parse_vars_json(
                row.try_get::<Option<String>, _>("vars_json")?
                    .unwrap_or_else(|| "{}".to_string()),
            )?,
            groups,
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
    persist_connection(&safe, data)?;
    Ok(db::db_path())
}

pub fn delete_connection(name: &str) -> Result<bool> {
    let safe = safe_connection_name(name)?;
    let existing = match load_connection_raw(&safe) {
        Ok(item) => item,
        Err(_) => return Ok(false),
    };
    if let Err(err) = keyring_store::delete_secret(existing.password_ref.as_deref()) {
        return Err(anyhow!(
            "failed to delete saved password for connection '{}': {}",
            safe,
            err
        ));
    }
    if let Err(err) = keyring_store::delete_secret(existing.enable_password_ref.as_deref()) {
        return Err(anyhow!(
            "failed to delete saved enable password for connection '{}': {}",
            safe,
            err
        ));
    }

    db::run_sync(async move {
        sqlx::query("DELETE FROM inventory_group_members WHERE connection_name = ?")
            .bind(&safe)
            .execute(db::pool())
            .await?;
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
    has_non_empty_value(data.password.as_deref()) || has_non_empty_value(data.password_ref.as_deref())
}

pub fn has_saved_enable_password(data: &SavedConnection) -> bool {
    has_non_empty_value(data.enable_password.as_deref())
        || has_non_empty_value(data.enable_password_ref.as_deref())
}

pub fn load_saved_secret(secret_ref: Option<&str>) -> Result<Option<String>> {
    Ok(keyring_store::load_secret(secret_ref)?.filter(|value| !value.is_empty()))
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
    stored.password_ref = sync_connection_secret(
        connection_name,
        "password",
        data.password.as_deref(),
        data.password_ref.as_deref(),
    )?;
    stored.enable_password_ref = sync_connection_secret(
        connection_name,
        "enable_password",
        data.enable_password.as_deref(),
        data.enable_password_ref.as_deref(),
    )?;
    stored.password = None;
    stored.enable_password = None;
    let labels_json = normalize_labels_json(&stored.labels)?;
    let vars_json = normalize_vars_json(stored.vars.clone())?;
    let groups = normalize_name_list(&stored.groups)?;

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
                name, host, username, password_ref, port, enable_password_ref, ssh_security, linux_shell_flavor,
                device_profile, template_dir, enabled, labels_json, vars_json,
                created_at_ms, updated_at_ms
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                host = excluded.host,
                username = excluded.username,
                password_ref = excluded.password_ref,
                port = excluded.port,
                enable_password_ref = excluded.enable_password_ref,
                ssh_security = excluded.ssh_security,
                linux_shell_flavor = excluded.linux_shell_flavor,
                device_profile = excluded.device_profile,
                template_dir = excluded.template_dir,
                enabled = excluded.enabled,
                labels_json = excluded.labels_json,
                vars_json = excluded.vars_json,
                updated_at_ms = excluded.updated_at_ms
            "#,
        )
        .bind(&name)
        .bind(&stored.host)
        .bind(&stored.username)
        .bind(&stored.password_ref)
        .bind(stored.port.map(i64::from))
        .bind(&stored.enable_password_ref)
        .bind(stored.ssh_security.map(|value| value.to_string()))
        .bind(stored.linux_shell_flavor.map(|value| value.to_string()))
        .bind(&stored.device_profile)
        .bind(&stored.template_dir)
        .bind(if stored.enabled { 1_i64 } else { 0_i64 })
        .bind(labels_json)
        .bind(vars_json)
        .bind(created_at_ms)
        .bind(now_ms as i64)
        .execute(db::pool())
        .await?;

        sqlx::query("DELETE FROM inventory_group_members WHERE connection_name = ?")
            .bind(&name)
            .execute(db::pool())
            .await?;

        for group_name in &groups {
            let group_created_at = sqlx::query_scalar::<_, i64>(
                "SELECT created_at_ms FROM inventory_groups WHERE name = ?",
            )
            .bind(group_name)
            .fetch_optional(db::pool())
            .await?
            .unwrap_or(now_ms as i64);

            sqlx::query(
                r#"
                INSERT INTO inventory_groups (name, description, created_at_ms, updated_at_ms)
                VALUES (?, NULL, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    updated_at_ms = excluded.updated_at_ms
                "#,
            )
            .bind(group_name)
            .bind(group_created_at)
            .bind(now_ms as i64)
            .execute(db::pool())
            .await?;

            sqlx::query(
                "INSERT INTO inventory_group_members (group_name, connection_name, created_at_ms) VALUES (?, ?, ?)",
            )
            .bind(group_name)
            .bind(&name)
            .bind(now_ms as i64)
            .execute(db::pool())
            .await?;
        }
        Ok(())
    })
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
    *field = load_saved_secret(secret_ref)?;
    if field.is_none() {
        return Err(anyhow!(
            "saved connection '{}' is missing {} in keyring; re-save the connection to repair it",
            connection_name,
            field_name,
        ));
    }
    Ok(())
}

fn sync_connection_secret(
    connection_name: &str,
    field_name: &str,
    secret_value: Option<&str>,
    incoming_ref: Option<&str>,
) -> Result<Option<String>> {
    if let Some(secret_value) = secret_value.filter(|value| !value.is_empty()) {
        return keyring_store::store_secret(connection_name, field_name, Some(secret_value));
    }

    if let Some(secret_ref) = incoming_ref.filter(|value| !value.is_empty()) {
        return Ok(Some(secret_ref.to_string()));
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

fn parse_linux_shell_flavor(value: &str) -> Result<LinuxShellFlavor> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("invalid linux shell flavor ''"));
    }
    trimmed.parse::<LinuxShellFlavor>()
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn default_enabled() -> bool {
    true
}

fn default_vars() -> Value {
    Value::Object(Map::new())
}

fn parse_labels_json(raw: String) -> Result<Vec<String>> {
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|err| anyhow!("failed to parse stored labels json: {}", err))?;
    let items = parsed
        .as_array()
        .ok_or_else(|| anyhow!("stored labels must be a JSON array"))?;
    let mut normalized = Vec::new();
    for item in items {
        let value = item
            .as_str()
            .ok_or_else(|| anyhow!("stored label values must be strings"))?;
        normalized.push(normalize_simple_name(value)?);
    }
    normalized.sort();
    normalized.dedup();
    Ok(normalized)
}

fn normalize_labels_json(values: &[String]) -> Result<String> {
    serde_json::to_string(&normalize_name_list(values)?).map_err(|err| anyhow!(err))
}

fn parse_vars_json(raw: String) -> Result<Value> {
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|err| anyhow!("failed to parse stored vars json: {}", err))?;
    ensure_json_object(&parsed)?;
    Ok(parsed)
}

fn normalize_vars_json(value: Value) -> Result<String> {
    ensure_json_object(&value)?;
    serde_json::to_string(&value).map_err(|err| anyhow!(err))
}

fn ensure_json_object(value: &Value) -> Result<()> {
    if !value.is_object() {
        return Err(anyhow!("vars must be a JSON object"));
    }
    Ok(())
}

fn normalize_simple_name(raw: &str) -> Result<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("name is required"));
    }
    if !trimmed
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.'))
    {
        return Err(anyhow!(
            "invalid name '{}', use only letters/numbers/_/./-",
            raw
        ));
    }
    Ok(trimmed.to_string())
}

fn normalize_name_list(values: &[String]) -> Result<Vec<String>> {
    let mut items = values
        .iter()
        .map(|value| normalize_simple_name(value))
        .collect::<Result<Vec<_>>>()?;
    items.sort();
    items.dedup();
    Ok(items)
}

async fn load_connection_groups_async(name: &str) -> Result<Vec<String>> {
    let rows = sqlx::query(
        "SELECT group_name FROM inventory_group_members WHERE connection_name = ? ORDER BY group_name ASC",
    )
    .bind(name)
    .fetch_all(db::pool())
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| row.get::<String, _>("group_name"))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::{
        SavedConnection, delete_connection, has_saved_password, load_connection,
        load_connection_raw, load_saved_secret, save_connection,
    };
    use crate::config::keyring_store;
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
    fn save_and_load_connection_round_trips_password_via_keyring() -> Result<()> {
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
                password_ref: None,
                port: Some(22),
                enable_password: None,
                enable_password_ref: None,
                ssh_security: Some(SshSecurityProfile::Secure),
                linux_shell_flavor: None,
                device_profile: Some("cisco".to_string()),
                template_dir: None,
                enabled: true,
                labels: vec!["core".to_string()],
                vars: serde_json::json!({"site":"lab-a"}),
                groups: vec!["access".to_string()],
            },
        )?;

        let loaded = load_connection(name)?;
        assert_eq!(loaded.password.as_deref(), Some("secret-123"));
        assert!(has_saved_password(&loaded));
        Ok(())
    }

    #[test]
    fn save_connection_persists_keyring_refs_and_delete_cleans_up_secret() -> Result<()> {
        let _env_guard = TestEnvGuard::new()?;
        db::init_sync()?;
        let name = "conn_store_keyring_refs";
        let _ = delete_connection(name);

        save_connection(
            name,
            &SavedConnection {
                host: Some("192.0.2.30".to_string()),
                username: Some("ops".to_string()),
                password: Some("top-secret".to_string()),
                password_ref: None,
                port: Some(2222),
                enable_password: Some("enable-me".to_string()),
                enable_password_ref: None,
                ssh_security: Some(SshSecurityProfile::Balanced),
                linux_shell_flavor: None,
                device_profile: Some("linux".to_string()),
                template_dir: None,
                enabled: true,
                labels: vec!["edge".to_string()],
                vars: serde_json::json!({"site":"lab-b"}),
                groups: vec!["core".to_string()],
            },
        )?;

        let raw = load_connection_raw(name)?;
        let password_ref = raw.password_ref.clone();
        let enable_ref = raw.enable_password_ref.clone();
        let expected_password_ref = keyring_store::build_secret_ref(name, "password");
        let expected_enable_ref = keyring_store::build_secret_ref(name, "enable_password");
        assert_eq!(
            password_ref.as_deref(),
            Some(expected_password_ref.as_str())
        );
        assert_eq!(enable_ref.as_deref(), Some(expected_enable_ref.as_str()));
        assert_eq!(
            load_saved_secret(password_ref.as_deref())?.as_deref(),
            Some("top-secret")
        );
        assert_eq!(
            load_saved_secret(enable_ref.as_deref())?.as_deref(),
            Some("enable-me")
        );

        assert!(delete_connection(name)?);
        assert!(load_saved_secret(password_ref.as_deref())?.is_none());
        assert!(load_saved_secret(enable_ref.as_deref())?.is_none());
        Ok(())
    }

    #[test]
    fn load_connection_fails_when_keyring_secret_is_missing() -> Result<()> {
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
                password_ref: Some("connection/conn_store_invalid_secret/password".to_string()),
                port: Some(22),
                enable_password: None,
                enable_password_ref: None,
                ssh_security: Some(SshSecurityProfile::Secure),
                linux_shell_flavor: None,
                device_profile: Some("h3c".to_string()),
                template_dir: None,
                enabled: true,
                labels: vec!["edge".to_string()],
                vars: serde_json::json!({}),
                groups: vec![],
            },
        )?;

        let loaded_raw = super::load_connection_raw(name)?;
        assert!(!has_saved_password(&loaded_raw));
        let err = load_connection(name).expect_err("missing keyring secret should fail");
        assert!(err.to_string().contains(
            "saved connection 'conn_store_invalid_secret' is missing password in keyring"
        ));
        Ok(())
    }
}
