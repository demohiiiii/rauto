use anyhow::{Result, anyhow};
use rneter::session::{
    Command, CommandDynamicParams, CommandFlow, CommandInteraction, MultilineMode,
    PromptResponseRule,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

const CISCO_LIKE_COPY_TEMPLATE_TOML: &str =
    include_str!("../../templates/examples/cisco-like-command-flow.toml");

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CommandFlowTemplate {
    pub name: String,
    #[serde(default = "default_true")]
    pub stop_on_error: bool,
    #[serde(default)]
    pub default_mode: Option<String>,
    #[serde(default)]
    pub steps: Vec<CommandFlowTemplateStep>,
}

impl CommandFlowTemplate {
    pub fn to_command_flow(&self, runtime: &CommandFlowTemplateRuntime) -> Result<CommandFlow> {
        render_command_flow_template(self, runtime)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CommandFlowTemplateStep {
    pub command: String,
    #[serde(default)]
    pub multiline_mode: MultilineMode,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub timeout_secs: Option<u64>,
    #[serde(default)]
    pub prompts: Vec<CommandFlowTemplatePrompt>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CommandFlowTemplatePrompt {
    pub patterns: Vec<String>,
    pub response: String,
    #[serde(default)]
    pub append_newline: bool,
    #[serde(default)]
    pub record_input: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct CommandFlowTemplateRuntime {
    #[serde(default)]
    pub default_mode: Option<String>,
    #[serde(default)]
    pub vars: Value,
}

fn render_value_as_text(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(value) => value.clone(),
        Value::Number(value) => value.to_string(),
        Value::Bool(value) => value.to_string(),
        other => other.to_string(),
    }
}

fn render_inline_template(template: &str, values: &Map<String, Value>) -> Result<String> {
    let mut output = String::new();
    let mut rest = template;

    while let Some(start) = rest.find("{{") {
        output.push_str(&rest[..start]);
        let after_start = &rest[start + 2..];
        let Some(end) = after_start.find("}}") else {
            output.push_str(&rest[start..]);
            rest = "";
            break;
        };
        let raw_name = &after_start[..end];
        let name = raw_name.trim();
        if name.is_empty() {
            output.push_str("{{");
            output.push_str(raw_name);
            output.push_str("}}");
        } else if let Some(value) = values.get(name).filter(|value| !value.is_null()) {
            output.push_str(&render_value_as_text(value));
        } else {
            return Err(anyhow!("missing command flow template var '{name}'"));
        }
        rest = &after_start[end + 2..];
    }

    output.push_str(rest);
    Ok(output)
}

fn command_flow_template_values(
    template: &CommandFlowTemplate,
    runtime: &CommandFlowTemplateRuntime,
) -> Result<Map<String, Value>> {
    let mut values = match &runtime.vars {
        Value::Null => Map::new(),
        Value::Object(values) => values.clone(),
        _ => return Err(anyhow!("command flow template vars must be a JSON object")),
    };
    if let Some(default_mode) = runtime
        .default_mode
        .clone()
        .or_else(|| template.default_mode.clone())
    {
        values.insert("default_mode".to_string(), Value::String(default_mode));
    }
    Ok(values)
}

pub fn render_command_flow_template(
    template: &CommandFlowTemplate,
    runtime: &CommandFlowTemplateRuntime,
) -> Result<CommandFlow> {
    validate_command_flow_template_definition(template)?;
    let values = command_flow_template_values(template, runtime)?;
    let fallback_mode = runtime
        .default_mode
        .as_deref()
        .or(template.default_mode.as_deref())
        .unwrap_or_default()
        .to_string();
    let mut steps = Vec::with_capacity(template.steps.len());

    for step in &template.steps {
        let command = render_inline_template(&step.command, &values)?;
        if command.trim().is_empty() {
            return Err(anyhow!(
                "command flow template '{}' rendered an empty command",
                template.name
            ));
        }
        let mode = match step.mode.as_deref() {
            Some(mode) => {
                let rendered = render_inline_template(mode, &values)?;
                let rendered = rendered.trim();
                if rendered.is_empty() {
                    fallback_mode.clone()
                } else {
                    rendered.to_string()
                }
            }
            None => fallback_mode.clone(),
        };
        let mut prompts = Vec::with_capacity(step.prompts.len());
        for prompt in &step.prompts {
            if prompt.patterns.is_empty() {
                return Err(anyhow!(
                    "command flow template '{}' contains a prompt with no patterns",
                    template.name
                ));
            }
            let mut response = render_inline_template(&prompt.response, &values)?;
            if prompt.append_newline {
                response.push('\n');
            }
            prompts.push(
                PromptResponseRule::new(prompt.patterns.clone(), response)
                    .with_record_input(prompt.record_input),
            );
        }
        steps.push(Command {
            mode,
            command,
            multiline_mode: step.multiline_mode,
            timeout: step.timeout_secs,
            dyn_params: CommandDynamicParams::default(),
            interaction: CommandInteraction { prompts },
        });
    }

    Ok(CommandFlow {
        steps,
        stop_on_error: template.stop_on_error,
        max_steps: None,
    })
}

pub fn cisco_like_copy_command_flow_template() -> Result<CommandFlowTemplate> {
    parse_command_flow_template(CISCO_LIKE_COPY_TEMPLATE_TOML, Some("cisco_like_copy"))
}

pub fn validate_command_flow_template_definition(template: &CommandFlowTemplate) -> Result<()> {
    if template.name.trim().is_empty() {
        return Err(anyhow!("command flow template name cannot be empty"));
    }
    if template.steps.is_empty() {
        return Err(anyhow!(
            "command flow template '{}' has no steps",
            template.name
        ));
    }

    Ok(())
}

#[cfg(test)]
pub fn parse_command_flow_template_str(
    body: &str,
    name_override: Option<&str>,
) -> Result<CommandFlowTemplate> {
    parse_command_flow_template(body, name_override)
}

pub fn parse_command_flow_template(
    body: &str,
    name_override: Option<&str>,
) -> Result<CommandFlowTemplate> {
    let root: toml::Table =
        toml::from_str(body).map_err(|e| anyhow!("invalid command flow template TOML: {}", e))?;
    if root.contains_key("current_connection_alias") {
        return Err(anyhow!(
            "unsupported command flow field: current_connection_alias"
        ));
    }
    let mut template: CommandFlowTemplate =
        toml::from_str(body).map_err(|e| anyhow!("invalid command flow template TOML: {}", e))?;
    if let Some(name) = name_override {
        template.name = name.to_string();
    }
    validate_command_flow_template_definition(&template)?;
    Ok(template)
}

pub fn normalize_command_flow_template_body(name: &str, body: &str) -> Result<String> {
    let template = parse_command_flow_template(body, Some(name))?;
    toml::to_string_pretty(&template).map_err(Into::into)
}

pub fn build_command_flow_runtime(
    default_mode: Option<String>,
    vars: Value,
) -> CommandFlowTemplateRuntime {
    CommandFlowTemplateRuntime { default_mode, vars }
}

pub fn resolve_command_flow_runtime_default_mode(
    requested_mode: Option<&str>,
    template_default_mode: Option<&str>,
    profile_default_mode: &str,
) -> Option<String> {
    if let Some(mode) = requested_mode
        .map(str::trim)
        .filter(|mode| !mode.is_empty())
    {
        return Some(mode.to_string());
    }

    if template_default_mode
        .map(str::trim)
        .is_some_and(|mode| !mode.is_empty())
    {
        return None;
    }

    Some(profile_default_mode.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rneter::session::MultilineMode;
    use serde_json::json;

    #[test]
    fn command_flow_template_renders_multiline_modes() {
        let template = parse_command_flow_template_str(
            r#"
name = "multiline"

[[steps]]
command = "show version\nshow inventory"
multiline_mode = "split_lines"

[[steps]]
command = "cat <<'EOF'\na\nb\nEOF"
multiline_mode = "whole"
"#,
            None,
        )
        .expect("parse template");

        let flow = template
            .to_command_flow(&CommandFlowTemplateRuntime::default())
            .expect("render flow");

        assert_eq!(flow.steps[0].multiline_mode, MultilineMode::SplitLines);
        assert_eq!(flow.steps[1].multiline_mode, MultilineMode::Whole);
    }

    #[test]
    fn command_flow_template_defaults_multiline_mode_to_split_lines() {
        let template = parse_command_flow_template_str(
            r#"
name = "default-multiline"

[[steps]]
command = "show version"
"#,
            None,
        )
        .expect("parse template");

        let flow = template
            .to_command_flow(&CommandFlowTemplateRuntime::default())
            .expect("render flow");

        assert_eq!(flow.steps[0].multiline_mode, MultilineMode::SplitLines);
    }

    #[test]
    fn validates_and_normalizes_structured_template() {
        let body = r#"
name = "demo"
description = "legacy description"

[[steps]]
command = "copy {{protocol}}"
"#;

        let normalized = normalize_command_flow_template_body("demo", body).expect("normalize");
        assert!(!normalized.contains("description"));
        let template = parse_command_flow_template_str(&normalized, None).expect("parse");
        let runtime =
            build_command_flow_runtime(Some("Enable".to_string()), json!({"protocol": "scp"}));
        let flow = template.to_command_flow(&runtime).expect("render");

        assert_eq!(flow.steps.len(), 1);
        assert_eq!(flow.steps[0].command, "copy scp");
    }

    #[test]
    fn accepts_connection_scoped_inline_references() {
        let body = r#"
name = "demo"

[[steps]]
command = "echo {{edge-94.password}}"
"#;
        let normalized = normalize_command_flow_template_body("demo", body).expect("normalize");
        let parsed = parse_command_flow_template_str(&normalized, None).expect("parse");
        let serialized = toml::to_string(&parsed).expect("serialize");
        assert!(serialized.contains("edge-94.password"));
    }

    #[test]
    fn rejects_removed_current_connection_alias() {
        let body = r#"
name = "demo"
current_connection_alias = "current"
[[steps]]
command = "echo {{current.host}}"
"#;
        let err =
            parse_command_flow_template(body, Some("demo")).expect_err("removed alias must fail");
        assert!(
            err.to_string().contains("unsupported command flow field"),
            "unexpected error: {err}"
        );
    }

    #[test]
    fn runtime_default_mode_uses_request_override_first() {
        let mode = resolve_command_flow_runtime_default_mode(Some("Root"), Some("User"), "Enable");
        assert_eq!(mode.as_deref(), Some("Root"));
    }

    #[test]
    fn runtime_default_mode_prefers_template_default_when_no_override() {
        let mode = resolve_command_flow_runtime_default_mode(None, Some("User"), "Enable");
        assert!(mode.is_none());
    }

    #[test]
    fn runtime_default_mode_falls_back_to_profile_default() {
        let mode = resolve_command_flow_runtime_default_mode(None, None, "Enable");
        assert_eq!(mode.as_deref(), Some("Enable"));
    }

    #[test]
    fn command_flow_runtime_contains_only_mode_and_explicit_vars() {
        let vars = json!({"host":"192.0.2.10", "username":"admin"});
        let runtime = build_command_flow_runtime(Some("Enable".to_string()), vars.clone());

        assert_eq!(runtime.default_mode.as_deref(), Some("Enable"));
        assert_eq!(runtime.vars, vars);
    }

    #[test]
    fn rauto_renders_command_flow_templates_into_concrete_flows() {
        let template = parse_command_flow_template_str(
            r#"
name = "deploy"
default_mode = "Enable"

[[steps]]
command = "copy {{protocol}}: {{path}}"
timeout_secs = 120

[[steps.prompts]]
patterns = ["(?i)^Proceed\\?$"]
response = "{{answer}}"
append_newline = true
record_input = true
"#,
            None,
        )
        .expect("parse template");
        let runtime = build_command_flow_runtime(
            None,
            json!({"protocol": "scp", "path": "flash:/image.bin", "answer": "yes"}),
        );

        let flow = render_command_flow_template(&template, &runtime).expect("render flow");

        assert_eq!(flow.steps.len(), 1);
        assert_eq!(flow.steps[0].mode, "Enable");
        assert_eq!(flow.steps[0].command, "copy scp: flash:/image.bin");
        assert_eq!(flow.steps[0].timeout, Some(120));
        assert_eq!(flow.steps[0].interaction.prompts.len(), 1);
        assert_eq!(flow.steps[0].interaction.prompts[0].response, "yes\n");
        assert!(flow.steps[0].interaction.prompts[0].record_input);
    }

    #[test]
    fn rauto_owns_and_renders_the_cisco_like_copy_template() {
        let template = cisco_like_copy_command_flow_template().expect("built-in template");
        let runtime = build_command_flow_runtime(
            None,
            json!({
                "command": "copy scp: flash:/image.bin",
                "server_addr": "192.0.2.10",
                "remote_path": "/images/image.bin",
                "transfer_username": "deploy",
                "transfer_password": "secret",
                "overwrite_answer": "y"
            }),
        );

        let flow = render_command_flow_template(&template, &runtime).expect("render flow");

        assert_eq!(template.name, "cisco_like_copy");
        assert_eq!(flow.steps.len(), 1);
        assert_eq!(flow.steps[0].interaction.prompts.len(), 7);
        assert_eq!(
            flow.steps[0].interaction.prompts[0].response,
            "192.0.2.10\n"
        );
        assert_eq!(flow.steps[0].interaction.prompts[4].response, "secret\n");
        assert_eq!(flow.steps[0].interaction.prompts[5].response, "\n");
    }
}
