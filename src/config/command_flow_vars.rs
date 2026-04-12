use crate::config::command_flow_template::CommandFlowTemplate;
use crate::config::connection_store::{SavedConnection, load_connection};
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::ssh_security::SshSecurityProfile;
use anyhow::{Result, anyhow};
use serde_json::{Map, Value};
use std::collections::{HashMap, HashSet};

const CURRENT_CONNECTION_ALIAS_SENTINEL: &str = "__rauto_current_connection__";

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

    fn bind_current_connection_alias(&mut self, alias: Option<&str>) {
        let Some(alias) = alias.map(str::trim).filter(|value| !value.is_empty()) else {
            return;
        };
        self.runtime_vars.insert(
            alias.to_string(),
            Value::String(CURRENT_CONNECTION_ALIAS_SENTINEL.to_string()),
        );
    }

    fn fill_template_inline_references(&mut self, template: &CommandFlowTemplate) {
        let references = collect_template_inline_references(template);
        for reference in references {
            let missing = self
                .runtime_vars
                .get(&reference)
                .map(|value| value.is_null())
                .unwrap_or(true);
            if !missing {
                continue;
            }
            if let Some(resolved) = self.resolve_reference(&reference, None) {
                self.runtime_vars.insert(reference, resolved);
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
            let loaded = load_connection(connection_name)
                .ok()
                .map(|saved| ConnectionParamContext::from_saved_connection(connection_name, &saved))
                .or_else(|| {
                    self.resolve_connection_alias(connection_name).and_then(|alias_name| {
                        if alias_name == CURRENT_CONNECTION_ALIAS_SENTINEL {
                            self.current.clone()
                        } else {
                            load_connection(&alias_name).ok().map(|saved| {
                                ConnectionParamContext::from_saved_connection(&alias_name, &saved)
                            })
                        }
                    })
                });
            self.named.insert(connection_name.to_string(), loaded);
        }
        self.named
            .get(connection_name)
            .and_then(|value| value.as_ref())
            .and_then(|value| value.lookup(param_name))
    }

    fn resolve_connection_alias(&self, alias: &str) -> Option<String> {
        let candidate = self
            .runtime_vars
            .get(alias)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())?;
        if candidate.contains('.') || !is_reference_token(candidate) {
            return None;
        }
        Some(candidate.to_string())
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
    current_connection_alias: Option<&str>,
) -> Result<Value> {
    let mut resolver = CommandFlowVarResolver::new(runtime_vars, current)?;
    resolver.bind_current_connection_alias(current_connection_alias);
    resolver.resolve_runtime_aliases();
    resolver.fill_template_vars(template);
    resolver.fill_template_inline_references(template);
    Ok(Value::Object(resolver.runtime_vars))
}

fn collect_template_inline_references(template: &CommandFlowTemplate) -> Vec<String> {
    let Ok(value) = serde_json::to_value(template) else {
        return Vec::new();
    };
    let mut references = HashSet::new();
    collect_inline_references_from_value(&value, &mut references);
    let mut references: Vec<String> = references.into_iter().collect();
    references.sort();
    references
}

fn collect_inline_references_from_value(value: &Value, references: &mut HashSet<String>) {
    match value {
        Value::Object(map) => {
            for item in map.values() {
                collect_inline_references_from_value(item, references);
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_inline_references_from_value(item, references);
            }
        }
        Value::String(text) => {
            collect_inline_references_from_text(text, references);
        }
        _ => {}
    }
}

fn collect_inline_references_from_text(text: &str, references: &mut HashSet<String>) {
    let mut rest = text;
    while let Some(start) = rest.find("{{") {
        let after_start = &rest[start + 2..];
        let Some(end) = after_start.find("}}") else {
            break;
        };
        let token = after_start[..end].trim();
        if !token.is_empty() && is_reference_token(token) {
            references.insert(token.to_string());
        }
        rest = &after_start[end + 2..];
    }
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
    use crate::config::connection_store::{SavedConnection, save_connection};
    use crate::db;
    use serde_json::json;
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    struct TestEnvGuard {
        original_home: Option<std::ffi::OsString>,
        _root: PathBuf,
        _guard: std::sync::MutexGuard<'static, ()>,
    }

    impl TestEnvGuard {
        fn new() -> anyhow::Result<Self> {
            let guard = TEST_ENV_LOCK
                .get_or_init(|| Mutex::new(()))
                .lock()
                .expect("test env lock poisoned");
            let root = std::env::temp_dir().join(format!(
                "rauto-command-flow-vars-test-{}",
                SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos()
            ));
            let original_home = std::env::var_os("RAUTO_HOME");
            unsafe {
                std::env::set_var("RAUTO_HOME", &root);
            }
            Ok(Self {
                original_home,
                _root: root,
                _guard: guard,
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

    fn sample_connection(host: &str, vars: serde_json::Value) -> SavedConnection {
        SavedConnection {
            host: Some(host.to_string()),
            username: Some("ops".to_string()),
            password: Some("secret-xyz".to_string()),
            password_ref: None,
            port: Some(22),
            enable_password: None,
            enable_password_ref: None,
            ssh_security: None,
            linux_shell_flavor: None,
            device_profile: Some("linux".to_string()),
            template_dir: None,
            enabled: true,
            labels: vec![],
            vars,
            groups: vec![],
        }
    }

    #[test]
    fn resolves_plain_name_from_current_connection_when_runtime_missing() {
        let template = parse_command_flow_template_str(
            r#"
name = "demo"
[[vars]]
name = "site"
[[steps]]
command = "show clock"
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
        let resolved = resolve_command_flow_runtime_vars(&template, Value::Null, Some(current), None)
            .expect("ok");
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
command = "show clock"
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
            None,
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

    #[test]
    fn resolves_connection_alias_then_named_connection_param_lookup() {
        let _env_guard = TestEnvGuard::new().expect("env");
        db::init_sync().expect("db init");
        save_connection(
            "edge94",
            &sample_connection("192.168.30.94", json!({"site":"dc-a"})),
        )
        .expect("save connection");

        let template = parse_command_flow_template_str(
            r#"
name = "demo"
[[vars]]
name = "peer_host"
[[vars]]
name = "peer_site"
[[vars]]
name = "peer_pass"
[[steps]]
command = "show clock"
"#,
            None,
        )
        .expect("template");

        let resolved = resolve_command_flow_runtime_vars(
            &template,
            json!({
                "peer": "edge94",
                "peer_host": "peer.host",
                "peer_site": "peer.site",
                "peer_pass": "peer.password"
            }),
            None,
            None,
        )
        .expect("resolve");

        assert_eq!(resolved["peer_host"], json!("192.168.30.94"));
        assert_eq!(resolved["peer_site"], json!("dc-a"));
        assert_eq!(resolved["peer_pass"], json!("secret-xyz"));
    }

    #[test]
    fn resolves_inline_reference_from_connection_alias_only_peer_input() {
        let _env_guard = TestEnvGuard::new().expect("env");
        db::init_sync().expect("db init");
        save_connection(
            "edge94",
            &sample_connection("192.168.30.94", json!({"site":"dc-a"})),
        )
        .expect("save connection");

        let template = parse_command_flow_template_str(
            r#"
name = "linux_scp_push"
[[vars]]
name = "peer"
required = true
[[vars]]
name = "local_path"
required = true
[[vars]]
name = "remote_path"
required = true
[[steps]]
command = "scp {{local_path}} {{peer.username}}@{{peer.host}}:{{remote_path}}"
[[steps.prompts]]
patterns = ["(?i)^.*password.*:\\s*$"]
append_newline = true
record_input = false
response = "{{peer.password}}"
"#,
            None,
        )
        .expect("template");

        let resolved = resolve_command_flow_runtime_vars(
            &template,
            json!({
                "peer": "edge94",
                "local_path": "/tmp/app.tar",
                "remote_path": "/tmp/app.tar",
            }),
            None,
            None,
        )
        .expect("resolve");

        assert_eq!(resolved["peer.host"], json!("192.168.30.94"));
        assert_eq!(resolved["peer.username"], json!("ops"));
        assert_eq!(resolved["peer.password"], json!("secret-xyz"));
    }

    #[test]
    fn resolves_inline_reference_from_current_connection_alias_field() {
        let template = parse_command_flow_template_str(
            r#"
name = "linux_deploy"
[[vars]]
name = "service"
required = true
[[steps]]
command = "ssh {{target.username}}@{{target.host}} \"systemctl restart {{service}}\""
"#,
            None,
        )
        .expect("template");

        let current = ConnectionParamContext::new(
            Some("edge-01"),
            Some("192.168.30.10"),
            Some("admin"),
            Some("secret"),
            Some(22),
            None,
            None,
            None,
            Some("linux"),
            &json!({"site":"dc-a"}),
        );
        let resolved = resolve_command_flow_runtime_vars(
            &template,
            json!({"service":"nginx"}),
            Some(current),
            Some("target"),
        )
        .expect("resolve");

        assert_eq!(resolved["target.host"], json!("192.168.30.10"));
        assert_eq!(resolved["target.username"], json!("admin"));
    }
}
