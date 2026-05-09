use crate::cli::{
    BlacklistCommands, DeviceCommands, GlobalOpts, HistoryCommands, InventoryCommands,
    InventoryGroupCommands, ProfileCommands,
};
use crate::config::connection_import::{self, ConnectionImportReport};
use crate::config::connection_store::{
    self, delete_connection, list_connections, load_connection_raw,
};
use crate::config::history_store;
use crate::config::{command_blacklist, content_store, inventory_store, template_loader};
use crate::device::DeviceClient;
use anyhow::{Result, anyhow};
use rneter::session::DetectRequest;
use rneter::session::SessionRecorder;
use rneter::templates::{DetectConnectPolicy, autodetect_with_context};
use serde::Serialize;

pub(crate) async fn run_profile_command(
    cmd: ProfileCommands,
    global_opts: &GlobalOpts,
) -> Result<()> {
    match cmd {
        ProfileCommands::List => {
            let mut profiles = template_loader::list_available_profiles()?;
            profiles.sort();
            profiles.dedup();
            println!("Available Device Profiles (builtin + custom):");
            for p in profiles {
                println!("- {}", p);
            }
        }
        ProfileCommands::Autodetect => {
            let conn = crate::resolve_effective_connection(global_opts)?;
            let request = DetectRequest::new(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
            );
            let context = crate::manager_execution_context_with_security(None, conn.ssh_security);
            let report = autodetect_with_context(request, context).await?;
            let policy = DetectConnectPolicy::default();
            println!("# device profile autodetect");
            println!("target: {}@{}:{}", conn.username, conn.host, conn.port);
            println!("minimum_confidence: {:?}", policy.minimum_confidence);
            if let Some(best) = report.best_match.as_ref() {
                println!("best_match: {}", best.template_name);
                println!("confidence: {:?}", best.confidence);
                println!("score: {}", best.score);
                println!(
                    "accepted: {}",
                    best.confidence.satisfies_minimum(policy.minimum_confidence)
                );
            } else {
                println!("best_match: -");
                println!("accepted: false");
            }
            println!("details:\n{:#?}", report);
        }
        ProfileCommands::Show { name } => {
            if let Some(mut profile) = crate::web::storage::builtin_profile_form(&name) {
                println!("# built-in profile: {}", name);
                println!("# source: rneter built-in");
                profile.name = name.clone();
                println!("{}", toml::to_string_pretty(&profile)?);
                return Ok(());
            }
            if let Some(detail) = crate::web::storage::builtin_profile_detail(&name) {
                println!("# built-in profile: {}", detail.name);
                println!("# source: {}", detail.source);
                println!("# summary: {}", detail.summary);
                if !detail.aliases.is_empty() {
                    println!("# aliases: {}", detail.aliases.join(", "));
                }
                for note in detail.notes {
                    println!("- {}", note);
                }
                return Ok(());
            }

            let safe_name = name.trim().trim_end_matches(".toml");
            let stored = content_store::load_custom_profile(safe_name)?;
            let Some(stored) = stored else {
                return Err(anyhow!("profile '{}' not found", name));
            };
            println!("# custom profile: {}", safe_name);
            println!("# path: {}", stored.locator);
            println!("{}", stored.content);
        }
        ProfileCommands::CopyBuiltin {
            source,
            name,
            overwrite,
        } => {
            let mut profile =
                if let Some(profile) = crate::web::storage::builtin_profile_form(&source) {
                    profile
                } else {
                    let builtin_names = crate::web::storage::builtin_profiles()
                        .into_iter()
                        .map(|profile| profile.name)
                        .collect::<Vec<_>>()
                        .join(", ");
                    return Err(anyhow!(
                        "Built-in profile '{}' not found. Try one of: {}",
                        source,
                        builtin_names
                    ));
                };

            let normalized = name.trim().trim_end_matches(".toml");
            if normalized.is_empty()
                || !normalized
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
            {
                return Err(anyhow!(
                    "Invalid custom profile name '{}'. Use only letters, numbers, '_' or '-'.",
                    name
                ));
            }

            profile.name = normalized.to_string();
            let content = toml::to_string_pretty(&profile)?;
            let exists = content_store::load_custom_profile(normalized)?.is_some();
            if exists && !overwrite {
                return Err(anyhow!(
                    "Target profile already exists: {} (use --overwrite to replace)",
                    normalized
                ));
            }
            if exists {
                content_store::update_custom_profile(normalized, &content)?;
            } else {
                content_store::create_custom_profile(normalized, &content)?;
            }
            println!("Copied built-in profile '{}' to '{}'", source, normalized);
        }
        ProfileCommands::DeleteCustom { name } => {
            let safe_name = name.trim().trim_end_matches(".toml");
            if safe_name.is_empty()
                || !safe_name
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
            {
                return Err(anyhow!(
                    "Invalid custom profile name '{}'. Use only letters, numbers, '_' or '-'.",
                    name
                ));
            }
            let deleted = content_store::delete_custom_profile(safe_name)?;
            if !deleted {
                return Err(anyhow!("Custom profile not found: {}", safe_name));
            }
            println!("Deleted custom profile '{}'", safe_name);
        }
        ProfileCommands::Diagnose { name, json } => {
            let handler = template_loader::load_device_profile(&name)?;
            let report = handler.diagnose_state_machine();

            if json {
                println!("{}", serde_json::to_string_pretty(&report)?);
                return Ok(());
            }

            println!("# profile: {}", name);
            println!("# has_issues: {}", report.has_issues());
            println!("total_states: {}", report.total_states);
            print_list("entry_states", &report.entry_states);
            print_list("missing_edge_sources", &report.missing_edge_sources);
            print_list("missing_edge_targets", &report.missing_edge_targets);
            print_list("unreachable_states", &report.unreachable_states);
            print_list("dead_end_states", &report.dead_end_states);
            print_list(
                "duplicate_prompt_patterns",
                &report.duplicate_prompt_patterns,
            );
            print_list(
                "potentially_ambiguous_prompt_states",
                &report.potentially_ambiguous_prompt_states,
            );
            print_list("self_loop_only_states", &report.self_loop_only_states);
        }
    }

    Ok(())
}

pub(crate) async fn run_device_command(
    cmd: DeviceCommands,
    global_opts: &GlobalOpts,
) -> Result<()> {
    match cmd {
        DeviceCommands::Test => {
            let conn = crate::resolve_autodetect_connection(crate::resolve_effective_connection(
                global_opts,
            )?)
            .await?;
            let handler = template_loader::load_device_profile_for_connection(
                &conn.device_profile,
                conn.linux_shell_flavor,
            )?;
            let default_mode = template_loader::default_profile_mode(&conn.device_profile)?;
            let _client = DeviceClient::connect(
                conn.host.clone(),
                conn.port,
                conn.username.clone(),
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                default_mode,
                conn.ssh_security,
            )
            .await?;
            crate::maybe_save_connection_profile(global_opts, &conn)?;
            println!(
                "Connection OK: {}@{}:{} ({}, ssh_security={}, linux_shell_flavor={})",
                conn.username,
                conn.host,
                conn.port,
                conn.device_profile,
                conn.ssh_security,
                conn.linux_shell_flavor
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "-".to_string())
            );
        }
        DeviceCommands::List => {
            let names = list_connections()?;
            if names.is_empty() {
                println!("-");
            } else {
                for name in names {
                    println!("- {}", name);
                }
            }
        }
        DeviceCommands::Show { name } => {
            let safe = connection_store::safe_connection_name(&name)?;
            let data = load_connection_raw(&safe)?;
            let output = ConnectionShowOutput {
                host: data.host.clone(),
                username: data.username.clone(),
                port: data.port,
                ssh_security: data.ssh_security,
                linux_shell_flavor: data.linux_shell_flavor,
                device_profile: data.device_profile.clone(),
                template_dir: data.template_dir.clone(),
                enabled: data.enabled,
                labels: data.labels.clone(),
                groups: data.groups.clone(),
                vars: data.vars.clone(),
                has_password: connection_store::has_saved_password(&data),
                has_enable_password: connection_store::has_saved_enable_password(&data),
            };
            println!("# saved device: {}", safe);
            println!("{}", toml::to_string_pretty(&output)?);
        }
        DeviceCommands::Delete { name } => {
            let deleted = delete_connection(&name)?;
            if deleted {
                println!("Deleted saved device '{}'", name);
            } else {
                println!("Saved device '{}' not found", name);
            }
        }
        DeviceCommands::Add { name } => {
            let conn = crate::resolve_effective_connection(global_opts)?;
            let path = crate::save_named_connection(
                &name,
                &conn,
                global_opts.password.is_some() || global_opts.enable_password.is_some(),
            )?;
            println!("Saved device '{}' to '{}'", name, path.to_string_lossy());
        }
        DeviceCommands::Import { file, json } => {
            let report = connection_import::import_connections_from_path(&file)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&report)?);
            } else {
                print_connection_import_report(&report);
            }
            if report.failed > 0 {
                return Err(anyhow!(
                    "connection import completed with {} failed row(s)",
                    report.failed
                ));
            }
        }
    }

    Ok(())
}

pub(crate) fn run_history_command(cmd: HistoryCommands) -> Result<()> {
    match cmd {
        HistoryCommands::List { name, limit, json } => {
            let safe = connection_store::safe_connection_name(&name)?;
            let items = history_store::list_history_by_connection_name(&safe, limit)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&items)?);
                return Ok(());
            }
            println!("# connection: {}", safe);
            if items.is_empty() {
                println!("-");
                return Ok(());
            }
            for item in items {
                println!(
                    "- [{}] {} mode={} level={} file={}",
                    item.ts_ms,
                    item.command_label,
                    item.mode.unwrap_or_else(|| "-".to_string()),
                    item.record_level,
                    item.record_path
                );
            }
        }
        HistoryCommands::Show { name, id, json } => {
            let safe = connection_store::safe_connection_name(&name)?;
            let items = history_store::list_history_by_connection_name(&safe, 0)?;
            let item = items
                .into_iter()
                .find(|entry| entry.id == id)
                .ok_or_else(|| anyhow!("history record not found"))?;
            let jsonl = history_store::load_recording_jsonl_by_key(&item.connection_key, &item.id)?
                .ok_or_else(|| anyhow!("history record body not found"))?;
            let recorder = SessionRecorder::from_jsonl(&jsonl)?;
            let entries = recorder.entries()?;
            if json {
                let value = serde_json::json!({ "meta": item, "entries": entries });
                println!("{}", serde_json::to_string_pretty(&value)?);
                return Ok(());
            }
            println!("id: {}", item.id);
            println!("ts_ms: {}", item.ts_ms);
            println!(
                "connection: {}",
                item.connection_name.clone().unwrap_or("-".to_string())
            );
            println!("host: {}", item.host);
            println!("port: {}", item.port);
            println!("username: {}", item.username);
            println!("device_profile: {}", item.device_profile);
            println!("operation: {}", item.operation);
            println!("command_label: {}", item.command_label);
            println!("mode: {}", item.mode.clone().unwrap_or("-".to_string()));
            println!("record_level: {}", item.record_level);
            println!("record_path: {}", item.record_path);
            println!("entries: {}", entries.len());
        }
        HistoryCommands::Delete { name, id } => {
            let safe = connection_store::safe_connection_name(&name)?;
            let deleted = history_store::delete_history_by_connection_name(&safe, &id)?;
            if deleted {
                println!("Deleted history record '{}'", id);
            } else {
                println!("History record '{}' not found", id);
            }
        }
    }
    Ok(())
}

pub(crate) fn run_blacklist_command(cmd: BlacklistCommands) -> Result<()> {
    match cmd {
        BlacklistCommands::List => {
            let patterns = command_blacklist::list_patterns()?;
            if patterns.is_empty() {
                println!("-");
            } else {
                for pattern in patterns {
                    println!("- {}", pattern);
                }
            }
            println!(
                "# file: {}",
                command_blacklist::storage_path().to_string_lossy()
            );
        }
        BlacklistCommands::Add { pattern } => {
            let (added, path) = command_blacklist::add_pattern(&pattern)?;
            if added {
                println!(
                    "Added blacklist pattern '{}' to '{}'",
                    pattern,
                    path.to_string_lossy()
                );
            } else {
                println!("Blacklist pattern '{}' already exists", pattern);
            }
        }
        BlacklistCommands::Delete { pattern } => {
            let deleted = command_blacklist::delete_pattern(&pattern)?;
            if deleted {
                println!("Deleted blacklist pattern '{}'", pattern);
            } else {
                println!("Blacklist pattern '{}' not found", pattern);
            }
        }
        BlacklistCommands::Check { command } => {
            if let Some(blocked) = command_blacklist::find_blocked_command(&command)? {
                println!(
                    "blocked: pattern='{}' command='{}'",
                    blocked.pattern, blocked.command
                );
            } else {
                println!("allowed");
            }
        }
    }

    Ok(())
}

pub(crate) fn run_inventory_command(cmd: InventoryCommands) -> Result<()> {
    match cmd {
        InventoryCommands::Group(cmd) => run_inventory_group_command(cmd),
        InventoryCommands::ResolveVars {
            host,
            groups,
            vars_file,
            vars_json,
            json,
        } => {
            let runtime_vars = crate::cli_tx_block::load_vars_json_input(
                vars_file.as_ref(),
                vars_json.as_deref(),
            )?;
            let resolution = inventory_store::resolve_vars(host.as_deref(), &groups, runtime_vars)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&resolution)?);
            } else {
                println!("host: {}", resolution.host_name.as_deref().unwrap_or("-"));
                print_list("groups", &resolution.group_names);
                println!(
                    "merged_vars:\n{}",
                    serde_json::to_string_pretty(&resolution.merged_vars)?
                );
            }
            Ok(())
        }
    }
}

fn run_inventory_group_command(cmd: InventoryGroupCommands) -> Result<()> {
    match cmd {
        InventoryGroupCommands::List { json } => {
            let groups = inventory_store::list_groups()?;
            if json {
                println!("{}", serde_json::to_string_pretty(&groups)?);
            } else if groups.is_empty() {
                println!("-");
            } else {
                for group in groups {
                    println!(
                        "- {} [hosts={}] {}",
                        group.name,
                        group.hosts.len(),
                        group.description.as_deref().unwrap_or("")
                    );
                }
            }
            Ok(())
        }
        InventoryGroupCommands::Show { name, json } => {
            let group = inventory_store::get_group(&name)?
                .ok_or_else(|| anyhow!("inventory group '{}' not found", name))?;
            if json {
                println!("{}", serde_json::to_string_pretty(&group)?);
            } else {
                println!("name: {}", group.name);
                println!(
                    "description: {}",
                    group.description.as_deref().unwrap_or("-")
                );
                print_list("hosts", &group.hosts);
                println!("vars:\n{}", serde_json::to_string_pretty(&group.vars)?);
            }
            Ok(())
        }
        InventoryGroupCommands::Upsert {
            name,
            file,
            content,
        } => {
            let body = crate::read_required_text_input(file.as_ref(), content.as_deref())?;
            let mut group: inventory_store::InventoryGroup = serde_json::from_str(&body)?;
            group.name = name.clone();
            inventory_store::upsert_group(&name, &group)?;
            println!("Upserted inventory group '{}'", name);
            Ok(())
        }
        InventoryGroupCommands::Delete { name } => {
            let deleted = inventory_store::delete_group(&name)?;
            if !deleted {
                return Err(anyhow!("inventory group '{}' not found", name));
            }
            println!("Deleted inventory group '{}'", name);
            Ok(())
        }
    }
}

#[derive(Debug, Serialize)]
struct ConnectionShowOutput {
    host: Option<String>,
    username: Option<String>,
    port: Option<u16>,
    ssh_security: Option<crate::config::ssh_security::SshSecurityProfile>,
    linux_shell_flavor: Option<crate::config::linux_shell::LinuxShellFlavor>,
    device_profile: Option<String>,
    template_dir: Option<String>,
    enabled: bool,
    labels: Vec<String>,
    groups: Vec<String>,
    vars: serde_json::Value,
    has_password: bool,
    has_enable_password: bool,
}

fn print_list(label: &str, values: &[String]) {
    if values.is_empty() {
        println!("{}: -", label);
    } else {
        println!("{}: {}", label, values.join(", "));
    }
}

fn print_connection_import_report(report: &ConnectionImportReport) {
    println!(
        "Imported connections from '{}' (total={}, imported={}, created={}, updated={}, failed={})",
        report.file_name,
        report.total_rows,
        report.imported,
        report.created,
        report.updated,
        report.failed
    );
    if report.failures.is_empty() {
        return;
    }
    println!("# failed rows");
    for failure in &report.failures {
        if let Some(name) = failure.name.as_deref() {
            println!("- row {} [{}]: {}", failure.row, name, failure.message);
        } else {
            println!("- row {}: {}", failure.row, failure.message);
        }
    }
}
