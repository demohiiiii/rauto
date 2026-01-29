mod cli;
mod config;
mod device;
mod template;

use anyhow::Result;
use clap::Parser;
use cli::{Cli, Commands, DeviceCommands};
use config::template_loader;
use device::DeviceClient;
use log::{error, info};
use std::process;
use template::renderer::Renderer;

#[tokio::main]
async fn main() {
    // Initialize logger
    env_logger::init();

    let cli = Cli::parse();

    if let Err(e) = run(cli).await {
        error!("Error: {}", e);
        process::exit(1);
    }
}

async fn run(cli: Cli) -> Result<()> {
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
        Commands::Device(cmd) => match cmd {
            DeviceCommands::List => {
                let profiles = template_loader::list_available_profiles(
                    cli.global_opts.template_dir.as_ref(),
                )?;
                println!("Available Device Profiles:");
                for p in profiles {
                    println!("- {}", p);
                }
            }
            DeviceCommands::Show { name } => {
                // To show, we load it and print debug info?
                // Or try to find the TOML file and print it?
                // rneter internal DeviceHandler is not easily displayable.
                // So we only support showing if it's a TOML file we loaded.
                println!(
                    "Show details for profile '{}' is not fully supported yet.",
                    name
                );
            }
        },
    }

    Ok(())
}
