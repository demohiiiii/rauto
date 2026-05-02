use super::{
    InventoryGroup, InventoryGroupSpec, OrchestrationInventory, OrchestrationJob,
    OrchestrationPlan, OrchestrationTarget, OrchestrationTargetDefaults, OrchestrationTargetInput,
};
use crate::EffectiveConnection;
use crate::cli::GlobalOpts;
use crate::config::command_flow_vars::{ConnectionParamContext, resolve_runtime_var_aliases};
use crate::config::connection_store::{list_connections_by_labels_any, load_connection};
use crate::config::template_loader::DEFAULT_DEVICE_PROFILE;
use anyhow::{Context, Result, anyhow};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) fn load_inventory(
    plan: &OrchestrationPlan,
    plan_root: &Path,
) -> Result<OrchestrationInventory> {
    let file_inventory = match &plan.inventory_file {
        Some(path) => {
            let resolved = if path.is_absolute() {
                path.clone()
            } else {
                plan_root.join(path)
            };
            let text = fs::read_to_string(&resolved).with_context(|| {
                format!(
                    "failed to read inventory file '{}'",
                    resolved.to_string_lossy()
                )
            })?;
            Some(
                serde_json::from_str::<OrchestrationInventory>(&text).with_context(|| {
                    format!(
                        "failed to parse inventory file '{}'",
                        resolved.to_string_lossy()
                    )
                })?,
            )
        }
        None => None,
    };

    let mut merged = file_inventory.unwrap_or_default();
    if let Some(inline) = &plan.inventory {
        merged.defaults = merge_target_defaults(&merged.defaults, &inline.defaults);
        for (group, value) in &inline.groups {
            merged.groups.insert(group.clone(), value.clone());
        }
    }
    Ok(merged)
}

fn merge_target_defaults(
    base: &OrchestrationTargetDefaults,
    overlay: &OrchestrationTargetDefaults,
) -> OrchestrationTargetDefaults {
    OrchestrationTargetDefaults {
        username: overlay.username.clone().or_else(|| base.username.clone()),
        password: overlay.password.clone().or_else(|| base.password.clone()),
        port: overlay.port.or(base.port),
        enable_password: overlay
            .enable_password
            .clone()
            .or_else(|| base.enable_password.clone()),
        ssh_security: overlay.ssh_security.or(base.ssh_security),
        linux_shell_flavor: overlay.linux_shell_flavor.or(base.linux_shell_flavor),
        device_profile: overlay
            .device_profile
            .clone()
            .or_else(|| base.device_profile.clone()),
        template_dir: overlay
            .template_dir
            .clone()
            .or_else(|| base.template_dir.clone()),
        vars: merge_values(&base.vars, &overlay.vars),
    }
}

fn inventory_group_spec(group: &InventoryGroup) -> InventoryGroupSpec {
    match group {
        InventoryGroup::Targets(targets) => InventoryGroupSpec {
            defaults: OrchestrationTargetDefaults::default(),
            targets: targets.clone(),
        },
        InventoryGroup::Detailed(spec) => spec.clone(),
    }
}

fn apply_target_defaults(
    defaults: &OrchestrationTargetDefaults,
    mut target: OrchestrationTarget,
) -> OrchestrationTarget {
    if target.username.is_none() {
        target.username = defaults.username.clone();
    }
    if target.password.is_none() {
        target.password = defaults.password.clone();
    }
    if target.port.is_none() {
        target.port = defaults.port;
    }
    if target.enable_password.is_none() {
        target.enable_password = defaults.enable_password.clone();
    }
    if target.ssh_security.is_none() {
        target.ssh_security = defaults.ssh_security;
    }
    if target.linux_shell_flavor.is_none() {
        target.linux_shell_flavor = defaults.linux_shell_flavor;
    }
    if target.device_profile.is_none() {
        target.device_profile = defaults.device_profile.clone();
    }
    if target.template_dir.is_none() {
        target.template_dir = defaults.template_dir.clone();
    }
    target.vars = merge_values(&defaults.vars, &target.vars);
    target
}

fn expand_targets_with_defaults(
    inputs: &[OrchestrationTargetInput],
    defaults: &OrchestrationTargetDefaults,
) -> Vec<OrchestrationTarget> {
    expand_targets(inputs)
        .into_iter()
        .map(|target| apply_target_defaults(defaults, target))
        .collect()
}

pub(crate) fn resolve_job_targets(
    stage_name: &str,
    job: &OrchestrationJob,
    inventory: &OrchestrationInventory,
) -> Result<Vec<OrchestrationTarget>> {
    let mut targets = Vec::new();
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
        let group = inventory.groups.get(normalized).ok_or_else(|| {
            anyhow!(
                "stage '{}' job '{}' references unknown inventory group '{}'",
                stage_name,
                job_label,
                normalized
            )
        })?;
        let group_spec = inventory_group_spec(group);
        let merged_defaults = merge_target_defaults(&inventory.defaults, &group_spec.defaults);
        targets.extend(expand_targets_with_defaults(
            &group_spec.targets,
            &merged_defaults,
        ));
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
            targets.push(apply_target_defaults(
                &inventory.defaults,
                OrchestrationTarget {
                    connection: Some(connection_name),
                    ..OrchestrationTarget::default()
                },
            ));
        }
    }
    targets.extend(expand_targets_with_defaults(
        &job.targets,
        &inventory.defaults,
    ));
    Ok(targets)
}

fn expand_targets(inputs: &[OrchestrationTargetInput]) -> Vec<OrchestrationTarget> {
    inputs
        .iter()
        .map(|item| match item {
            OrchestrationTargetInput::ConnectionName(name) => OrchestrationTarget {
                connection: Some(name.clone()),
                ..OrchestrationTarget::default()
            },
            OrchestrationTargetInput::Detailed(target) => target.as_ref().clone(),
        })
        .collect()
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
        enable_password,
        ssh_security,
        linux_shell_flavor,
        device_profile,
        vars,
        template_dir,
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

pub(crate) fn merge_values(base: &Value, overlay: &Value) -> Value {
    match (base, overlay) {
        (_, Value::Null) => base.clone(),
        (Value::Null, _) => overlay.clone(),
        (Value::Object(base_obj), Value::Object(overlay_obj)) => {
            let mut merged = base_obj.clone();
            for (key, value) in overlay_obj {
                let next = match merged.get(key) {
                    Some(existing) => merge_values(existing, value),
                    None => value.clone(),
                };
                merged.insert(key.clone(), next);
            }
            Value::Object(merged)
        }
        (_, _) => overlay.clone(),
    }
}
