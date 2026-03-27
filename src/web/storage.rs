use crate::config::content_store;
use crate::config::device_profile::DeviceProfile;
use crate::config::template_loader;
use crate::web::error::ApiError;
use crate::web::models::{
    BuiltinProfileDetail, BuiltinProfileMeta, CommandFlowTemplateMeta, CustomProfileMeta,
    TemplateMeta,
};
use rneter::templates::{TemplateCapability, by_name_config, template_catalog, template_metadata};

fn builtin_aliases(name: &str) -> Vec<String> {
    match name {
        "cisco" => vec!["ios".to_string()],
        "huawei" => vec!["vrp".to_string()],
        "h3c" => vec!["comware".to_string()],
        "juniper" => vec!["junos".to_string()],
        "arista" => vec!["eos".to_string()],
        "fortinet" => vec!["fortigate".to_string(), "fortios".to_string()],
        "paloalto" => vec!["palo-alto".to_string(), "panos".to_string()],
        "chaitin" => vec!["safeline".to_string()],
        "qianxin" => vec!["qax".to_string(), "qian-xin".to_string()],
        "checkpoint" => vec!["check-point".to_string(), "check_point".to_string()],
        _ => Vec::new(),
    }
}

fn builtin_summary(name: &str, vendor: &str, family: &str) -> String {
    if name == "linux" {
        "Linux server profile".to_string()
    } else if family.is_empty() {
        format!("{vendor} profile")
    } else {
        format!("{vendor} {family} profile")
    }
}

fn capability_label(capability: TemplateCapability) -> &'static str {
    match capability {
        TemplateCapability::LoginMode => "login mode",
        TemplateCapability::EnableMode => "enable mode",
        TemplateCapability::ConfigMode => "config mode",
        TemplateCapability::SysContext => "system context",
        TemplateCapability::InteractiveInput => "interactive input",
    }
}

fn builtin_notes(vendor: &str, family: &str, capabilities: &[TemplateCapability]) -> Vec<String> {
    let mut notes = Vec::new();
    if !family.is_empty() {
        notes.push(format!("Vendor: {vendor}; family: {family}."));
    } else {
        notes.push(format!("Vendor: {vendor}."));
    }
    if !capabilities.is_empty() {
        let caps = capabilities
            .iter()
            .copied()
            .map(capability_label)
            .collect::<Vec<_>>()
            .join(", ");
        notes.push(format!("Capabilities: {caps}."));
    }
    notes
}

pub fn builtin_profiles() -> Vec<BuiltinProfileMeta> {
    template_catalog()
        .into_iter()
        .map(|meta| BuiltinProfileMeta {
            summary: builtin_summary(&meta.name, &meta.vendor, &meta.family),
            aliases: builtin_aliases(&meta.name),
            name: meta.name,
        })
        .collect()
}

pub fn builtin_profile_detail(name: &str) -> Option<BuiltinProfileDetail> {
    let canonical = template_loader::canonical_builtin_profile_name(name)?;
    let meta = template_metadata(canonical).ok()?;
    Some(BuiltinProfileDetail {
        name: meta.name.clone(),
        aliases: builtin_aliases(&meta.name),
        summary: builtin_summary(&meta.name, &meta.vendor, &meta.family),
        source: format!("rneter::templates::{}", meta.name),
        notes: builtin_notes(&meta.vendor, &meta.family, &meta.capabilities),
    })
}

pub fn builtin_profile_form(name: &str) -> Option<DeviceProfile> {
    let canonical = template_loader::canonical_builtin_profile_name(name)?;
    let config = by_name_config(canonical).ok()?;
    Some(DeviceProfile::from_handler_config(
        canonical.to_string(),
        config,
    ))
}

pub fn list_custom_profiles() -> Result<Vec<CustomProfileMeta>, ApiError> {
    Ok(content_store::list_custom_profiles()
        .map_err(ApiError::from)?
        .into_iter()
        .map(|item| CustomProfileMeta {
            name: item.name,
            path: item.locator,
        })
        .collect())
}

pub fn list_templates() -> Result<Vec<TemplateMeta>, ApiError> {
    Ok(content_store::list_command_templates()
        .map_err(ApiError::from)?
        .into_iter()
        .map(|item| TemplateMeta {
            name: item.name,
            path: item.locator,
        })
        .collect())
}

pub fn list_command_flow_templates() -> Result<Vec<CommandFlowTemplateMeta>, ApiError> {
    Ok(content_store::list_command_flow_templates()
        .map_err(ApiError::from)?
        .into_iter()
        .map(|item| CommandFlowTemplateMeta {
            name: item.name,
            path: item.locator,
        })
        .collect())
}

pub fn safe_profile_name(raw: &str) -> Result<String, ApiError> {
    let normalized = raw.trim().trim_end_matches(".toml");
    if normalized.is_empty() || !is_safe_name(normalized) {
        return Err(ApiError::bad_request("invalid profile name"));
    }
    Ok(normalized.to_string())
}

pub fn safe_template_name(raw: &str) -> Result<String, ApiError> {
    let normalized = raw.trim();
    if normalized.is_empty() || !is_safe_template_name(normalized) {
        return Err(ApiError::bad_request("invalid template name"));
    }
    Ok(normalized.to_string())
}

pub fn safe_command_flow_template_name(raw: &str) -> Result<String, ApiError> {
    let normalized = raw.trim().trim_end_matches(".toml");
    if normalized.is_empty() || !is_safe_name(normalized) {
        return Err(ApiError::bad_request("invalid command flow template name"));
    }
    Ok(normalized.to_string())
}

fn is_safe_name(name: &str) -> bool {
    name.chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
}

fn is_safe_template_name(name: &str) -> bool {
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return false;
    }
    name.chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' || ch == '.')
}
