mod cli;
mod config;
mod device;
mod template;
mod web;

use anyhow::Result;
use clap::Parser;
use cli::{Cli, Commands, DeviceCommands, RecordLevelOpt, TemplateCommands};
use config::connection_store::{
    SavedConnection, delete_connection, list_connections, load_connection, save_connection,
};
use config::paths::{default_template_dir, ensure_default_layout};
use config::template_loader;
use device::DeviceClient;
use rneter::session::{SessionEvent, SessionRecordLevel, SessionRecorder, SessionReplayer};
use std::fs;
use std::path::PathBuf;
use std::process;
use template::renderer::Renderer;
use tracing::{error, info};
use tracing_subscriber::{EnvFilter, fmt};
use web::run_web_server;

#[tokio::main]
async fn main() {
    init_tracing();

    if let Err(e) = ensure_default_layout() {
        error!("Failed to initialize ~/.rauto layout: {}", e);
        process::exit(1);
    }

    let cli = Cli::parse();

    if let Err(e) = run(cli).await {
        error!("Error: {}", e);
        process::exit(1);
    }
}

fn init_tracing() {
    let _ = tracing_log::LogTracer::init();
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let _ = fmt().with_env_filter(filter).with_target(true).try_init();
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
            let client = if args.record_file.is_some() {
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

            let client = if args.record_file.is_some() {
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
            println!("{}", output);
        }
        Commands::Interactive(_) => {
            println!("Interactive mode not yet implemented");
        }
        Commands::Web(args) => {
            info!("Starting web service on {}:{}", args.bind, args.port);
            run_web_server(args.bind, args.port, cli.global_opts).await?;
        }
        Commands::Device(cmd) => match cmd {
            DeviceCommands::List => {
                let mut profiles = template_loader::list_available_profiles(
                    cli.global_opts.template_dir.as_ref(),
                )?;
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

                let templates_root = cli
                    .global_opts
                    .template_dir
                    .clone()
                    .unwrap_or_else(default_template_dir);
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
            DeviceCommands::TestConnection => {
                let conn = resolve_effective_connection(&cli.global_opts)?;
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
                maybe_save_connection_profile(&cli.global_opts, &conn)?;
                println!(
                    "Connection OK: {}@{}:{} ({})",
                    conn.username, conn.host, conn.port, conn.device_profile
                );
            }
            DeviceCommands::ListConnections => {
                let names = list_connections()?;
                if names.is_empty() {
                    println!("-");
                } else {
                    for name in names {
                        println!("- {}", name);
                    }
                }
            }
            DeviceCommands::ShowConnection { name } => {
                let safe = config::connection_store::safe_connection_name(&name)?;
                let data = load_connection(&safe)?;
                println!("# saved connection: {}", safe);
                println!("{}", toml::to_string_pretty(&data)?);
            }
            DeviceCommands::DeleteConnection { name } => {
                let deleted = delete_connection(&name)?;
                if deleted {
                    println!("Deleted saved connection '{}'", name);
                } else {
                    println!("Saved connection '{}' not found", name);
                }
            }
            DeviceCommands::AddConnection { name } => {
                let conn = resolve_effective_connection(&cli.global_opts)?;
                let path = save_named_connection(
                    &name,
                    &conn,
                    cli.global_opts.password.is_some() || cli.global_opts.enable_password.is_some(),
                )?;
                println!(
                    "Saved connection profile '{}' to '{}'",
                    name,
                    path.to_string_lossy()
                );
            }
            DeviceCommands::Diagnose { name, json } => {
                let handler = template_loader::load_device_profile(
                    &name,
                    cli.global_opts.template_dir.as_ref(),
                )?;
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
        },
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

#[derive(Debug, Clone)]
struct EffectiveConnection {
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

fn to_record_level(level: RecordLevelOpt) -> SessionRecordLevel {
    match level {
        RecordLevelOpt::Off => SessionRecordLevel::Off,
        RecordLevelOpt::KeyEventsOnly => SessionRecordLevel::KeyEventsOnly,
        RecordLevelOpt::Full => SessionRecordLevel::Full,
    }
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
