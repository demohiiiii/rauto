use crate::config::textfsm;
use anyhow::{Result, anyhow};
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::sync::OnceLock;

#[derive(Debug, Clone)]
pub struct ShowCommand {
    pub object: String,
    pub platform: String,
    pub command: String,
    pub mode: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FriendlyShowCatalogConfig {
    #[serde(default)]
    platform_modes: BTreeMap<String, String>,
    platforms: BTreeMap<String, BTreeMap<String, ShowCommandConfig>>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ShowCommandConfig {
    Command(String),
    Detailed {
        command: String,
        #[serde(default)]
        mode: Option<String>,
    },
}

impl ShowCommandConfig {
    fn command(&self) -> &str {
        match self {
            Self::Command(command) => command,
            Self::Detailed { command, .. } => command,
        }
    }

    fn mode(&self) -> Option<&str> {
        match self {
            Self::Command(_) => None,
            Self::Detailed { mode, .. } => mode
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty()),
        }
    }
}

static FRIENDLY_SHOW_COMMANDS: OnceLock<Vec<ShowCommand>> = OnceLock::new();
static SHOW_CATALOG_CONFIG: OnceLock<FriendlyShowCatalogConfig> = OnceLock::new();

pub fn normalize_show_object(raw: &str) -> Option<String> {
    let normalized = normalize_object_text(raw);
    match normalized.as_str() {
        "ver" | "version" => Some("version".to_string()),
        "int" | "ints" | "interface" | "interfaces" => Some("interfaces".to_string()),
        "brief" | "interface-brief" | "interfaces-brief" | "ip-interface-brief" => {
            Some("interface-brief".to_string())
        }
        "route" | "routes" | "routing" => Some("route".to_string()),
        "arp" | "lldp" | "mac" | "vlan" => Some(normalized),
        "vlans" => Some("vlan".to_string()),
        _ if !normalized.is_empty() => Some(normalized),
        _ => None,
    }
}

pub fn platform_for_show(device_profile: &str, override_platform: Option<&str>) -> Option<String> {
    override_platform
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| textfsm::ntc_platform_for_device_profile(device_profile))
}

pub fn resolve_show_command(
    object: &str,
    platform: &str,
    device_profile: &str,
) -> Result<ShowCommand> {
    let normalized_object =
        normalize_show_object(object).ok_or_else(|| anyhow!("unknown show object '{}'", object))?;
    show_commands_for_platform(platform)
        .into_iter()
        .find(|entry| entry.object == normalized_object)
        .ok_or_else(|| {
            let objects = list_show_objects_for_platform(platform);
            if objects.is_empty() {
                anyhow!(
                    "show object '{}' is not available for profile '{}' (NTC platform '{}')",
                    normalized_object,
                    device_profile,
                    platform
                )
            } else {
                anyhow!(
                    "show object '{}' is not available for profile '{}' (NTC platform '{}'); available objects: {}",
                    normalized_object,
                    device_profile,
                    platform,
                    objects.join(", ")
                )
            }
        })
}

pub fn list_show_objects_for_platform(platform: &str) -> Vec<String> {
    show_commands_for_platform(platform)
        .into_iter()
        .map(|entry| entry.object)
        .collect()
}

pub fn list_show_commands_for_platform(platform: &str) -> Vec<ShowCommand> {
    show_commands_for_platform(platform)
}

pub fn list_all_show_objects() -> Vec<String> {
    let mut objects = BTreeSet::new();
    for entry in friendly_show_commands() {
        objects.insert(entry.object.clone());
    }
    objects.into_iter().collect()
}

fn show_commands_for_platform(platform: &str) -> Vec<ShowCommand> {
    let mut commands = Vec::new();
    let mut seen_objects = HashSet::new();

    for entry in friendly_show_commands() {
        if entry.platform != platform {
            continue;
        }
        if seen_objects.insert(entry.object.clone()) {
            commands.push(entry.clone());
        }
    }

    commands.sort_by(|left, right| left.object.cmp(&right.object));
    commands
}

fn friendly_show_commands() -> &'static [ShowCommand] {
    FRIENDLY_SHOW_COMMANDS
        .get_or_init(load_friendly_show_commands)
        .as_slice()
}

fn show_catalog_config() -> &'static FriendlyShowCatalogConfig {
    SHOW_CATALOG_CONFIG.get_or_init(|| {
        toml::from_str(include_str!(
            "../../assets/show_catalog/commands-mapping.toml"
        ))
        .expect("built-in show catalog mapping must be valid TOML")
    })
}

fn load_friendly_show_commands() -> Vec<ShowCommand> {
    let config = show_catalog_config();
    let mut commands = Vec::new();
    for (platform, object_commands) in &config.platforms {
        let platform_mode = config
            .platform_modes
            .get(platform)
            .map(String::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        for (object, command_config) in object_commands {
            commands.push(ShowCommand {
                object: object.clone(),
                platform: platform.clone(),
                command: command_config.command().to_string(),
                mode: command_config
                    .mode()
                    .or(platform_mode)
                    .map(ToOwned::to_owned),
            });
        }
    }
    commands
}

fn normalize_object_text(raw: &str) -> String {
    let mut output = String::new();
    let mut last_dash = false;
    for ch in raw.trim().to_ascii_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            output.push(ch);
            last_dash = false;
        } else if !last_dash {
            output.push('-');
            last_dash = true;
        }
    }
    output.trim_matches('-').to_string()
}
