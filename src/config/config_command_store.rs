use crate::config::{command_blacklist, template_loader};
use crate::db;
use anyhow::{Result, anyhow};
use regex::Regex;
use sqlx::Row;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct ConfigCommandOverride {
    pub device_profile: String,
    pub kind: String,
    pub command: String,
    pub mode: Option<String>,
}

fn normalize_profile(profile: &str) -> Result<String> {
    let profile = profile.trim().to_string();
    if profile.is_empty() {
        return Err(anyhow!("device profile is required"));
    }
    Ok(profile)
}

fn normalize_kind(kind: &str) -> Result<String> {
    let kind = kind.trim().to_lowercase();
    if kind.is_empty() {
        return Err(anyhow!("config kind is required"));
    }
    Ok(kind)
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

fn row_to_override(row: &sqlx::sqlite::SqliteRow) -> ConfigCommandOverride {
    ConfigCommandOverride {
        device_profile: row.get("device_profile"),
        kind: row.get("kind"),
        command: row.get("command"),
        mode: row.get("mode"),
    }
}

pub fn list(profile: Option<&str>) -> Result<Vec<ConfigCommandOverride>> {
    let profile = profile.map(normalize_profile).transpose()?;
    db::run_sync(async move {
        let rows = if let Some(profile) = profile {
            sqlx::query(
                r#"
                SELECT device_profile, kind, command, mode
                FROM config_command_overrides
                WHERE device_profile = ?
                ORDER BY device_profile ASC, kind ASC
                "#,
            )
            .bind(profile)
            .fetch_all(db::pool())
            .await?
        } else {
            sqlx::query(
                r#"
                SELECT device_profile, kind, command, mode
                FROM config_command_overrides
                ORDER BY device_profile ASC, kind ASC
                "#,
            )
            .fetch_all(db::pool())
            .await?
        };
        Ok(rows.iter().map(row_to_override).collect())
    })
}

pub fn load(profile: &str, kind: &str) -> Result<Option<ConfigCommandOverride>> {
    let profile = normalize_profile(profile)?;
    let kind = normalize_kind(kind)?;
    db::run_sync(async move {
        let row = sqlx::query(
            r#"
            SELECT device_profile, kind, command, mode
            FROM config_command_overrides
            WHERE device_profile = ? AND kind = ?
            "#,
        )
        .bind(profile)
        .bind(kind)
        .fetch_optional(db::pool())
        .await?;
        Ok(row.as_ref().map(row_to_override))
    })
}

pub fn upsert(profile: &str, kind: &str, command: &str, mode: Option<&str>) -> Result<()> {
    let profile = normalize_profile(profile)?;
    let kind = normalize_kind(kind)?;
    let command = command.trim().to_string();
    if command.is_empty() {
        return Err(anyhow!("config fetch command is required"));
    }
    command_blacklist::ensure_command_allowed(&command, "config fetch command override")?;
    let mode = mode
        .map(str::trim)
        .filter(|mode| !mode.is_empty())
        .map(|mode| template_loader::resolve_profile_mode(&profile, Some(mode)))
        .transpose()?;
    db::run_sync(async move {
        let now = now_ms();
        sqlx::query(
            r#"
            INSERT INTO config_command_overrides
                (device_profile, kind, command, mode, created_at_ms, updated_at_ms)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(device_profile, kind) DO UPDATE SET
                command = excluded.command,
                mode = excluded.mode,
                updated_at_ms = excluded.updated_at_ms
            "#,
        )
        .bind(profile)
        .bind(kind)
        .bind(command)
        .bind(mode)
        .bind(now)
        .bind(now)
        .execute(db::pool())
        .await?;
        Ok(())
    })
}

pub fn delete(profile: &str, kind: &str) -> Result<bool> {
    let profile = normalize_profile(profile)?;
    let kind = normalize_kind(kind)?;
    db::run_sync(async move {
        let result = sqlx::query(
            r#"
            DELETE FROM config_command_overrides
            WHERE device_profile = ? AND kind = ?
            "#,
        )
        .bind(profile)
        .bind(kind)
        .execute(db::pool())
        .await?;
        Ok(result.rows_affected() > 0)
    })
}

#[derive(Debug, Clone)]
pub struct VolatilePatternOverride {
    pub device_profile: String,
    pub pattern: String,
}

fn normalize_pattern(pattern: &str) -> Result<String> {
    let pattern = pattern.trim().to_string();
    if pattern.is_empty() {
        return Err(anyhow!("volatile pattern is required"));
    }
    Regex::new(&pattern)
        .map_err(|err| anyhow!("invalid volatile pattern regex '{}': {}", pattern, err))?;
    Ok(pattern)
}

pub fn list_volatile_patterns(profile: Option<&str>) -> Result<Vec<VolatilePatternOverride>> {
    let profile = profile.map(normalize_profile).transpose()?;
    db::run_sync(async move {
        let rows = if let Some(profile) = profile {
            sqlx::query(
                r#"
                SELECT device_profile, pattern
                FROM config_volatile_patterns
                WHERE device_profile = ?
                ORDER BY device_profile ASC, pattern ASC
                "#,
            )
            .bind(profile)
            .fetch_all(db::pool())
            .await?
        } else {
            sqlx::query(
                r#"
                SELECT device_profile, pattern
                FROM config_volatile_patterns
                ORDER BY device_profile ASC, pattern ASC
                "#,
            )
            .fetch_all(db::pool())
            .await?
        };
        Ok(rows
            .iter()
            .map(|row| VolatilePatternOverride {
                device_profile: row.get("device_profile"),
                pattern: row.get("pattern"),
            })
            .collect())
    })
}

pub fn add_volatile_pattern(profile: &str, pattern: &str) -> Result<bool> {
    let profile = normalize_profile(profile)?;
    let pattern = normalize_pattern(pattern)?;
    db::run_sync(async move {
        let result = sqlx::query(
            r#"
            INSERT OR IGNORE INTO config_volatile_patterns
                (device_profile, pattern, created_at_ms)
            VALUES (?, ?, ?)
            "#,
        )
        .bind(profile)
        .bind(pattern)
        .bind(now_ms())
        .execute(db::pool())
        .await?;
        Ok(result.rows_affected() > 0)
    })
}

pub fn remove_volatile_pattern(profile: &str, pattern: &str) -> Result<bool> {
    let profile = normalize_profile(profile)?;
    let pattern = pattern.trim().to_string();
    db::run_sync(async move {
        let result = sqlx::query(
            r#"
            DELETE FROM config_volatile_patterns
            WHERE device_profile = ? AND pattern = ?
            "#,
        )
        .bind(profile)
        .bind(pattern)
        .execute(db::pool())
        .await?;
        Ok(result.rows_affected() > 0)
    })
}
