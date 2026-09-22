use anyhow::{Result, anyhow};
use rneter::session::{
    Command, CommandDynamicParams, CommandFlow as ExecutionSequence, CommandInteraction,
    MultilineMode, PromptResponseRule,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

const CISCO_LIKE_COPY_TEMPLATE_TOML: &str =
    include_str!("../../../templates/examples/cisco-like-interactive.toml");

/// One command definition with its interactive prompt/response rules.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct InteractiveTemplate {
    pub name: String,
    #[serde(flatten)]
    pub operation: InteractiveCommandDefinition,
}

impl InteractiveTemplate {
    pub fn to_execution_sequence(
        &self,
        runtime: &InteractiveTemplateRuntime,
    ) -> Result<ExecutionSequence> {
        render_interactive_template(self, runtime)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct InteractiveCommandDefinition {
    pub command: String,
    #[serde(default)]
    pub multiline_mode: MultilineMode,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub timeout_secs: Option<u64>,
    #[serde(default)]
    pub prompts: Vec<InteractiveTemplatePrompt>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct InteractiveTemplatePrompt {
    pub patterns: Vec<String>,
    pub response: String,
    #[serde(default)]
    pub append_newline: bool,
    #[serde(default)]
    pub record_input: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct InteractiveTemplateRuntime {
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
            return Err(anyhow!("missing interactive command template var '{name}'"));
        }
        rest = &after_start[end + 2..];
    }

    output.push_str(rest);
    Ok(output)
}

fn interactive_template_values(
    template: &InteractiveTemplate,
    runtime: &InteractiveTemplateRuntime,
) -> Result<Map<String, Value>> {
    let mut values = match &runtime.vars {
        Value::Null => Map::new(),
        Value::Object(values) => values.clone(),
        _ => {
            return Err(anyhow!(
                "interactive command template vars must be a JSON object"
            ));
        }
    };
    if let Some(default_mode) = runtime
        .default_mode
        .clone()
        .or_else(|| template.operation.mode.clone())
    {
        values.insert("default_mode".to_string(), Value::String(default_mode));
    }
    Ok(values)
}

pub fn render_interactive_template(
    template: &InteractiveTemplate,
    runtime: &InteractiveTemplateRuntime,
) -> Result<ExecutionSequence> {
    validate_interactive_template_definition(template)?;
    let values = interactive_template_values(template, runtime)?;
    let fallback_mode = runtime
        .default_mode
        .as_deref()
        .or(template.operation.mode.as_deref())
        .unwrap_or_default()
        .to_string();
    let step = &template.operation;
    let command = render_inline_template(&step.command, &values)?;
    if command.trim().is_empty() {
        return Err(anyhow!(
            "interactive command template '{}' rendered an empty command",
            template.name
        ));
    }
    let mode = render_inline_template(&fallback_mode, &values)?;
    let mut prompts = Vec::with_capacity(step.prompts.len());
    for prompt in &step.prompts {
        if prompt.patterns.is_empty() {
            return Err(anyhow!(
                "interactive command template '{}' contains a prompt with no patterns",
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
    let command = Command {
        mode,
        command,
        multiline_mode: step.multiline_mode,
        timeout: step.timeout_secs,
        dyn_params: CommandDynamicParams::default(),
        interaction: CommandInteraction { prompts },
    };
    Ok(ExecutionSequence {
        steps: vec![command],
        stop_on_error: true,
        max_steps: None,
    })
}

pub fn cisco_like_copy_interactive_template() -> Result<InteractiveTemplate> {
    parse_interactive_template(CISCO_LIKE_COPY_TEMPLATE_TOML, Some("cisco_like_copy"))
}

pub fn validate_interactive_template_definition(template: &InteractiveTemplate) -> Result<()> {
    if template.name.trim().is_empty() {
        return Err(anyhow!("interactive command template name cannot be empty"));
    }

    Ok(())
}

pub fn parse_interactive_template_str(
    body: &str,
    name_override: Option<&str>,
) -> Result<InteractiveTemplate> {
    parse_interactive_template(body, name_override)
}

pub fn parse_interactive_template(
    body: &str,
    name_override: Option<&str>,
) -> Result<InteractiveTemplate> {
    let root: toml::Table = toml::from_str(body)
        .map_err(|e| anyhow!("invalid interactive command template TOML: {}", e))?;
    for key in root.keys() {
        if !matches!(
            key.as_str(),
            "name" | "command" | "mode" | "multiline_mode" | "timeout_secs" | "prompts"
        ) {
            return Err(anyhow!("unsupported interactive command field: {}", key));
        }
    }
    let mut template: InteractiveTemplate = toml::Value::Table(root)
        .try_into()
        .map_err(|e| anyhow!("invalid interactive command template TOML: {}", e))?;
    if let Some(name) = name_override {
        template.name = name.to_string();
    }
    validate_interactive_template_definition(&template)?;
    Ok(template)
}

pub fn normalize_interactive_template_body(name: &str, body: &str) -> Result<String> {
    let template = parse_interactive_template(body, Some(name))?;
    toml::to_string_pretty(&template).map_err(Into::into)
}

pub fn build_interactive_runtime(
    default_mode: Option<String>,
    vars: Value,
) -> InteractiveTemplateRuntime {
    InteractiveTemplateRuntime { default_mode, vars }
}

pub fn resolve_interactive_runtime_default_mode(
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
    fn interactive_template_renders_multiline_modes() {
        for (mode, expected) in [
            ("split_lines", MultilineMode::SplitLines),
            ("whole", MultilineMode::Whole),
        ] {
            let body = format!(
                "name = \"multiline\"\ncommand = \"show version\\nshow inventory\"\nmultiline_mode = \"{mode}\""
            );
            let template = parse_interactive_template_str(&body, None).expect("parse template");
            let interactive = template
                .to_execution_sequence(&InteractiveTemplateRuntime::default())
                .expect("render command");
            assert_eq!(interactive.steps.len(), 1);
            assert_eq!(interactive.steps[0].multiline_mode, expected);
            assert_eq!(interactive.steps[0].command, "show version\nshow inventory");
        }
    }

    #[test]
    fn interactive_template_defaults_multiline_mode_to_split_lines() {
        let template = parse_interactive_template_str(
            r#"
name = "default-multiline"

command = "show version"
"#,
            None,
        )
        .expect("parse template");

        let interactive = template
            .to_execution_sequence(&InteractiveTemplateRuntime::default())
            .expect("render interactive");

        assert_eq!(
            interactive.steps[0].multiline_mode,
            MultilineMode::SplitLines
        );
    }

    #[test]
    fn validates_and_normalizes_structured_template() {
        let body = r#"
name = "demo"

command = "copy {{protocol}}"
"#;

        let normalized = normalize_interactive_template_body("demo", body).expect("normalize");
        assert!(!normalized.contains("description"));
        let template = parse_interactive_template_str(&normalized, None).expect("parse");
        let runtime =
            build_interactive_runtime(Some("Enable".to_string()), json!({"protocol": "scp"}));
        let interactive = template.to_execution_sequence(&runtime).expect("render");

        assert_eq!(interactive.steps.len(), 1);
        assert_eq!(interactive.steps[0].command, "copy scp");
    }

    #[test]
    fn accepts_connection_scoped_inline_references() {
        let body = r#"
name = "demo"

command = "echo {{edge-94.password}}"
"#;
        let normalized = normalize_interactive_template_body("demo", body).expect("normalize");
        let parsed = parse_interactive_template_str(&normalized, None).expect("parse");
        let serialized = toml::to_string(&parsed).expect("serialize");
        assert!(serialized.contains("edge-94.password"));
    }

    #[test]
    fn rejects_removed_current_connection_alias() {
        let body = r#"
name = "demo"
current_connection_alias = "current"
command = "echo {{current.host}}"
"#;
        let err =
            parse_interactive_template(body, Some("demo")).expect_err("removed alias must fail");
        assert!(
            err.to_string()
                .contains("unsupported interactive command field"),
            "unexpected error: {err}"
        );
    }

    #[test]
    fn rejects_legacy_template_fields() {
        for field in [
            "steps = []",
            "default_mode = \"Enable\"",
            "stop_on_error = true",
            "description = \"old\"",
        ] {
            let body = format!("name = \"demo\"\ncommand = \"show version\"\n{field}");
            assert!(
                parse_interactive_template(&body, None)
                    .unwrap_err()
                    .to_string()
                    .contains("unsupported interactive command field")
            );
        }
    }

    #[test]
    fn rejects_unknown_prompt_fields() {
        let body = r#"name = "demo"
command = "copy image"
[[prompts]]
patterns = ["Continue?"]
response = "yes"
unexpected = true
"#;
        assert!(
            parse_interactive_template(body, None)
                .unwrap_err()
                .to_string()
                .contains("unknown field")
        );
    }

    #[test]
    fn runtime_override_applies_to_the_single_command() {
        let template = parse_interactive_template(
            "name = \"demo\"\ncommand = \"show version\"\nmode = \"User\"",
            None,
        )
        .unwrap();
        let interactive = template
            .to_execution_sequence(&build_interactive_runtime(Some("Enable".into()), json!({})))
            .unwrap();
        assert_eq!(interactive.steps.len(), 1);
        assert_eq!(interactive.steps[0].mode, "Enable");
        assert!(interactive.stop_on_error);
    }

    #[test]
    fn runtime_default_mode_uses_request_override_first() {
        let mode = resolve_interactive_runtime_default_mode(Some("Root"), Some("User"), "Enable");
        assert_eq!(mode.as_deref(), Some("Root"));
    }

    #[test]
    fn runtime_default_mode_prefers_template_default_when_no_override() {
        let mode = resolve_interactive_runtime_default_mode(None, Some("User"), "Enable");
        assert!(mode.is_none());
    }

    #[test]
    fn runtime_default_mode_falls_back_to_profile_default() {
        let mode = resolve_interactive_runtime_default_mode(None, None, "Enable");
        assert_eq!(mode.as_deref(), Some("Enable"));
    }

    #[test]
    fn interactive_runtime_contains_only_mode_and_explicit_vars() {
        let vars = json!({"host":"192.0.2.10", "username":"admin"});
        let runtime = build_interactive_runtime(Some("Enable".to_string()), vars.clone());

        assert_eq!(runtime.default_mode.as_deref(), Some("Enable"));
        assert_eq!(runtime.vars, vars);
    }

    #[test]
    fn rauto_renders_interactive_templates_into_execution_sequences() {
        let template = parse_interactive_template_str(
            r#"
name = "deploy"
mode = "Enable"

command = "copy {{protocol}}: {{path}}"
timeout_secs = 120

[[prompts]]
patterns = ["(?i)^Proceed\\?$"]
response = "{{answer}}"
append_newline = true
record_input = true
"#,
            None,
        )
        .expect("parse template");
        let runtime = build_interactive_runtime(
            None,
            json!({"protocol": "scp", "path": "flash:/image.bin", "answer": "yes"}),
        );

        let interactive =
            render_interactive_template(&template, &runtime).expect("render interactive");

        assert_eq!(interactive.steps.len(), 1);
        assert_eq!(interactive.steps[0].mode, "Enable");
        assert_eq!(interactive.steps[0].command, "copy scp: flash:/image.bin");
        assert_eq!(interactive.steps[0].timeout, Some(120));
        assert_eq!(interactive.steps[0].interaction.prompts.len(), 1);
        assert_eq!(
            interactive.steps[0].interaction.prompts[0].response,
            "yes\n"
        );
        assert!(interactive.steps[0].interaction.prompts[0].record_input);
    }

    #[test]
    fn rauto_owns_and_renders_the_cisco_like_copy_template() {
        let template = cisco_like_copy_interactive_template().expect("built-in template");
        let runtime = build_interactive_runtime(
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

        let interactive =
            render_interactive_template(&template, &runtime).expect("render interactive");

        assert_eq!(template.name, "cisco_like_copy");
        assert_eq!(interactive.steps.len(), 1);
        assert_eq!(interactive.steps[0].interaction.prompts.len(), 7);
        assert_eq!(
            interactive.steps[0].interaction.prompts[0].response,
            "192.0.2.10\n"
        );
        assert_eq!(
            interactive.steps[0].interaction.prompts[4].response,
            "secret\n"
        );
        assert_eq!(interactive.steps[0].interaction.prompts[5].response, "\n");
    }
}
