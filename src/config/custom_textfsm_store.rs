use crate::db;
use anyhow::{Result, anyhow};
use sqlx::Row;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct CustomTextfsmTemplate {
    pub name: String,
    pub content: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone)]
pub struct CustomTextfsmMapping {
    pub device_profile: String,
    pub command: String,
    pub template_name: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone)]
pub struct ResolvedCustomTextfsmTemplate {
    pub device_profile: String,
    pub command: String,
    pub template_name: String,
    pub template_content: String,
}

pub fn list_templates() -> Result<Vec<CustomTextfsmTemplate>> {
    db::run_sync(async {
        let rows = sqlx::query(
            "SELECT name, content, created_at_ms, updated_at_ms FROM custom_textfsm_templates ORDER BY name ASC",
        )
        .fetch_all(db::pool())
        .await?;
        Ok(rows.into_iter().map(template_from_row).collect())
    })
}

pub fn load_template(name: &str) -> Result<Option<CustomTextfsmTemplate>> {
    let name = normalize_name(name)?;
    db::run_sync(async move {
        let row = sqlx::query(
            "SELECT name, content, created_at_ms, updated_at_ms FROM custom_textfsm_templates WHERE name = ?",
        )
        .bind(name)
        .fetch_optional(db::pool())
        .await?;
        Ok(row.map(template_from_row))
    })
}

pub fn create_template(name: &str, content: &str) -> Result<bool> {
    let name = normalize_name(name)?;
    let content = normalize_content(content)?;
    let ts_ms = now_ms() as i64;
    db::run_sync(async move {
        let result = sqlx::query(
            r#"
            INSERT INTO custom_textfsm_templates (name, content, created_at_ms, updated_at_ms)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(name) DO NOTHING
            "#,
        )
        .bind(name)
        .bind(content)
        .bind(ts_ms)
        .bind(ts_ms)
        .execute(db::pool())
        .await?;
        Ok(result.rows_affected() > 0)
    })
}

pub fn update_template(name: &str, content: &str) -> Result<bool> {
    let name = normalize_name(name)?;
    let content = normalize_content(content)?;
    let ts_ms = now_ms() as i64;
    db::run_sync(async move {
        let result = sqlx::query(
            "UPDATE custom_textfsm_templates SET content = ?, updated_at_ms = ? WHERE name = ?",
        )
        .bind(content)
        .bind(ts_ms)
        .bind(name)
        .execute(db::pool())
        .await?;
        Ok(result.rows_affected() > 0)
    })
}

pub fn delete_template(name: &str) -> Result<bool> {
    let name = normalize_name(name)?;
    db::run_sync(async move {
        let result = sqlx::query("DELETE FROM custom_textfsm_templates WHERE name = ?")
            .bind(name)
            .execute(db::pool())
            .await?;
        Ok(result.rows_affected() > 0)
    })
}

pub fn list_mappings(profile: Option<&str>) -> Result<Vec<CustomTextfsmMapping>> {
    let profile = profile.map(normalize_profile).transpose()?;
    db::run_sync(async move {
        let rows = if let Some(profile) = profile {
            sqlx::query(
                r#"
                SELECT device_profile, command, template_name, created_at_ms, updated_at_ms
                FROM custom_textfsm_mappings
                WHERE device_profile = ?
                ORDER BY device_profile ASC, command ASC
                "#,
            )
            .bind(profile)
            .fetch_all(db::pool())
            .await?
        } else {
            sqlx::query(
                r#"
                SELECT device_profile, command, template_name, created_at_ms, updated_at_ms
                FROM custom_textfsm_mappings
                ORDER BY device_profile ASC, command ASC
                "#,
            )
            .fetch_all(db::pool())
            .await?
        };
        Ok(rows.into_iter().map(mapping_from_row).collect())
    })
}

pub fn upsert_mapping(device_profile: &str, command: &str, template_name: &str) -> Result<()> {
    let device_profile = normalize_profile(device_profile)?;
    let command = normalize_command(command)?;
    let template_name = normalize_name(template_name)?;
    let ts_ms = now_ms() as i64;
    db::run_sync(async move {
        let template_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM custom_textfsm_templates WHERE name = ?",
        )
        .bind(&template_name)
        .fetch_one(db::pool())
        .await?;
        if template_exists == 0 {
            return Err(anyhow!("TextFSM template '{}' not found", template_name));
        }
        sqlx::query(
            r#"
            INSERT INTO custom_textfsm_mappings
                (device_profile, command, template_name, created_at_ms, updated_at_ms)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(device_profile, command) DO UPDATE SET
                template_name = excluded.template_name,
                updated_at_ms = excluded.updated_at_ms
            "#,
        )
        .bind(device_profile)
        .bind(command)
        .bind(template_name)
        .bind(ts_ms)
        .bind(ts_ms)
        .execute(db::pool())
        .await?;
        Ok(())
    })
}

pub fn delete_mapping(device_profile: &str, command: &str) -> Result<bool> {
    let device_profile = normalize_profile(device_profile)?;
    let command = normalize_command(command)?;
    db::run_sync(async move {
        let result = sqlx::query(
            "DELETE FROM custom_textfsm_mappings WHERE device_profile = ? AND command = ?",
        )
        .bind(device_profile)
        .bind(command)
        .execute(db::pool())
        .await?;
        Ok(result.rows_affected() > 0)
    })
}

pub fn resolve_template_for_command(
    device_profile: Option<&str>,
    command: &str,
) -> Result<Option<ResolvedCustomTextfsmTemplate>> {
    let Some(device_profile) = device_profile else {
        return Ok(None);
    };
    let device_profile = normalize_profile(device_profile)?;
    let command = normalize_command(command)?;
    db::run_sync(async move {
        let row = sqlx::query(
            r#"
            SELECT
                m.device_profile,
                m.command,
                m.template_name,
                t.content AS template_content
            FROM custom_textfsm_mappings m
            JOIN custom_textfsm_templates t ON t.name = m.template_name
            WHERE m.device_profile = ? AND m.command = ?
            "#,
        )
        .bind(device_profile)
        .bind(command)
        .fetch_optional(db::pool())
        .await?;
        Ok(row.map(|row| ResolvedCustomTextfsmTemplate {
            device_profile: row.get("device_profile"),
            command: row.get("command"),
            template_name: row.get("template_name"),
            template_content: row.get("template_content"),
        }))
    })
}

fn template_from_row(row: sqlx::sqlite::SqliteRow) -> CustomTextfsmTemplate {
    CustomTextfsmTemplate {
        name: row.get("name"),
        content: row.get("content"),
        created_at_ms: row.get("created_at_ms"),
        updated_at_ms: row.get("updated_at_ms"),
    }
}

fn mapping_from_row(row: sqlx::sqlite::SqliteRow) -> CustomTextfsmMapping {
    CustomTextfsmMapping {
        device_profile: row.get("device_profile"),
        command: row.get("command"),
        template_name: row.get("template_name"),
        created_at_ms: row.get("created_at_ms"),
        updated_at_ms: row.get("updated_at_ms"),
    }
}

fn normalize_name(raw: &str) -> Result<String> {
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

fn normalize_profile(raw: &str) -> Result<String> {
    let value = raw.trim();
    if value.is_empty() {
        return Err(anyhow!("device profile must not be empty"));
    }
    Ok(value.to_string())
}

fn normalize_command(raw: &str) -> Result<String> {
    let value = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if value.is_empty() {
        return Err(anyhow!("command must not be empty"));
    }
    Ok(value)
}

fn normalize_content(raw: &str) -> Result<String> {
    let value = raw.trim();
    if value.is_empty() {
        return Err(anyhow!("TextFSM template content must not be empty"));
    }
    Ok(value.to_string())
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}
