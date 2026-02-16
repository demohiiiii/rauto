use anyhow::Result;
use rneter::device::DeviceHandler;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

type InteractionTuple = (String, (bool, String, bool), Vec<String>);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceProfile {
    pub name: String,
    pub prompts: Vec<PromptConfig>,
    #[serde(default)]
    pub sys_prompts: Vec<SysPromptConfig>,
    #[serde(default)]
    pub interactions: Vec<InteractionConfig>,
    pub more_patterns: Vec<String>,
    pub error_patterns: Vec<String>,
    pub transitions: Vec<TransitionConfig>,
    #[serde(default)]
    pub ignore_errors: Vec<String>,
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
    pub fn to_device_handler(&self) -> Result<DeviceHandler> {
        let prompts: Vec<(String, Vec<String>)> = self
            .prompts
            .iter()
            .map(|p| (p.state.clone(), p.patterns.clone()))
            .collect();

        let sys_prompts: Vec<(String, String, String)> = self
            .sys_prompts
            .iter()
            .map(|p| (p.state.clone(), p.sys_name_group.clone(), p.pattern.clone()))
            .collect();

        let interactions: Vec<InteractionTuple> = self
            .interactions
            .iter()
            .map(|i| {
                (
                    i.state.clone(),
                    (i.is_dynamic, i.input.clone(), i.record_input),
                    i.patterns.clone(),
                )
            })
            .collect();

        let transitions: Vec<(String, String, String, bool, bool)> = self
            .transitions
            .iter()
            .map(|t| {
                (
                    t.from.clone(),
                    t.command.clone(),
                    t.to.clone(),
                    t.is_exit,
                    t.format_sys,
                )
            })
            .collect();

        Ok(DeviceHandler::new(
            prompts,
            sys_prompts,
            interactions,
            self.more_patterns.clone(),
            self.error_patterns.clone(),
            transitions,
            self.ignore_errors.clone(),
            HashMap::new(), // dyn_param will be set later during connection or from args
        )?)
    }
}
