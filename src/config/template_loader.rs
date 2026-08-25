use crate::config::content_store;
use crate::config::device_profile::DeviceProfile;
use crate::config::linux_shell::LinuxShellFlavor;
use anyhow::{Context, Result, anyhow};
use rneter::{
    device::DeviceHandler,
    templates::{self, DetectTemplateDefinition},
};
use std::collections::BTreeSet;

pub const AUTODETECT_DEVICE_PROFILE: &str = "autodetect";
pub const DEFAULT_DEVICE_PROFILE: &str = AUTODETECT_DEVICE_PROFILE;
const AUTODETECT_MODE_FALLBACK_PROFILE: &str = "linux";

pub fn is_autodetect_profile_name(name: &str) -> bool {
    matches!(
        name.trim().to_lowercase().as_str(),
        "auto" | "autodetect" | "detect"
    )
}

pub use crate::domain::device::canonical_builtin_profile_name;

pub fn load_device_profile(name: &str) -> Result<DeviceHandler> {
    load_device_profile_form(name)?.to_device_handler()
}

pub fn load_device_profile_for_connection(
    name: &str,
    linux_shell_flavor: Option<LinuxShellFlavor>,
) -> Result<DeviceHandler> {
    let mut profile = load_device_profile_form(name)?;
    if let Some(flavor) = linux_shell_flavor {
        profile.apply_shell_flavor_override(flavor.to_device_shell_flavor());
    }
    profile.to_device_handler()
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
    if is_autodetect_profile_name(name) {
        return list_profile_modes(AUTODETECT_MODE_FALLBACK_PROFILE);
    }

    Ok(load_device_profile_form(name)?.available_modes())
}

pub fn default_profile_mode(name: &str) -> Result<String> {
    if is_autodetect_profile_name(name) {
        return default_profile_mode(AUTODETECT_MODE_FALLBACK_PROFILE);
    }

    Ok(load_device_profile_form(name)?.default_mode())
}

fn canonicalize_profile_mode<'a>(
    available_modes: &'a [String],
    requested_mode: &str,
) -> Option<&'a str> {
    available_modes
        .iter()
        .find(|mode| mode.eq_ignore_ascii_case(requested_mode))
        .map(String::as_str)
}

fn split_profile_mode_candidates(requested_mode: &str) -> impl Iterator<Item = &str> {
    requested_mode
        .split([',', '|'])
        .map(str::trim)
        .filter(|mode| !mode.is_empty())
}

pub fn resolve_profile_mode(name: &str, requested_mode: Option<&str>) -> Result<String> {
    if is_autodetect_profile_name(name) {
        return resolve_profile_mode(AUTODETECT_MODE_FALLBACK_PROFILE, requested_mode);
    }

    let profile = load_device_profile_form(name)?;
    let available_modes = profile.available_modes();
    let default_mode = profile.default_mode();

    let Some(requested_mode) = requested_mode
        .map(str::trim)
        .filter(|mode| !mode.is_empty())
    else {
        return Ok(default_mode);
    };

    let mut canonical_modes = Vec::new();
    let mut invalid_modes = Vec::new();
    for mode in split_profile_mode_candidates(requested_mode) {
        match canonicalize_profile_mode(&available_modes, mode) {
            Some(canonical_mode) => canonical_modes.push(canonical_mode.to_string()),
            None => invalid_modes.push(mode.to_string()),
        }
    }

    if !canonical_modes.is_empty() && invalid_modes.is_empty() {
        return Ok(canonical_modes.join(","));
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
    profiles.insert(AUTODETECT_DEVICE_PROFILE.to_string());
    for builtin in templates::available_templates() {
        profiles.insert((*builtin).to_string());
    }
    for custom in content_store::list_custom_profile_names()? {
        profiles.insert(custom);
    }
    Ok(profiles.into_iter().collect())
}

pub fn custom_detect_template_definitions() -> Result<Vec<DetectTemplateDefinition>> {
    let mut templates = Vec::new();
    for stored in content_store::list_custom_profiles()? {
        let profile: DeviceProfile = toml::from_str(&stored.content)
            .with_context(|| format!("Failed to parse device profile from {}", stored.locator))?;
        let Some(detect_profile) = profile.detect_profile.clone() else {
            continue;
        };
        templates.push(DetectTemplateDefinition::new(
            profile.name.clone(),
            profile.to_device_handler_config(),
            detect_profile,
        ));
    }
    Ok(templates)
}

#[cfg(test)]
mod tests {
    use super::{canonicalize_profile_mode, resolve_profile_mode, split_profile_mode_candidates};

    #[test]
    fn canonicalizes_mode_case_insensitively() {
        let modes = vec![
            "Enable".to_string(),
            "Config".to_string(),
            "Shell".to_string(),
        ];

        assert_eq!(canonicalize_profile_mode(&modes, "enable"), Some("Enable"));
        assert_eq!(canonicalize_profile_mode(&modes, "CONFIG"), Some("Config"));
        assert_eq!(canonicalize_profile_mode(&modes, "sHeLl"), Some("Shell"));
    }

    #[test]
    fn returns_none_for_unknown_mode() {
        let modes = vec!["Enable".to_string(), "Config".to_string()];

        assert_eq!(canonicalize_profile_mode(&modes, "user"), None);
    }

    #[test]
    fn splits_multi_mode_candidates_on_comma_or_pipe() {
        assert_eq!(
            split_profile_mode_candidates(" Root, User | Config ").collect::<Vec<_>>(),
            vec!["Root", "User", "Config"]
        );
        assert_eq!(
            split_profile_mode_candidates(",,Enable||").collect::<Vec<_>>(),
            vec!["Enable"]
        );
    }

    #[test]
    fn resolves_multi_mode_candidates_case_insensitively() {
        let resolved =
            resolve_profile_mode("linux", Some(" root | user ")).expect("resolve multi mode");

        assert_eq!(resolved, "Root,User");
    }

    #[test]
    fn rejects_unknown_multi_mode_candidates() {
        let err = resolve_profile_mode("linux", Some("root,missing"))
            .expect_err("unknown mode should fail");

        assert!(err.to_string().contains("root,missing"));
        assert!(err.to_string().contains("available_modes="));
    }
}
