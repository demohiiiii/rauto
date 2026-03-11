mod cli;
mod config;
mod device;
mod orchestrator;
mod template;
mod web;

use anyhow::Result;
use chrono::Local;
use clap::Parser;
use cli::{
    BackupCommands, Cli, Commands, ConnectionCommands, DeviceCommands, GlobalOpts, HistoryCommands,
    RecordLevelOpt, TemplateCommands, TxArgs, TxWorkflowArgs,
};
use config::backup;
use config::connection_store::{
    SavedConnection, delete_connection, list_connections, load_connection, save_connection,
};
use config::history_store::{self, HistoryBinding};
use config::paths::{default_template_dir, ensure_default_layout};
use config::template_loader;
use device::DeviceClient;
use rneter::session::{
    CommandBlockKind, MANAGER, RollbackPolicy, SessionEvent, SessionRecordLevel, SessionRecorder,
    SessionReplayer, TxBlock, TxStep, TxWorkflowResult,
};
use rneter::templates as rneter_templates;
use serde_json::Value;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use std::process;
use template::renderer::Renderer;
use tracing::{error, info};
use tracing_subscriber::{EnvFilter, fmt, fmt::format::Writer, fmt::time::FormatTime};
use web::run_web_server;

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    init_tracing(&cli);

    if let Err(e) = ensure_default_layout() {
        error!("Failed to initialize ~/.rauto layout: {}", e);
        process::exit(1);
    }

    if let Err(e) = run(cli).await {
        error!("Error: {}", e);
        process::exit(1);
    }
}

fn init_tracing(cli: &Cli) {
    let _ = tracing_log::LogTracer::init();
    let default_level = if matches!(cli.command, Commands::Web(_)) {
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

async fn run(cli: Cli) -> Result<()> {
    let templates_root = cli
        .global_opts
        .template_dir
        .clone()
        .unwrap_or_else(default_template_dir);

    match cli.command {
        Commands::Template(args) => {
            info!("Running template mode");

            // 1. Prepare Template Renderer
            let renderer = Renderer::new(cli.global_opts.template_dir.clone());

            // 2. Load Variables
            let vars = if let Some(vars_path) = args.vars {
                let content = std::fs::read_to_string(&vars_path)?;
                serde_json::from_str(&content)?
            } else {
                serde_json::Value::Null
            };

            // 3. Render Template
            // Check if template arg is a file path or name
            // The renderer handles both logic (if passed as name, looks in paths)
            let rendered_commands = if std::path::Path::new(&args.template).exists()
                && cli.global_opts.template_dir.is_none()
            {
                // If it's a direct file path and no custom dir override, read directly?
                // Creating a renderer with no custom dir defaults to standard paths.
                // But renderer.render_file expects a NAME or relative path generally.
                // Let's rely on renderer's absolute path support.
                renderer.render_file(&args.template, vars)?
            } else {
                renderer.render_file(&args.template, vars)?
            };

            println!("--- Rendered Commands ---\n{}", rendered_commands);
            println!("-------------------------");

            if args.dry_run {
                info!("Dry run enabled, skipping execution");
                return Ok(());
            }

            let conn = match resolve_effective_connection(&cli.global_opts) {
                Ok(conn) => conn,
                Err(_) => {
                    error!("Host is required for execution (unless --dry-run is used)");
                    return Ok(());
                }
            };
            let handler = template_loader::load_device_profile(
                &conn.device_profile,
                conn.template_dir.as_ref(),
            )?;

            info!("Connecting to device...");
            let client = if !matches!(args.record_level, RecordLevelOpt::Off) {
                DeviceClient::connect_with_recording(
                    conn.host.clone(),
                    conn.port,
                    conn.username.clone(),
                    conn.password.clone(),
                    conn.enable_password.clone(),
                    handler,
                    to_record_level(args.record_level),
                )
                .await?
            } else {
                DeviceClient::connect(
                    conn.host.clone(),
                    conn.port,
                    conn.username.clone(),
                    conn.password.clone(),
                    conn.enable_password.clone(),
                    handler,
                )
                .await?
            };

            maybe_save_connection_profile(&cli.global_opts, &conn)?;

            // Split commands by line and execute
            // Ignore empty lines
            let lines: Vec<String> = rendered_commands
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();

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
                None,
                args.record_level,
            )?;
        }
        Commands::Exec(args) => {
            let conn = match resolve_effective_connection(&cli.global_opts) {
                Ok(conn) => conn,
                Err(_) => {
                    error!("Host is required");
                    return Ok(());
                }
            };
            let handler = template_loader::load_device_profile(
                &conn.device_profile,
                conn.template_dir.as_ref(),
            )?;

            let client = if !matches!(args.record_level, RecordLevelOpt::Off) {
                DeviceClient::connect_with_recording(
                    conn.host.clone(),
                    conn.port,
                    conn.username.clone(),
                    conn.password.clone(),
                    conn.enable_password.clone(),
                    handler,
                    to_record_level(args.record_level),
                )
                .await?
            } else {
                DeviceClient::connect(
                    conn.host.clone(),
                    conn.port,
                    conn.username.clone(),
                    conn.password.clone(),
                    conn.enable_password.clone(),
                    handler,
                )
                .await?
            };

            maybe_save_connection_profile(&cli.global_opts, &conn)?;

            info!("Executing command: {}", args.command);
            let output = client.execute(&args.command, args.mode.as_deref()).await?;
            write_recording_if_requested(args.record_file.as_ref(), &client)?;
            persist_auto_recording_history(
                &client,
                &conn,
                "exec",
                &args.command,
                args.mode.as_deref(),
                args.record_level,
            )?;
            println!("{}", output);
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
            run_web_server(args.bind, args.port, cli.global_opts).await?;
        }
        Commands::Device(cmd) => {
            run_device_command(cmd, &cli.global_opts, &templates_root)?;
        }
        Commands::Connection(cmd) => {
            run_connection_command(cmd, &cli.global_opts).await?;
        }
        Commands::History(cmd) => {
            run_history_command(cmd)?;
        }
        Commands::Templates(cmd) => match cmd {
            TemplateCommands::List => {
                let commands_dir = templates_root.join("commands");
                if !commands_dir.exists() {
                    println!("-");
                    return Ok(());
                }
                let mut names = Vec::new();
                for entry in fs::read_dir(&commands_dir)? {
                    let entry = entry?;
                    let path = entry.path();
                    if path.is_file()
                        && let Some(name) = path.file_name().and_then(|s| s.to_str())
                    {
                        names.push(name.to_string());
                    }
                }
                names.sort();
                for name in names {
                    println!("- {}", name);
                }
            }
            TemplateCommands::Show { name } => {
                let safe_name = safe_template_name(&name)?;
                let path = templates_root.join("commands").join(&safe_name);
                if !path.exists() {
                    return Err(anyhow::anyhow!("template '{}' not found", safe_name));
                }
                println!("{}", fs::read_to_string(path)?);
            }
            TemplateCommands::Create {
                name,
                file,
                content,
            } => {
                let safe_name = safe_template_name(&name)?;
                let path = templates_root.join("commands").join(&safe_name);
                if path.exists() {
                    return Err(anyhow::anyhow!("template '{}' already exists", safe_name));
                }
                let body = read_template_body(file, content)?;
                if let Some(parent) = path.parent() {
                    fs::create_dir_all(parent)?;
                }
                fs::write(&path, body.as_bytes())?;
                println!("Created template '{}'", safe_name);
            }
            TemplateCommands::Update {
                name,
                file,
                content,
            } => {
                let safe_name = safe_template_name(&name)?;
                let path = templates_root.join("commands").join(&safe_name);
                if !path.exists() {
                    return Err(anyhow::anyhow!("template '{}' not found", safe_name));
                }
                let body = read_template_body(file, content)?;
                fs::write(&path, body.as_bytes())?;
                println!("Updated template '{}'", safe_name);
            }
            TemplateCommands::Delete { name } => {
                let safe_name = safe_template_name(&name)?;
                let path = templates_root.join("commands").join(&safe_name);
                if !path.exists() {
                    return Err(anyhow::anyhow!("template '{}' not found", safe_name));
                }
                fs::remove_file(&path)?;
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
                        ..
                    } = entry.event
                    {
                        idx += 1;
                        println!(
                            "{}. mode={} success={} command={}",
                            idx, mode, success, command
                        );
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

fn run_device_command(
    cmd: DeviceCommands,
    global_opts: &GlobalOpts,
    templates_root: &Path,
) -> Result<()> {
    match cmd {
        DeviceCommands::List => {
            let mut profiles =
                template_loader::list_available_profiles(global_opts.template_dir.as_ref())?;
            let custom_dir = templates_root.join("devices");
            if custom_dir.exists() {
                for entry in fs::read_dir(&custom_dir)? {
                    let entry = entry?;
                    let path = entry.path();
                    if path
                        .extension()
                        .and_then(|s| s.to_str())
                        .is_some_and(|ext| ext == "toml")
                        && let Some(name) = path.file_stem().and_then(|s| s.to_str())
                    {
                        profiles.push(name.to_string());
                    }
                }
            }
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

            let safe_name = name.trim().trim_end_matches(".toml");
            let path = templates_root
                .join("devices")
                .join(format!("{}.toml", safe_name));
            if !path.exists() {
                return Err(anyhow::anyhow!("profile '{}' not found", name));
            }
            println!("# custom profile: {}", safe_name);
            println!("# path: {}", path.to_string_lossy());
            println!("{}", fs::read_to_string(path)?);
        }
        DeviceCommands::CopyBuiltin {
            source,
            name,
            overwrite,
        } => {
            let mut profile = web::storage::builtin_profile_form(&source).ok_or_else(|| {
                anyhow::anyhow!(
                    "Built-in profile '{}' not found. Try one of: cisco, huawei, h3c, hillstone, juniper, array",
                    source
                )
            })?;

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

            let profiles_dir = templates_root.join("devices");
            fs::create_dir_all(&profiles_dir)?;
            let target = profiles_dir.join(format!("{}.toml", normalized));

            if target.exists() && !overwrite {
                return Err(anyhow::anyhow!(
                    "Target profile already exists: {} (use --overwrite to replace)",
                    target.to_string_lossy()
                ));
            }

            fs::write(&target, content.as_bytes())?;
            println!(
                "Copied built-in profile '{}' to '{}'",
                source,
                target.to_string_lossy()
            );
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
            let path = templates_root
                .join("devices")
                .join(format!("{}.toml", safe_name));
            if !path.exists() {
                return Err(anyhow::anyhow!(
                    "Custom profile not found: {}",
                    path.to_string_lossy()
                ));
            }
            fs::remove_file(&path)?;
            println!("Deleted custom profile '{}'", path.to_string_lossy());
        }
        DeviceCommands::Diagnose { name, json } => {
            let handler =
                template_loader::load_device_profile(&name, global_opts.template_dir.as_ref())?;
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
            let handler = template_loader::load_device_profile(
                &conn.device_profile,
                conn.template_dir.as_ref(),
            )?;
            let _client = DeviceClient::connect(
                conn.host.clone(),
                conn.port,
                conn.username.clone(),
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
            )
            .await?;
            maybe_save_connection_profile(global_opts, &conn)?;
            println!(
                "Connection OK: {}@{}:{} ({})",
                conn.username, conn.host, conn.port, conn.device_profile
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
            let data = load_connection(&safe)?;
            println!("# saved connection: {}", safe);
            println!("{}", toml::to_string_pretty(&data)?);
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
            let jsonl = fs::read_to_string(&item.record_path)?;
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

#[derive(Debug, Clone)]
pub(crate) struct EffectiveConnection {
    connection_name: Option<String>,
    host: String,
    username: String,
    password: String,
    port: u16,
    enable_password: Option<String>,
    device_profile: String,
    template_dir: Option<PathBuf>,
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
    let device_profile = opts
        .device_profile
        .clone()
        .or_else(|| saved.as_ref().and_then(|s| s.device_profile.clone()))
        .unwrap_or_else(|| "cisco".to_string());
    let template_dir = opts.template_dir.clone().or_else(|| {
        saved
            .as_ref()
            .and_then(|s| s.template_dir.clone().map(PathBuf::from))
    });

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
        device_profile,
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
        port: Some(conn.port),
        enable_password: if save_password {
            conn.enable_password.clone()
        } else {
            None
        },
        device_profile: Some(conn.device_profile.clone()),
        template_dir: conn
            .template_dir
            .as_ref()
            .map(|p| p.to_string_lossy().to_string()),
    };

    save_connection(name, &data)
}

fn print_list(label: &str, values: &[String]) {
    if values.is_empty() {
        println!("{}: -", label);
    } else {
        println!("{}: {}", label, values.join(", "));
    }
}

pub(crate) fn to_record_level(level: RecordLevelOpt) -> SessionRecordLevel {
    match level {
        RecordLevelOpt::Off => SessionRecordLevel::Off,
        RecordLevelOpt::KeyEventsOnly => SessionRecordLevel::KeyEventsOnly,
        RecordLevelOpt::Full => SessionRecordLevel::Full,
    }
}

pub(crate) fn record_level_name(level: RecordLevelOpt) -> &'static str {
    match level {
        RecordLevelOpt::Off => "off",
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
    if matches!(record_level, RecordLevelOpt::Off) {
        return Ok(());
    }
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

fn read_template_body(file: Option<PathBuf>, content: Option<String>) -> Result<String> {
    if let Some(text) = content {
        if text.trim().is_empty() {
            return Err(anyhow::anyhow!("template content must not be empty"));
        }
        return Ok(text);
    }
    if let Some(path) = file {
        let text = fs::read_to_string(&path)?;
        if text.trim().is_empty() {
            return Err(anyhow::anyhow!("template file content is empty"));
        }
        return Ok(text);
    }
    Err(anyhow::anyhow!(
        "template content required: use --content or --file"
    ))
}

async fn run_tx_block(args: TxArgs, opts: &cli::GlobalOpts) -> Result<()> {
    if args.template.is_none() && args.commands.is_empty() {
        return Err(anyhow::anyhow!(
            "tx requires at least one --command or a --template"
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
    if args.rollback_trigger_step_index.is_some() && args.resource_rollback_command.is_none() {
        return Err(anyhow::anyhow!(
            "--rollback-trigger-step-index requires --resource-rollback-command"
        ));
    }

    let conn = resolve_effective_connection(opts)?;
    let template_profile = args
        .template_profile
        .clone()
        .unwrap_or_else(|| conn.device_profile.clone());
    let commands = resolve_tx_commands(&args, &conn)?;
    let mode = if args.mode.trim().is_empty() {
        "Config".to_string()
    } else {
        args.mode.clone()
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
    let tx_block = if !rollback_commands.is_empty() {
        if rollback_commands.len() > commands.len() {
            return Err(anyhow::anyhow!(
                "--rollback-command count must not exceed command count"
            ));
        }
        while rollback_commands.len() < commands.len() {
            rollback_commands.push(String::new());
        }
        let steps: Vec<TxStep> = commands
            .iter()
            .enumerate()
            .map(|(idx, cmd)| TxStep {
                mode: mode.to_string(),
                command: cmd.clone(),
                timeout_secs: args.timeout_secs,
                rollback_command: if rollback_commands[idx].trim().is_empty() {
                    None
                } else {
                    Some(rollback_commands[idx].clone())
                },
                rollback_on_failure: args.rollback_on_failure,
            })
            .collect();
        let tx_block = TxBlock {
            name: args.name.clone(),
            kind: CommandBlockKind::Config,
            rollback_policy: RollbackPolicy::PerStep,
            steps,
            fail_fast: true,
        };
        tx_block.validate()?;
        tx_block
    } else {
        let mut tx_block = rneter_templates::build_tx_block(
            &template_profile,
            &args.name,
            &mode,
            &commands,
            args.timeout_secs,
            args.resource_rollback_command.clone(),
        )?;
        if args.rollback_on_failure {
            for step in tx_block.steps.iter_mut() {
                step.rollback_on_failure = true;
            }
        }
        if let Some(trigger) = args.rollback_trigger_step_index {
            match tx_block.rollback_policy {
                RollbackPolicy::WholeResource {
                    mode,
                    undo_command,
                    timeout_secs,
                    ..
                } => {
                    tx_block.rollback_policy = RollbackPolicy::WholeResource {
                        mode,
                        undo_command,
                        timeout_secs,
                        trigger_step_index: trigger,
                    };
                }
                _ => {
                    return Err(anyhow::anyhow!(
                        "--rollback-trigger-step-index requires whole-resource rollback"
                    ));
                }
            }
        }
        tx_block
    };

    if args.dry_run {
        println!("{}", serde_json::to_string_pretty(&tx_block)?);
        return Ok(());
    }

    let handler =
        template_loader::load_device_profile(&conn.device_profile, conn.template_dir.as_ref())?;
    let tx_result = if matches!(args.record_level, RecordLevelOpt::Off) {
        MANAGER
            .execute_tx_block(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                tx_block.clone(),
                None,
            )
            .await?
    } else {
        let (_sender, recorder) = MANAGER
            .get_with_recording_level(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                to_record_level(args.record_level),
            )
            .await?;
        let handler_for_tx =
            template_loader::load_device_profile(&conn.device_profile, conn.template_dir.as_ref())?;
        let result = MANAGER
            .execute_tx_block(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler_for_tx,
                tx_block.clone(),
                None,
            )
            .await?;

        let jsonl = recorder.to_jsonl()?;
        write_recording_text_if_requested(args.record_file.as_ref(), &jsonl)?;
        persist_auto_recording_history_jsonl(
            &jsonl,
            &conn,
            "tx_block",
            &args.name,
            Some(&mode),
            args.record_level,
        )?;
        if args.json {
            println!("{}", serde_json::to_string_pretty(&result)?);
        } else {
            print_tx_result(&result);
        }
        maybe_save_connection_profile(opts, &conn)?;
        return Ok(());
    };

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
        let renderer = Renderer::new(conn.template_dir.clone());
        let vars = load_vars_json(args.vars.as_ref())?;
        let rendered = renderer.render_file(template_name, vars)?;
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
}

pub(crate) fn persist_auto_recording_history_jsonl(
    jsonl: &str,
    conn: &EffectiveConnection,
    operation: &str,
    command_label: &str,
    mode: Option<&str>,
    record_level: RecordLevelOpt,
) -> Result<()> {
    if matches!(record_level, RecordLevelOpt::Off) {
        return Ok(());
    }
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

    let conn = resolve_effective_connection(opts)?;
    let handler =
        template_loader::load_device_profile(&conn.device_profile, conn.template_dir.as_ref())?;
    let (workflow_result, recording_jsonl) = if matches!(args.record_level, RecordLevelOpt::Off) {
        let result = MANAGER
            .execute_tx_workflow(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                workflow.clone(),
                None,
            )
            .await?;
        (result, None)
    } else {
        let (_sender, recorder) = MANAGER
            .get_with_recording_level(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                to_record_level(args.record_level),
            )
            .await?;
        let handler_for_tx =
            template_loader::load_device_profile(&conn.device_profile, conn.template_dir.as_ref())?;
        let result = MANAGER
            .execute_tx_workflow(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler_for_tx,
                workflow.clone(),
                None,
            )
            .await?;
        let jsonl = recorder.to_jsonl()?;
        (result, Some(jsonl))
    };

    if let Some(jsonl) = &recording_jsonl {
        write_recording_text_if_requested(args.record_file.as_ref(), jsonl)?;
        persist_auto_recording_history_jsonl(
            jsonl,
            &conn,
            "tx_workflow",
            &workflow.name,
            None,
            args.record_level,
        )?;
    }

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
                    "kind".to_string(),
                    format!("{:?}", block.kind)
                ],
                &BLOCK_META_COLS,
                &[
                    CellStyle::Label,
                    CellStyle::Value,
                    CellStyle::Label,
                    block_kind_style(block.kind),
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
                mode,
                timeout_secs,
                trigger_step_index,
                undo_command,
            } => {
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
                            "undo_mode".to_string(),
                            mode.clone(),
                            "undo_timeout".to_string(),
                            timeout_secs
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
                            "undo_cmd".to_string(),
                            undo_command.clone(),
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
            let timeout = step
                .timeout_secs
                .map(|sec| format!("{sec}s"))
                .unwrap_or_else(|| "-".to_string());
            let rollback_cmd = step
                .rollback_command
                .as_deref()
                .filter(|cmd| !cmd.trim().is_empty())
                .unwrap_or("-")
                .to_string();
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
                        step.mode.clone()
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
                        step.command.clone(),
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
    if let RollbackPolicy::WholeResource { undo_command, .. } = &block.rollback_policy {
        max_len = max_len.max(undo_command.chars().count());
    }
    for step in &block.steps {
        max_len = max_len.max(step.command.chars().count());
        if let Some(rollback) = &step.rollback_command {
            max_len = max_len.max(rollback.chars().count());
        }
    }
    max_len.clamp(24, 54)
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

fn block_kind_style(kind: CommandBlockKind) -> CellStyle {
    match kind {
        CommandBlockKind::Show => CellStyle::Info,
        CommandBlockKind::Config => CellStyle::Warn,
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
