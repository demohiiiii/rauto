use crate::config::content_store;
use crate::config::device_profile::{
    DeviceProfile, InteractionConfig, PromptConfig, SysPromptConfig, TransitionConfig,
};
use crate::config::template_loader;
use crate::web::error::ApiError;
use crate::web::models::{
    BuiltinProfileDetail, BuiltinProfileMeta, CustomProfileMeta, TemplateMeta,
};
use rneter::templates::{TemplateCapability, template_catalog, template_metadata};

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

fn builtin_notes(
    name: &str,
    vendor: &str,
    family: &str,
    capabilities: &[TemplateCapability],
) -> Vec<String> {
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
    if builtin_profile_form(name).is_none() {
        notes.push(
            "This built-in template is available for execution, but exporting an editable TOML form is not supported yet."
                .to_string(),
        );
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
        notes: builtin_notes(&meta.name, &meta.vendor, &meta.family, &meta.capabilities),
    })
}

pub fn builtin_profile_form(name: &str) -> Option<DeviceProfile> {
    let key = template_loader::canonical_builtin_profile_name(name).unwrap_or(name);
    match key {
        "cisco" | "ios" => Some(DeviceProfile {
            name: "cisco".to_string(),
            prompts: vec![
                PromptConfig {
                    state: "Config".to_string(),
                    patterns: vec![r"^\S+\(\S+\)#\s*$".to_string()],
                },
                PromptConfig {
                    state: "Enable".to_string(),
                    patterns: vec![r"^[^\s#]+#\s*$".to_string()],
                },
                PromptConfig {
                    state: "Login".to_string(),
                    patterns: vec![r"^[^\s<]+>\s*$".to_string()],
                },
            ],
            sys_prompts: vec![],
            interactions: vec![InteractionConfig {
                state: "EnablePassword".to_string(),
                input: "EnablePassword".to_string(),
                is_dynamic: true,
                record_input: true,
                patterns: vec![r"^\x00*\r(Enable )?Password:".to_string()],
            }],
            more_patterns: vec![r"\s*<--- More --->\s*".to_string()],
            error_patterns: vec![
                r"% Invalid command at '\^' marker\.".to_string(),
                r"% Invalid parameter detected at '\^' marker\.".to_string(),
                r"^%.+".to_string(),
            ],
            transitions: vec![
                TransitionConfig {
                    from: "Login".to_string(),
                    command: "enable".to_string(),
                    to: "Enable".to_string(),
                    is_exit: false,
                    format_sys: false,
                },
                TransitionConfig {
                    from: "Enable".to_string(),
                    command: "configure terminal".to_string(),
                    to: "Config".to_string(),
                    is_exit: false,
                    format_sys: false,
                },
                TransitionConfig {
                    from: "Config".to_string(),
                    command: "exit".to_string(),
                    to: "Enable".to_string(),
                    is_exit: true,
                    format_sys: false,
                },
                TransitionConfig {
                    from: "Enable".to_string(),
                    command: "exit".to_string(),
                    to: "Login".to_string(),
                    is_exit: true,
                    format_sys: false,
                },
            ],
            ignore_errors: vec![r"ERROR: object \(.+\) does not exist.".to_string()],
        }),
        "huawei" | "vrp" => Some(DeviceProfile {
            name: "huawei".to_string(),
            prompts: vec![
                PromptConfig {
                    state: "Config".to_string(),
                    patterns: vec![r"^(HRP_M|HRP_S){0,1}\[.+]+\s*$".to_string()],
                },
                PromptConfig {
                    state: "Enable".to_string(),
                    patterns: vec![r"^(RBM_P|RBM_S)?<.+>\s*$".to_string()],
                },
            ],
            sys_prompts: vec![],
            interactions: vec![InteractionConfig {
                state: "Save".to_string(),
                input: "y".to_string(),
                is_dynamic: false,
                record_input: true,
                patterns: vec![r"Are you sure to continue\?\[Y\/N\]: ".to_string()],
            }],
            more_patterns: vec![r"\s*---- More ----\s*".to_string()],
            error_patterns: vec![r"Error: .+$".to_string(), r"\^$".to_string()],
            transitions: vec![
                TransitionConfig {
                    from: "Enable".to_string(),
                    command: "system-view".to_string(),
                    to: "Config".to_string(),
                    is_exit: false,
                    format_sys: false,
                },
                TransitionConfig {
                    from: "Config".to_string(),
                    command: "exit".to_string(),
                    to: "Enable".to_string(),
                    is_exit: true,
                    format_sys: false,
                },
            ],
            ignore_errors: vec![],
        }),
        "h3c" | "comware" => Some(DeviceProfile {
            name: "h3c".to_string(),
            prompts: vec![
                PromptConfig {
                    state: "Config".to_string(),
                    patterns: vec![r"^(RBM_P|RBM_S)?\[.+\]\s*$".to_string()],
                },
                PromptConfig {
                    state: "Enable".to_string(),
                    patterns: vec![r"^(RBM_P|RBM_S)?<.+>\s*$".to_string()],
                },
            ],
            sys_prompts: vec![],
            interactions: vec![],
            more_patterns: vec![r"\s*---- More ----\s*".to_string()],
            error_patterns: vec![r".+%.+".to_string(), r".+does not exist.+".to_string()],
            transitions: vec![
                TransitionConfig {
                    from: "Enable".to_string(),
                    command: "system-view".to_string(),
                    to: "Config".to_string(),
                    is_exit: false,
                    format_sys: false,
                },
                TransitionConfig {
                    from: "Config".to_string(),
                    command: "exit".to_string(),
                    to: "Enable".to_string(),
                    is_exit: true,
                    format_sys: false,
                },
            ],
            ignore_errors: vec![],
        }),
        "hillstone" => Some(DeviceProfile {
            name: "hillstone".to_string(),
            prompts: vec![
                PromptConfig {
                    state: "Enable".to_string(),
                    patterns: vec![r"^.+#\s\r{0,1}$".to_string()],
                },
                PromptConfig {
                    state: "Config".to_string(),
                    patterns: vec![r"^.+\(config.*\)\s*#\s\r{0,1}$".to_string()],
                },
            ],
            sys_prompts: vec![],
            interactions: vec![InteractionConfig {
                state: "Save".to_string(),
                input: "y".to_string(),
                is_dynamic: false,
                record_input: true,
                patterns: vec![r"Save configuration, are you sure\? \[y\]\/n: ".to_string()],
            }],
            more_patterns: vec![r"\s*--More--\s*".to_string()],
            error_patterns: vec![r".+%.+".to_string(), r".+does not exist.+".to_string()],
            transitions: vec![
                TransitionConfig {
                    from: "Enable".to_string(),
                    command: "config".to_string(),
                    to: "Config".to_string(),
                    is_exit: false,
                    format_sys: false,
                },
                TransitionConfig {
                    from: "Config".to_string(),
                    command: "exit".to_string(),
                    to: "Enable".to_string(),
                    is_exit: true,
                    format_sys: false,
                },
            ],
            ignore_errors: vec![],
        }),
        "juniper" | "junos" => Some(DeviceProfile {
            name: "juniper".to_string(),
            prompts: vec![
                PromptConfig {
                    state: "Config".to_string(),
                    patterns: vec![r"^\S+@\S+#\s*$".to_string()],
                },
                PromptConfig {
                    state: "Enable".to_string(),
                    patterns: vec![r"^\S+@\S+>\s*$".to_string()],
                },
            ],
            sys_prompts: vec![],
            interactions: vec![InteractionConfig {
                state: "Save".to_string(),
                input: "yes".to_string(),
                is_dynamic: false,
                record_input: true,
                patterns: vec![r"Exit with uncommitted changes\? \[yes,no\] \(yes\) ".to_string()],
            }],
            more_patterns: vec![r"---\(more.*\)---".to_string()],
            error_patterns: vec![
                r".*unknown command.*".to_string(),
                r"syntax error.*".to_string(),
            ],
            transitions: vec![
                TransitionConfig {
                    from: "Enable".to_string(),
                    command: "system-view".to_string(),
                    to: "Config".to_string(),
                    is_exit: false,
                    format_sys: false,
                },
                TransitionConfig {
                    from: "Config".to_string(),
                    command: "exit".to_string(),
                    to: "Enable".to_string(),
                    is_exit: true,
                    format_sys: false,
                },
            ],
            ignore_errors: vec![r"warning: statement not found".to_string()],
        }),
        "array" => Some(DeviceProfile {
            name: "array".to_string(),
            prompts: vec![
                PromptConfig {
                    state: "Login".to_string(),
                    patterns: vec![r"^[^\s<]+>\s*$".to_string()],
                },
                PromptConfig {
                    state: "Enable".to_string(),
                    patterns: vec![r"^[^\s#]+#\s*$".to_string()],
                },
                PromptConfig {
                    state: "Config".to_string(),
                    patterns: vec![r"^\S+\(\S+\)#\s*$".to_string()],
                },
            ],
            sys_prompts: vec![
                SysPromptConfig {
                    state: "VSiteConfig".to_string(),
                    sys_name_group: "VS".to_string(),
                    pattern: r"^(?<VS>\S+)\(\S+\)\$\s*$".to_string(),
                },
                SysPromptConfig {
                    state: "VSiteEnable".to_string(),
                    sys_name_group: "VS".to_string(),
                    pattern: r"^(?<VS>\S+)\$\s*$".to_string(),
                },
            ],
            interactions: vec![InteractionConfig {
                state: "EnablePassword".to_string(),
                input: "EnablePassword".to_string(),
                is_dynamic: true,
                record_input: true,
                patterns: vec![r"^\x00*\rEnable password:".to_string()],
            }],
            more_patterns: vec![r"\s*--More--\s*".to_string()],
            error_patterns: vec![
                r"Virtual site .+ is not configured".to_string(),
                r"Access denied!".to_string(),
            ],
            transitions: vec![
                TransitionConfig {
                    from: "Login".to_string(),
                    command: "enable".to_string(),
                    to: "Enable".to_string(),
                    is_exit: false,
                    format_sys: false,
                },
                TransitionConfig {
                    from: "Enable".to_string(),
                    command: "configure terminal".to_string(),
                    to: "Config".to_string(),
                    is_exit: false,
                    format_sys: false,
                },
                TransitionConfig {
                    from: "Config".to_string(),
                    command: "exit".to_string(),
                    to: "Enable".to_string(),
                    is_exit: true,
                    format_sys: false,
                },
            ],
            ignore_errors: vec![],
        }),
        _ => None,
    }
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
