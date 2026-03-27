use crate::db;
use anyhow::Result;
use sqlx::Row;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct StoredContent {
    pub name: String,
    pub content: String,
    pub locator: String,
}

pub fn storage_path() -> PathBuf {
    db::db_path()
}

pub fn template_locator(name: &str) -> String {
    format!(
        "sqlite://{}#templates/{}",
        storage_path().display(),
        name.trim()
    )
}

pub fn custom_profile_locator(name: &str) -> String {
    format!(
        "sqlite://{}#device-profiles/{}",
        storage_path().display(),
        name.trim()
    )
}

pub fn command_flow_template_locator(name: &str) -> String {
    format!(
        "sqlite://{}#command-flow-templates/{}",
        storage_path().display(),
        name.trim()
    )
}

pub fn list_command_templates() -> Result<Vec<StoredContent>> {
    db::run_sync(async {
        let rows = sqlx::query("SELECT name, content FROM command_templates ORDER BY name ASC")
            .fetch_all(db::pool())
            .await?;
        Ok(rows
            .into_iter()
            .map(|row| {
                let name = row.get::<String, _>("name");
                StoredContent {
                    locator: template_locator(&name),
                    content: row.get("content"),
                    name,
                }
            })
            .collect())
    })
}

pub fn list_command_template_names() -> Result<Vec<String>> {
    Ok(list_command_templates()?
        .into_iter()
        .map(|item| item.name)
        .collect())
}

pub fn load_command_template(name: &str) -> Result<Option<StoredContent>> {
    let safe_name = name.trim().to_string();
    db::run_sync(async move {
        let row = sqlx::query("SELECT content FROM command_templates WHERE name = ?")
            .bind(&safe_name)
            .fetch_optional(db::pool())
            .await?;
        Ok(row.map(|row| StoredContent {
            name: safe_name.clone(),
            content: row.get("content"),
            locator: template_locator(&safe_name),
        }))
    })
}

pub fn create_command_template(name: &str, content: &str) -> Result<bool> {
    let safe_name = name.trim().to_string();
    let body = content.to_string();
    let ts_ms = now_ms() as i64;
    db::run_sync(async move {
        let result = sqlx::query(
            r#"
            INSERT INTO command_templates (name, content, created_at_ms, updated_at_ms)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(name) DO NOTHING
            "#,
        )
        .bind(&safe_name)
        .bind(&body)
        .bind(ts_ms)
        .bind(ts_ms)
        .execute(db::pool())
        .await?;
        Ok(result.rows_affected() > 0)
    })
}

pub fn update_command_template(name: &str, content: &str) -> Result<bool> {
    let safe_name = name.trim().to_string();
    let body = content.to_string();
    let ts_ms = now_ms() as i64;
    db::run_sync(async move {
        let result = sqlx::query(
            "UPDATE command_templates SET content = ?, updated_at_ms = ? WHERE name = ?",
        )
        .bind(&body)
        .bind(ts_ms)
        .bind(&safe_name)
        .execute(db::pool())
        .await?;
        Ok(result.rows_affected() > 0)
    })
}

pub fn delete_command_template(name: &str) -> Result<bool> {
    let safe_name = name.trim().to_string();
    db::run_sync(async move {
        let result = sqlx::query("DELETE FROM command_templates WHERE name = ?")
            .bind(&safe_name)
            .execute(db::pool())
            .await?;
        Ok(result.rows_affected() > 0)
    })
}

pub fn list_custom_profiles() -> Result<Vec<StoredContent>> {
    db::run_sync(async {
        let rows = sqlx::query("SELECT name, content FROM custom_profiles ORDER BY name ASC")
            .fetch_all(db::pool())
            .await?;
        Ok(rows
            .into_iter()
            .map(|row| {
                let name = row.get::<String, _>("name");
                StoredContent {
                    locator: custom_profile_locator(&name),
                    content: row.get("content"),
                    name,
                }
            })
            .collect())
    })
}

pub fn list_custom_profile_names() -> Result<Vec<String>> {
    Ok(list_custom_profiles()?
        .into_iter()
        .map(|item| item.name)
        .collect())
}

pub fn load_custom_profile(name: &str) -> Result<Option<StoredContent>> {
    let safe_name = name.trim().to_string();
    db::run_sync(async move {
        let row = sqlx::query("SELECT content FROM custom_profiles WHERE name = ?")
            .bind(&safe_name)
            .fetch_optional(db::pool())
            .await?;
        Ok(row.map(|row| StoredContent {
            name: safe_name.clone(),
            content: row.get("content"),
            locator: custom_profile_locator(&safe_name),
        }))
    })
}

pub fn create_custom_profile(name: &str, content: &str) -> Result<bool> {
    let safe_name = name.trim().to_string();
    let body = content.to_string();
    let ts_ms = now_ms() as i64;
    db::run_sync(async move {
        let result = sqlx::query(
            r#"
            INSERT INTO custom_profiles (name, content, created_at_ms, updated_at_ms)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(name) DO NOTHING
            "#,
        )
        .bind(&safe_name)
        .bind(&body)
        .bind(ts_ms)
        .bind(ts_ms)
        .execute(db::pool())
        .await?;
        Ok(result.rows_affected() > 0)
    })
}

pub fn update_custom_profile(name: &str, content: &str) -> Result<bool> {
    let safe_name = name.trim().to_string();
    let body = content.to_string();
    let ts_ms = now_ms() as i64;
    db::run_sync(async move {
        let result =
            sqlx::query("UPDATE custom_profiles SET content = ?, updated_at_ms = ? WHERE name = ?")
                .bind(&body)
                .bind(ts_ms)
                .bind(&safe_name)
                .execute(db::pool())
                .await?;
        Ok(result.rows_affected() > 0)
    })
}

pub fn delete_custom_profile(name: &str) -> Result<bool> {
    let safe_name = name.trim().to_string();
    db::run_sync(async move {
        let result = sqlx::query("DELETE FROM custom_profiles WHERE name = ?")
            .bind(&safe_name)
            .execute(db::pool())
            .await?;
        Ok(result.rows_affected() > 0)
    })
}

pub fn list_command_flow_templates() -> Result<Vec<StoredContent>> {
    db::run_sync(async {
        let rows =
            sqlx::query("SELECT name, content FROM command_flow_templates ORDER BY name ASC")
                .fetch_all(db::pool())
                .await?;
        Ok(rows
            .into_iter()
            .map(|row| {
                let name = row.get::<String, _>("name");
                StoredContent {
                    locator: command_flow_template_locator(&name),
                    content: row.get("content"),
                    name,
                }
            })
            .collect())
    })
}

pub fn list_command_flow_template_names() -> Result<Vec<String>> {
    Ok(list_command_flow_templates()?
        .into_iter()
        .map(|item| item.name)
        .collect())
}

pub fn load_command_flow_template(name: &str) -> Result<Option<StoredContent>> {
    let safe_name = name.trim().to_string();
    db::run_sync(async move {
        let row = sqlx::query("SELECT content FROM command_flow_templates WHERE name = ?")
            .bind(&safe_name)
            .fetch_optional(db::pool())
            .await?;
        Ok(row.map(|row| StoredContent {
            name: safe_name.clone(),
            content: row.get("content"),
            locator: command_flow_template_locator(&safe_name),
        }))
    })
}

pub fn create_command_flow_template(name: &str, content: &str) -> Result<bool> {
    let safe_name = name.trim().to_string();
    let body = content.to_string();
    let ts_ms = now_ms() as i64;
    db::run_sync(async move {
        let result = sqlx::query(
            r#"
            INSERT INTO command_flow_templates (name, content, created_at_ms, updated_at_ms)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(name) DO NOTHING
            "#,
        )
        .bind(&safe_name)
        .bind(&body)
        .bind(ts_ms)
        .bind(ts_ms)
        .execute(db::pool())
        .await?;
        Ok(result.rows_affected() > 0)
    })
}

pub fn update_command_flow_template(name: &str, content: &str) -> Result<bool> {
    let safe_name = name.trim().to_string();
    let body = content.to_string();
    let ts_ms = now_ms() as i64;
    db::run_sync(async move {
        let result = sqlx::query(
            "UPDATE command_flow_templates SET content = ?, updated_at_ms = ? WHERE name = ?",
        )
        .bind(&body)
        .bind(ts_ms)
        .bind(&safe_name)
        .execute(db::pool())
        .await?;
        Ok(result.rows_affected() > 0)
    })
}

pub fn delete_command_flow_template(name: &str) -> Result<bool> {
    let safe_name = name.trim().to_string();
    db::run_sync(async move {
        let result = sqlx::query("DELETE FROM command_flow_templates WHERE name = ?")
            .bind(&safe_name)
            .execute(db::pool())
            .await?;
        Ok(result.rows_affected() > 0)
    })
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}
