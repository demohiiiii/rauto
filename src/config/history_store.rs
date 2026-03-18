use crate::config::connection_store;
use crate::db;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub ts_ms: u128,
    pub connection_key: String,
    pub connection_name: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub device_profile: String,
    pub operation: String,
    pub command_label: String,
    pub mode: Option<String>,
    pub record_level: String,
    pub record_path: String,
}

pub struct HistoryBinding<'a> {
    pub connection_name: Option<&'a str>,
    pub host: &'a str,
    pub port: u16,
    pub username: &'a str,
    pub device_profile: &'a str,
}

pub fn save_recording(
    binding: HistoryBinding<'_>,
    operation: &str,
    command_label: &str,
    mode: Option<&str>,
    record_level: &str,
    jsonl: &str,
) -> Result<HistoryEntry> {
    let ts_ms = now_ms();
    let connection_key = if let Some(name) = binding.connection_name {
        match connection_store::safe_connection_name(name) {
            Ok(v) => v,
            Err(_) => adhoc_connection_key(
                binding.host,
                binding.port,
                binding.username,
                binding.device_profile,
            ),
        }
    } else {
        adhoc_connection_key(
            binding.host,
            binding.port,
            binding.username,
            binding.device_profile,
        )
    };

    let op = slug(operation);
    let id = format!("{}_{}", ts_ms, op);
    let entry = HistoryEntry {
        id: id.clone(),
        ts_ms,
        connection_key: connection_key.clone(),
        connection_name: binding.connection_name.map(|s| s.to_string()),
        host: binding.host.to_string(),
        port: binding.port,
        username: binding.username.to_string(),
        device_profile: binding.device_profile.to_string(),
        operation: operation.to_string(),
        command_label: command_label.to_string(),
        mode: Some(match mode {
            Some(m) if !m.trim().is_empty() => m.to_string(),
            _ => "Enable".to_string(),
        }),
        record_level: record_level.to_string(),
        record_path: recording_locator(&id),
    };
    insert_history_entry(&entry, jsonl)?;
    Ok(entry)
}

pub fn list_history_by_connection_name(name: &str, limit: usize) -> Result<Vec<HistoryEntry>> {
    let key = connection_store::safe_connection_name(name)?;
    list_history_by_key(&key, limit)
}

pub fn delete_history_by_connection_name(name: &str, id: &str) -> Result<bool> {
    let key = connection_store::safe_connection_name(name)?;
    delete_history_by_key(&key, id)
}

pub fn delete_history_by_key(key: &str, id: &str) -> Result<bool> {
    let safe_id = slug(id);
    if safe_id.is_empty() {
        return Ok(false);
    }

    db::run_sync(async {
        let deleted =
            sqlx::query("DELETE FROM history_entries WHERE connection_key = ? AND id = ?")
                .bind(key)
                .bind(&safe_id)
                .execute(db::pool())
                .await?
                .rows_affected()
                > 0;
        Ok(deleted)
    })
}

pub fn list_history_by_key(key: &str, limit: usize) -> Result<Vec<HistoryEntry>> {
    db::run_sync(async move {
        let sql = if limit > 0 {
            "SELECT * FROM history_entries WHERE connection_key = ? AND record_jsonl <> '' ORDER BY ts_ms DESC LIMIT ?"
        } else {
            "SELECT * FROM history_entries WHERE connection_key = ? AND record_jsonl <> '' ORDER BY ts_ms DESC"
        };
        let rows = if limit > 0 {
            sqlx::query(sql)
                .bind(key)
                .bind(limit as i64)
                .fetch_all(db::pool())
                .await?
        } else {
            sqlx::query(sql).bind(key).fetch_all(db::pool()).await?
        };
        Ok(rows.into_iter().map(row_to_history_entry).collect())
    })
}

pub fn load_recording_jsonl_by_key(key: &str, id: &str) -> Result<Option<String>> {
    let safe_id = slug(id);
    if safe_id.is_empty() {
        return Ok(None);
    }

    db::run_sync(async move {
        let row = sqlx::query(
            "SELECT record_jsonl FROM history_entries WHERE connection_key = ? AND id = ?",
        )
        .bind(key)
        .bind(&safe_id)
        .fetch_optional(db::pool())
        .await?;
        Ok(row.and_then(|row| {
            let jsonl = row.get::<String, _>("record_jsonl");
            if jsonl.is_empty() { None } else { Some(jsonl) }
        }))
    })
}

fn insert_history_entry(entry: &HistoryEntry, jsonl: &str) -> Result<()> {
    let entry = entry.clone();
    let record_jsonl = jsonl.to_string();
    db::run_sync(async move {
        sqlx::query(
            r#"
            INSERT INTO history_entries (
                id, ts_ms, connection_key, connection_name, host, port, username,
                device_profile, operation, command_label, mode, record_level, record_path, record_jsonl
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&entry.id)
        .bind(entry.ts_ms as i64)
        .bind(&entry.connection_key)
        .bind(&entry.connection_name)
        .bind(&entry.host)
        .bind(i64::from(entry.port))
        .bind(&entry.username)
        .bind(&entry.device_profile)
        .bind(&entry.operation)
        .bind(&entry.command_label)
        .bind(&entry.mode)
        .bind(&entry.record_level)
        .bind(&entry.record_path)
        .bind(&record_jsonl)
        .execute(db::pool())
        .await?;
        Ok(())
    })
}

fn row_to_history_entry(row: sqlx::sqlite::SqliteRow) -> HistoryEntry {
    HistoryEntry {
        id: row.get("id"),
        ts_ms: row.get::<i64, _>("ts_ms") as u128,
        connection_key: row.get("connection_key"),
        connection_name: row.get("connection_name"),
        host: row.get("host"),
        port: row.get::<i64, _>("port") as u16,
        username: row.get("username"),
        device_profile: row.get("device_profile"),
        operation: row.get("operation"),
        command_label: row.get("command_label"),
        mode: row.get("mode"),
        record_level: row.get("record_level"),
        record_path: row.get("record_path"),
    }
}

fn recording_locator(id: &str) -> String {
    format!("sqlite://{}#history/{}", db::db_path().display(), id)
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn adhoc_connection_key(host: &str, port: u16, username: &str, profile: &str) -> String {
    let s = format!("adhoc_{}_{}_{}_{}", host, port, username, profile);
    slug(&s)
}

fn slug(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for ch in raw.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' {
            out.push(ch.to_ascii_lowercase());
        } else {
            out.push('_');
        }
    }
    while out.contains("__") {
        out = out.replace("__", "_");
    }
    out.trim_matches('_').to_string()
}
