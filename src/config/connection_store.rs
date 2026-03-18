use crate::config::secret_store::{self, SecretKind};
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
    pub password_ref: Option<String>,
    pub port: Option<u16>,
    pub enable_password: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enable_password_ref: Option<String>,
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
            SELECT host, username, password_ref, port, enable_password_ref, ssh_security, device_profile, template_dir
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
    let existing = load_connection_raw(&safe).ok();
    persist_connection(&safe, data, existing.as_ref())?;
    Ok(db::db_path())
}

pub fn delete_connection(name: &str) -> Result<bool> {
    let safe = safe_connection_name(name)?;
    let existing = load_connection_raw(&safe).ok();
    let Some(existing) = existing else {
        return Ok(false);
    };

    let password_ref = existing
        .password_ref
        .unwrap_or_else(|| secret_store::connection_secret_ref(&safe, SecretKind::Password));
    let enable_password_ref = existing
        .enable_password_ref
        .unwrap_or_else(|| secret_store::connection_secret_ref(&safe, SecretKind::EnablePassword));
    secret_store::delete_secret(&password_ref)?;
    secret_store::delete_secret(&enable_password_ref)?;

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

fn persist_connection(
    connection_name: &str,
    data: &SavedConnection,
    existing: Option<&SavedConnection>,
) -> Result<()> {
    let mut stored = data.clone();
    stored.password_ref = sync_connection_secret(
        connection_name,
        SecretKind::Password,
        data.password.as_deref(),
        data.password_ref.as_deref(),
        existing.and_then(|item| item.password_ref.as_deref()),
    )?;
    stored.enable_password_ref = sync_connection_secret(
        connection_name,
        SecretKind::EnablePassword,
        data.enable_password.as_deref(),
        data.enable_password_ref.as_deref(),
        existing.and_then(|item| item.enable_password_ref.as_deref()),
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
                name, host, username, password_ref, port, enable_password_ref, ssh_security,
                device_profile, template_dir, created_at_ms, updated_at_ms
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                host = excluded.host,
                username = excluded.username,
                password_ref = excluded.password_ref,
                port = excluded.port,
                enable_password_ref = excluded.enable_password_ref,
                ssh_security = excluded.ssh_security,
                device_profile = excluded.device_profile,
                template_dir = excluded.template_dir,
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
