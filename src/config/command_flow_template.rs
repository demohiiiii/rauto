use anyhow::{Result, anyhow};
use serde_json::Value;
use std::collections::HashSet;

pub type CommandFlowTemplate = rneter::templates::CommandFlowTemplate;
pub type CommandFlowTemplateRuntime = rneter::templates::CommandFlowTemplateRuntime;
pub type CommandFlowTemplateVar = rneter::templates::CommandFlowTemplateVar;
pub type CommandFlowTemplateVarKind = rneter::templates::CommandFlowTemplateVarKind;

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
    let mut template: CommandFlowTemplate =
        toml::from_str(body).map_err(|e| anyhow!("invalid command flow template TOML: {}", e))?;
    if let Some(name) = name_override {
        template.name = name.to_string();
    }
    validate_command_flow_template_definition(&template)?;
    Ok(template)
}

pub fn normalize_command_flow_template_body(name: &str, body: &str) -> Result<String> {
    let template = parse_command_flow_template_str(body, Some(name))?;
    toml::to_string_pretty(&template).map_err(Into::into)
}

pub fn build_command_flow_runtime(
    default_mode: impl Into<String>,
    connection_name: Option<&str>,
    host: &str,
    username: &str,
    device_profile: &str,
    vars: Value,
) -> CommandFlowTemplateRuntime {
    CommandFlowTemplateRuntime {
        default_mode: Some(default_mode.into()),
        connection_name: connection_name.map(ToOwned::to_owned),
        host: Some(host.to_string()),
        username: Some(username.to_string()),
        device_profile: Some(device_profile.to_string()),
        vars,
    }
}

fn is_safe_var_name(name: &str) -> bool {
    let mut chars = name.chars();
    match chars.next() {
        Some(ch) if ch.is_ascii_alphabetic() || ch == '_' => {}
        _ => return false,
    }
    chars.all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
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
command = { kind = "concat", parts = [
  { kind = "literal", value = "copy " },
  { kind = "var", name = "protocol" }
] }
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
}
