use crate::config::{custom_show_object_store, textfsm};
use anyhow::{Result, anyhow};
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::sync::OnceLock;

pub use crate::domain::device::{ShowCommand, ShowCommandSource, normalize_show_object};

#[derive(Debug, Deserialize)]
struct FriendlyShowCatalogConfig {
    #[serde(default)]
    platform_modes: BTreeMap<String, String>,
    #[serde(default)]
    profile_modes: BTreeMap<String, String>,
    #[serde(default)]
    profiles: BTreeMap<String, BTreeMap<String, ShowCommandConfig>>,
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

pub fn platform_for_show(device_profile: &str, override_platform: Option<&str>) -> Option<String> {
    override_platform
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| textfsm::ntc_platform_for_device_profile(device_profile))
}

pub fn resolve_show_command(
    object: &str,
    platform: Option<&str>,
    device_profile: &str,
) -> Result<ShowCommand> {
    let normalized_object =
        normalize_show_object(object).ok_or_else(|| anyhow!("unknown show object '{}'", object))?;
    if let Some(custom) =
        custom_show_object_store::load_enabled(device_profile, &normalized_object)?
    {
        return Ok(ShowCommand {
            object: custom.object,
            platform: platform.unwrap_or_default().to_string(),
            command: custom.command,
            mode: custom.mode,
            textfsm_mapping_command: custom.textfsm_mapping_command,
            textfsm_template_name: custom.textfsm_template_name,
            source: ShowCommandSource::Custom,
        });
    }

    if let Some(command) = show_commands_for_profile(device_profile, platform)
        .into_iter()
        .find(|entry| entry.object == normalized_object)
    {
        return Ok(command);
    }

    let Some(platform) = platform.map(str::trim).filter(|value| !value.is_empty()) else {
        return Err(anyhow!(
            "show object '{}' is not available for profile '{}'; cannot infer NTC platform and no profile-specific or custom show object matches",
            normalized_object,
            device_profile
        ));
    };

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

pub fn list_show_commands_for_profile(
    device_profile: Option<&str>,
    platform: Option<&str>,
) -> Result<Vec<ShowCommand>> {
    let mut commands = BTreeMap::new();

    if let Some(platform) = platform.map(str::trim).filter(|value| !value.is_empty()) {
        for command in show_commands_for_platform(platform) {
            commands.insert(command.object.clone(), command);
        }
    }

    if let Some(device_profile) = device_profile
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        for command in show_commands_for_profile(device_profile, platform) {
            commands.insert(command.object.clone(), command);
        }
        for item in custom_show_object_store::list_enabled_for_profile(device_profile)? {
            commands.insert(
                item.object.clone(),
                ShowCommand {
                    object: item.object,
                    platform: platform.unwrap_or_default().to_string(),
                    command: item.command,
                    mode: item.mode,
                    textfsm_mapping_command: item.textfsm_mapping_command,
                    textfsm_template_name: item.textfsm_template_name,
                    source: ShowCommandSource::Custom,
                },
            );
        }
    }

    Ok(commands.into_values().collect())
}

pub fn list_all_show_objects() -> Vec<String> {
    let mut objects = BTreeSet::new();
    for entry in friendly_show_commands() {
        objects.insert(entry.object.clone());
    }
    for profile in show_catalog_config().profiles.keys() {
        for entry in show_commands_for_profile(profile, None) {
            objects.insert(entry.object);
        }
    }
    objects.into_iter().collect()
}

fn show_commands_for_profile(device_profile: &str, platform: Option<&str>) -> Vec<ShowCommand> {
    let config = show_catalog_config();
    let canonical_profile =
        crate::config::template_loader::canonical_builtin_profile_name(device_profile.trim())
            .unwrap_or_else(|| device_profile.trim());
    let Some(object_commands) = config.profiles.get(canonical_profile) else {
        return Vec::new();
    };
    let profile_mode = config
        .profile_modes
        .get(canonical_profile)
        .map(String::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let platform = platform.unwrap_or_default().to_string();

    let mut commands = object_commands
        .iter()
        .map(|(object, command_config)| ShowCommand {
            object: object.clone(),
            platform: platform.clone(),
            command: command_config.command().to_string(),
            mode: command_config
                .mode()
                .or(profile_mode)
                .map(ToOwned::to_owned),
            textfsm_mapping_command: None,
            textfsm_template_name: None,
            source: ShowCommandSource::Builtin,
        })
        .collect::<Vec<_>>();
    commands.sort_by(|left, right| left.object.cmp(&right.object));
    commands
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
                textfsm_mapping_command: None,
                textfsm_template_name: None,
                source: ShowCommandSource::Builtin,
            });
        }
    }
    commands
}

#[cfg(test)]
mod tests {
    use super::{
        normalize_show_object, platform_for_show, show_commands_for_platform,
        show_commands_for_profile,
    };

    fn builtin_command(platform: &str, object: &str) -> super::ShowCommand {
        show_commands_for_platform(platform)
            .into_iter()
            .find(|command| command.object == object)
            .unwrap_or_else(|| panic!("{object} should resolve for {platform}"))
    }

    fn builtin_command_for_profile(profile: &str, object: &str) -> super::ShowCommand {
        let platform = platform_for_show(profile, None);
        show_commands_for_profile(profile, platform.as_deref())
            .into_iter()
            .find(|entry| entry.object == object)
            .or_else(|| {
                platform
                    .as_deref()
                    .map(|platform| builtin_command(platform, object))
            })
            .unwrap_or_else(|| panic!("{object} should resolve for {profile}"))
    }

    #[test]
    fn h3c_comware_version_resolves_display_version() {
        let platform = platform_for_show("h3c_comware", None);
        let command = builtin_command(platform.as_deref().expect("H3C platform"), "version");

        assert_eq!(platform.as_deref(), Some("hp_comware"));
        assert_eq!(command.command, "display version");
        assert_eq!(command.mode.as_deref(), Some("Enable"));
    }

    #[test]
    fn linux_version_resolves_os_release() {
        let platform = platform_for_show("linux", None);
        let command = builtin_command(platform.as_deref().expect("Linux platform"), "version");

        assert_eq!(platform.as_deref(), Some("linux"));
        assert_eq!(command.command, "cat /etc/os-release");
        assert_eq!(command.mode.as_deref(), Some("Root|User"));
    }

    #[test]
    fn policy_and_nat_aliases_use_canonical_objects() {
        assert_eq!(normalize_show_object("policy").as_deref(), Some("policy"));
        assert_eq!(
            normalize_show_object("security policy").as_deref(),
            Some("policy")
        );
        assert_eq!(normalize_show_object("nat").as_deref(), Some("nat-policy"));
        assert_eq!(
            normalize_show_object("nat policy").as_deref(),
            Some("nat-policy")
        );
    }

    #[test]
    fn security_vendor_profiles_expose_policy_and_nat_commands() {
        let expected = [
            ("cisco_asa", "show access-list", "show nat"),
            (
                "dptech",
                "display security-policy all",
                "display firewall nat-policy",
            ),
            (
                "fortinet",
                "get firewall policy",
                "get firewall central-snat-map",
            ),
            (
                "h3c_comware",
                "display security-policy ip",
                "display nat all",
            ),
            (
                "huawei",
                "display security-policy rule all",
                "display nat-policy rule all",
            ),
            ("hillstone_stoneos", "show policy", "show nat"),
            ("leadsec_powerv", "get policy", "get nat"),
            (
                "paloalto_panos",
                "show running security-policy",
                "show running nat-policy",
            ),
            ("qianxin", "show security policy", "show nat"),
            ("topsec", "firewall policy show", "firewall nat show"),
        ];

        for (profile, expected_policy, expected_nat) in expected {
            assert_eq!(
                builtin_command_for_profile(profile, "policy").command,
                expected_policy,
                "policy profile: {profile}"
            );
            assert_eq!(
                builtin_command_for_profile(profile, "nat-policy").command,
                expected_nat,
                "NAT profile: {profile}"
            );
        }
    }

    #[test]
    fn venustech_exposes_confirmed_policy_without_guessing_nat() {
        assert_eq!(
            builtin_command_for_profile("venustech", "policy").command,
            "display security-policy all"
        );
        assert!(
            show_commands_for_profile("venustech", None)
                .iter()
                .all(|command| command.object != "nat-policy")
        );
    }

    #[test]
    fn fortinet_exposes_each_nat_configuration_object() {
        for (object, expected_command) in [
            ("nat-vip", "get firewall vip"),
            ("nat-ippool", "get firewall ippool"),
            ("nat-central-snat", "get firewall central-snat-map"),
        ] {
            assert_eq!(
                builtin_command_for_profile("fortinet", object).command,
                expected_command,
                "FortiGate NAT object: {object}"
            );
        }
    }

    #[test]
    fn h3c_security_commands_do_not_leak_into_hp_comware() {
        let hp_objects = show_commands_for_platform("hp_comware")
            .into_iter()
            .map(|command| command.object)
            .collect::<Vec<_>>();
        assert!(!hp_objects.iter().any(|object| object == "policy"));
        assert!(!hp_objects.iter().any(|object| object == "nat-policy"));
    }

    #[test]
    fn cisco_asa_nat_uses_the_canonical_nat_policy_object() {
        let command = builtin_command("cisco_asa", "nat-policy");
        assert_eq!(command.command, "show nat");
        assert!(
            show_commands_for_platform("cisco_asa")
                .iter()
                .all(|command| command.object != "nat")
        );
    }
}
