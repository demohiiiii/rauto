use super::TxWorkflowAction;
use super::targets as orchestrator_targets;
use crate::EffectiveConnection;
use crate::config::connection_store::load_connection;
use crate::config::content_store;
use crate::config::template_connection_refs::enrich_context_with_connection_refs_from_value;
use crate::template::renderer::Renderer;
use anyhow::{Context, Result, anyhow};
use chrono::Utc;
use rneter::session::{TxBlock, TxWorkflow};
use serde_json::{Value, json};

#[derive(Debug, serde::Deserialize)]
struct TxWorkflowBlockTemplateRefPayload {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    fail_fast: Option<bool>,
    #[serde(default)]
    tx_block_template_name: Option<String>,
    #[serde(default)]
    tx_block_template_content: Option<String>,
    #[serde(default)]
    tx_block_template_vars: Value,
}

pub(super) fn load_workflow(
    action: &TxWorkflowAction,
    conn: &EffectiveConnection,
) -> Result<TxWorkflow> {
    load_workflow_with_contexts(action, conn, &mut None)
}

pub(super) fn load_workflow_preview(
    action: &TxWorkflowAction,
    conn: &EffectiveConnection,
) -> Result<TxWorkflow> {
    let mut contexts = Some(vec![build_stage_json_template_context(
        conn.vars.clone(),
        conn,
    )]);
    let workflow = load_workflow_with_contexts(action, conn, &mut contexts)?;
    workflow.validate()?;
    let mut value = serde_json::to_value(workflow)?;
    crate::config::session_recording::redact_authentication_json(
        &mut value,
        &conn.auth,
        conn.enable_password.as_deref(),
    );
    crate::domain::template::redaction::redact_preview_json(
        &mut value,
        &Value::Array(contexts.unwrap_or_default()),
    );
    serde_json::from_value(value).map_err(Into::into)
}

fn load_workflow_with_contexts(
    action: &TxWorkflowAction,
    conn: &EffectiveConnection,
    contexts: &mut Option<Vec<Value>>,
) -> Result<TxWorkflow> {
    let mut workflow_value = if let Some(name) = action
        .workflow_template_name
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
    {
        let content = load_tx_workflow_template_content(name)?;
        let source: Value = serde_json::from_str(&content)
            .with_context(|| format!("failed to parse tx workflow template '{}'", name))?;
        render_json_template_source(&source, action.workflow_vars.clone(), conn, None, contexts)?
    } else if let Some(value) = &action.workflow {
        if crate::domain::execution::workflow_template::has_workflow_controls(value) {
            let context = action.inline_template_context.as_ref();
            let vars = context.map_or(Value::Null, |context| context.vars.clone());
            render_json_template_source(value, vars, conn, context, contexts)?
        } else {
            value.clone()
        }
    } else {
        return Err(anyhow!("workflow or workflow_template_name is required"));
    };
    workflow_value = resolve_tx_workflow_blocks_from_templates(workflow_value, conn, contexts)?;
    serde_json::from_value(workflow_value).map_err(Into::into)
}

fn resolve_tx_workflow_blocks_from_templates(
    workflow: Value,
    conn: &EffectiveConnection,
    contexts: &mut Option<Vec<Value>>,
) -> Result<Value> {
    let mut root = match workflow {
        Value::Object(map) => map,
        other => return Ok(other),
    };
    let blocks = root
        .get("blocks")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if blocks.is_empty() {
        return Ok(Value::Object(root));
    }

    let mut resolved_blocks = Vec::with_capacity(blocks.len());
    for block in blocks {
        let Some(block_obj) = block.as_object() else {
            resolved_blocks.push(block);
            continue;
        };
        let has_template_name = block_obj
            .get("tx_block_template_name")
            .and_then(Value::as_str)
            .map(str::trim)
            .is_some_and(|value| !value.is_empty());
        let has_template_content = block_obj
            .get("tx_block_template_content")
            .and_then(Value::as_str)
            .map(str::trim)
            .is_some_and(|value| !value.is_empty());
        if !has_template_name && !has_template_content {
            resolved_blocks.push(block);
            continue;
        }

        let block_ref: TxWorkflowBlockTemplateRefPayload =
            serde_json::from_value(Value::Object(block_obj.clone()))?;
        let mut tx_block = resolve_tx_block_from_template_source(
            block_ref.tx_block_template_name.as_deref(),
            block_ref.tx_block_template_content.as_deref(),
            block_ref.tx_block_template_vars,
            conn,
            contexts,
        )?;
        if let Some(name) = block_ref.name.filter(|value| !value.trim().is_empty()) {
            tx_block.name = name;
        }
        if let Some(fail_fast) = block_ref.fail_fast {
            tx_block.fail_fast = fail_fast;
        }
        tx_block.validate()?;
        resolved_blocks.push(serde_json::to_value(&tx_block)?);
    }

    root.insert("blocks".to_string(), Value::Array(resolved_blocks));
    Ok(Value::Object(root))
}

fn resolve_tx_block_from_template_source(
    template_name: Option<&str>,
    template_content: Option<&str>,
    template_vars: Value,
    conn: &EffectiveConnection,
    contexts: &mut Option<Vec<Value>>,
) -> Result<TxBlock> {
    let source = load_tx_block_template_source_value(template_name, template_content)?;
    let rendered_value = render_json_template_source(&source, template_vars, conn, None, contexts)?;
    serde_json::from_value(rendered_value).map_err(Into::into)
}

fn load_tx_block_template_source_value(
    template_name: Option<&str>,
    template_content: Option<&str>,
) -> Result<Value> {
    match (
        template_name
            .map(str::trim)
            .filter(|value| !value.is_empty()),
        template_content
            .map(str::trim)
            .filter(|value| !value.is_empty()),
    ) {
        (Some(name), None) => {
            let content = load_tx_block_template_content(name)?;
            serde_json::from_str(&content)
                .with_context(|| format!("failed to parse tx block template '{}'", name))
        }
        (None, Some(content)) => {
            serde_json::from_str(content).context("failed to parse tx_block_template_content")
        }
        (Some(_), Some(_)) => Err(anyhow!(
            "use either tx_block_template_name or tx_block_template_content"
        )),
        (None, None) => Err(anyhow!(
            "tx block template source requires tx_block_template_name or tx_block_template_content"
        )),
    }
}

fn load_tx_block_template_content(name: &str) -> Result<String> {
    let safe_name = name.trim();
    if safe_name.is_empty() {
        return Err(anyhow!("tx block template name is required"));
    }
    content_store::load_tx_block_template(safe_name)?
        .map(|item| item.content)
        .ok_or_else(|| anyhow!("tx block template '{}' not found", safe_name))
}

fn load_tx_workflow_template_content(name: &str) -> Result<String> {
    let safe_name = name.trim();
    if safe_name.is_empty() {
        return Err(anyhow!("tx workflow template name is required"));
    }
    content_store::load_tx_workflow_template(safe_name)?
        .map(|item| item.content)
        .ok_or_else(|| anyhow!("tx workflow template '{}' not found", safe_name))
}

fn render_json_template_source(
    source: &Value,
    vars: Value,
    conn: &EffectiveConnection,
    plan_context: Option<&crate::domain::orchestration::template::InlineWorkflowTemplateContext>,
    contexts: &mut Option<Vec<Value>>,
) -> Result<Value> {
    let resolved_vars = orchestrator_targets::resolve_runtime_vars_for_connection(vars, conn)?;
    let mut context = build_stage_json_template_context(resolved_vars, conn);
    if let Some(plan_context) = plan_context {
        if let Some(now) = &plan_context.now {
            context["now"] = now.clone();
        }
        if let Some(defaults) = &plan_context.defaults {
            context["defaults"] = defaults.clone();
        }
    }
    enrich_context_with_connection_refs_from_value(&mut context, source)?;
    let renderer = Renderer::new();
    let rendered = renderer.render_json_value(source, &context)?;
    if let Some(contexts) = contexts {
        contexts.push(context);
    }
    Ok(rendered)
}

fn build_stage_json_template_context(vars: Value, conn: &EffectiveConnection) -> Value {
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
        && let Ok(saved) = load_connection(name)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ssh_security::SshSecurityProfile;

    fn connection(host: &str, role: &str) -> EffectiveConnection {
        EffectiveConnection {
            connection_name: None,
            credential_id: None,
            host: host.into(),
            username: "admin".into(),
            password: "test".into(),
            auth: rneter::session::SshAuthMethod::password("test"),
            port: 22,
            connect_timeout_secs: None,
            enable_password: None,
            ssh_security: SshSecurityProfile::Balanced,
            linux_shell_flavor: None,
            output_encoding: Default::default(),
            device_profile: "linux".into(),
            vars: json!({"role":role}),
            template_dir: None,
            force_autodetect: false,
            retry_policy: Default::default(),
        }
    }

    #[test]
    fn preview_resolves_block_template_vars_and_masks_secrets_without_changing_execution() {
        let block = json!({
            "name":"reusable", "fail_fast":true, "rollback_policy":"per_step",
            "steps":[{
                "run":{"kind":"command", "mode":"Root,User", "command":"send {{ vars.api_token }} to {{ connection.host }}"},
                "rollback":{"kind":"command", "mode":"Root,User", "command":"undo {{ vars.api_token }}"}
            }]
        });
        let action = TxWorkflowAction {
            workflow: Some(
                json!({"name":"template-preview", "fail_fast":true, "blocks":[{
                    "tx_block_template_content":serde_json::to_string(&block).unwrap(),
                    "tx_block_template_vars":{"api_token":"private\ntoken"}
                }]}),
            ),
            workflow_template_name: None,
            workflow_vars: Value::Null,
            inline_template_context: None,
        };
        let conn = connection("192.0.2.10", "edge");
        let actual = serde_json::to_value(load_workflow(&action, &conn).unwrap()).unwrap();
        let preview = serde_json::to_value(load_workflow_preview(&action, &conn).unwrap()).unwrap();
        assert_eq!(
            actual["blocks"][0]["steps"][0]["run"]["command"],
            "send private\ntoken to 192.0.2.10"
        );
        assert_eq!(
            preview["blocks"][0]["steps"][0]["run"]["command"],
            "send ****** to 192.0.2.10"
        );
        assert_eq!(
            preview["blocks"][0]["steps"][0]["rollback"]["command"],
            "undo ******"
        );
    }

    #[test]
    fn inline_controls_use_each_target_context_and_keep_plan_vars() {
        let block = |name: &str, command: &str| {
            json!({
                "name":name, "rollback_policy":"none", "fail_fast":true,
                "steps":[{"run":{"kind":"command", "mode":"User", "command":command}}]
            })
        };
        let source = json!({"name":"plan", "stages":[{"name":"stage", "strategy":"serial", "jobs":[{
            "strategy":"serial", "targets":["target-a","target-b"], "action":{"kind":"tx_workflow", "workflow":{
                "name":"workflow", "fail_fast":true, "blocks":[
                    {"kind":"loop", "iterations":"vars.commands", "blocks":[
                        block("iteration-{{ loop.index }}", "{{ item }} {{ connection.host }} {{ role }}")
                    ]},
                    {"kind":"choice", "branches":[{
                        "condition":"connection.host == 'target-a'", "blocks":[block("a", "show a")]
                    }], "else":[block("b", "show b")]}
                ]
            }}
        }]}]});
        for global_connection in [None, Some(json!({"host":"target-a"}))] {
            let mut context = json!({"vars":{"commands":["echo first","echo second"]}});
            if let Some(connection) = global_connection {
                context["connection"] = connection;
                context["host"] = json!("target-a");
                context["role"] = json!("global-role");
            }
            let plan = Renderer::new()
                .render_orchestration_plan(&source, &context)
                .unwrap();
            let super::super::OrchestrationAction::TxWorkflow(action) =
                &plan.stages[0].jobs[0].action;
            for (host, role, selected) in [
                ("target-a", "edge", "show a"),
                ("target-b", "core", "show b"),
            ] {
                let workflow = load_workflow(action, &connection(host, role)).unwrap();
                workflow.validate().unwrap();
                let rendered = serde_json::to_value(workflow).unwrap();
                assert_eq!(rendered["blocks"].as_array().unwrap().len(), 3);
                assert_eq!(
                    rendered["blocks"][0]["steps"][0]["run"]["command"],
                    format!("echo first {host} {role}")
                );
                assert_eq!(
                    rendered["blocks"][1]["steps"][0]["run"]["command"],
                    format!("echo second {host} {role}")
                );
                assert_eq!(
                    rendered["blocks"][2]["steps"][0]["run"]["command"],
                    selected
                );
            }
        }
    }
}
