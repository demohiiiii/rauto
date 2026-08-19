use crate::config::config_command_store;
use crate::config::template_loader;
use anyhow::{Result, anyhow};
use regex::Regex;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::sync::OnceLock;

#[derive(Debug, Deserialize)]
struct ConfigCatalogFile {
    #[serde(default)]
    platform_modes: BTreeMap<String, String>,
    #[serde(default)]
    platform_profiles: BTreeMap<String, Vec<String>>,
    #[serde(default)]
    platforms: BTreeMap<String, BTreeMap<String, ConfigCommandConfig>>,
    #[serde(default)]
    volatile_patterns: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ConfigCommandConfig {
    Command(String),
    Detailed {
        command: String,
        #[serde(default)]
        mode: Option<String>,
    },
}

impl ConfigCommandConfig {
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigCommandSource {
    Builtin,
    Custom,
}

impl ConfigCommandSource {
    pub fn label(self) -> &'static str {
        match self {
            ConfigCommandSource::Builtin => "builtin",
            ConfigCommandSource::Custom => "custom",
        }
    }
}

#[derive(Debug, Clone)]
pub struct ConfigFetchCommand {
    pub profile: String,
    pub kind: String,
    pub command: String,
    pub mode: Option<String>,
    pub source: ConfigCommandSource,
}

fn catalog() -> &'static ConfigCatalogFile {
    static CATALOG: OnceLock<ConfigCatalogFile> = OnceLock::new();
    CATALOG.get_or_init(|| {
        toml::from_str(include_str!(
            "../../assets/config_catalog/config-commands.toml"
        ))
        .expect("builtin config catalog must parse")
    })
}

fn canonical_profile(profile: &str) -> String {
    template_loader::canonical_builtin_profile_name(profile)
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| profile.trim().to_string())
}

fn catalog_platform_for_profile<'a>(catalog: &'a ConfigCatalogFile, profile: &'a str) -> &'a str {
    catalog
        .platform_profiles
        .iter()
        .find(|(_, profiles)| profiles.iter().any(|candidate| candidate == profile))
        .map(|(platform, _)| platform.as_str())
        .unwrap_or(profile)
}

fn profiles_for_catalog_platform<'a>(
    catalog: &'a ConfigCatalogFile,
    platform: &'a str,
) -> Vec<&'a str> {
    catalog
        .platform_profiles
        .get(platform)
        .map(|profiles| profiles.iter().map(String::as_str).collect())
        .unwrap_or_else(|| vec![platform])
}

fn normalize_kind(kind: &str) -> Result<String> {
    let kind = kind.trim().to_lowercase();
    if kind.is_empty() {
        return Err(anyhow!("config kind is required"));
    }
    Ok(kind)
}

/// Resolves the device command used to fetch the given config kind for a
/// profile. Custom overrides stored in the database win over the builtin
/// catalog.
pub fn resolve_config_command(profile: &str, kind: &str) -> Result<ConfigFetchCommand> {
    let profile = canonical_profile(profile);
    let kind = normalize_kind(kind)?;
    if let Some(custom) = config_command_store::load(&profile, &kind)? {
        return Ok(ConfigFetchCommand {
            profile,
            kind,
            command: custom.command,
            mode: custom.mode,
            source: ConfigCommandSource::Custom,
        });
    }
    let catalog = catalog();
    let catalog_platform = catalog_platform_for_profile(catalog, &profile);
    let Some(commands) = catalog.platforms.get(catalog_platform) else {
        return Err(anyhow!(
            "profile '{}' has no builtin config fetch commands; add one with 'rauto config command set'",
            profile
        ));
    };
    let Some(command) = commands.get(&kind) else {
        let known: Vec<&str> = commands.keys().map(String::as_str).collect();
        return Err(anyhow!(
            "profile '{}' has no builtin config kind '{}' (available: {})",
            profile,
            kind,
            known.join(", ")
        ));
    };
    Ok(ConfigFetchCommand {
        mode: command
            .mode()
            .or_else(|| {
                catalog
                    .platform_modes
                    .get(catalog_platform)
                    .map(String::as_str)
            })
            .map(ToOwned::to_owned),
        command: command.command().to_string(),
        profile,
        kind,
        source: ConfigCommandSource::Builtin,
    })
}

/// Lists all config fetch commands (builtin merged with custom overrides),
/// optionally filtered by profile.
pub fn list_config_commands(profile: Option<&str>) -> Result<Vec<ConfigFetchCommand>> {
    let profile_filter = profile.map(canonical_profile);
    let catalog = catalog();
    let mut merged: BTreeMap<(String, String), ConfigFetchCommand> = BTreeMap::new();
    for (platform, commands) in &catalog.platforms {
        for profile in profiles_for_catalog_platform(catalog, platform) {
            if let Some(filter) = profile_filter.as_deref()
                && filter != profile
            {
                continue;
            }
            for (kind, command) in commands {
                merged.insert(
                    (profile.to_string(), kind.clone()),
                    ConfigFetchCommand {
                        profile: profile.to_string(),
                        kind: kind.clone(),
                        command: command.command().to_string(),
                        mode: command
                            .mode()
                            .or_else(|| catalog.platform_modes.get(platform).map(String::as_str))
                            .map(ToOwned::to_owned),
                        source: ConfigCommandSource::Builtin,
                    },
                );
            }
        }
    }
    for custom in config_command_store::list(profile_filter.as_deref())? {
        merged.insert(
            (custom.device_profile.clone(), custom.kind.clone()),
            ConfigFetchCommand {
                profile: custom.device_profile,
                kind: custom.kind,
                command: custom.command,
                mode: custom.mode,
                source: ConfigCommandSource::Custom,
            },
        );
    }
    Ok(merged.into_values().collect())
}

/// Builtin volatile-line patterns for a profile from the bundled catalog.
pub(crate) fn builtin_volatile_patterns(profile: &str) -> Vec<String> {
    let profile = canonical_profile(profile);
    let catalog = catalog();
    catalog
        .volatile_patterns
        .get(catalog_platform_for_profile(catalog, &profile))
        .cloned()
        .unwrap_or_default()
}

/// Returns the volatile-line patterns for a profile: builtin patterns merged
/// with user-defined additions stored in the database. Lines matching any of
/// these change on every fetch without a real configuration change.
pub fn volatile_patterns(profile: &str) -> Result<Vec<String>> {
    let profile = canonical_profile(profile);
    let mut patterns = builtin_volatile_patterns(&profile);
    for custom in config_command_store::list_volatile_patterns(Some(&profile))? {
        if !patterns.contains(&custom.pattern) {
            patterns.push(custom.pattern);
        }
    }
    Ok(patterns)
}

#[derive(Debug, Clone)]
pub struct VolatilePatternEntry {
    pub profile: String,
    pub pattern: String,
    pub source: ConfigCommandSource,
}

/// Lists volatile-line patterns (builtin merged with custom additions),
/// optionally filtered by profile, for management views.
pub fn list_volatile_patterns(profile: Option<&str>) -> Result<Vec<VolatilePatternEntry>> {
    let profile_filter = profile.map(canonical_profile);
    let mut entries = Vec::new();
    let catalog = catalog();
    for (platform, patterns) in &catalog.volatile_patterns {
        for profile in profiles_for_catalog_platform(catalog, platform) {
            if let Some(filter) = profile_filter.as_deref()
                && filter != profile
            {
                continue;
            }
            for pattern in patterns {
                entries.push(VolatilePatternEntry {
                    profile: profile.to_string(),
                    pattern: pattern.clone(),
                    source: ConfigCommandSource::Builtin,
                });
            }
        }
    }
    for custom in config_command_store::list_volatile_patterns(profile_filter.as_deref())? {
        let duplicate = entries
            .iter()
            .any(|entry| entry.profile == custom.device_profile && entry.pattern == custom.pattern);
        if !duplicate {
            entries.push(VolatilePatternEntry {
                profile: custom.device_profile,
                pattern: custom.pattern,
                source: ConfigCommandSource::Custom,
            });
        }
    }
    entries.sort_by(|a, b| (&a.profile, &a.pattern).cmp(&(&b.profile, &b.pattern)));
    Ok(entries)
}

/// Removes lines matching any volatile pattern, producing the text used for
/// drift comparison. Invalid patterns are ignored rather than failing the
/// fetch.
pub fn normalize_config(content: &str, patterns: &[String]) -> String {
    let compiled: Vec<Regex> = patterns
        .iter()
        .filter_map(|pattern| Regex::new(pattern).ok())
        .collect();
    if compiled.is_empty() {
        return content.to_string();
    }
    let mut normalized = String::with_capacity(content.len());
    for line in content.lines() {
        if compiled.iter().any(|regex| regex.is_match(line)) {
            continue;
        }
        normalized.push_str(line);
        normalized.push('\n');
    }
    normalized
}

pub fn sha256_hex(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    let digest = hasher.finalize();
    let mut hex = String::with_capacity(digest.len() * 2);
    for byte in digest {
        let _ = std::fmt::Write::write_fmt(&mut hex, format_args!("{:02x}", byte));
    }
    hex
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TestEnvGuard {
        original_home: Option<std::ffi::OsString>,
        _root: PathBuf,
    }

    impl TestEnvGuard {
        fn new() -> Result<Self> {
            let root = std::env::temp_dir().join(format!(
                "rauto-config-catalog-{}",
                SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos()
            ));
            let original_home = std::env::var_os("RAUTO_HOME");
            unsafe {
                std::env::set_var("RAUTO_HOME", &root);
            }
            Ok(Self {
                original_home,
                _root: root,
            })
        }
    }

    impl Drop for TestEnvGuard {
        fn drop(&mut self) {
            if let Some(value) = &self.original_home {
                unsafe {
                    std::env::set_var("RAUTO_HOME", value);
                }
            } else {
                unsafe {
                    std::env::remove_var("RAUTO_HOME");
                }
            }
        }
    }

    #[test]
    fn builtin_catalog_resolves_and_custom_override_wins() -> Result<()> {
        let _guard = TestEnvGuard::new()?;
        db::init_sync()?;

        let command = resolve_config_command("cisco_ios", "running")?;
        assert_eq!(command.command, "show running-config");
        assert_eq!(command.mode.as_deref(), Some("Enable"));
        assert_eq!(command.source, ConfigCommandSource::Builtin);

        for (profile, running, startup, mode) in [
            (
                "array",
                "show running-config",
                "show startup-config",
                "Enable",
            ),
            (
                "dell_os10",
                "show running-configuration",
                "show startup-configuration",
                "Enable",
            ),
            (
                "dptech",
                "display current-configuration",
                "display saved-configuration",
                "Enable",
            ),
            (
                "h3c_comware",
                "display current-configuration",
                "display saved-configuration",
                "Enable",
            ),
            (
                "hillstone_stoneos",
                "show configuration running",
                "show configuration saved",
                "Enable",
            ),
            (
                "huawei",
                "display current-configuration",
                "display saved-configuration",
                "Enable",
            ),
            (
                "leadsec_powerv",
                "display current-configuration",
                "display saved-configuration",
                "Login",
            ),
            (
                "maipu",
                "display current-configuration",
                "display saved-configuration",
                "Enable",
            ),
            (
                "qianxin",
                "display current-configuration",
                "display saved-configuration",
                "Enable",
            ),
            (
                "ruijie_os",
                "show running-config",
                "show startup-config",
                "Enable",
            ),
            (
                "topsec",
                "show running-config",
                "display saved-configuration",
                "Enable",
            ),
            (
                "venustech",
                "display current-configuration",
                "display saved-configuration",
                "Enable",
            ),
        ] {
            let command = resolve_config_command(profile, "running")?;
            assert_eq!(command.profile, profile);
            assert_eq!(command.command, running);
            assert_eq!(command.mode.as_deref(), Some(mode));
            assert_eq!(command.source, ConfigCommandSource::Builtin);

            let command = resolve_config_command(profile, "startup")?;
            assert_eq!(command.command, startup);
            assert_eq!(command.mode.as_deref(), Some(mode));
        }

        let commands = list_config_commands(None)?;
        assert!(commands.iter().any(|command| command.profile == "huawei"));
        assert!(
            commands
                .iter()
                .any(|command| command.profile == "h3c_comware")
        );
        assert!(commands.iter().any(|command| command.profile == "cisco_xe"));
        assert!(
            commands
                .iter()
                .all(|command| command.profile != "huawei_vrp")
        );

        let error = resolve_config_command("cisco_ios", "candidate")
            .expect_err("cisco_ios has no candidate config");
        let message = error.to_string();
        assert!(message.contains("running"));
        assert!(message.contains("startup"));

        let error =
            resolve_config_command("linux", "running").expect_err("linux has no config commands");
        assert!(error.to_string().contains("no builtin config fetch"));

        crate::config::config_command_store::upsert(
            "cisco_ios",
            "running",
            "show running-config full",
            Some("enable|config"),
        )?;
        let command = resolve_config_command("cisco_ios", "running")?;
        assert_eq!(command.command, "show running-config full");
        assert_eq!(command.mode.as_deref(), Some("Enable,Config"));
        assert_eq!(command.source, ConfigCommandSource::Custom);

        assert!(crate::config::config_command_store::delete(
            "cisco_ios",
            "running"
        )?);
        let command = resolve_config_command("cisco_ios", "running")?;
        assert_eq!(command.source, ConfigCommandSource::Builtin);

        crate::config::config_command_store::upsert(
            "iosxe",
            "running",
            "show running-config all",
            Some("enable"),
        )?;
        let command = resolve_config_command("cisco_xe", "running")?;
        assert_eq!(command.profile, "cisco_xe");
        assert_eq!(command.command, "show running-config all");
        assert_eq!(command.source, ConfigCommandSource::Custom);
        Ok(())
    }

    #[test]
    fn catalog_file_accepts_detailed_command_modes() -> Result<()> {
        let catalog: ConfigCatalogFile = toml::from_str(
            r#"
[platform_modes]
linux = "User"

[platforms.linux]
running = { command = "cat /etc/os-release", mode = "Root|User" }
startup = "cat /etc/profile"
"#,
        )?;
        let commands = catalog.platforms.get("linux").expect("linux commands");

        assert_eq!(
            commands.get("running").and_then(ConfigCommandConfig::mode),
            Some("Root|User")
        );
        assert_eq!(
            commands.get("running").map(ConfigCommandConfig::command),
            Some("cat /etc/os-release")
        );
        assert_eq!(
            commands.get("startup").and_then(ConfigCommandConfig::mode),
            None
        );
        assert_eq!(
            catalog.platform_modes.get("linux").map(String::as_str),
            Some("User")
        );
        Ok(())
    }

    #[test]
    fn normalize_filters_volatile_lines_and_hashes_stay_stable() {
        let patterns = builtin_volatile_patterns("cisco_ios");
        assert!(!patterns.is_empty());
        assert_eq!(builtin_volatile_patterns("cisco_xe"), patterns);
        let monday = "Building configuration...\n\
            ! Last configuration change at 09:00:00 Mon Jul 20 2026\n\
            hostname edge-1\n\
            interface Gi0/1\n";
        let tuesday = "Building configuration...\n\
            ! Last configuration change at 10:30:00 Tue Jul 21 2026\n\
            hostname edge-1\n\
            interface Gi0/1\n";
        let normalized_monday = normalize_config(monday, &patterns);
        let normalized_tuesday = normalize_config(tuesday, &patterns);
        assert_eq!(normalized_monday, normalized_tuesday);
        assert_ne!(sha256_hex(monday), sha256_hex(tuesday));
        assert_eq!(
            sha256_hex(&normalized_monday),
            sha256_hex(&normalized_tuesday)
        );
        assert!(normalized_monday.contains("hostname edge-1"));
        assert!(!normalized_monday.contains("Last configuration change"));
    }

    #[test]
    fn custom_volatile_patterns_merge_with_builtin() -> Result<()> {
        let _guard = TestEnvGuard::new()?;
        db::init_sync()?;

        let builtin_count = builtin_volatile_patterns("cisco_ios").len();
        assert!(crate::config::config_command_store::add_volatile_pattern(
            "cisco_ios",
            r"^! custom-noise .*"
        )?);
        let merged = volatile_patterns("cisco_ios")?;
        assert_eq!(merged.len(), builtin_count + 1);
        assert!(merged.contains(&r"^! custom-noise .*".to_string()));

        let content = "! custom-noise 12345\nhostname edge-1\n";
        let normalized = normalize_config(content, &merged);
        assert!(!normalized.contains("custom-noise"));
        assert!(normalized.contains("hostname edge-1"));

        crate::config::config_command_store::add_volatile_pattern("cisco_ios", "[invalid(")
            .expect_err("invalid regex must be rejected at insert time");

        assert!(
            crate::config::config_command_store::remove_volatile_pattern(
                "cisco_ios",
                r"^! custom-noise .*"
            )?
        );
        assert_eq!(volatile_patterns("cisco_ios")?.len(), builtin_count);
        Ok(())
    }

    #[test]
    fn sha256_matches_known_vector() {
        assert_eq!(
            sha256_hex(""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }
}
