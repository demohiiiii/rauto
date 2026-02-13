mod cli;
mod config;
mod device;
mod template;
mod web;

use anyhow::Result;
use clap::Parser;
use cli::{Cli, Commands, DeviceCommands, TemplateCommands};
use config::paths::{default_template_dir, ensure_default_layout};
use config::template_loader;
use device::DeviceClient;
use std::fs;
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

            // 4. Connect and Execute
            if let Some(host) = cli.global_opts.host {
                let handler = template_loader::load_device_profile(
                    &cli.global_opts.device_profile,
                    cli.global_opts.template_dir.as_ref(),
                )?;

                let username = cli
                    .global_opts
                    .username
                    .unwrap_or_else(|| "admin".to_string());
                let password = cli.global_opts.password.unwrap_or_else(|| {
                    // TODO: Prompt for password if not provided
                    // For now just empty or panic?
                    // Better to use a simpler approach for MVP
                    std::env::var("RAUTO_PASSWORD").unwrap_or_default()
                });
                let enable_password = cli.global_opts.enable_password;

                info!("Connecting to device...");
                let client = DeviceClient::connect(
                    host,
                    cli.global_opts.port,
                    username,
                    password,
                    enable_password,
                    handler,
                )
                .await?;

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
            } else {
                error!("Host is required for execution (unless --dry-run is used)");
            }
        }
        Commands::Exec(args) => {
            if let Some(host) = cli.global_opts.host {
                let handler = template_loader::load_device_profile(
                    &cli.global_opts.device_profile,
                    cli.global_opts.template_dir.as_ref(),
                )?;

                let username = cli
                    .global_opts
                    .username
                    .unwrap_or_else(|| "admin".to_string());
                let password = cli.global_opts.password.unwrap_or_default(); // TODO: prompt
                let enable_password = cli.global_opts.enable_password;

                let client = DeviceClient::connect(
                    host,
                    cli.global_opts.port,
                    username,
                    password,
                    enable_password,
                    handler,
                )
                .await?;

                info!("Executing command: {}", args.command);
                let output = client.execute(&args.command, args.mode.as_deref()).await?;
                println!("{}", output);
            } else {
                error!("Host is required");
            }
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
                        {
                            if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                                profiles.push(name.to_string());
                            }
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
                let path = templates_root.join("devices").join(format!("{}.toml", safe_name));
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
                let path = templates_root.join("devices").join(format!("{}.toml", safe_name));
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
                let host = cli
                    .global_opts
                    .host
                    .clone()
                    .ok_or_else(|| anyhow::anyhow!("Host is required for connection test"))?;
                let username = cli
                    .global_opts
                    .username
                    .clone()
                    .unwrap_or_else(|| "admin".to_string());
                let password = cli.global_opts.password.clone().unwrap_or_default();
                let handler = template_loader::load_device_profile(
                    &cli.global_opts.device_profile,
                    cli.global_opts.template_dir.as_ref(),
                )?;
                let _client = DeviceClient::connect(
                    host.clone(),
                    cli.global_opts.port,
                    username.clone(),
                    password,
                    cli.global_opts.enable_password.clone(),
                    handler,
                )
                .await?;
                println!(
                    "Connection OK: {}@{}:{} ({})",
                    username, host, cli.global_opts.port, cli.global_opts.device_profile
                );
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
                    if path.is_file() {
                        if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
                            names.push(name.to_string());
                        }
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
    }

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
