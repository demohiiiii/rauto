mod agent;
mod agent_task_grpc;
mod cli;
mod config;
mod db;
mod device;
mod manager_grpc;
mod orchestrator;
mod task;
mod template;
mod tx_operation;
mod web;

use anyhow::Result;
use chrono::Local;
use clap::Parser;
use cli::{
    BackupCommands, BlacklistCommands, Cli, CommandFlowArgs, CommandFlowTemplateCommands, Commands,
    ConnectionCommands, DeviceCommands, GlobalOpts, HistoryCommands, InventoryCommands,
    InventoryGroupCommands, RecordLevelOpt, TemplateCommands, TxArgs, TxRunKind, TxWorkflowArgs,
    UploadArgs,
};
use config::command_flow_template::{
    CommandFlowTemplate, ParsedCommandFlowTemplate, build_command_flow_runtime,
    normalize_command_flow_template_body, parse_command_flow_template_with_extensions,
    resolve_command_flow_runtime_default_mode,
};
use config::command_flow_vars::{
    ConnectionParamContext, resolve_command_flow_runtime_vars, resolve_runtime_var_aliases,
};
use config::connection_import::{self, ConnectionImportReport};
use config::connection_store::{
    SavedConnection, delete_connection, list_connections, load_connection, load_connection_raw,
    save_connection,
};
use config::history_store::{self, HistoryBinding};
use config::inventory_store;
use config::linux_shell::LinuxShellFlavor;
use config::paths::ensure_default_layout;
use config::ssh_security::SshSecurityProfile;
use config::template_connection_refs::enrich_context_with_connection_refs_from_template;
use config::template_loader;
use config::template_loader::DEFAULT_DEVICE_PROFILE;
use config::{backup, command_blacklist, content_store};
use device::DeviceClient;
use rneter::device::DeviceHandler;
use rneter::session::{
    ConnectionRequest as ManagerConnectionRequest, ExecutionContext, MANAGER, RollbackPolicy,
    SessionEvent, SessionOperation, SessionRecordLevel, SessionRecorder, SessionReplayer, TxBlock,
    TxOperationStepResult, TxStep, TxWorkflowResult,
};
use serde::Serialize;
use serde_json::Value;
use std::fmt::Write as _;
use std::fs;
use std::path::PathBuf;
use std::process;
use template::renderer::Renderer;
use tracing::{error, info};
use tracing_subscriber::{EnvFilter, fmt, fmt::format::Writer, fmt::time::FormatTime};
use tx_operation::{build_command_tx_block, command_timeout_secs};
use web::{run_agent_server, run_web_server};

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    init_tracing(&cli);

    if let Err(e) = ensure_default_layout() {
        error!("Failed to initialize ~/.rauto layout: {}", e);
        process::exit(1);
    }
    if let Err(e) = db::init_sync() {
        error!("Failed to initialize SQLite database: {}", e);
        process::exit(1);
    }

    if let Err(e) = run(cli).await {
        error!("Error: {e:#}");
        process::exit(1);
    }
}

fn init_tracing(cli: &Cli) {
    let _ = tracing_log::LogTracer::init();
    let default_level = if matches!(cli.command, Commands::Web(_) | Commands::Agent(_)) {
        "info"
    } else {
        "error"
    };
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(default_level));
    let _ = fmt()
        .with_env_filter(filter)
        .with_target(true)
        .with_timer(LocalTimer)
        .try_init();
}

struct LocalTimer;

impl FormatTime for LocalTimer {
    fn format_time(&self, w: &mut Writer<'_>) -> std::fmt::Result {
        write!(w, "{}", Local::now().format("%Y-%m-%d %H:%M:%S%.3f %:z"))
    }
}

pub(crate) fn manager_connection_request(
    username: String,
    host: String,
    port: u16,
    password: String,
    enable_password: Option<String>,
    handler: DeviceHandler,
) -> ManagerConnectionRequest {
    ManagerConnectionRequest::new(username, host, port, password, enable_password, handler)
}

pub(crate) fn manager_execution_context_with_security(
    sys: Option<String>,
    ssh_security: SshSecurityProfile,
) -> ExecutionContext {
    ExecutionContext::new()
        .with_security_options(ssh_security.to_connection_security_options())
        .with_sys(sys)
}

async fn run(cli: Cli) -> Result<()> {
    match cli.command {
        Commands::Template(args) => {
            info!("Running template mode");

            // 1. Prepare Template Renderer
            let renderer = Renderer::new();

            // 2. Load Variables
            let vars = if let Some(vars_path) = args.vars {
                let content = std::fs::read_to_string(&vars_path)?;
                serde_json::from_str(&content)?
            } else {
                serde_json::Value::Null
            };

            // 3. Render Template from the SQLite store
            let rendered_commands = renderer.render_file(&args.template, vars)?;

            println!("--- Rendered Commands ---\n{}", rendered_commands);
            println!("-------------------------");

            if args.dry_run {
                info!("Dry run enabled, skipping execution");
                return Ok(());
            }

            let lines: Vec<String> = rendered_commands
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            command_blacklist::ensure_commands_allowed(
                lines.iter().map(String::as_str),
                "template execution",
            )?;

            let conn = resolve_effective_connection(&cli.global_opts)?;
            let handler = template_loader::load_device_profile_for_connection(
                &conn.device_profile,
                conn.linux_shell_flavor,
            )?;
            let default_mode = template_loader::default_profile_mode(&conn.device_profile)?;

            info!("Connecting to device...");
            let client = DeviceClient::connect_with_recording(
                conn.host.clone(),
                conn.port,
                conn.username.clone(),
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                default_mode.clone(),
                to_record_level(args.record_level),
                conn.ssh_security,
            )
            .await?;

            maybe_save_connection_profile(&cli.global_opts, &conn)?;

            // Split commands by line and execute
            // Ignore empty lines
            info!("Executing {} commands...", lines.len());
            for cmd in lines {
                print!("Executing '{}' ... ", cmd);
                match client.execute(&cmd, None).await {
                    Ok(output) => println!("Success\nOutput:\n{}", output),
                    Err(e) => println!("Failed: {}", e),
                }
            }
            write_recording_if_requested(args.record_file.as_ref(), &client)?;
            persist_auto_recording_history(
                &client,
                &conn,
                "template_execute",
                &format!("template: {}", args.template),
                Some(default_mode.as_str()),
                args.record_level,
            )?;
        }
        Commands::Exec(args) => {
            command_blacklist::ensure_command_allowed(&args.command, "direct execution")?;
            let conn = resolve_effective_connection(&cli.global_opts)?;
            let handler = template_loader::load_device_profile_for_connection(
                &conn.device_profile,
                conn.linux_shell_flavor,
            )?;
            let default_mode = template_loader::default_profile_mode(&conn.device_profile)?;
            let effective_mode =
                template_loader::resolve_profile_mode(&conn.device_profile, args.mode.as_deref())?;

            let client = DeviceClient::connect_with_recording(
                conn.host.clone(),
                conn.port,
                conn.username.clone(),
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                default_mode.clone(),
                to_record_level(args.record_level),
                conn.ssh_security,
            )
            .await?;

            maybe_save_connection_profile(&cli.global_opts, &conn)?;

            info!("Executing command: {}", args.command);
            let output = client.execute(&args.command, Some(&effective_mode)).await?;
            write_recording_if_requested(args.record_file.as_ref(), &client)?;
            persist_auto_recording_history(
                &client,
                &conn,
                "exec",
                &args.command,
                Some(effective_mode.as_str()),
                args.record_level,
            )?;
            println!("{}", output);
        }
        Commands::Flow(args) => {
            run_command_flow(args, &cli.global_opts).await?;
        }
        Commands::FlowTemplate(cmd) => {
            run_command_flow_template_command(cmd)?;
        }
        Commands::Upload(args) => {
            run_upload(args, &cli.global_opts).await?;
        }
        Commands::Interactive(_) => {
            println!("Interactive mode not yet implemented");
        }
        Commands::Tx(args) => {
            run_tx_block(args, &cli.global_opts).await?;
        }
        Commands::TxWorkflow(args) => {
            run_tx_workflow(args, &cli.global_opts).await?;
        }
        Commands::Orchestrate(args) => {
            orchestrator::run(args, &cli.global_opts).await?;
        }
        Commands::Backup(cmd) => match cmd {
            BackupCommands::Create { output } => {
                let path = backup::create_backup(output.as_deref())?;
                println!("Backup created: {}", path.to_string_lossy());
            }
            BackupCommands::Restore { archive, replace } => {
                backup::restore_backup(&archive, replace)?;
                ensure_default_layout()?;
                println!(
                    "Backup restored from '{}' (replace={})",
                    archive.to_string_lossy(),
                    replace
                );
            }
            BackupCommands::List => {
                let files = backup::list_backups()?;
                if files.is_empty() {
                    println!("-");
                } else {
                    for file in files {
                        println!("- {}", file.to_string_lossy());
                    }
                }
            }
        },
        Commands::Web(args) => {
            info!("Starting web service on {}:{}", args.bind, args.port);
            run_web_server(args, cli.global_opts).await?;
        }
        Commands::Agent(args) => {
            info!("Starting agent service on {}:{}", args.bind, args.port);
            run_agent_server(args, cli.global_opts).await?;
        }
        Commands::Device(cmd) => {
            run_device_command(cmd, &cli.global_opts)?;
        }
        Commands::Connection(cmd) => {
            run_connection_command(cmd, &cli.global_opts).await?;
        }
        Commands::Inventory(cmd) => {
            run_inventory_command(cmd)?;
        }
        Commands::History(cmd) => {
            run_history_command(cmd)?;
        }
        Commands::Blacklist(cmd) => {
            run_blacklist_command(cmd)?;
        }
        Commands::Templates(cmd) => match cmd {
            TemplateCommands::List => {
                let names = content_store::list_command_template_names()?;
                if names.is_empty() {
                    println!("-");
                    return Ok(());
                }
                for name in names {
                    println!("- {}", name);
                }
            }
            TemplateCommands::Show { name } => {
                let safe_name = safe_template_name(&name)?;
                let template = content_store::load_command_template(&safe_name)?
                    .ok_or_else(|| anyhow::anyhow!("template '{}' not found", safe_name))?;
                println!("{}", template.content);
            }
            TemplateCommands::Create {
                name,
                file,
                content,
            } => {
                let safe_name = safe_template_name(&name)?;
                let body = read_template_body(file, content)?;
                let created = content_store::create_command_template(&safe_name, &body)?;
                if !created {
                    return Err(anyhow::anyhow!("template '{}' already exists", safe_name));
                }
                println!("Created template '{}'", safe_name);
            }
            TemplateCommands::Update {
                name,
                file,
                content,
            } => {
                let safe_name = safe_template_name(&name)?;
                let body = read_template_body(file, content)?;
                let updated = content_store::update_command_template(&safe_name, &body)?;
                if !updated {
                    return Err(anyhow::anyhow!("template '{}' not found", safe_name));
                }
                println!("Updated template '{}'", safe_name);
            }
            TemplateCommands::Delete { name } => {
                let safe_name = safe_template_name(&name)?;
                let deleted = content_store::delete_command_template(&safe_name)?;
                if !deleted {
                    return Err(anyhow::anyhow!("template '{}' not found", safe_name));
                }
                println!("Deleted template '{}'", safe_name);
            }
        },
        Commands::Replay(args) => {
            let jsonl = fs::read_to_string(&args.record_file)?;
            let mut replayer = SessionReplayer::from_jsonl(&jsonl)?;

            if let Some(ctx) = replayer.initial_context() {
                println!(
                    "# context: device={} prompt={} fsm_prompt={}",
                    ctx.device_addr, ctx.prompt, ctx.fsm_prompt
                );
            }

            if args.list {
                let recorder = SessionRecorder::from_jsonl(&jsonl)?;
                let entries = recorder.entries()?;
                let mut idx = 0usize;
                for entry in entries {
                    if let SessionEvent::CommandOutput {
                        command,
                        mode,
                        success,
                        exit_code,
                        ..
                    } = entry.event
                    {
                        idx += 1;
                        if let Some(exit_code) = exit_code {
                            println!(
                                "{}. mode={} success={} exit_code={} command={}",
                                idx, mode, success, exit_code, command
                            );
                        } else {
                            println!(
                                "{}. mode={} success={} command={}",
                                idx, mode, success, command
                            );
                        }
                    }
                }
                if idx == 0 {
                    println!("-");
                }
            }

            if let Some(command) = args.command {
                let output = if let Some(mode) = args.mode.as_deref() {
                    replayer.replay_next_in_mode(&command, mode)?
                } else {
                    replayer.replay_next(&command)?
                };
                println!("{}", output.content);
            }
        }
    }

    Ok(())
}

fn run_device_command(cmd: DeviceCommands, _global_opts: &GlobalOpts) -> Result<()> {
    match cmd {
        DeviceCommands::List => {
            let mut profiles = template_loader::list_available_profiles()?;
            profiles.sort();
            profiles.dedup();
            println!("Available Device Profiles (builtin + custom):");
            for p in profiles {
                println!("- {}", p);
            }
        }
        DeviceCommands::Show { name } => {
            if let Some(mut profile) = web::storage::builtin_profile_form(&name) {
                println!("# built-in profile: {}", name);
                println!("# source: rneter built-in");
                profile.name = name.clone();
                println!("{}", toml::to_string_pretty(&profile)?);
                return Ok(());
            }
            if let Some(detail) = web::storage::builtin_profile_detail(&name) {
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
                return Err(anyhow::anyhow!("profile '{}' not found", name));
            };
            println!("# custom profile: {}", safe_name);
            println!("# path: {}", stored.locator);
            println!("{}", stored.content);
        }
        DeviceCommands::CopyBuiltin {
            source,
            name,
            overwrite,
        } => {
            let mut profile = if let Some(profile) = web::storage::builtin_profile_form(&source) {
                profile
            } else {
                let builtin_names = web::storage::builtin_profiles()
                    .into_iter()
                    .map(|profile| profile.name)
                    .collect::<Vec<_>>()
                    .join(", ");
                return Err(anyhow::anyhow!(
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
                return Err(anyhow::anyhow!(
                    "Invalid custom profile name '{}'. Use only letters, numbers, '_' or '-'.",
                    name
                ));
            }

            profile.name = normalized.to_string();
            let content = toml::to_string_pretty(&profile)?;
            let exists = content_store::load_custom_profile(normalized)?.is_some();
            if exists && !overwrite {
                return Err(anyhow::anyhow!(
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
        DeviceCommands::DeleteCustom { name } => {
            let safe_name = name.trim().trim_end_matches(".toml");
            if safe_name.is_empty()
                || !safe_name
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
            {
                return Err(anyhow::anyhow!(
                    "Invalid custom profile name '{}'. Use only letters, numbers, '_' or '-'.",
                    name
                ));
            }
            let deleted = content_store::delete_custom_profile(safe_name)?;
            if !deleted {
                return Err(anyhow::anyhow!("Custom profile not found: {}", safe_name));
            }
            println!("Deleted custom profile '{}'", safe_name);
        }
        DeviceCommands::Diagnose { name, json } => {
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

async fn run_connection_command(cmd: ConnectionCommands, global_opts: &GlobalOpts) -> Result<()> {
    match cmd {
        ConnectionCommands::Test => {
            let conn = resolve_effective_connection(global_opts)?;
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
            maybe_save_connection_profile(global_opts, &conn)?;
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
        ConnectionCommands::List => {
            let names = list_connections()?;
            if names.is_empty() {
                println!("-");
            } else {
                for name in names {
                    println!("- {}", name);
                }
            }
        }
        ConnectionCommands::Show { name } => {
            let safe = config::connection_store::safe_connection_name(&name)?;
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
                has_password: config::connection_store::has_saved_password(&data),
                has_enable_password: config::connection_store::has_saved_enable_password(&data),
            };
            println!("# saved connection: {}", safe);
            println!("{}", toml::to_string_pretty(&output)?);
        }
        ConnectionCommands::Delete { name } => {
            let deleted = delete_connection(&name)?;
            if deleted {
                println!("Deleted saved connection '{}'", name);
            } else {
                println!("Saved connection '{}' not found", name);
            }
        }
        ConnectionCommands::Add { name } => {
            let conn = resolve_effective_connection(global_opts)?;
            let path = save_named_connection(
                &name,
                &conn,
                global_opts.password.is_some() || global_opts.enable_password.is_some(),
            )?;
            println!(
                "Saved connection profile '{}' to '{}'",
                name,
                path.to_string_lossy()
            );
        }
        ConnectionCommands::Import { file, json } => {
            let report = connection_import::import_connections_from_path(&file)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&report)?);
            } else {
                print_connection_import_report(&report);
            }
            if report.failed > 0 {
                return Err(anyhow::anyhow!(
                    "connection import completed with {} failed row(s)",
                    report.failed
                ));
            }
        }
    }

    Ok(())
}

fn run_history_command(cmd: HistoryCommands) -> Result<()> {
    match cmd {
        HistoryCommands::List { name, limit, json } => {
            let safe = config::connection_store::safe_connection_name(&name)?;
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
            let safe = config::connection_store::safe_connection_name(&name)?;
            let items = history_store::list_history_by_connection_name(&safe, 0)?;
            let item = items
                .into_iter()
                .find(|entry| entry.id == id)
                .ok_or_else(|| anyhow::anyhow!("history record not found"))?;
            let jsonl = history_store::load_recording_jsonl_by_key(&item.connection_key, &item.id)?
                .ok_or_else(|| anyhow::anyhow!("history record body not found"))?;
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
            let safe = config::connection_store::safe_connection_name(&name)?;
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

fn run_blacklist_command(cmd: BlacklistCommands) -> Result<()> {
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

#[derive(Debug, Clone)]
pub(crate) struct EffectiveConnection {
    connection_name: Option<String>,
    host: String,
    username: String,
    password: String,
    port: u16,
    enable_password: Option<String>,
    ssh_security: SshSecurityProfile,
    linux_shell_flavor: Option<LinuxShellFlavor>,
    device_profile: String,
    vars: serde_json::Value,
    template_dir: Option<PathBuf>,
}

#[derive(Debug, Serialize)]
struct ConnectionShowOutput {
    host: Option<String>,
    username: Option<String>,
    port: Option<u16>,
    ssh_security: Option<SshSecurityProfile>,
    linux_shell_flavor: Option<LinuxShellFlavor>,
    device_profile: Option<String>,
    template_dir: Option<String>,
    enabled: bool,
    labels: Vec<String>,
    groups: Vec<String>,
    vars: serde_json::Value,
    has_password: bool,
    has_enable_password: bool,
}

fn resolve_effective_connection(opts: &cli::GlobalOpts) -> Result<EffectiveConnection> {
    let saved = if let Some(name) = &opts.connection {
        Some(load_connection(name)?)
    } else {
        None
    };

    let host = opts
        .host
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.host.clone()))
        .ok_or_else(|| anyhow::anyhow!("host is required"))?;
    let username = opts
        .username
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.username.clone()))
        .unwrap_or_else(|| "admin".to_string());
    let password = opts
        .password
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.password.clone()))
        .or_else(|| std::env::var("RAUTO_PASSWORD").ok())
        .unwrap_or_default();
    let port = opts
        .port
        .or_else(|| saved.as_ref().and_then(|s| s.port))
        .unwrap_or(22);
    let enable_password = opts
        .enable_password
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.enable_password.clone()));
    let ssh_security = opts
        .ssh_security
        .or_else(|| saved.as_ref().and_then(|s| s.ssh_security))
        .unwrap_or_default();
    let linux_shell_flavor = opts
        .linux_shell_flavor
        .or_else(|| saved.as_ref().and_then(|s| s.linux_shell_flavor));
    let device_profile = opts
        .device_profile
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.device_profile.clone()))
        .unwrap_or_else(|| DEFAULT_DEVICE_PROFILE.to_string());
    let template_dir = opts.template_dir.clone().or_else(|| {
        saved
            .as_ref()
            .and_then(|s| s.template_dir.clone().map(PathBuf::from))
    });
    let vars = saved
        .as_ref()
        .map(|s| s.vars.clone())
        .unwrap_or_else(|| serde_json::json!({}));

    Ok(EffectiveConnection {
        connection_name: opts
            .connection
            .clone()
            .or_else(|| opts.save_connection.clone()),
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

fn maybe_save_connection_profile(opts: &cli::GlobalOpts, conn: &EffectiveConnection) -> Result<()> {
    let Some(name) = &opts.save_connection else {
        return Ok(());
    };

    let path = save_named_connection(name, conn, opts.save_password)?;
    println!(
        "Saved connection profile '{}' to '{}'",
        name,
        path.to_string_lossy()
    );
    Ok(())
}

fn save_named_connection(
    name: &str,
    conn: &EffectiveConnection,
    save_password: bool,
) -> Result<PathBuf> {
    let data = SavedConnection {
        host: Some(conn.host.clone()),
        username: Some(conn.username.clone()),
        password: if save_password {
            Some(conn.password.clone())
        } else {
            None
        },
        password_ref: None,
        port: Some(conn.port),
        enable_password: if save_password {
            conn.enable_password.clone()
        } else {
            None
        },
        enable_password_ref: None,
        ssh_security: Some(conn.ssh_security),
        linux_shell_flavor: conn.linux_shell_flavor,
        device_profile: Some(conn.device_profile.clone()),
        template_dir: conn
            .template_dir
            .as_ref()
            .map(|p| p.to_string_lossy().to_string()),
        enabled: true,
        labels: vec![],
        vars: conn.vars.clone(),
        groups: vec![],
    };

    save_connection(name, &data)
}

fn current_connection_param_context(conn: &EffectiveConnection) -> ConnectionParamContext {
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

fn resolve_flow_runtime_vars(
    template: &CommandFlowTemplate,
    vars: Value,
    conn: &EffectiveConnection,
    current_connection_alias: Option<&str>,
) -> Result<Value> {
    resolve_command_flow_runtime_vars(
        template,
        vars,
        Some(current_connection_param_context(conn)),
        current_connection_alias,
    )
}

fn resolve_runtime_vars_for_connection(vars: Value, conn: &EffectiveConnection) -> Result<Value> {
    resolve_runtime_var_aliases(vars, Some(current_connection_param_context(conn)))
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

fn run_inventory_command(cmd: InventoryCommands) -> Result<()> {
    match cmd {
        InventoryCommands::Group(cmd) => run_inventory_group_command(cmd),
        InventoryCommands::ResolveVars {
            host,
            groups,
            vars_file,
            vars_json,
            json,
        } => {
            let runtime_vars = load_vars_json_input(vars_file.as_ref(), vars_json.as_deref())?;
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
                .ok_or_else(|| anyhow::anyhow!("inventory group '{}' not found", name))?;
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
            let body = read_required_text_input(file.as_ref(), content.as_deref())?;
            let mut group: inventory_store::InventoryGroup = serde_json::from_str(&body)?;
            group.name = name.clone();
            inventory_store::upsert_group(&name, &group)?;
            println!("Upserted inventory group '{}'", name);
            Ok(())
        }
        InventoryGroupCommands::Delete { name } => {
            let deleted = inventory_store::delete_group(&name)?;
            if !deleted {
                return Err(anyhow::anyhow!("inventory group '{}' not found", name));
            }
            println!("Deleted inventory group '{}'", name);
            Ok(())
        }
    }
}

fn run_command_flow_template_command(cmd: CommandFlowTemplateCommands) -> Result<()> {
    match cmd {
        CommandFlowTemplateCommands::List => {
            let names = content_store::list_command_flow_template_names()?;
            if names.is_empty() {
                println!("-");
            } else {
                for name in names {
                    println!("- {}", name);
                }
            }
        }
        CommandFlowTemplateCommands::Show { name } => {
            let safe_name = safe_command_flow_template_name(&name)?;
            let stored =
                content_store::load_command_flow_template(&safe_name)?.ok_or_else(|| {
                    anyhow::anyhow!("command flow template '{}' not found", safe_name)
                })?;
            println!("{}", stored.content);
        }
        CommandFlowTemplateCommands::Create {
            name,
            file,
            content,
        } => {
            let safe_name = safe_command_flow_template_name(&name)?;
            let body = normalize_command_flow_template_body_from_input(&safe_name, file, content)?;
            let created = content_store::create_command_flow_template(&safe_name, &body)?;
            if !created {
                return Err(anyhow::anyhow!(
                    "command flow template '{}' already exists",
                    safe_name
                ));
            }
            println!("Created command flow template '{}'", safe_name);
        }
        CommandFlowTemplateCommands::Update {
            name,
            file,
            content,
        } => {
            let safe_name = safe_command_flow_template_name(&name)?;
            let body = normalize_command_flow_template_body_from_input(&safe_name, file, content)?;
            let updated = content_store::update_command_flow_template(&safe_name, &body)?;
            if !updated {
                return Err(anyhow::anyhow!(
                    "command flow template '{}' not found",
                    safe_name
                ));
            }
            println!("Updated command flow template '{}'", safe_name);
        }
        CommandFlowTemplateCommands::Delete { name } => {
            let safe_name = safe_command_flow_template_name(&name)?;
            let deleted = content_store::delete_command_flow_template(&safe_name)?;
            if !deleted {
                return Err(anyhow::anyhow!(
                    "command flow template '{}' not found",
                    safe_name
                ));
            }
            println!("Deleted command flow template '{}'", safe_name);
        }
    }
    Ok(())
}

async fn run_command_flow(args: CommandFlowArgs, opts: &cli::GlobalOpts) -> Result<()> {
    let parsed_template = resolve_command_flow_template(&args)?;
    let template = &parsed_template.template;
    let vars = load_vars_json_input(args.vars.as_ref(), args.vars_json.as_deref())?;
    let conn = resolve_effective_connection(opts)?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let profile_default_mode = template_loader::default_profile_mode(&conn.device_profile)?;
    let runtime_vars = resolve_flow_runtime_vars(
        template,
        vars,
        &conn,
        parsed_template.current_connection_alias.as_deref(),
    )?;
    let runtime_default_mode = resolve_command_flow_runtime_default_mode(
        None,
        template.default_mode.as_deref(),
        &profile_default_mode,
    );
    let effective_flow_mode = runtime_default_mode
        .clone()
        .or_else(|| {
            template
                .default_mode
                .as_deref()
                .map(str::trim)
                .filter(|mode| !mode.is_empty())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| profile_default_mode.clone());

    let flow = template.to_command_flow(&build_command_flow_runtime(
        runtime_default_mode,
        conn.connection_name.as_deref(),
        &conn.host,
        &conn.username,
        &conn.device_profile,
        runtime_vars,
    ))?;

    command_blacklist::ensure_commands_allowed(
        flow.steps.iter().map(|command| command.command.as_str()),
        "command flow",
    )?;
    if flow.steps.is_empty() {
        return Err(anyhow::anyhow!("command flow has no steps"));
    }

    let client = DeviceClient::connect_with_recording(
        conn.host.clone(),
        conn.port,
        conn.username.clone(),
        conn.password.clone(),
        conn.enable_password.clone(),
        handler,
        profile_default_mode.clone(),
        to_record_level(args.record_level),
        conn.ssh_security,
    )
    .await?;

    maybe_save_connection_profile(opts, &conn)?;

    let result = client.execute_command_flow(flow).await?;
    print_command_flow_output(&result);
    write_recording_if_requested(args.record_file.as_ref(), &client)?;
    persist_auto_recording_history(
        &client,
        &conn,
        "command_flow",
        &format!("template: {}", template.name),
        Some(effective_flow_mode.as_str()),
        args.record_level,
    )?;

    if !result.success {
        return Err(anyhow::anyhow!("command flow completed with errors"));
    }
    Ok(())
}

async fn run_upload(args: UploadArgs, opts: &cli::GlobalOpts) -> Result<()> {
    let conn = resolve_effective_connection(opts)?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let upload = build_upload_request(&args)?;

    let request = manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
        conn.enable_password.clone(),
        handler,
    );
    let context = manager_execution_context_with_security(None, conn.ssh_security);

    let (_sender, recorder) = MANAGER
        .get_with_recording_level_and_context(
            request,
            context.clone(),
            to_record_level(args.record_level),
        )
        .await?;
    let handler_for_upload = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let request = manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
        conn.enable_password.clone(),
        handler_for_upload,
    );
    MANAGER
        .upload_file_with_context(request, upload, context)
        .await?;

    let jsonl = recorder.to_jsonl()?;
    write_recording_text_if_requested(args.record_file.as_ref(), &jsonl)?;
    persist_auto_recording_history_jsonl(
        &jsonl,
        &conn,
        "sftp_upload",
        &format!(
            "{} -> {}",
            args.local_path.to_string_lossy(),
            args.remote_path
        ),
        None,
        args.record_level,
    )?;

    maybe_save_connection_profile(opts, &conn)?;
    println!(
        "Uploaded '{}' to '{}'",
        args.local_path.to_string_lossy(),
        args.remote_path
    );
    Ok(())
}

fn print_command_flow_output(result: &rneter::session::CommandFlowOutput) {
    println!("flow_success: {}", result.success);
    for (index, output) in result.outputs.iter().enumerate() {
        println!(
            "step {} success={} exit_code={}",
            index + 1,
            output.success,
            output
                .exit_code
                .map(|value| value.to_string())
                .unwrap_or_else(|| "-".to_string())
        );
        println!("{}", output.content);
        if index + 1 < result.outputs.len() {
            println!("---");
        }
    }
}

fn build_upload_request(args: &UploadArgs) -> Result<rneter::session::FileUploadRequest> {
    let local_path = args.local_path.to_string_lossy().to_string();
    if !args.local_path.is_file() {
        return Err(anyhow::anyhow!(
            "local upload file '{}' does not exist or is not a file",
            args.local_path.to_string_lossy()
        ));
    }
    let mut request = rneter::session::FileUploadRequest::new(local_path, args.remote_path.clone())
        .with_timeout_secs(args.timeout_secs)
        .with_progress_reporting(args.show_progress);
    if let Some(buffer_size) = args.buffer_size {
        request = request.with_buffer_size(buffer_size);
    }
    Ok(request)
}

const BUILTIN_FLOW_TEMPLATE_PREFIX: &str = "builtin:";
const BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY: &str = "cisco-like-copy";

fn normalize_builtin_command_flow_template_name(raw: &str) -> String {
    raw.trim().to_ascii_lowercase().replace('_', "-")
}

fn parse_builtin_command_flow_template_token(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if !trimmed
        .get(..BUILTIN_FLOW_TEMPLATE_PREFIX.len())
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case(BUILTIN_FLOW_TEMPLATE_PREFIX))
    {
        return None;
    }
    let suffix = trimmed
        .get(BUILTIN_FLOW_TEMPLATE_PREFIX.len()..)
        .unwrap_or("");
    let normalized = normalize_builtin_command_flow_template_name(suffix);
    (!normalized.is_empty()).then_some(normalized)
}

fn load_builtin_command_flow_template_form(name: &str) -> Result<ParsedCommandFlowTemplate> {
    let normalized = normalize_builtin_command_flow_template_name(name);
    match normalized.as_str() {
        BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY => {
            let mut template = rneter::templates::cisco_like_copy_template();
            template.name = BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY.to_string();
            Ok(ParsedCommandFlowTemplate {
                template,
                current_connection_alias: None,
            })
        }
        _ => Err(anyhow::anyhow!(
            "builtin command flow template '{}' not found",
            name.trim()
        )),
    }
}

fn load_command_flow_template_form(name: &str) -> Result<ParsedCommandFlowTemplate> {
    if let Some(builtin_name) = parse_builtin_command_flow_template_token(name) {
        return load_builtin_command_flow_template_form(&builtin_name);
    }
    let safe_name = safe_command_flow_template_name(name)?;
    let stored = content_store::load_command_flow_template(&safe_name)?
        .ok_or_else(|| anyhow::anyhow!("command flow template '{}' not found", safe_name))?;
    parse_command_flow_template_with_extensions(&stored.content, Some(&safe_name))
}

fn resolve_command_flow_template_from_sources(
    template: Option<&str>,
    file: Option<&PathBuf>,
    context: &str,
    inline_name: &str,
    template_flag: &str,
    file_flag: &str,
) -> Result<ParsedCommandFlowTemplate> {
    match (
        template.map(str::trim).filter(|value| !value.is_empty()),
        file,
    ) {
        (Some(name), None) => load_command_flow_template_form(name),
        (None, Some(file)) => {
            let body = fs::read_to_string(file)?;
            parse_command_flow_template_with_extensions(&body, Some(inline_name))
        }
        (Some(_), Some(_)) => Err(anyhow::anyhow!(
            "use either {template_flag} or {file_flag} for {context}, not both"
        )),
        (None, None) => Err(anyhow::anyhow!(
            "{context} requires {template_flag} <name> or {file_flag} <path>"
        )),
    }
}

fn read_required_text_input(file: Option<&PathBuf>, content: Option<&str>) -> Result<String> {
    match (
        file.map(|path| path.as_path()),
        content.map(str::trim).filter(|value| !value.is_empty()),
    ) {
        (Some(path), None) => Ok(fs::read_to_string(path)?),
        (None, Some(inline)) => Ok(inline.to_string()),
        (Some(_), Some(_)) => Err(anyhow::anyhow!(
            "choose either --file or --content, not both"
        )),
        (None, None) => Err(anyhow::anyhow!("one of --file or --content is required")),
    }
}

fn resolve_command_flow_template(args: &CommandFlowArgs) -> Result<ParsedCommandFlowTemplate> {
    let inline_name = args
        .file
        .as_ref()
        .and_then(|value| value.file_stem())
        .and_then(|value| value.to_str())
        .unwrap_or("inline_flow");
    resolve_command_flow_template_from_sources(
        args.template.as_deref(),
        args.file.as_ref(),
        "command flow execution",
        inline_name,
        "--template",
        "--file",
    )
}

fn normalize_command_flow_template_body_from_input(
    name: &str,
    file: Option<PathBuf>,
    content: Option<String>,
) -> Result<String> {
    let body = read_text_body("command flow template", file, content)?;
    normalize_command_flow_template_body(name, &body)
}

pub(crate) fn to_record_level(level: RecordLevelOpt) -> SessionRecordLevel {
    match level {
        RecordLevelOpt::KeyEventsOnly => SessionRecordLevel::KeyEventsOnly,
        RecordLevelOpt::Full => SessionRecordLevel::Full,
    }
}

pub(crate) fn record_level_name(level: RecordLevelOpt) -> &'static str {
    match level {
        RecordLevelOpt::KeyEventsOnly => "key-events-only",
        RecordLevelOpt::Full => "full",
    }
}

fn persist_auto_recording_history(
    client: &DeviceClient,
    conn: &EffectiveConnection,
    operation: &str,
    command_label: &str,
    mode: Option<&str>,
    record_level: RecordLevelOpt,
) -> Result<()> {
    let Some(jsonl) = client.recording_jsonl()? else {
        return Ok(());
    };
    let result = history_store::save_recording(
        HistoryBinding {
            connection_name: conn.connection_name.as_deref(),
            host: &conn.host,
            port: conn.port,
            username: &conn.username,
            device_profile: &conn.device_profile,
        },
        operation,
        command_label,
        mode,
        record_level_name(record_level),
        &jsonl,
    );
    match result {
        Ok(entry) => {
            info!(
                "Auto-saved recording history: {} -> {}",
                entry.connection_key, entry.record_path
            );
        }
        Err(e) => {
            error!("Failed to auto-save recording history: {}", e);
        }
    }
    Ok(())
}

fn write_recording_if_requested(
    record_file: Option<&PathBuf>,
    client: &DeviceClient,
) -> Result<()> {
    let Some(path) = record_file else {
        return Ok(());
    };
    let Some(jsonl) = client.recording_jsonl()? else {
        return Ok(());
    };

    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, jsonl.as_bytes())?;
    println!("Saved session recording to '{}'", path.to_string_lossy());
    Ok(())
}

fn safe_template_name(raw: &str) -> Result<String> {
    let normalized = raw.trim();
    if normalized.is_empty()
        || normalized.contains('/')
        || normalized.contains('\\')
        || normalized.contains("..")
        || !normalized
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' || ch == '.')
    {
        return Err(anyhow::anyhow!("invalid template name"));
    }
    Ok(normalized.to_string())
}

fn safe_command_flow_template_name(raw: &str) -> Result<String> {
    let normalized = raw.trim();
    if normalized.is_empty()
        || normalized.contains('/')
        || normalized.contains('\\')
        || normalized.contains("..")
        || !normalized
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
    {
        return Err(anyhow::anyhow!("invalid command flow template name"));
    }
    Ok(normalized.to_string())
}

fn read_template_body(file: Option<PathBuf>, content: Option<String>) -> Result<String> {
    read_text_body("template", file, content)
}

fn read_text_body(kind: &str, file: Option<PathBuf>, content: Option<String>) -> Result<String> {
    if let Some(text) = content {
        if text.trim().is_empty() {
            return Err(anyhow::anyhow!("{kind} content must not be empty"));
        }
        return Ok(text);
    }
    if let Some(path) = file {
        let text = fs::read_to_string(&path)?;
        if text.trim().is_empty() {
            return Err(anyhow::anyhow!("{kind} file content is empty"));
        }
        return Ok(text);
    }
    Err(anyhow::anyhow!(
        "{kind} content required: use --content or --file"
    ))
}

async fn run_tx_block(args: TxArgs, opts: &cli::GlobalOpts) -> Result<()> {
    let conn = resolve_effective_connection(opts)?;
    let (tx_block, effective_mode) = match args.run_kind {
        TxRunKind::Commands => {
            if args.template.is_none() && args.commands.is_empty() {
                return Err(anyhow::anyhow!(
                    "tx requires at least one --command or a --template"
                ));
            }
            if args.flow_template.is_some()
                || args.flow_file.is_some()
                || args.flow_vars.is_some()
                || args.flow_vars_json.is_some()
                || args.rollback_flow_template.is_some()
                || args.rollback_flow_file.is_some()
                || args.rollback_flow_vars.is_some()
                || args.rollback_flow_vars_json.is_some()
            {
                return Err(anyhow::anyhow!(
                    "command-based tx does not accept --flow-* arguments"
                ));
            }
            if args.rollback_commands_file.is_some() && !args.rollback_commands.is_empty() {
                return Err(anyhow::anyhow!(
                    "use either --rollback-commands-file or repeated --rollback-command"
                ));
            }
            if args.rollback_commands_json.is_some()
                && (args.rollback_commands_file.is_some() || !args.rollback_commands.is_empty())
            {
                return Err(anyhow::anyhow!(
                    "use only one rollback command source: --rollback-commands-json, --rollback-commands-file, or repeated --rollback-command"
                ));
            }
            if !args.rollback_commands.is_empty() && args.resource_rollback_command.is_some() {
                return Err(anyhow::anyhow!(
                    "use either --rollback-command (per-step) or --resource-rollback-command (whole-resource)"
                ));
            }
            if args.rollback_trigger_step_index.is_some()
                && args.resource_rollback_command.is_none()
            {
                return Err(anyhow::anyhow!(
                    "--rollback-trigger-step-index requires --resource-rollback-command"
                ));
            }

            let commands = resolve_tx_commands(&args, &conn)?;
            let mode = match args
                .mode
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                Some(mode) => {
                    template_loader::resolve_profile_mode(&conn.device_profile, Some(mode))?
                }
                None => "Config".to_string(),
            };

            let mut rollback_commands = if let Some(path) = &args.rollback_commands_json {
                let raw = std::fs::read_to_string(path)?;
                let value: Value = serde_json::from_str(&raw)?;
                let array = value
                    .as_array()
                    .ok_or_else(|| anyhow::anyhow!("rollback JSON must be an array of strings"))?;
                array
                    .iter()
                    .map(|v| {
                        v.as_str()
                            .map(|s| s.trim().to_string())
                            .ok_or_else(|| anyhow::anyhow!("rollback JSON array must be strings"))
                    })
                    .collect::<Result<Vec<_>>>()?
            } else if let Some(path) = &args.rollback_commands_file {
                let text = std::fs::read_to_string(path)?;
                text.lines()
                    .map(|s| s.trim().to_string())
                    .collect::<Vec<_>>()
            } else {
                args.rollback_commands.clone()
            };
            while rollback_commands.len() > commands.len()
                && rollback_commands
                    .last()
                    .map(|s| s.trim().is_empty())
                    .unwrap_or(false)
            {
                rollback_commands.pop();
            }
            let tx_block = build_command_tx_block(
                args.name.clone(),
                &mode,
                &commands,
                &rollback_commands,
                args.timeout_secs,
                args.rollback_on_failure,
                args.resource_rollback_command.clone(),
                args.rollback_trigger_step_index,
                false,
            )?;
            (tx_block, mode)
        }
        TxRunKind::CommandFlow => {
            if args.template.is_some()
                || args.vars.is_some()
                || !args.commands.is_empty()
                || !args.rollback_commands.is_empty()
                || args.rollback_commands_file.is_some()
                || args.rollback_commands_json.is_some()
                || args.resource_rollback_command.is_some()
                || args.rollback_trigger_step_index.is_some()
            {
                return Err(anyhow::anyhow!(
                    "command flow tx does not accept command/template rollback arguments"
                ));
            }

            let mode_override = args
                .mode
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|mode| template_loader::resolve_profile_mode(&conn.device_profile, Some(mode)))
                .transpose()?;
            let profile_default_mode = template_loader::default_profile_mode(&conn.device_profile)?;

            let flow_template = resolve_command_flow_template_from_sources(
                args.flow_template.as_deref(),
                args.flow_file.as_ref(),
                "command flow tx execution",
                "inline_tx_flow",
                "--flow-template",
                "--flow-file",
            )?;
            let flow_runtime_default_mode = resolve_command_flow_runtime_default_mode(
                mode_override.as_deref(),
                flow_template.template.default_mode.as_deref(),
                &profile_default_mode,
            );
            let flow_effective_mode = flow_runtime_default_mode
                .clone()
                .or_else(|| {
                    flow_template
                        .template
                        .default_mode
                        .as_deref()
                        .map(str::trim)
                        .filter(|mode| !mode.is_empty())
                        .map(ToOwned::to_owned)
                })
                .unwrap_or_else(|| profile_default_mode.clone());
            let flow_vars =
                load_vars_json_input(args.flow_vars.as_ref(), args.flow_vars_json.as_deref())?;
            let flow_runtime_vars = resolve_flow_runtime_vars(
                &flow_template.template,
                flow_vars,
                &conn,
                flow_template.current_connection_alias.as_deref(),
            )?;
            let mut flow = flow_template
                .template
                .to_command_flow(&build_command_flow_runtime(
                    flow_runtime_default_mode,
                    conn.connection_name.as_deref(),
                    &conn.host,
                    &conn.username,
                    &conn.device_profile,
                    flow_runtime_vars,
                ))?;
            if let Some(timeout_secs) = args.timeout_secs {
                for step in &mut flow.steps {
                    step.timeout = Some(timeout_secs);
                }
            }
            command_blacklist::ensure_commands_allowed(
                flow.steps.iter().map(|step| step.command.as_str()),
                "command flow",
            )?;
            if flow.steps.is_empty() {
                return Err(anyhow::anyhow!("command flow has no steps"));
            }

            let rollback_operation = match (
                args.rollback_flow_template.as_deref(),
                args.rollback_flow_file.as_ref(),
            ) {
                (None, None) => None,
                _ => {
                    let rollback_template = resolve_command_flow_template_from_sources(
                        args.rollback_flow_template.as_deref(),
                        args.rollback_flow_file.as_ref(),
                        "rollback command flow tx execution",
                        "inline_tx_rollback_flow",
                        "--rollback-flow-template",
                        "--rollback-flow-file",
                    )?;
                    let rollback_runtime_default_mode = resolve_command_flow_runtime_default_mode(
                        mode_override.as_deref(),
                        rollback_template.template.default_mode.as_deref(),
                        &profile_default_mode,
                    );
                    let rollback_vars = load_vars_json_input(
                        args.rollback_flow_vars.as_ref(),
                        args.rollback_flow_vars_json.as_deref(),
                    )?;
                    let rollback_runtime_vars = resolve_flow_runtime_vars(
                        &rollback_template.template,
                        rollback_vars,
                        &conn,
                        rollback_template.current_connection_alias.as_deref(),
                    )?;
                    let mut rollback_flow =
                        rollback_template
                            .template
                            .to_command_flow(&build_command_flow_runtime(
                                rollback_runtime_default_mode,
                                conn.connection_name.as_deref(),
                                &conn.host,
                                &conn.username,
                                &conn.device_profile,
                                rollback_runtime_vars,
                            ))?;
                    if let Some(timeout_secs) = args.timeout_secs {
                        for step in &mut rollback_flow.steps {
                            step.timeout = Some(timeout_secs);
                        }
                    }
                    command_blacklist::ensure_commands_allowed(
                        rollback_flow.steps.iter().map(|step| step.command.as_str()),
                        "rollback command flow",
                    )?;
                    if rollback_flow.steps.is_empty() {
                        return Err(anyhow::anyhow!("rollback command flow has no steps"));
                    }
                    Some(SessionOperation::from(rollback_flow))
                }
            };

            let mut step = TxStep::new(SessionOperation::from(flow))
                .with_rollback_on_failure(args.rollback_on_failure);
            if let Some(rollback_operation) = rollback_operation {
                step = step.with_rollback(rollback_operation);
            }
            let tx_block = TxBlock {
                name: args.name.clone(),
                rollback_policy: RollbackPolicy::PerStep,
                steps: vec![step],
                fail_fast: true,
            };
            tx_block.validate()?;
            (tx_block, flow_effective_mode)
        }
    };

    if args.dry_run {
        println!("{}", serde_json::to_string_pretty(&tx_block)?);
        return Ok(());
    }

    command_blacklist::ensure_tx_block_allowed(&tx_block, &format!("tx block '{}'", args.name))?;

    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let request = manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
        conn.enable_password.clone(),
        handler,
    );
    let (_sender, recorder) = MANAGER
        .get_with_recording_level_and_context(
            request,
            manager_execution_context_with_security(None, conn.ssh_security),
            to_record_level(args.record_level),
        )
        .await?;
    let handler_for_tx = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let request = manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
        conn.enable_password.clone(),
        handler_for_tx,
    );
    let tx_result = MANAGER
        .execute_tx_block_with_context(
            request,
            tx_block.clone(),
            manager_execution_context_with_security(None, conn.ssh_security),
        )
        .await?;

    let jsonl = recorder.to_jsonl()?;
    write_recording_text_if_requested(args.record_file.as_ref(), &jsonl)?;
    persist_auto_recording_history_jsonl(
        &jsonl,
        &conn,
        "tx_block",
        &args.name,
        Some(&effective_mode),
        args.record_level,
    )?;

    if args.json {
        println!("{}", serde_json::to_string_pretty(&tx_result)?);
    } else {
        print_tx_result(&tx_result);
    }
    maybe_save_connection_profile(opts, &conn)?;
    Ok(())
}

fn resolve_tx_commands(args: &TxArgs, conn: &EffectiveConnection) -> Result<Vec<String>> {
    let mut commands = Vec::new();
    if let Some(template_name) = &args.template {
        let renderer = Renderer::new();
        let vars = load_vars_json(args.vars.as_ref())?;
        let vars = resolve_runtime_vars_for_connection(vars, conn)?;
        let mut render_context = match vars {
            Value::Null => serde_json::json!({}),
            Value::Object(_) => vars,
            _ => return Err(anyhow::anyhow!("tx vars must be a JSON object")),
        };
        if let Some(stored) = content_store::load_command_template(template_name)? {
            enrich_context_with_connection_refs_from_template(
                &mut render_context,
                &stored.content,
            )?;
        }
        let rendered = renderer.render_file(template_name, render_context)?;
        commands.extend(
            rendered
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
        );
    }
    commands.extend(
        args.commands
            .iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
    );
    if commands.is_empty() {
        return Err(anyhow::anyhow!(
            "no executable commands resolved for tx block"
        ));
    }
    Ok(commands)
}

fn load_vars_json(path: Option<&PathBuf>) -> Result<serde_json::Value> {
    match path {
        Some(p) => {
            let content = fs::read_to_string(p)?;
            Ok(serde_json::from_str(&content)?)
        }
        None => Ok(serde_json::Value::Null),
    }
}

fn load_vars_json_input(
    path: Option<&PathBuf>,
    inline_json: Option<&str>,
) -> Result<serde_json::Value> {
    match (
        path,
        inline_json.map(str::trim).filter(|value| !value.is_empty()),
    ) {
        (Some(_), Some(_)) => Err(anyhow::anyhow!(
            "use either --vars or --vars-json, not both"
        )),
        (Some(path), None) => load_vars_json(Some(path)),
        (None, Some(raw)) => Ok(serde_json::from_str(raw)?),
        (None, None) => Ok(serde_json::Value::Null),
    }
}

fn print_tx_result(result: &rneter::session::TxResult) {
    println!("# tx_block: {}", result.block_name);
    println!("committed: {}", result.committed);
    println!("executed_steps: {}", result.executed_steps);
    println!(
        "rollback: attempted={} succeeded={} steps={}",
        result.rollback_attempted, result.rollback_succeeded, result.rollback_steps
    );
    if let Some(i) = result.failed_step {
        println!("failed_step: {}", i);
    }
    if let Some(reason) = &result.failure_reason {
        println!("failure_reason: {}", reason);
    }
    if !result.rollback_errors.is_empty() {
        println!("rollback_errors: {}", result.rollback_errors.join(" | "));
    }
    if let Some(summary) = &result.block_rollback_operation_summary {
        println!("block_rollback_operation_summary: {}", summary);
    }
    if !result.block_rollback_steps.is_empty() {
        println!("block_rollback_steps:");
        print_operation_step_results("  ", &result.block_rollback_steps);
    }
    if !result.step_results.is_empty() {
        println!("step_results:");
        for step in &result.step_results {
            println!(
                "  - step={} exec={:?} rollback={:?} mode={} operation={}",
                step.step_index,
                step.execution_state,
                step.rollback_state,
                step.mode,
                step.operation_summary
            );
            if let Some(reason) = &step.failure_reason {
                println!("    failure_reason: {}", reason);
            }
            if !step.forward_operation_steps.is_empty() {
                println!("    forward_operation_steps:");
                print_operation_step_results("      ", &step.forward_operation_steps);
            }
            if let Some(summary) = &step.rollback_operation_summary {
                println!("    rollback_operation: {}", summary);
            }
            if let Some(reason) = &step.rollback_reason {
                println!("    rollback_reason: {}", reason);
            }
            if !step.rollback_operation_steps.is_empty() {
                println!("    rollback_operation_steps:");
                print_operation_step_results("      ", &step.rollback_operation_steps);
            }
        }
    }
}

fn print_operation_step_results(prefix: &str, steps: &[TxOperationStepResult]) {
    for step in steps {
        println!(
            "{}- child_step={} success={} mode={} summary={}",
            prefix, step.step_index, step.success, step.mode, step.operation_summary
        );
        if let Some(exit_code) = step.exit_code {
            println!("{}  exit_code: {}", prefix, exit_code);
        }
        if let Some(prompt) = &step.prompt {
            println!("{}  prompt: {}", prefix, prompt);
        }
    }
}

pub(crate) fn persist_auto_recording_history_jsonl(
    jsonl: &str,
    conn: &EffectiveConnection,
    operation: &str,
    command_label: &str,
    mode: Option<&str>,
    record_level: RecordLevelOpt,
) -> Result<()> {
    let result = history_store::save_recording(
        HistoryBinding {
            connection_name: conn.connection_name.as_deref(),
            host: &conn.host,
            port: conn.port,
            username: &conn.username,
            device_profile: &conn.device_profile,
        },
        operation,
        command_label,
        mode,
        record_level_name(record_level),
        jsonl,
    );
    match result {
        Ok(entry) => {
            info!(
                "Auto-saved recording history: {} -> {}",
                entry.connection_key, entry.record_path
            );
        }
        Err(e) => {
            error!("Failed to auto-save recording history: {}", e);
        }
    }
    Ok(())
}

fn write_recording_text_if_requested(record_file: Option<&PathBuf>, jsonl: &str) -> Result<()> {
    let Some(path) = record_file else {
        return Ok(());
    };
    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, jsonl.as_bytes())?;
    println!("Saved session recording to '{}'", path.to_string_lossy());
    Ok(())
}

async fn run_tx_workflow(args: TxWorkflowArgs, opts: &cli::GlobalOpts) -> Result<()> {
    let workflow_text = fs::read_to_string(&args.workflow_file)?;
    let workflow: rneter::session::TxWorkflow = serde_json::from_str(&workflow_text)?;

    if args.view {
        print_tx_workflow_plan(&workflow, Some(&args.workflow_file));
        return Ok(());
    }

    if args.dry_run {
        if args.json {
            println!("{}", serde_json::to_string_pretty(&workflow)?);
        } else {
            print_tx_workflow_plan(&workflow, Some(&args.workflow_file));
        }
        return Ok(());
    }

    command_blacklist::ensure_tx_workflow_allowed(
        &workflow,
        &format!("tx workflow '{}'", workflow.name),
    )?;

    let conn = resolve_effective_connection(opts)?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let request = manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
        conn.enable_password.clone(),
        handler,
    );
    let (_sender, recorder) = MANAGER
        .get_with_recording_level_and_context(
            request,
            manager_execution_context_with_security(None, conn.ssh_security),
            to_record_level(args.record_level),
        )
        .await?;
    let handler_for_tx = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let request = manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
        conn.enable_password.clone(),
        handler_for_tx,
    );
    let workflow_result = MANAGER
        .execute_tx_workflow_with_context(
            request,
            workflow.clone(),
            manager_execution_context_with_security(None, conn.ssh_security),
        )
        .await?;
    let recording_jsonl = recorder.to_jsonl()?;
    write_recording_text_if_requested(args.record_file.as_ref(), &recording_jsonl)?;
    persist_auto_recording_history_jsonl(
        &recording_jsonl,
        &conn,
        "tx_workflow",
        &workflow.name,
        None,
        args.record_level,
    )?;

    if args.json {
        println!("{}", serde_json::to_string_pretty(&workflow_result)?);
    } else {
        print_tx_workflow_result(&workflow_result);
    }
    maybe_save_connection_profile(opts, &conn)?;
    Ok(())
}

fn print_tx_workflow_plan(workflow: &rneter::session::TxWorkflow, source: Option<&PathBuf>) {
    println!("{}", render_tx_workflow_plan(workflow, source));
}

fn render_tx_workflow_plan(
    workflow: &rneter::session::TxWorkflow,
    source: Option<&PathBuf>,
) -> String {
    let ansi = AnsiTheme::detect();
    let mut out = String::new();
    let total_blocks = workflow.blocks.len();
    let total_steps = workflow
        .blocks
        .iter()
        .map(|block| block.steps.len())
        .sum::<usize>();
    let mut per_step_blocks = 0usize;
    let mut whole_resource_blocks = 0usize;
    let mut none_blocks = 0usize;
    for block in &workflow.blocks {
        match &block.rollback_policy {
            RollbackPolicy::PerStep => per_step_blocks += 1,
            RollbackPolicy::WholeResource { .. } => whole_resource_blocks += 1,
            RollbackPolicy::None => none_blocks += 1,
        }
    }

    let _ = writeln!(
        &mut out,
        "{}",
        ansi.header(&format!("# tx_workflow_plan: {}", workflow.name))
    );
    if let Some(path) = source {
        let _ = writeln!(
            &mut out,
            "{}",
            ansi.muted(&format!("file: {}", path.to_string_lossy()))
        );
    }
    let _ = writeln!(
        &mut out,
        "{}",
        ansi.overview(&format!(
            "overview: fail_fast={} blocks={} steps={} policies(per_step={}, whole_resource={}, none={})",
            workflow.fail_fast,
            total_blocks,
            total_steps,
            per_step_blocks,
            whole_resource_blocks,
            none_blocks
        ))
    );
    let _ = writeln!(&mut out);

    for (block_idx, block) in workflow.blocks.iter().enumerate() {
        const BLOCK_META_COLS: [usize; 4] = [11, 26, 11, 18];
        const STEP_INFO_COLS: [usize; 4] = [11, 14, 11, 14];
        let command_value_w = block_command_cell_width(block);
        let step_cmd_cols = [11, command_value_w, 11, command_value_w];

        let block_meta_sep = table_sep(&BLOCK_META_COLS);
        let step_info_sep = table_sep(&STEP_INFO_COLS);
        let step_cmd_sep = table_sep(&step_cmd_cols);

        let _ = writeln!(
            &mut out,
            "{}",
            ansi.block_title(&format!("[Block {}/{}]", block_idx + 1, total_blocks))
        );
        let _ = writeln!(&mut out, "{}", ansi.border(&block_meta_sep));
        let _ = writeln!(
            &mut out,
            "{}",
            table_row(
                &[
                    "name".to_string(),
                    block.name.clone(),
                    "steps".to_string(),
                    block.steps.len().to_string()
                ],
                &BLOCK_META_COLS,
                &[
                    CellStyle::Label,
                    CellStyle::Value,
                    CellStyle::Label,
                    CellStyle::Info,
                ],
                &ansi,
            )
        );
        let _ = writeln!(
            &mut out,
            "{}",
            table_row(
                &[
                    "fail_fast".to_string(),
                    block.fail_fast.to_string(),
                    "steps".to_string(),
                    block.steps.len().to_string()
                ],
                &BLOCK_META_COLS,
                &[
                    CellStyle::Label,
                    if block.fail_fast {
                        CellStyle::Warn
                    } else {
                        CellStyle::Muted
                    },
                    CellStyle::Label,
                    CellStyle::Info,
                ],
                &ansi,
            )
        );
        match &block.rollback_policy {
            RollbackPolicy::None => {
                let _ = writeln!(
                    &mut out,
                    "{}",
                    table_row(
                        &[
                            "policy".to_string(),
                            "none".to_string(),
                            "trigger".to_string(),
                            "-".to_string()
                        ],
                        &BLOCK_META_COLS,
                        &[
                            CellStyle::Label,
                            CellStyle::PolicyNone,
                            CellStyle::Label,
                            CellStyle::Muted,
                        ],
                        &ansi,
                    )
                );
            }
            RollbackPolicy::PerStep => {
                let _ = writeln!(
                    &mut out,
                    "{}",
                    table_row(
                        &[
                            "policy".to_string(),
                            "per_step".to_string(),
                            "trigger".to_string(),
                            "-".to_string()
                        ],
                        &BLOCK_META_COLS,
                        &[
                            CellStyle::Label,
                            CellStyle::PolicyPerStep,
                            CellStyle::Label,
                            CellStyle::Muted,
                        ],
                        &ansi,
                    )
                );
            }
            RollbackPolicy::WholeResource {
                rollback,
                trigger_step_index,
            } => {
                let (rollback_mode, rollback_summary) =
                    operation_mode_and_summary(rollback.as_ref());
                let _ = writeln!(
                    &mut out,
                    "{}",
                    table_row(
                        &[
                            "policy".to_string(),
                            "whole_resource".to_string(),
                            "trigger".to_string(),
                            trigger_step_index.to_string()
                        ],
                        &BLOCK_META_COLS,
                        &[
                            CellStyle::Label,
                            CellStyle::PolicyWhole,
                            CellStyle::Label,
                            CellStyle::Info,
                        ],
                        &ansi,
                    )
                );
                let _ = writeln!(
                    &mut out,
                    "{}",
                    table_row(
                        &[
                            "rb_mode".to_string(),
                            rollback_mode,
                            "rb_timeout".to_string(),
                            command_timeout_secs(rollback.as_ref())
                                .map(|sec| format!("{sec}s"))
                                .unwrap_or_else(|| "-".to_string())
                        ],
                        &BLOCK_META_COLS,
                        &[
                            CellStyle::Label,
                            CellStyle::Info,
                            CellStyle::Label,
                            CellStyle::Info,
                        ],
                        &ansi,
                    )
                );
                let _ = writeln!(&mut out, "{}", ansi.border(&step_cmd_sep));
                let _ = writeln!(
                    &mut out,
                    "{}",
                    table_row(
                        &[
                            "rollback".to_string(),
                            rollback_summary,
                            "-".to_string(),
                            "-".to_string()
                        ],
                        &step_cmd_cols,
                        &[
                            CellStyle::Label,
                            CellStyle::Rollback,
                            CellStyle::Muted,
                            CellStyle::Muted,
                        ],
                        &ansi,
                    )
                );
                let _ = writeln!(&mut out, "{}", ansi.border(&step_cmd_sep));
            }
        }
        let _ = writeln!(&mut out, "{}", ansi.border(&block_meta_sep));

        if block.steps.is_empty() {
            let _ = writeln!(&mut out, "{}", ansi.muted("  (no steps)"));
            let _ = writeln!(&mut out);
            continue;
        }

        for (step_idx, step) in block.steps.iter().enumerate() {
            let timeout = command_timeout_secs(&step.run)
                .map(|sec| format!("{sec}s"))
                .unwrap_or_else(|| "-".to_string());
            let (mode_value, command_value) = operation_mode_and_summary(&step.run);
            let rollback_cmd = step
                .rollback
                .as_ref()
                .map(|operation| operation_mode_and_summary(operation).1)
                .unwrap_or_else(|| "-".to_string());
            let _ = writeln!(
                &mut out,
                "{}",
                ansi.step_title(&format!("  Step {}/{}", step_idx + 1, block.steps.len()))
            );
            let _ = writeln!(&mut out, "  {}", ansi.border(&step_info_sep));
            let _ = writeln!(
                &mut out,
                "  {}",
                table_row(
                    &[
                        "step".to_string(),
                        format!("{}/{}", step_idx + 1, block.steps.len()),
                        "mode".to_string(),
                        mode_value
                    ],
                    &STEP_INFO_COLS,
                    &[
                        CellStyle::Label,
                        CellStyle::Info,
                        CellStyle::Label,
                        CellStyle::Info,
                    ],
                    &ansi,
                )
            );
            let _ = writeln!(
                &mut out,
                "  {}",
                table_row(
                    &[
                        "timeout".to_string(),
                        timeout,
                        "rb_fail".to_string(),
                        if step.rollback_on_failure {
                            "yes".to_string()
                        } else {
                            "no".to_string()
                        }
                    ],
                    &STEP_INFO_COLS,
                    &[
                        CellStyle::Label,
                        CellStyle::Value,
                        CellStyle::Label,
                        if step.rollback_on_failure {
                            CellStyle::Warn
                        } else {
                            CellStyle::Muted
                        },
                    ],
                    &ansi,
                )
            );
            let _ = writeln!(&mut out, "  {}", ansi.border(&step_info_sep));

            let _ = writeln!(&mut out, "  {}", ansi.border(&step_cmd_sep));
            let _ = writeln!(
                &mut out,
                "  {}",
                table_row(
                    &[
                        "command".to_string(),
                        command_value,
                        "rollback".to_string(),
                        rollback_cmd
                    ],
                    &step_cmd_cols,
                    &[
                        CellStyle::Label,
                        CellStyle::Command,
                        CellStyle::Label,
                        CellStyle::Rollback,
                    ],
                    &ansi,
                )
            );
            let _ = writeln!(&mut out, "  {}", ansi.border(&step_cmd_sep));
        }
        let _ = writeln!(&mut out);
    }

    out
}

fn table_sep(widths: &[usize]) -> String {
    let mut line = String::new();
    line.push('+');
    for width in widths {
        line.push_str(&"-".repeat(width + 2));
        line.push('+');
    }
    line
}

fn table_row(
    values: &[String],
    widths: &[usize],
    styles: &[CellStyle],
    ansi: &AnsiTheme,
) -> String {
    let mut line = String::new();
    line.push('|');
    for (idx, (value, width)) in values.iter().zip(widths.iter()).enumerate() {
        line.push(' ');
        let fitted = fit_cell(value, *width);
        let style = styles.get(idx).copied().unwrap_or(CellStyle::Plain);
        line.push_str(&ansi.apply(style, &fitted));
        line.push(' ');
        line.push('|');
    }
    line
}

fn fit_cell(value: &str, width: usize) -> String {
    if width == 0 {
        return String::new();
    }
    let count = value.chars().count();
    let clipped = if count > width {
        if width <= 3 {
            ".".repeat(width)
        } else {
            let mut s = String::new();
            for ch in value.chars().take(width - 3) {
                s.push(ch);
            }
            s.push_str("...");
            s
        }
    } else {
        value.to_string()
    };
    let pad = width.saturating_sub(clipped.chars().count());
    if pad == 0 {
        clipped
    } else {
        format!("{clipped}{}", " ".repeat(pad))
    }
}

fn block_command_cell_width(block: &TxBlock) -> usize {
    let mut max_len = 24usize;
    if let RollbackPolicy::WholeResource { rollback, .. } = &block.rollback_policy {
        max_len = max_len.max(
            operation_mode_and_summary(rollback.as_ref())
                .1
                .chars()
                .count(),
        );
    }
    for step in &block.steps {
        max_len = max_len.max(operation_mode_and_summary(&step.run).1.chars().count());
        if let Some(rollback) = &step.rollback {
            max_len = max_len.max(operation_mode_and_summary(rollback).1.chars().count());
        }
    }
    max_len.clamp(24, 54)
}

fn operation_mode_and_summary(operation: &SessionOperation) -> (String, String) {
    match operation.summary() {
        Ok(summary) => (summary.mode, summary.description),
        Err(_) => ("-".to_string(), "<invalid operation>".to_string()),
    }
}

#[derive(Clone, Copy)]
enum CellStyle {
    Plain,
    Label,
    Value,
    Info,
    Warn,
    Muted,
    Command,
    Rollback,
    PolicyPerStep,
    PolicyWhole,
    PolicyNone,
}

#[derive(Clone, Copy)]
struct AnsiTheme {
    enabled: bool,
}

impl AnsiTheme {
    fn detect() -> Self {
        let no_color = std::env::var_os("NO_COLOR").is_some();
        let term_is_dumb = std::env::var("TERM")
            .map(|v| v.eq_ignore_ascii_case("dumb"))
            .unwrap_or(false);
        Self {
            enabled: !no_color && !term_is_dumb,
        }
    }

    fn paint(&self, code: &str, text: &str) -> String {
        if self.enabled {
            format!("\x1b[{code}m{text}\x1b[0m")
        } else {
            text.to_string()
        }
    }

    fn apply(&self, style: CellStyle, text: &str) -> String {
        match style {
            CellStyle::Plain => text.to_string(),
            CellStyle::Label => self.paint("1;36", text),
            CellStyle::Value => self.paint("97", text),
            CellStyle::Info => self.paint("1;94", text),
            CellStyle::Warn => self.paint("1;33", text),
            CellStyle::Muted => self.paint("90", text),
            CellStyle::Command => self.paint("1;92", text),
            CellStyle::Rollback => self.paint("1;95", text),
            CellStyle::PolicyPerStep => self.paint("1;34", text),
            CellStyle::PolicyWhole => self.paint("1;35", text),
            CellStyle::PolicyNone => self.paint("90", text),
        }
    }

    fn header(&self, text: &str) -> String {
        self.paint("1;96", text)
    }

    fn overview(&self, text: &str) -> String {
        self.paint("1;93", text)
    }

    fn block_title(&self, text: &str) -> String {
        self.paint("1;94", text)
    }

    fn step_title(&self, text: &str) -> String {
        self.paint("1;34", text)
    }

    fn muted(&self, text: &str) -> String {
        self.paint("90", text)
    }

    fn border(&self, text: &str) -> String {
        self.paint("2;37", text)
    }
}

fn print_tx_workflow_result(result: &TxWorkflowResult) {
    println!("# tx_workflow: {}", result.workflow_name);
    println!("committed: {}", result.committed);
    println!(
        "rollback: attempted={} succeeded={}",
        result.rollback_attempted, result.rollback_succeeded
    );
    if let Some(i) = result.failed_block {
        println!("failed_block: {}", i);
    }
    for (idx, block) in result.block_results.iter().enumerate() {
        println!(
            "- block[{idx}] name={} committed={} executed_steps={} rollback_ok={}",
            block.block_name, block.committed, block.executed_steps, block.rollback_succeeded
        );
        if let Some(reason) = &block.failure_reason {
            println!("  failure_reason: {}", reason);
        }
        if !block.rollback_errors.is_empty() {
            println!("  rollback_errors: {}", block.rollback_errors.join(" | "));
        }
    }
    if !result.rollback_errors.is_empty() {
        println!(
            "workflow_rollback_errors: {}",
            result.rollback_errors.join(" | ")
        );
    }
}
