use super::{OrchestrationJob, OrchestrationTarget};
use crate::EffectiveConnection;
use crate::cli::GlobalOpts;
use crate::config::command_flow_vars::{ConnectionParamContext, resolve_runtime_var_aliases};
use crate::config::connection_store::{
    list_connections_by_groups_any, list_connections_by_labels_any, load_connection,
};
use crate::config::inventory_store;
use crate::config::template_loader::DEFAULT_DEVICE_PROFILE;
use anyhow::{Context, Result, anyhow};
use serde_json::Value;
use std::collections::HashSet;
use std::path::PathBuf;

pub(crate) fn resolve_job_targets(
    stage_name: &str,
    job: &OrchestrationJob,
) -> Result<Vec<OrchestrationTarget>> {
    let mut targets = Vec::new();
    let mut seen_connections = HashSet::new();
    let job_label = job
        .name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("unnamed-job");
    for group_name in &job.target_groups {
        let normalized = group_name.trim();
        if normalized.is_empty() {
            return Err(anyhow!(
                "stage '{}' job '{}' has empty target_groups entry",
                stage_name,
                job_label
            ));
        }
        if inventory_store::get_group(normalized)?.is_none() {
            return Err(anyhow!(
                "stage '{}' job '{}' references unknown device group '{}'",
                stage_name,
                job_label,
                normalized
            ));
        }
    }
    for connection_name in list_connections_by_groups_any(&job.target_groups)? {
        push_connection_target(&mut targets, &mut seen_connections, connection_name);
    }
    let tag_filters = job
        .target_tags
        .iter()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .map(|item| item.to_string())
        .collect::<Vec<_>>();
    if tag_filters.len() != job.target_tags.len() {
        return Err(anyhow!(
            "stage '{}' job '{}' has empty target_tags entry",
            stage_name,
            job_label
        ));
    }
    if !tag_filters.is_empty() {
        let by_tags = list_connections_by_labels_any(&tag_filters).with_context(|| {
            format!(
                "stage '{}' job '{}' failed to resolve target_tags",
                stage_name, job_label
            )
        })?;
        for connection_name in by_tags {
            push_connection_target(&mut targets, &mut seen_connections, connection_name);
        }
    }
    for connection_name in &job.targets {
        let normalized = connection_name.trim();
        if normalized.is_empty() {
            return Err(anyhow!(
                "stage '{}' job '{}' has empty targets entry",
                stage_name,
                job_label
            ));
        }
        push_connection_target(&mut targets, &mut seen_connections, normalized.to_string());
    }
    Ok(targets)
}

fn push_connection_target(
    targets: &mut Vec<OrchestrationTarget>,
    seen_connections: &mut HashSet<String>,
    connection_name: String,
) {
    if seen_connections.insert(connection_name.clone()) {
        targets.push(OrchestrationTarget {
            connection: Some(connection_name),
            ..OrchestrationTarget::default()
        });
    }
}

pub(crate) fn resolve_target_connection(
    opts: &GlobalOpts,
    target: &OrchestrationTarget,
) -> Result<EffectiveConnection> {
    let saved = if let Some(name) = &target.connection {
        Some(load_connection(name)?)
    } else if let Some(name) = &opts.connection {
        Some(load_connection(name)?)
    } else {
        None
    };

    let host = target
        .host
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.host.clone()))
        .or_else(|| opts.host.clone())
        .ok_or_else(|| anyhow!("host is required (target.connection or target.host)"))?;
    let username = target
        .username
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.username.clone()))
        .or_else(|| opts.username.clone())
        .unwrap_or_else(|| "admin".to_string());
    let password = target
        .password
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.password.clone()))
        .or_else(|| opts.password.clone())
        .or_else(|| std::env::var("RAUTO_PASSWORD").ok())
        .unwrap_or_default();
    let port = target
        .port
        .or_else(|| saved.as_ref().and_then(|s| s.port))
        .or(opts.port)
        .unwrap_or(22);
    let connect_timeout_secs = saved
        .as_ref()
        .and_then(|connection| connection.connect_timeout_secs);
    let device_profile = target
        .device_profile
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.device_profile.clone()))
        .or_else(|| opts.device_profile.clone())
        .unwrap_or_else(|| DEFAULT_DEVICE_PROFILE.to_string());
    let ssh_security = target
        .ssh_security
        .or_else(|| saved.as_ref().and_then(|s| s.ssh_security))
        .or(opts.ssh_security)
        .unwrap_or_default();
    let linux_shell_flavor = target
        .linux_shell_flavor
        .or_else(|| saved.as_ref().and_then(|s| s.linux_shell_flavor))
        .or(opts.linux_shell_flavor);
    let template_dir = target
        .template_dir
        .as_ref()
        .map(PathBuf::from)
        .or_else(|| {
            saved
                .as_ref()
                .and_then(|s| s.template_dir.clone().map(PathBuf::from))
        })
        .or_else(|| opts.template_dir.clone());

    let vars = saved
        .as_ref()
        .map(|s| s.vars.clone())
        .unwrap_or_else(|| serde_json::json!({}));
    let enable_password = target
        .enable_password
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.enable_password.clone()))
        .or_else(|| opts.enable_password.clone())
        .or_else(|| Some(String::new()));

    Ok(EffectiveConnection {
        connection_name: target
            .connection
            .clone()
            .or_else(|| opts.connection.clone()),
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
        template_dir,
        force_autodetect: opts.force_autodetect,
    })
}

pub(crate) fn current_connection_param_context(
    conn: &EffectiveConnection,
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

pub(crate) fn resolve_runtime_vars_for_connection(
    vars: Value,
    conn: &EffectiveConnection,
) -> Result<Value> {
    resolve_runtime_var_aliases(vars, Some(current_connection_param_context(conn)))
}
