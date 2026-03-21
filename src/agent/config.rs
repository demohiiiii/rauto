use crate::agent::report_mode::ManagerReportMode;
use crate::config::paths::rauto_home_dir;
use anyhow::{Context, Result};
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Deserialize)]
pub struct AgentConfig {
    pub manager: ManagerConfig,
    pub agent: AgentMeta,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ManagerConfig {
    pub url: String,
    pub token: Option<String>,
    pub report_mode: ManagerReportMode,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AgentMeta {
    pub name: String,
    #[serde(default = "default_heartbeat")]
    pub heartbeat_interval: u64,
    #[serde(default = "default_probe_report_interval")]
    pub probe_report_interval: u64,
}

#[derive(Debug, Clone)]
pub struct ResolvedAgentSettings {
    pub config: Option<AgentConfig>,
    pub api_token: Option<String>,
}

#[derive(Debug, Default, Clone)]
pub struct AgentCliOverrides {
    pub manager_url: Option<String>,
    pub agent_name: Option<String>,
    pub agent_token: Option<String>,
    pub report_mode: Option<ManagerReportMode>,
    pub probe_report_interval: Option<u64>,
}

#[derive(Debug, Default, Deserialize)]
struct AgentConfigFile {
    #[serde(default)]
    manager: PartialManagerConfig,
    #[serde(default)]
    agent: PartialAgentMeta,
}

#[derive(Debug, Default, Deserialize)]
struct PartialManagerConfig {
    url: Option<String>,
    token: Option<String>,
    report_mode: Option<ManagerReportMode>,
}

#[derive(Debug, Default, Deserialize)]
struct PartialAgentMeta {
    name: Option<String>,
    heartbeat_interval: Option<u64>,
    probe_report_interval: Option<u64>,
}

fn default_heartbeat() -> u64 {
    30
}

fn default_probe_report_interval() -> u64 {
    300
}

pub fn default_agent_config_path() -> PathBuf {
    rauto_home_dir().join("agent.toml")
}

#[allow(dead_code)]
pub fn load_agent_config(
    config_path: Option<PathBuf>,
    overrides: AgentCliOverrides,
) -> Result<Option<AgentConfig>> {
    Ok(resolve_agent_settings(config_path, overrides)?.config)
}

pub fn resolve_agent_settings(
    config_path: Option<PathBuf>,
    overrides: AgentCliOverrides,
) -> Result<ResolvedAgentSettings> {
    let file_config = load_agent_file(config_path)?;

    let manager_url = overrides
        .manager_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            file_config
                .as_ref()
                .and_then(|cfg| cfg.manager.url.as_deref())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
        });
    let agent_name = overrides
        .agent_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            file_config
                .as_ref()
                .and_then(|cfg| cfg.agent.name.as_deref())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
        });
    let api_token = overrides
        .agent_token
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            file_config
                .as_ref()
                .and_then(|cfg| cfg.manager.token.as_deref())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
        });
    let report_mode = overrides
        .report_mode
        .or_else(|| file_config.as_ref().and_then(|cfg| cfg.manager.report_mode))
        .unwrap_or_default();
    let heartbeat_interval = file_config
        .as_ref()
        .and_then(|cfg| cfg.agent.heartbeat_interval)
        .unwrap_or_else(default_heartbeat);
    let probe_report_interval = overrides
        .probe_report_interval
        .or_else(|| {
            file_config
                .as_ref()
                .and_then(|cfg| cfg.agent.probe_report_interval)
        })
        .unwrap_or_else(default_probe_report_interval);
    let config = match (manager_url, agent_name) {
        (Some(url), Some(name)) => Some(AgentConfig {
            manager: ManagerConfig {
                url,
                token: api_token.clone(),
                report_mode,
            },
            agent: AgentMeta {
                name,
                heartbeat_interval,
                probe_report_interval,
            },
        }),
        _ => None,
    };

    Ok(ResolvedAgentSettings { config, api_token })
}

fn load_agent_file(config_path: Option<PathBuf>) -> Result<Option<AgentConfigFile>> {
    let path = config_path.unwrap_or_else(default_agent_config_path);
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)
        .with_context(|| format!("failed to read agent config '{}'", path.display()))?;
    let parsed = toml::from_str::<AgentConfigFile>(&content)
        .with_context(|| format!("failed to parse agent config '{}'", path.display()))?;
    Ok(Some(parsed))
}

#[cfg(test)]
mod tests {
    use super::{AgentCliOverrides, resolve_agent_settings};
    use crate::agent::report_mode::ManagerReportMode;

    #[test]
    fn resolve_agent_settings_prefers_cli_values() {
        let settings = resolve_agent_settings(
            None,
            AgentCliOverrides {
                manager_url: Some("http://manager.local:3000".to_string()),
                agent_name: Some("agent-a".to_string()),
                agent_token: Some("token-a".to_string()),
                report_mode: Some(ManagerReportMode::Http),
                probe_report_interval: Some(120),
            },
        )
        .expect("settings");

        let config = settings.config.expect("config");
        assert_eq!(config.manager.url, "http://manager.local:3000");
        assert_eq!(config.agent.name, "agent-a");
        assert_eq!(config.manager.token.as_deref(), Some("token-a"));
        assert_eq!(config.manager.report_mode, ManagerReportMode::Http);
        assert_eq!(config.agent.probe_report_interval, 120);
        assert_eq!(settings.api_token.as_deref(), Some("token-a"));
    }

    #[test]
    fn resolve_agent_settings_uses_default_probe_interval() {
        let settings = resolve_agent_settings(
            None,
            AgentCliOverrides {
                manager_url: Some("http://manager.local:3000".to_string()),
                agent_name: Some("agent-a".to_string()),
                ..AgentCliOverrides::default()
            },
        )
        .expect("settings");

        let config = settings.config.expect("config");
        assert_eq!(config.manager.report_mode, ManagerReportMode::Grpc);
        assert_eq!(config.agent.probe_report_interval, 300);
    }
}
