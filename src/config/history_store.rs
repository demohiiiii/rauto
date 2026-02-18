use crate::config::{connection_store, paths::rauto_home_dir};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
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

pub fn records_by_connection_dir() -> PathBuf {
    rauto_home_dir().join("records").join("by_connection")
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

    let dir = records_by_connection_dir().join(&connection_key);
    fs::create_dir_all(&dir)?;

    let op = slug(operation);
    let id = format!("{}_{}", ts_ms, op);
    let record_path = dir.join(format!("{}.jsonl", id));
    let meta_path = dir.join(format!("{}.meta.json", id));
    fs::write(&record_path, jsonl.as_bytes())?;

    let entry = HistoryEntry {
        id,
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
        record_path: record_path.to_string_lossy().to_string(),
    };
    let meta_json = serde_json::to_string_pretty(&entry)?;
    fs::write(meta_path, meta_json.as_bytes())?;
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

    let dir = records_by_connection_dir().join(key);
    if !dir.exists() {
        return Ok(false);
    }

    let record_path = dir.join(format!("{}.jsonl", safe_id));
    let meta_path = dir.join(format!("{}.meta.json", safe_id));
    let mut deleted = false;

    if record_path.exists() {
        fs::remove_file(&record_path)?;
        deleted = true;
    }
    if meta_path.exists() {
        fs::remove_file(&meta_path)?;
        deleted = true;
    }

    if deleted && fs::read_dir(&dir)?.next().is_none() {
        let _ = fs::remove_dir(&dir);
    }

    Ok(deleted)
}

pub fn list_history_by_key(key: &str, limit: usize) -> Result<Vec<HistoryEntry>> {
    let dir = records_by_connection_dir().join(key);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut items = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        let is_meta = path
            .file_name()
            .and_then(|s| s.to_str())
            .is_some_and(|name| name.ends_with(".meta.json"));
        if !is_meta {
            continue;
        }
        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(item) = serde_json::from_str::<HistoryEntry>(&content) else {
            continue;
        };
        items.push(item);
    }
    items.sort_by(|a, b| b.ts_ms.cmp(&a.ts_ms));
    if limit > 0 && items.len() > limit {
        items.truncate(limit);
    }
    Ok(items)
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
