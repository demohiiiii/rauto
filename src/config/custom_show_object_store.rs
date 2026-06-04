use crate::config::show_catalog;
use crate::db;
use anyhow::{Result, anyhow};
use sqlx::Row;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct CustomShowObject {
    pub device_profile: String,
    pub object: String,
    pub command: String,
    pub mode: Option<String>,
    pub textfsm_mapping_command: Option<String>,
    pub textfsm_template_name: Option<String>,
    pub enabled: bool,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

pub fn list(profile: Option<&str>) -> Result<Vec<CustomShowObject>> {
    let profile = profile.map(normalize_profile).transpose()?;
    db::run_sync(async move {
        let rows = if let Some(profile) = profile {
            sqlx::query(
                r#"
                SELECT
                    device_profile,
                    object,
                    command,
                    mode,
                    textfsm_mapping_command,
                    textfsm_template_name,
                    enabled,
                    created_at_ms,
                    updated_at_ms
                FROM custom_show_objects
                WHERE device_profile = ?
                ORDER BY device_profile ASC, object ASC
                "#,
            )
            .bind(profile)
            .fetch_all(db::pool())
            .await?
        } else {
            sqlx::query(
                r#"
                SELECT
                    device_profile,
                    object,
                    command,
                    mode,
                    textfsm_mapping_command,
                    textfsm_template_name,
                    enabled,
                    created_at_ms,
                    updated_at_ms
                FROM custom_show_objects
                ORDER BY device_profile ASC, object ASC
                "#,
            )
            .fetch_all(db::pool())
            .await?
        };
        Ok(rows.into_iter().map(show_object_from_row).collect())
    })
}

pub fn list_enabled_for_profile(profile: &str) -> Result<Vec<CustomShowObject>> {
    let profile = normalize_profile(profile)?;
    db::run_sync(async move {
        let rows = sqlx::query(
            r#"
            SELECT
                device_profile,
                object,
                command,
                mode,
                textfsm_mapping_command,
                textfsm_template_name,
                enabled,
                created_at_ms,
                updated_at_ms
            FROM custom_show_objects
            WHERE device_profile = ? AND enabled = 1
            ORDER BY object ASC
            "#,
        )
        .bind(profile)
        .fetch_all(db::pool())
        .await?;
        Ok(rows.into_iter().map(show_object_from_row).collect())
    })
}

pub fn load_enabled(profile: &str, object: &str) -> Result<Option<CustomShowObject>> {
    let profile = normalize_profile(profile)?;
    let object = normalize_object(object)?;
    db::run_sync(async move {
        let row = sqlx::query(
            r#"
            SELECT
                device_profile,
                object,
                command,
                mode,
                textfsm_mapping_command,
                textfsm_template_name,
                enabled,
                created_at_ms,
                updated_at_ms
            FROM custom_show_objects
            WHERE device_profile = ? AND object = ? AND enabled = 1
            "#,
        )
        .bind(profile)
        .bind(object)
        .fetch_optional(db::pool())
        .await?;
        Ok(row.map(show_object_from_row))
    })
}

pub fn upsert(
    profile: &str,
    object: &str,
    command: &str,
    mode: Option<&str>,
    textfsm_mapping_command: Option<&str>,
    textfsm_template_name: Option<&str>,
    enabled: bool,
) -> Result<()> {
    let profile = normalize_profile(profile)?;
    let object = normalize_object(object)?;
    let textfsm_mapping_command =
        normalize_optional_command(textfsm_mapping_command).transpose()?;
    let command = if let Some(mapping_command) = textfsm_mapping_command.as_deref() {
        mapping_command.to_string()
    } else {
        normalize_command(command)?
    };
    let mode = normalize_optional_text(mode);
    let textfsm_template_name = if textfsm_mapping_command.is_some() {
        None
    } else {
        normalize_optional_template_name(textfsm_template_name)?
    };
    let ts_ms = now_ms() as i64;
    db::run_sync(async move {
        if let Some(mapping_command) = textfsm_mapping_command.as_deref() {
            let mapping_exists = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM custom_textfsm_mappings WHERE device_profile = ? AND command = ?",
            )
            .bind(&profile)
            .bind(mapping_command)
            .fetch_one(db::pool())
            .await?;
            if mapping_exists == 0 {
                return Err(anyhow!(
                    "TextFSM mapping for profile '{}' command '{}' not found",
                    profile,
                    mapping_command
                ));
            }
        }
        if let Some(template_name) = textfsm_template_name.as_deref() {
            let template_exists = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM custom_textfsm_templates WHERE name = ?",
            )
            .bind(template_name)
            .fetch_one(db::pool())
            .await?;
            if template_exists == 0 {
                return Err(anyhow!("TextFSM template '{}' not found", template_name));
            }
        }
        sqlx::query(
            r#"
            INSERT INTO custom_show_objects
                (
                    device_profile,
                    object,
                    command,
                    mode,
                    textfsm_mapping_command,
                    textfsm_template_name,
                    enabled,
                    created_at_ms,
                    updated_at_ms
                )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(device_profile, object) DO UPDATE SET
                command = excluded.command,
                mode = excluded.mode,
                textfsm_mapping_command = excluded.textfsm_mapping_command,
                textfsm_template_name = excluded.textfsm_template_name,
                enabled = excluded.enabled,
                updated_at_ms = excluded.updated_at_ms
            "#,
        )
        .bind(profile)
        .bind(object)
        .bind(command)
        .bind(mode)
        .bind(textfsm_mapping_command)
        .bind(textfsm_template_name)
        .bind(if enabled { 1 } else { 0 })
        .bind(ts_ms)
        .bind(ts_ms)
        .execute(db::pool())
        .await?;
        Ok(())
    })
}

pub fn delete(profile: &str, object: &str) -> Result<bool> {
    let profile = normalize_profile(profile)?;
    let object = normalize_object(object)?;
    db::run_sync(async move {
        let result =
            sqlx::query("DELETE FROM custom_show_objects WHERE device_profile = ? AND object = ?")
                .bind(profile)
                .bind(object)
                .execute(db::pool())
                .await?;
        Ok(result.rows_affected() > 0)
    })
}

fn show_object_from_row(row: sqlx::sqlite::SqliteRow) -> CustomShowObject {
    let enabled: i64 = row.get("enabled");
    CustomShowObject {
        device_profile: row.get("device_profile"),
        object: row.get("object"),
        command: row.get("command"),
        mode: row.get("mode"),
        textfsm_mapping_command: row.get("textfsm_mapping_command"),
        textfsm_template_name: row.get("textfsm_template_name"),
        enabled: enabled != 0,
        created_at_ms: row.get("created_at_ms"),
        updated_at_ms: row.get("updated_at_ms"),
    }
}

fn normalize_profile(raw: &str) -> Result<String> {
    let value = raw.trim();
    if value.is_empty() {
        return Err(anyhow!("device profile must not be empty"));
    }
    Ok(value.to_string())
}

fn normalize_object(raw: &str) -> Result<String> {
    show_catalog::normalize_show_object(raw).ok_or_else(|| anyhow!("show object must not be empty"))
}

fn normalize_command(raw: &str) -> Result<String> {
    let value = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if value.is_empty() {
        return Err(anyhow!("command must not be empty"));
    }
    Ok(value)
}

fn normalize_optional_text(raw: Option<&str>) -> Option<String> {
    raw.map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn normalize_optional_command(raw: Option<&str>) -> Option<Result<String>> {
    raw.map(str::trim)
        .filter(|value| !value.is_empty())
        .map(normalize_command)
}

fn normalize_optional_template_name(raw: Option<&str>) -> Result<Option<String>> {
    raw.map(str::trim)
        .filter(|value| !value.is_empty())
        .map(normalize_template_name)
        .transpose()
}

fn normalize_template_name(raw: &str) -> Result<String> {
    let value = raw.trim();
    if value.is_empty()
        || value.contains('/')
        || value.contains('\\')
        || value.contains("..")
        || !value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' || ch == '.')
    {
        return Err(anyhow!("invalid TextFSM template name"));
    }
    Ok(value.to_string())
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}
