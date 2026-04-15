use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

pub type CommandFlowTemplate = rneter::templates::CommandFlowTemplate;
pub type CommandFlowTemplateRuntime = rneter::templates::CommandFlowTemplateRuntime;
pub type CommandFlowTemplateVar = rneter::templates::CommandFlowTemplateVar;
pub type CommandFlowTemplateVarKind = rneter::templates::CommandFlowTemplateVarKind;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedCommandFlowTemplate {
    pub template: CommandFlowTemplate,
    pub current_connection_alias: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CommandFlowTemplateDocument {
    #[serde(flatten)]
    template: CommandFlowTemplate,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    current_connection_alias: Option<String>,
}

pub fn command_flow_var_kind_label(kind: CommandFlowTemplateVarKind) -> &'static str {
    match kind {
        CommandFlowTemplateVarKind::String => "string",
        CommandFlowTemplateVarKind::Secret => "secret",
        CommandFlowTemplateVarKind::Number => "number",
        CommandFlowTemplateVarKind::Boolean => "boolean",
        CommandFlowTemplateVarKind::Json => "json",
    }
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

    let mut seen = HashSet::new();
    for field in &template.vars {
        let name = field.name.trim();
        if name.is_empty() {
            return Err(anyhow!(
                "command flow template '{}' contains a var with an empty name",
                template.name
            ));
        }
        if !is_safe_var_name(name) {
            return Err(anyhow!(
                "command flow template '{}' has invalid var name '{}'",
                template.name,
                field.name
            ));
        }
        if !seen.insert(name.to_string()) {
            return Err(anyhow!(
                "command flow template '{}' contains duplicate var '{}'",
                template.name,
                field.name
            ));
        }
        if let Some(default_value) = &field.default_value {
            validate_var_value(field, default_value).map_err(|err| {
                anyhow!(
                    "command flow template '{}' has invalid default for var '{}': {}",
                    template.name,
                    field.name,
                    err
                )
            })?;
        }
    }

    Ok(())
}

pub fn parse_command_flow_template_str(
    body: &str,
    name_override: Option<&str>,
) -> Result<CommandFlowTemplate> {
    let parsed = parse_command_flow_template_with_extensions(body, name_override)?;
    Ok(parsed.template)
}

pub fn parse_command_flow_template_with_extensions(
    body: &str,
    name_override: Option<&str>,
) -> Result<ParsedCommandFlowTemplate> {
    let mut doc: CommandFlowTemplateDocument =
        toml::from_str(body).map_err(|e| anyhow!("invalid command flow template TOML: {}", e))?;
    if let Some(name) = name_override {
        doc.template.name = name.to_string();
    }
    validate_command_flow_template_definition(&doc.template)?;
    let current_connection_alias =
        normalize_current_connection_alias(doc.current_connection_alias)?;
    Ok(ParsedCommandFlowTemplate {
        template: doc.template,
        current_connection_alias,
    })
}

pub fn normalize_command_flow_template_body(name: &str, body: &str) -> Result<String> {
    let parsed = parse_command_flow_template_with_extensions(body, Some(name))?;
    let doc = CommandFlowTemplateDocument {
        template: parsed.template,
        current_connection_alias: parsed.current_connection_alias,
    };
    toml::to_string_pretty(&doc).map_err(Into::into)
}

pub fn build_command_flow_runtime(
    default_mode: Option<String>,
    connection_name: Option<&str>,
    host: &str,
    username: &str,
    device_profile: &str,
    vars: Value,
) -> CommandFlowTemplateRuntime {
    CommandFlowTemplateRuntime {
        default_mode,
        connection_name: connection_name.map(ToOwned::to_owned),
        host: Some(host.to_string()),
        username: Some(username.to_string()),
        device_profile: Some(device_profile.to_string()),
        vars,
    }
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

fn is_safe_var_name(name: &str) -> bool {
    if name.is_empty() {
        return false;
    }
    name.split('.').all(|segment| {
        !segment.is_empty()
            && segment
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-'))
    })
}

fn normalize_current_connection_alias(alias: Option<String>) -> Result<Option<String>> {
    let Some(alias) = alias.map(|value| value.trim().to_string()) else {
        return Ok(None);
    };
    if alias.is_empty() {
        return Ok(None);
    }
    if !is_safe_connection_alias(&alias) {
        return Err(anyhow!(
            "command flow template has invalid current_connection_alias '{}'",
            alias
        ));
    }
    Ok(Some(alias))
}

fn is_safe_connection_alias(alias: &str) -> bool {
    let mut chars = alias.chars();
    match chars.next() {
        Some(ch) if ch.is_ascii_alphabetic() || ch == '_' => {}
        _ => return false,
    }
    chars.all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-'))
}

fn validate_var_value(field: &CommandFlowTemplateVar, value: &Value) -> Result<()> {
    let kind_ok = match field.kind {
        CommandFlowTemplateVarKind::String | CommandFlowTemplateVarKind::Secret => {
            value.is_string()
        }
        CommandFlowTemplateVarKind::Number => value.is_number(),
        CommandFlowTemplateVarKind::Boolean => value.is_boolean(),
        CommandFlowTemplateVarKind::Json => true,
    };
    if !kind_ok {
        return Err(anyhow!(
            "expected {}",
            command_flow_var_kind_label(field.kind)
        ));
    }
    if !field.options.is_empty() && !matches!(field.kind, CommandFlowTemplateVarKind::Json) {
        let Some(text) = value.as_str() else {
            return Err(anyhow!("expected one of [{}]", field.options.join(", ")));
        };
        if !field.options.iter().any(|option| option == text) {
            return Err(anyhow!("expected one of [{}]", field.options.join(", ")));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn validates_and_normalizes_structured_template() {
        let body = r#"
name = "demo"

[[vars]]
name = "protocol"
required = true
options = ["scp", "tftp"]

[[steps]]
command = "copy {{protocol}}"
"#;

        let normalized = normalize_command_flow_template_body("demo", body).expect("normalize");
        let template = parse_command_flow_template_str(&normalized, None).expect("parse");
        let flow = template
            .to_command_flow(
                &CommandFlowTemplateRuntime::new()
                    .with_default_mode("Enable")
                    .with_vars(json!({"protocol": "scp"})),
            )
            .expect("render");

        assert_eq!(flow.steps.len(), 1);
        assert_eq!(flow.steps[0].command, "copy scp");
    }

    #[test]
    fn accepts_connection_scoped_var_names() {
        let body = r#"
name = "demo"

[[vars]]
name = "edge-94.password"

[[steps]]
command = "echo {{edge-94.password}}"
"#;
        let normalized = normalize_command_flow_template_body("demo", body).expect("normalize");
        let parsed = parse_command_flow_template_str(&normalized, None).expect("parse");
        assert_eq!(parsed.vars[0].name, "edge-94.password");
    }

    #[test]
    fn parses_current_connection_alias_extension() {
        let body = r#"
name = "demo"
current_connection_alias = "current"
[[steps]]
command = "echo {{current.host}}"
"#;
        let parsed =
            parse_command_flow_template_with_extensions(body, Some("demo")).expect("parse");
        assert_eq!(parsed.current_connection_alias.as_deref(), Some("current"));
    }

    #[test]
    fn rejects_invalid_current_connection_alias() {
        let body = r#"
name = "demo"
current_connection_alias = "bad.alias"
[[steps]]
command = "show clock"
"#;
        let err = parse_command_flow_template_with_extensions(body, None).expect_err("invalid");
        assert!(
            err.to_string().contains("current_connection_alias"),
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
}
