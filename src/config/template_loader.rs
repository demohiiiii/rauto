use crate::config::content_store;
use crate::config::device_profile::DeviceProfile;
use anyhow::{Context, Result, anyhow};
use rneter::{device::DeviceHandler, templates};
use std::collections::BTreeSet;

pub fn canonical_builtin_profile_name(name: &str) -> Option<&'static str> {
    match name.to_lowercase().as_str() {
        "cisco" | "ios" => Some("cisco"),
        "huawei" | "vrp" => Some("huawei"),
        "h3c" | "comware" => Some("h3c"),
        "hillstone" => Some("hillstone"),
        "juniper" | "junos" => Some("juniper"),
        "array" => Some("array"),
        "linux" => Some("linux"),
        "arista" | "eos" => Some("arista"),
        "fortinet" | "fortigate" | "fortios" => Some("fortinet"),
        "paloalto" | "palo-alto" | "panos" => Some("paloalto"),
        "topsec" => Some("topsec"),
        "venustech" => Some("venustech"),
        "dptech" => Some("dptech"),
        "chaitin" | "safeline" => Some("chaitin"),
        "qianxin" | "qax" | "qian-xin" => Some("qianxin"),
        "maipu" => Some("maipu"),
        "checkpoint" | "check-point" | "check_point" => Some("checkpoint"),
        _ => None,
    }
}

pub fn load_device_profile(name: &str) -> Result<DeviceHandler> {
    // 1. Check built-in templates
    if let Some(canonical) = canonical_builtin_profile_name(name) {
        return Ok(templates::by_name(canonical)?);
    }

    if let Some(stored) = content_store::load_custom_profile(name)? {
        let profile: DeviceProfile = toml::from_str(&stored.content)
            .with_context(|| format!("Failed to parse device profile from {}", stored.locator))?;
        return profile.to_device_handler();
    }

    Err(anyhow!(
        "Device profile '{}' not found in built-ins or SQLite store",
        name
    ))
}

pub fn list_available_profiles() -> Result<Vec<String>> {
    let mut profiles = BTreeSet::new();
    for builtin in templates::available_templates() {
        profiles.insert((*builtin).to_string());
    }
    for custom in content_store::list_custom_profile_names()? {
        profiles.insert(custom);
    }
    Ok(profiles.into_iter().collect())
}
