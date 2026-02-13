use crate::config::paths::rauto_home_dir;
use anyhow::{Context, Result, anyhow};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedConnection {
    pub host: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub port: Option<u16>,
    pub enable_password: Option<String>,
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
        {
            if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                names.push(name.to_string());
            }
        }
    }
    names.sort();
    Ok(names)
}

pub fn load_connection(name: &str) -> Result<SavedConnection> {
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

pub fn save_connection(name: &str, data: &SavedConnection) -> Result<PathBuf> {
    let safe = safe_connection_name(name)?;
    let dir = connections_dir();
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{}.toml", safe));
    let content = toml::to_string_pretty(data)?;
    fs::write(&path, content.as_bytes())?;
    Ok(path)
}

pub fn delete_connection(name: &str) -> Result<bool> {
    let safe = safe_connection_name(name)?;
    let path = connections_dir().join(format!("{}.toml", safe));
    if !path.exists() {
        return Ok(false);
    }
    fs::remove_file(path)?;
    Ok(true)
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
