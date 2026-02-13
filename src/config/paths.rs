use anyhow::Result;
use std::fs;
use std::path::PathBuf;

pub fn rauto_home_dir() -> PathBuf {
    dirs::home_dir()
        .map(|p| p.join(".rauto"))
        .unwrap_or_else(|| PathBuf::from(".rauto"))
}

pub fn default_template_dir() -> PathBuf {
    rauto_home_dir().join("templates")
}

pub fn ensure_default_layout() -> Result<()> {
    let root = rauto_home_dir();
    fs::create_dir_all(root.join("templates").join("commands"))?;
    fs::create_dir_all(root.join("templates").join("devices"))?;
    Ok(())
}
