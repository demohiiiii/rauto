use crate::config::content_store;
use crate::config::device_profile::DeviceProfile;
use anyhow::{Context, Result, anyhow};
use rneter::{device::DeviceHandler, templates};
use std::collections::BTreeSet;

pub const DEFAULT_DEVICE_PROFILE: &str = "linux";

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
    load_device_profile_form(name)?.to_device_handler()
}

pub fn load_device_profile_form(name: &str) -> Result<DeviceProfile> {
    if let Some(canonical) = canonical_builtin_profile_name(name) {
        return Ok(DeviceProfile::from_handler_config(
            canonical.to_string(),
            templates::by_name_config(canonical)?,
        ));
    }

    if let Some(stored) = content_store::load_custom_profile(name)? {
        let profile: DeviceProfile = toml::from_str(&stored.content)
            .with_context(|| format!("Failed to parse device profile from {}", stored.locator))?;
        return Ok(profile);
    }

    Err(anyhow!(
        "Device profile '{}' not found in built-ins or SQLite store",
        name
    ))
}

pub fn list_profile_modes(name: &str) -> Result<Vec<String>> {
    Ok(load_device_profile_form(name)?.available_modes())
}

pub fn default_profile_mode(name: &str) -> Result<String> {
    Ok(load_device_profile_form(name)?.default_mode())
}

pub fn resolve_profile_mode(name: &str, requested_mode: Option<&str>) -> Result<String> {
    let profile = load_device_profile_form(name)?;
    let available_modes = profile.available_modes();
    let default_mode = profile.default_mode();

    let Some(requested_mode) = requested_mode
        .map(str::trim)
        .filter(|mode| !mode.is_empty())
    else {
        return Ok(default_mode);
    };

    if available_modes.iter().any(|mode| mode == requested_mode) {
        return Ok(requested_mode.to_string());
    }

    Err(anyhow!(
        "invalid mode '{}' for profile '{}'; default_mode='{}'; available_modes=[{}]",
        requested_mode,
        name,
        default_mode,
        available_modes.join(", ")
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
