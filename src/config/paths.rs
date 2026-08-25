use anyhow::Result;
use std::fs;
use std::path::PathBuf;

pub fn rauto_home_dir() -> PathBuf {
    if let Some(path) = std::env::var_os("RAUTO_HOME").filter(|value| !value.is_empty()) {
        return PathBuf::from(path);
    }
    dirs::home_dir()
        .map(|p| p.join(".rauto"))
        .unwrap_or_else(|| PathBuf::from(".rauto"))
}

pub fn ensure_default_layout() -> Result<()> {
    let root = rauto_home_dir();
    fs::create_dir_all(&root)?;
    fs::create_dir_all(root.join("backups"))?;
    fs::create_dir_all(root.join("uploads"))?;
    fs::create_dir_all(root.join("keys"))?;
    Ok(())
}
