use super::*;
use std::cmp::Reverse;

pub(crate) fn load_json_template_from_input(
    template_name: Option<&str>,
    template_content: Option<&str>,
    inline_value: &Value,
    load_by_name: impl Fn(&str) -> Result<Option<String>, ApiError>,
    missing_error: &'static str,
) -> Result<Value, ApiError> {
    match (
        template_name
            .map(str::trim)
            .filter(|value| !value.is_empty()),
        template_content
            .map(str::trim)
            .filter(|value| !value.is_empty()),
    ) {
        (Some(name), None) => {
            let content =
                load_by_name(name)?.ok_or_else(|| ApiError::bad_request(missing_error))?;
            serde_json::from_str(&content).map_err(ApiError::from)
        }
        (None, Some(content)) => serde_json::from_str(content).map_err(ApiError::from),
        (Some(_), Some(_)) => Err(ApiError::bad_request(
            "use either template_name or template_content",
        )),
        (None, None) => Ok(inline_value.clone()),
    }
}

pub(crate) fn build_json_template_context(
    vars: Value,
    conn: Option<&crate::web::state::ResolvedConnection>,
) -> Value {
    let vars_for_root = vars.clone();
    let mut root = serde_json::Map::new();
    root.insert("vars".to_string(), vars_for_root);
    root.insert(
        "now".to_string(),
        json!({
            "rfc3339": Utc::now().to_rfc3339(),
            "timestamp_ms": Utc::now().timestamp_millis()
        }),
    );
    let mut flattened = serde_json::Map::new();
    if let Some(conn) = conn {
        let mut connection = json!({
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
        });
        if let Some(name) = conn.connection_name.as_deref()
            && let Ok(saved) = connection_store::load_connection(name)
        {
            connection["saved"] = json!({
                "enabled": saved.enabled,
                "labels": saved.labels,
                "groups": saved.groups,
                "vars": saved.vars
            });
        }
        root.insert("connection".to_string(), connection);

        if let Some(name) = conn.connection_name.as_deref()
            && !name.trim().is_empty()
        {
            flattened.insert("name".to_string(), Value::String(name.to_string()));
            flattened.insert(
                "connection_name".to_string(),
                Value::String(name.to_string()),
            );
        }
        flattened.insert("host".to_string(), Value::String(conn.host.clone()));
        flattened.insert("username".to_string(), Value::String(conn.username.clone()));
        flattened.insert("password".to_string(), Value::String(conn.password.clone()));
        flattened.insert("port".to_string(), Value::Number(conn.port.into()));
        if let Some(value) = conn.enable_password.clone() {
            flattened.insert("enable_password".to_string(), Value::String(value));
        }
        flattened.insert(
            "ssh_security".to_string(),
            Value::String(conn.ssh_security.to_string()),
        );
        if let Some(value) = conn.linux_shell_flavor {
            flattened.insert(
                "linux_shell_flavor".to_string(),
                Value::String(value.to_string()),
            );
        }
        flattened.insert(
            "device_profile".to_string(),
            Value::String(conn.device_profile.clone()),
        );
        if let Some(map) = conn.vars.as_object() {
            for (key, value) in map {
                flattened
                    .entry(key.clone())
                    .or_insert_with(|| value.clone());
            }
        }
    }
    if let Some(map) = vars.as_object() {
        for (key, value) in map {
            flattened.insert(key.clone(), value.clone());
        }
    }
    for (key, value) in flattened {
        if matches!(key.as_str(), "vars" | "connection" | "now" | "defaults") {
            continue;
        }
        root.insert(key, value);
    }
    Value::Object(root)
}

pub(crate) fn render_json_template_value(
    input: &Value,
    context: &mut Value,
    renderer: &Renderer<'_>,
) -> Result<Value, ApiError> {
    match input {
        Value::Object(map) => {
            let mut out = serde_json::Map::with_capacity(map.len());
            for (k, v) in map {
                out.insert(k.clone(), render_json_template_value(v, context, renderer)?);
            }
            Ok(Value::Object(out))
        }
        Value::Array(items) => {
            let mut out = Vec::with_capacity(items.len());
            for item in items {
                out.push(render_json_template_value(item, context, renderer)?);
            }
            Ok(Value::Array(out))
        }
        Value::String(text) => {
            if !text.contains("{{") && !text.contains("{%") {
                return Ok(Value::String(text.clone()));
            }
            enrich_context_with_connection_refs_from_template(context, text)
                .map_err(ApiError::from)?;
            let rendered = renderer
                .render_string(text, context.clone())
                .map_err(ApiError::from)?;
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

pub(crate) fn current_connection_param_context(
    conn: &ResolvedConnection,
) -> ConnectionParamContext {
    ConnectionParamContext::new(
        conn.connection_name.as_deref(),
        Some(&conn.host),
        Some(&conn.username),
        Some(&conn.password),
        Some(conn.port),
        conn.enable_password.as_deref(),
        Some(conn.ssh_security),
        conn.linux_shell_flavor,
        Some(&conn.device_profile),
        &conn.vars,
    )
}

pub(crate) fn resolve_runtime_vars_with_connection(
    vars: Value,
    conn: Option<&ResolvedConnection>,
) -> Result<Value, ApiError> {
    let context = conn.map(current_connection_param_context);
    resolve_runtime_var_aliases(vars, context).map_err(ApiError::from)
}

fn resolve_template_runtime_vars_with_connection(
    vars: Value,
    conn: Option<&ResolvedConnection>,
) -> Result<Value, ApiError> {
    if !vars.is_null() && !vars.is_object() {
        return Err(ApiError::bad_request("template vars must be a JSON object"));
    }
    resolve_runtime_vars_with_connection(vars, conn)
}

fn is_sensitive_key_name(key: &str) -> bool {
    let normalized = key.trim().to_ascii_lowercase().replace('-', "_");
    normalized.contains("password")
        || normalized.contains("passwd")
        || normalized == "pass"
        || normalized.ends_with("_pass")
        || normalized.contains("secret")
        || normalized.contains("token")
        || normalized == "enable_password"
        || normalized.contains("private_key")
}

fn collect_sensitive_strings(value: &Value, parent_key: Option<&str>, out: &mut Vec<String>) {
    match value {
        Value::Object(map) => {
            for (key, item) in map {
                collect_sensitive_strings(item, Some(key), out);
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_sensitive_strings(item, parent_key, out);
            }
        }
        Value::String(text) => {
            if let Some(key) = parent_key
                && is_sensitive_key_name(key)
                && !text.trim().is_empty()
            {
                out.push(text.clone());
            }
        }
        _ => {}
    }
}

pub(crate) fn sanitize_rendered_output_for_response(rendered: &str, context: &Value) -> String {
    let mut secrets = Vec::new();
    collect_sensitive_strings(context, None, &mut secrets);
    if secrets.is_empty() {
        return rendered.to_string();
    }
    secrets.sort_by_key(|value| Reverse(value.len()));
    secrets.dedup();
    let mut masked = rendered.to_string();
    for secret in secrets {
        if secret.trim().is_empty() {
            continue;
        }
        masked = masked.replace(&secret, "******");
    }
    masked
}

fn has_non_empty_object(value: &Value) -> bool {
    value
        .as_object()
        .map(|map| !map.is_empty())
        .unwrap_or(false)
}

pub(crate) fn resolve_render_connection_context_fallback(
    defaults: &crate::cli::GlobalOpts,
    incoming: Option<ConnectionRequest>,
) -> Option<ResolvedConnection> {
    let incoming = incoming.unwrap_or(ConnectionRequest {
        connection_name: None,
        host: None,
        username: None,
        password: None,
        port: None,
        connect_timeout_secs: None,
        enable_password: None,
        enable_password_empty_enter: None,
        ssh_security: None,
        linux_shell_flavor: None,
        device_profile: None,
        template_dir: None,
        enabled: true,
        labels: vec![],
        groups: vec![],
        vars: serde_json::json!({}),
    });

    let connection_name = incoming
        .connection_name
        .clone()
        .or_else(|| defaults.connection.clone());

    let saved_raw = connection_name
        .as_ref()
        .and_then(|name| connection_store::load_connection_raw(name).ok());

    let vars = if has_non_empty_object(&incoming.vars) {
        incoming.vars.clone()
    } else {
        saved_raw
            .as_ref()
            .map(|saved| saved.vars.clone())
            .filter(has_non_empty_object)
            .unwrap_or_else(|| serde_json::json!({}))
    };

    let host = incoming
        .host
        .clone()
        .or_else(|| saved_raw.as_ref().and_then(|saved| saved.host.clone()))
        .or_else(|| defaults.host.clone())
        .unwrap_or_default();

    let username = incoming
        .username
        .clone()
        .or_else(|| saved_raw.as_ref().and_then(|saved| saved.username.clone()))
        .or_else(|| defaults.username.clone())
        .unwrap_or_else(|| "admin".to_string());

    let password = incoming
        .password
        .clone()
        .or_else(|| defaults.password.clone())
        .unwrap_or_default();

    let port = incoming
        .port
        .or_else(|| saved_raw.as_ref().and_then(|saved| saved.port))
        .or(defaults.port)
        .unwrap_or(22);
    let connect_timeout_secs = incoming.connect_timeout_secs.or_else(|| {
        saved_raw
            .as_ref()
            .and_then(|saved| saved.connect_timeout_secs)
    });

    let enable_password = incoming
        .enable_password
        .clone()
        .or_else(|| defaults.enable_password.clone())
        .or_else(|| Some(String::new()));

    let ssh_security = incoming
        .ssh_security
        .or_else(|| saved_raw.as_ref().and_then(|saved| saved.ssh_security))
        .or(defaults.ssh_security)
        .unwrap_or_default();

    let linux_shell_flavor = incoming
        .linux_shell_flavor
        .or_else(|| {
            saved_raw
                .as_ref()
                .and_then(|saved| saved.linux_shell_flavor)
        })
        .or(defaults.linux_shell_flavor);

    let device_profile = incoming
        .device_profile
        .clone()
        .or_else(|| {
            saved_raw
                .as_ref()
                .and_then(|saved| saved.device_profile.clone())
        })
        .or_else(|| defaults.device_profile.clone())
        .unwrap_or_else(|| template_loader::DEFAULT_DEVICE_PROFILE.to_string());

    if connection_name.is_none() && host.trim().is_empty() && !has_non_empty_object(&vars) {
        return None;
    }

    Some(ResolvedConnection {
        connection_name,
        host,
        username,
        password,
        port,
        connect_timeout_secs,
        enable_password,
        ssh_security,
        linux_shell_flavor,
        device_profile,
        vars,
        force_autodetect: false,
    })
}

pub(crate) fn render_commands_with_runtime_context(
    template_name: Option<&str>,
    template_content: Option<&str>,
    vars: Value,
    conn: Option<&ResolvedConnection>,
) -> Result<(String, String), ApiError> {
    let template_name = template_name
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let template_content = template_content.filter(|value| !value.trim().is_empty());
    if template_name.is_some() == template_content.is_some() {
        return Err(ApiError::bad_request(
            "use either template or template_content",
        ));
    }

    let resolved_vars = resolve_template_runtime_vars_with_connection(vars, conn)?;
    let mut render_context = build_json_template_context(resolved_vars, conn);
    let renderer = Renderer::new();
    let rendered = match (template_name, template_content) {
        (Some(name), None) => {
            if let Some(stored) =
                content_store::load_command_template(name).map_err(ApiError::from)?
            {
                enrich_context_with_connection_refs_from_template(
                    &mut render_context,
                    &stored.content,
                )
                .map_err(ApiError::from)?;
            }
            renderer
                .render_file(name, render_context.clone())
                .map_err(ApiError::from)?
        }
        (None, Some(content)) => {
            enrich_context_with_connection_refs_from_template(&mut render_context, content)
                .map_err(ApiError::from)?;
            renderer
                .render_string(content, render_context.clone())
                .map_err(ApiError::from)?
        }
        _ => unreachable!("template source validation handled above"),
    };
    let masked = sanitize_rendered_output_for_response(&rendered, &render_context);
    Ok((rendered, masked))
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct WebTextfsmParseOptions<'a> {
    pub template_file: Option<&'a str>,
    pub template_content: Option<&'a str>,
    pub enabled: bool,
    pub platform: Option<&'a str>,
    pub device_profile: Option<&'a str>,
    pub vendor: Option<&'a str>,
    pub filter_error_rules: bool,
}

impl Default for WebTextfsmParseOptions<'_> {
    fn default() -> Self {
        Self {
            template_file: None,
            template_content: None,
            enabled: false,
            platform: None,
            device_profile: None,
            vendor: None,
            filter_error_rules: true,
        }
    }
}

pub(crate) fn parse_textfsm_output_optional(
    output: &str,
    command: &str,
    options: WebTextfsmParseOptions<'_>,
) -> (Option<Value>, Option<String>) {
    if !options.enabled {
        return (None, None);
    }
    let parse_options = crate::config::textfsm::ParseOptions {
        template_file: options.template_file.map(std::path::PathBuf::from),
        template_content: options.template_content.map(str::to_string),
        enabled: options.enabled,
        platform: options.platform.map(str::to_string),
        device_profile: options.device_profile.map(str::to_string),
        vendor: options.vendor.map(str::to_string),
        filter_error_rules: options.filter_error_rules,
    };
    crate::config::textfsm::parse_command_output_optional(output, command, &parse_options)
}
