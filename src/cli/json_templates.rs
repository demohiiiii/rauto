use crate::config::content_store;
use crate::template::renderer::Renderer;
use anyhow::Result;
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy)]
pub(crate) enum JsonTemplateKind {
    TxWorkflow,
    Orchestration,
}

impl JsonTemplateKind {
    fn label(self) -> &'static str {
        match self {
            Self::TxWorkflow => "tx workflow template",
            Self::Orchestration => "orchestration template",
        }
    }
}

pub(crate) fn safe_json_template_name(raw: &str) -> Result<String> {
    let normalized = raw.trim();
    if normalized.is_empty()
        || normalized.contains('/')
        || normalized.contains('\\')
        || normalized.contains("..")
        || !normalized
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' || ch == '.')
    {
        return Err(anyhow::anyhow!("invalid JSON template name"));
    }
    Ok(normalized.to_string())
}

pub(crate) fn read_json_template_body(
    kind: JsonTemplateKind,
    file: Option<PathBuf>,
    content: Option<String>,
) -> Result<String> {
    let body = crate::cli_exec::read_text_body(kind.label(), file, content)?;
    let value: Value = serde_json::from_str(&body)?;
    serde_json::to_string_pretty(&value).map_err(Into::into)
}

pub(crate) fn load_json_template_content(kind: JsonTemplateKind, name: &str) -> Result<String> {
    let safe_name = safe_json_template_name(name)?;
    let stored = match kind {
        JsonTemplateKind::TxWorkflow => content_store::load_tx_workflow_template(&safe_name)?,
        JsonTemplateKind::Orchestration => content_store::load_orchestration_template(&safe_name)?,
    }
    .ok_or_else(|| anyhow::anyhow!("{} '{}' not found", kind.label(), safe_name))?;
    Ok(stored.content)
}

pub(crate) fn read_json_vars(vars_file: Option<&Path>, vars_json: Option<&str>) -> Result<Value> {
    match (
        vars_file,
        vars_json.map(str::trim).filter(|value| !value.is_empty()),
    ) {
        (Some(_), Some(_)) => Err(anyhow::anyhow!(
            "choose either --vars or --vars-json, not both"
        )),
        (Some(path), None) => {
            let text = std::fs::read_to_string(path)?;
            let value: Value = serde_json::from_str(&text)?;
            ensure_vars_object(value)
        }
        (None, Some(text)) => {
            let value: Value = serde_json::from_str(text)?;
            ensure_vars_object(value)
        }
        (None, None) => Ok(Value::Null),
    }
}

fn ensure_vars_object(value: Value) -> Result<Value> {
    if value.is_null() || value.is_object() {
        Ok(value)
    } else {
        Err(anyhow::anyhow!("template vars must be a JSON object"))
    }
}

pub(crate) fn template_context(vars: Value, conn: Option<&crate::EffectiveConnection>) -> Value {
    let vars_for_root = vars.clone();
    let mut root = serde_json::Map::new();
    root.insert("vars".to_string(), vars_for_root);
    root.insert(
        "now".to_string(),
        json!({
            "rfc3339": chrono::Utc::now().to_rfc3339(),
            "timestamp_ms": chrono::Utc::now().timestamp_millis()
        }),
    );
    if let Some(conn) = conn {
        root.insert(
            "connection".to_string(),
            json!({
                "name": conn.connection_name,
                "host": conn.host,
                "username": conn.username,
                "password": conn.password,
                "port": conn.port,
                "enable_password": conn.enable_password,
                "ssh_security": conn.ssh_security,
                "linux_shell_flavor": conn.linux_shell_flavor,
                "device_profile": conn.device_profile,
                "vars": conn.vars
            }),
        );
        if let Some(name) = conn.connection_name.as_deref()
            && !name.trim().is_empty()
        {
            root.insert("name".to_string(), Value::String(name.to_string()));
            root.insert(
                "connection_name".to_string(),
                Value::String(name.to_string()),
            );
        }
        root.insert("host".to_string(), Value::String(conn.host.clone()));
        root.insert("username".to_string(), Value::String(conn.username.clone()));
        root.insert("password".to_string(), Value::String(conn.password.clone()));
        root.insert("port".to_string(), Value::Number(conn.port.into()));
        if let Some(value) = conn.enable_password.clone() {
            root.insert("enable_password".to_string(), Value::String(value));
        }
        root.insert(
            "ssh_security".to_string(),
            Value::String(conn.ssh_security.to_string()),
        );
        if let Some(value) = conn.linux_shell_flavor {
            root.insert(
                "linux_shell_flavor".to_string(),
                Value::String(value.to_string()),
            );
        }
        root.insert(
            "device_profile".to_string(),
            Value::String(conn.device_profile.clone()),
        );
        if let Some(map) = conn.vars.as_object() {
            for (key, value) in map {
                root.entry(key.clone()).or_insert_with(|| value.clone());
            }
        }
    }
    if let Some(map) = vars.as_object() {
        for (key, value) in map {
            root.insert(key.clone(), value.clone());
        }
    }
    Value::Object(root)
}

pub(crate) fn render_json_template_value(input: &Value, context: &mut Value) -> Result<Value> {
    let renderer = Renderer::new();
    render_json_template_value_with_renderer(input, context, &renderer)
}

fn render_json_template_value_with_renderer(
    input: &Value,
    context: &mut Value,
    renderer: &Renderer<'_>,
) -> Result<Value> {
    match input {
        Value::Object(map) => {
            let mut out = serde_json::Map::with_capacity(map.len());
            for (key, value) in map {
                out.insert(
                    key.clone(),
                    render_json_template_value_with_renderer(value, context, renderer)?,
                );
            }
            Ok(Value::Object(out))
        }
        Value::Array(items) => {
            let mut out = Vec::with_capacity(items.len());
            for item in items {
                out.push(render_json_template_value_with_renderer(
                    item, context, renderer,
                )?);
            }
            Ok(Value::Array(out))
        }
        Value::String(text) => {
            if !text.contains("{{") && !text.contains("{%") {
                return Ok(Value::String(text.clone()));
            }
            let rendered = renderer.render_string(text, context.clone())?;
            let trimmed = rendered.trim();
            if trimmed.is_empty() {
                return Ok(Value::String(rendered));
            }
            if let Ok(parsed) = serde_json::from_str::<Value>(trimmed) {
                return Ok(parsed);
            }
            Ok(Value::String(rendered))
        }
        _ => Ok(input.clone()),
    }
}
