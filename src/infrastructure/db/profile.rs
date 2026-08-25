use crate::domain::device::{DeviceProfile, canonical_builtin_profile_name};
use crate::infrastructure::db::content_store;
use anyhow::{Context, Result, anyhow};

pub fn canonical_profile_name(name: &str) -> String {
    canonical_builtin_profile_name(name)
        .unwrap_or_else(|| name.trim())
        .to_string()
}

pub fn resolve_profile_mode(profile_name: &str, requested_mode: Option<&str>) -> Result<String> {
    let profile = load_profile(profile_name)?;
    let available_modes = profile.available_modes();
    let default_mode = profile.default_mode();
    let Some(requested_mode) = requested_mode
        .map(str::trim)
        .filter(|mode| !mode.is_empty())
    else {
        return Ok(default_mode);
    };

    let canonical_modes = requested_mode
        .split([',', '|'])
        .map(str::trim)
        .filter(|mode| !mode.is_empty())
        .map(|mode| {
            available_modes
                .iter()
                .find(|candidate| candidate.eq_ignore_ascii_case(mode))
                .cloned()
        })
        .collect::<Option<Vec<_>>>()
        .filter(|modes| !modes.is_empty());

    canonical_modes.map(|modes| modes.join(",")).ok_or_else(|| {
        anyhow!(
            "invalid mode '{}' for profile '{}'; default_mode='{}'; available_modes=[{}]",
            requested_mode,
            profile_name,
            default_mode,
            available_modes.join(", ")
        )
    })
}

fn load_profile(name: &str) -> Result<DeviceProfile> {
    if let Some(canonical) = canonical_builtin_profile_name(name) {
        return Ok(DeviceProfile::from_handler_config(
            canonical.to_string(),
            rneter::templates::by_name_config(canonical)?,
        ));
    }
    let stored = content_store::load_custom_profile(name)?
        .ok_or_else(|| anyhow!("device profile '{}' not found", name))?;
    toml::from_str(&stored.content)
        .with_context(|| format!("failed to parse device profile from {}", stored.locator))
}
