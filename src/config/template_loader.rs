use crate::config::device_profile::DeviceProfile;
use crate::config::paths::default_template_dir;
use anyhow::{Context, Result, anyhow};
use rneter::{device::DeviceHandler, templates};
use std::fs;
use std::path::PathBuf;

pub fn canonical_builtin_profile_name(name: &str) -> Option<&'static str> {
    match name.to_lowercase().as_str() {
        "cisco" | "ios" => Some("cisco"),
        "huawei" | "vrp" => Some("huawei"),
        "h3c" | "comware" => Some("h3c"),
        "hillstone" => Some("hillstone"),
        "juniper" | "junos" => Some("juniper"),
        "array" => Some("array"),
        _ => None,
    }
}

pub fn load_device_profile(name: &str, custom_dir: Option<&PathBuf>) -> Result<DeviceHandler> {
    // 1. Check built-in templates
    match canonical_builtin_profile_name(name) {
        Some("cisco") => return Ok(templates::cisco()?),
        Some("huawei") => return Ok(templates::huawei()?),
        Some("h3c") => return Ok(templates::h3c()?),
        Some("hillstone") => return Ok(templates::hillstone()?),
        Some("juniper") => return Ok(templates::juniper()?),
        Some("array") => return Ok(templates::array()?),
        Some(_) | None => {}
    }

    // 2. Search for TOML file
    let filename = if name.ends_with(".toml") {
        name.to_string()
    } else {
        format!("{}.toml", name)
    };

    let mut search_paths = Vec::new();

    // Priority 1: Custom directory from CLI
    if let Some(dir) = custom_dir {
        search_paths.push(dir.join("devices").join(&filename));
        search_paths.push(dir.join(&filename));
    }

    // Priority 2: ~/.rauto/templates
    let home_templates = default_template_dir();
    search_paths.push(home_templates.join("devices").join(&filename));
    search_paths.push(home_templates.join(&filename));

    // Priority 3: Local project templates (backward compatibility)
    search_paths.push(PathBuf::from("templates").join("devices").join(&filename));
    search_paths.push(PathBuf::from("templates").join(&filename));

    // Scan paths
    for path in search_paths {
        if path.exists() {
            let content = fs::read_to_string(&path)
                .with_context(|| format!("Failed to read device profile from {:?}", path))?;

            let profile: DeviceProfile = toml::from_str(&content)
                .with_context(|| format!("Failed to parse device profile from {:?}", path))?;

            return profile.to_device_handler();
        }
    }

    Err(anyhow!(
        "Device profile '{}' not found in built-ins or search paths",
        name
    ))
}

pub fn list_available_profiles(_custom_dir: Option<&PathBuf>) -> Result<Vec<String>> {
    let profiles = vec![
        "cisco".to_string(),
        "huawei".to_string(),
        "h3c".to_string(),
        "hillstone".to_string(),
        "juniper".to_string(),
        "array".to_string(),
    ];

    // TODO: Scan directories for .toml files and add to list
    // For now just return built-ins

    Ok(profiles)
}
