use anyhow::Result;
use rneter::device::{
    DeviceCommandExecutionConfig, DeviceHandler, DeviceHandlerConfig, DeviceInputRule,
    DevicePromptRule, DevicePromptWithSysRule, DeviceShellFlavor, DeviceTransitionRule,
};
use rneter::session::SessionHooks;
use rneter::templates::TemplateDetectProfile;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceProfile {
    pub name: String,
    pub prompts: Vec<PromptConfig>,
    #[serde(default)]
    pub sys_prompts: Vec<SysPromptConfig>,
    #[serde(default)]
    pub prompt_prefix: Vec<String>,
    #[serde(default)]
    pub interactions: Vec<InteractionConfig>,
    pub more_patterns: Vec<String>,
    pub error_patterns: Vec<String>,
    pub transitions: Vec<TransitionConfig>,
    #[serde(default)]
    pub ignore_errors: Vec<String>,
    #[serde(default)]
    pub hooks: SessionHooks,
    #[serde(default)]
    pub command_execution: DeviceCommandExecutionConfig,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detect_profile: Option<TemplateDetectProfile>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PromptConfig {
    pub state: String,
    pub patterns: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SysPromptConfig {
    pub state: String,
    pub sys_name_group: String,
    pub pattern: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InteractionConfig {
    pub state: String,
    pub input: String,
    #[serde(default)]
    pub is_dynamic: bool,
    #[serde(default = "default_true")]
    pub record_input: bool,
    pub patterns: Vec<String>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TransitionConfig {
    pub from: String,
    pub command: String,
    pub to: String,
    #[serde(default)]
    pub is_exit: bool,
    #[serde(default)]
    pub format_sys: bool,
}

impl DeviceProfile {
    pub fn available_modes(&self) -> Vec<String> {
        let mut modes = Vec::new();
        for prompt in &self.prompts {
            if !prompt.state.trim().is_empty() && !modes.iter().any(|m| m == &prompt.state) {
                modes.push(prompt.state.clone());
            }
        }
        for prompt in &self.sys_prompts {
            if !prompt.state.trim().is_empty() && !modes.iter().any(|m| m == &prompt.state) {
                modes.push(prompt.state.clone());
            }
        }
        modes
    }

    pub fn default_mode(&self) -> String {
        self.available_modes()
            .into_iter()
            .next()
            .unwrap_or_else(|| "Enable".to_string())
    }

    pub fn to_device_handler(&self) -> Result<DeviceHandler> {
        Ok(DeviceHandler::from_config(
            &self.to_device_handler_config(),
        )?)
    }

    pub fn to_device_handler_config(&self) -> DeviceHandlerConfig {
        DeviceHandlerConfig {
            prompt: self
                .prompts
                .iter()
                .map(|p| DevicePromptRule {
                    state: p.state.clone(),
                    patterns: p.patterns.clone(),
                })
                .collect(),
            prompt_with_sys: self
                .sys_prompts
                .iter()
                .map(|p| DevicePromptWithSysRule {
                    state: p.state.clone(),
                    capture_group: p.sys_name_group.clone(),
                    pattern: p.pattern.clone(),
                })
                .collect(),
            prompt_prefix: self.prompt_prefix.clone(),
            write: self
                .interactions
                .iter()
                .map(|i| DeviceInputRule {
                    state: i.state.clone(),
                    dynamic: i.is_dynamic,
                    value: i.input.clone(),
                    record_input: i.record_input,
                    patterns: i.patterns.clone(),
                })
                .collect(),
            more_regex: self.more_patterns.clone(),
            error_regex: self.error_patterns.clone(),
            edges: self
                .transitions
                .iter()
                .map(|t| DeviceTransitionRule {
                    from_state: t.from.clone(),
                    command: t.command.clone(),
                    to_state: t.to.clone(),
                    is_exit: t.is_exit,
                    needs_format: t.format_sys,
                })
                .collect(),
            ignore_errors: self.ignore_errors.clone(),
            dyn_param: HashMap::new(),
            hooks: self.hooks.clone(),
            command_execution: self.command_execution.clone(),
        }
    }

    pub fn apply_shell_flavor_override(&mut self, shell_flavor: DeviceShellFlavor) {
        if let DeviceCommandExecutionConfig::ShellExitStatus {
            marker: _,
            shell_flavor: current,
        } = &mut self.command_execution
        {
            *current = shell_flavor;
        }
    }

    pub fn from_handler_config(name: String, config: DeviceHandlerConfig) -> Self {
        Self {
            name,
            prompts: config
                .prompt
                .into_iter()
                .map(|p| PromptConfig {
                    state: p.state,
                    patterns: p.patterns,
                })
                .collect(),
            sys_prompts: config
                .prompt_with_sys
                .into_iter()
                .map(|p| SysPromptConfig {
                    state: p.state,
                    sys_name_group: p.capture_group,
                    pattern: p.pattern,
                })
                .collect(),
            prompt_prefix: config.prompt_prefix,
            interactions: config
                .write
                .into_iter()
                .map(|i| InteractionConfig {
                    state: i.state,
                    input: i.value,
                    is_dynamic: i.dynamic,
                    record_input: i.record_input,
                    patterns: i.patterns,
                })
                .collect(),
            more_patterns: config.more_regex,
            error_patterns: config.error_regex,
            transitions: config
                .edges
                .into_iter()
                .map(|t| TransitionConfig {
                    from: t.from_state,
                    command: t.command,
                    to: t.to_state,
                    is_exit: t.is_exit,
                    format_sys: t.needs_format,
                })
                .collect(),
            ignore_errors: config.ignore_errors,
            hooks: config.hooks,
            command_execution: config.command_execution,
            detect_profile: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rneter::session::{Command, HookAction, SessionOperation};

    fn sample_profile_with_hook() -> DeviceProfile {
        DeviceProfile {
            name: "sample".to_string(),
            prompts: vec![PromptConfig {
                state: "Root".to_string(),
                patterns: vec![r"^root#\s*$".to_string()],
            }],
            sys_prompts: Vec::new(),
            prompt_prefix: Vec::new(),
            interactions: Vec::new(),
            more_patterns: Vec::new(),
            error_patterns: Vec::new(),
            transitions: Vec::new(),
            ignore_errors: Vec::new(),
            hooks: SessionHooks {
                after_connect: vec![HookAction::new(
                    "disable-paging",
                    SessionOperation::from(Command {
                        mode: "Root".to_string(),
                        command: "stty -echo".to_string(),
                        ..Command::default()
                    }),
                )],
                ..SessionHooks::default()
            },
            command_execution: DeviceCommandExecutionConfig::PromptDriven,
            detect_profile: None,
        }
    }

    #[test]
    fn device_profile_passes_hooks_to_device_handler() {
        let profile = sample_profile_with_hook();
        let handler = profile.to_device_handler().expect("device handler");

        assert_eq!(handler.hooks().after_connect.len(), 1);
        assert_eq!(handler.hooks().after_connect[0].name, "disable-paging");
    }

    #[test]
    fn device_profile_toml_roundtrip_preserves_hooks() {
        let profile = sample_profile_with_hook();
        let toml = toml::to_string_pretty(&profile).expect("serialize profile");
        let parsed: DeviceProfile = toml::from_str(&toml).expect("parse profile");

        assert_eq!(parsed.hooks.after_connect.len(), 1);
        assert_eq!(parsed.hooks.after_connect[0].name, "disable-paging");
    }
}
