use crate::config::command_flow_template::CommandFlowTemplate;
use crate::config::connection_store::{SavedConnection, load_connection};
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::ssh_security::SshSecurityProfile;
use anyhow::{Result, anyhow};
use serde_json::{Map, Value};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct ConnectionParamContext {
    values: Map<String, Value>,
}

impl ConnectionParamContext {
    pub fn new(
        connection_name: Option<&str>,
        host: Option<&str>,
        username: Option<&str>,
        password: Option<&str>,
        port: Option<u16>,
        enable_password: Option<&str>,
        ssh_security: Option<SshSecurityProfile>,
        linux_shell_flavor: Option<LinuxShellFlavor>,
        device_profile: Option<&str>,
        vars: &Value,
    ) -> Self {
        let mut values = Map::new();
        if let Some(name) = connection_name.filter(|value| !value.trim().is_empty()) {
            values.insert("name".to_string(), Value::String(name.to_string()));
            values.insert(
                "connection_name".to_string(),
                Value::String(name.to_string()),
            );
        }
        if let Some(value) = host.filter(|value| !value.trim().is_empty()) {
            values.insert("host".to_string(), Value::String(value.to_string()));
        }
        if let Some(value) = username.filter(|value| !value.trim().is_empty()) {
            values.insert("username".to_string(), Value::String(value.to_string()));
        }
        if let Some(value) = password {
            values.insert("password".to_string(), Value::String(value.to_string()));
        }
        if let Some(value) = port {
            values.insert("port".to_string(), Value::Number(value.into()));
        }
        if let Some(value) = enable_password {
            values.insert(
                "enable_password".to_string(),
                Value::String(value.to_string()),
            );
        }
        if let Some(value) = ssh_security {
            values.insert("ssh_security".to_string(), Value::String(value.to_string()));
        }
        if let Some(value) = linux_shell_flavor {
            values.insert(
                "linux_shell_flavor".to_string(),
                Value::String(value.to_string()),
            );
        }
        if let Some(value) = device_profile.filter(|value| !value.trim().is_empty()) {
            values.insert(
                "device_profile".to_string(),
                Value::String(value.to_string()),
            );
        }
        if let Some(map) = vars.as_object() {
            for (key, value) in map {
                values.entry(key.clone()).or_insert_with(|| value.clone());
            }
        }
        Self { values }
    }

    fn from_saved_connection(name: &str, conn: &SavedConnection) -> Self {
        Self::new(
            Some(name),
            conn.host.as_deref(),
            conn.username.as_deref(),
            conn.password.as_deref(),
            conn.port,
            conn.enable_password.as_deref(),
            conn.ssh_security,
            conn.linux_shell_flavor,
            conn.device_profile.as_deref(),
            &conn.vars,
        )
    }

    fn lookup(&self, param_name: &str) -> Option<Value> {
        self.values
            .get(param_name)
            .cloned()
            .filter(|v| !v.is_null())
    }
}

struct CommandFlowVarResolver {
    runtime_vars: Map<String, Value>,
    current: Option<ConnectionParamContext>,
    named: HashMap<String, Option<ConnectionParamContext>>,
}

impl CommandFlowVarResolver {
    fn new(runtime_vars: Value, current: Option<ConnectionParamContext>) -> Result<Self> {
        let runtime_vars = match runtime_vars {
            Value::Null => Map::new(),
            Value::Object(map) => map,
            _ => return Err(anyhow!("command flow vars must be a JSON object")),
        };
        Ok(Self {
            runtime_vars,
            current,
            named: HashMap::new(),
        })
    }

    fn resolve_runtime_aliases(&mut self) {
        let keys: Vec<String> = self.runtime_vars.keys().cloned().collect();
        for key in keys {
            let Some(raw) = self
                .runtime_vars
                .get(&key)
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
            else {
                continue;
            };
            if let Some(resolved) = self.resolve_reference(&raw, Some(&key)) {
                self.runtime_vars.insert(key, resolved);
            }
        }
    }

    fn fill_template_vars(&mut self, template: &CommandFlowTemplate) {
        for field in &template.vars {
            let name = field.name.trim();
            if name.is_empty() {
                continue;
            }
            let missing = self
                .runtime_vars
                .get(name)
                .map(|value| value.is_null())
                .unwrap_or(true);
            if !missing {
                continue;
            }
            if let Some(resolved) = self.resolve_reference(name, None) {
                self.runtime_vars.insert(name.to_string(), resolved);
            }
        }
    }

    fn resolve_reference(
        &mut self,
        reference: &str,
        skip_runtime_key: Option<&str>,
    ) -> Option<Value> {
        if !is_reference_token(reference) {
            return None;
        }
        if let Some((connection_name, param_name)) = reference.split_once('.') {
            if connection_name.is_empty() || param_name.is_empty() {
                return None;
            }
            return self.lookup_named_connection(connection_name, param_name);
        }

        if Some(reference) != skip_runtime_key
            && let Some(value) = self.runtime_vars.get(reference).cloned()
            && !value.is_null()
        {
            return Some(value);
        }

        self.current
            .as_ref()
            .and_then(|conn| conn.lookup(reference))
    }

    fn lookup_named_connection(
        &mut self,
        connection_name: &str,
        param_name: &str,
    ) -> Option<Value> {
        if !self.named.contains_key(connection_name) {
            let loaded = load_connection(connection_name).ok().map(|saved| {
                ConnectionParamContext::from_saved_connection(connection_name, &saved)
            });
            self.named.insert(connection_name.to_string(), loaded);
        }
        self.named
            .get(connection_name)
            .and_then(|value| value.as_ref())
            .and_then(|value| value.lookup(param_name))
    }
}

pub fn resolve_runtime_var_aliases(
    runtime_vars: Value,
    current: Option<ConnectionParamContext>,
) -> Result<Value> {
    let mut resolver = CommandFlowVarResolver::new(runtime_vars, current)?;
    resolver.resolve_runtime_aliases();
    Ok(Value::Object(resolver.runtime_vars))
}

pub fn resolve_command_flow_runtime_vars(
    template: &CommandFlowTemplate,
    runtime_vars: Value,
    current: Option<ConnectionParamContext>,
) -> Result<Value> {
    let mut resolver = CommandFlowVarResolver::new(runtime_vars, current)?;
    resolver.resolve_runtime_aliases();
    resolver.fill_template_vars(template);
    Ok(Value::Object(resolver.runtime_vars))
}

fn is_reference_token(value: &str) -> bool {
    value
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.'))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::command_flow_template::parse_command_flow_template_str;
    use serde_json::json;

    #[test]
    fn resolves_plain_name_from_current_connection_when_runtime_missing() {
        let template = parse_command_flow_template_str(
            r#"
name = "demo"
[[vars]]
name = "site"
[[steps]]
command = { kind = "literal", value = "show clock" }
"#,
            None,
        )
        .expect("template");

        let current = ConnectionParamContext::new(
            Some("edge-01"),
            Some("192.168.1.1"),
            Some("admin"),
            Some("secret"),
            Some(22),
            None,
            None,
            None,
            Some("linux"),
            &json!({"site":"lab-a"}),
        );
        let resolved =
            resolve_command_flow_runtime_vars(&template, Value::Null, Some(current)).expect("ok");
        assert_eq!(resolved["site"], json!("lab-a"));
    }

    #[test]
    fn resolves_alias_value_from_current_connection() {
        let template = parse_command_flow_template_str(
            r#"
name = "demo"
[[vars]]
name = "target_host"
[[steps]]
command = { kind = "literal", value = "show clock" }
"#,
            None,
        )
        .expect("template");

        let current = ConnectionParamContext::new(
            Some("edge-01"),
            Some("192.168.1.1"),
            Some("admin"),
            Some("secret"),
            Some(22),
            None,
            None,
            None,
            Some("linux"),
            &json!({}),
        );
        let resolved = resolve_command_flow_runtime_vars(
            &template,
            json!({"target_host":"host"}),
            Some(current),
        )
        .expect("ok");
        assert_eq!(resolved["target_host"], json!("192.168.1.1"));
    }

    #[test]
    fn resolves_runtime_aliases_without_template_schema() {
        let current = ConnectionParamContext::new(
            Some("edge-01"),
            Some("192.168.1.1"),
            Some("admin"),
            Some("secret"),
            Some(22),
            None,
            None,
            None,
            Some("linux"),
            &json!({"site":"lab-a"}),
        );
        let resolved = resolve_runtime_var_aliases(
            json!({
                "target_password": "password",
                "target_site": "site"
            }),
            Some(current),
        )
        .expect("ok");
        assert_eq!(resolved["target_password"], json!("secret"));
        assert_eq!(resolved["target_site"], json!("lab-a"));
    }
}
