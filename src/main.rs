mod agent;
mod agent_task_grpc;
mod application;
mod cli;
mod config;
mod device;
pub mod domain;
pub mod infrastructure;
pub mod interfaces;
mod manager_grpc;
mod orchestrator;
mod scheduler;
mod template;
mod web;

use anyhow::Result;
use chrono::Local;
use clap::Parser;
use cli::{
    BackupCommands, Cli, Commands, ExecSubcommand, InteractiveSubcommand, OrchestrateSubcommand,
    ShowSubcommand, TxWorkflowSubcommand,
};
use config::backup;
use config::paths::ensure_default_layout;
use std::process;
use tracing::{error, info};
use tracing_subscriber::{EnvFilter, fmt, fmt::format::Writer, fmt::time::FormatTime};
use web::{run_agent_server, run_web_server};

use infrastructure::db;

pub mod task {
    pub use crate::domain::task::*;
}

pub(crate) mod tx_operation {
    pub use crate::domain::execution::tx_operation::*;
}

pub(crate) use cli::runtime::{
    EffectiveConnection, manager_connection_request, manager_execution_context_with_security,
    manager_retry_policy, maybe_save_connection_profile, normalize_recording_jsonl_for_cli_level,
    persist_auto_recording_history_jsonl, read_required_text_input, resolve_autodetect_connection,
    resolve_effective_connection, save_named_connection, to_record_level,
};

fn main() {
    let cli = Cli::parse();
    if let Commands::Completion(args) = &cli.command {
        if let Err(error) = cli::completion::generate(args.shell, &mut std::io::stdout().lock()) {
            eprintln!("Failed to generate completions: {error}");
            process::exit(1);
        }
        return;
    }
    main_async(cli);
}

#[tokio::main]
async fn main_async(cli: Cli) {
    init_tracing(&cli);

    if let Err(error) = launch(cli).await {
        error!("Error: {error:#}");
        process::exit(1);
    }
}

async fn launch(cli: Cli) -> Result<()> {
    use interfaces::runtime::{ExecutionBackend, discover};
    let home = config::paths::rauto_home_dir();
    if let Some(prepared) = cli::execution::prepare(&cli)? {
        match discover(&home).await? {
            ExecutionBackend::Service(client) => {
                let reply = client.execute(&prepared.request).await?;
                return cli::execution::present(reply, &prepared.presentation);
            }
            ExecutionBackend::Local(_lock) => {
                ensure_default_layout()?;
                db::init_sync()?;
                let state = application::state::AppState::new(cli.global_opts, None, None);
                let reply = application::dispatch::execute(state, prepared.request).await;
                return cli::execution::present(reply, &prepared.presentation);
            }
        }
    }
    let runtime_lock = if matches!(
        cli.command,
        Commands::Web(_) | Commands::Serve(_) | Commands::Agent(_)
    ) {
        Some(interfaces::runtime::acquire_service(&home).await?)
    } else if matches!(
        cli.command,
        Commands::Device(cli::DeviceCommands::Test)
            | Commands::Profile(cli::ProfileCommands::Autodetect { .. })
            | Commands::Backup(BackupCommands::Restore { .. })
    ) || matches!(&cli.command, Commands::Device(cli::DeviceCommands::Discover(args)) if args.command.is_none())
    {
        match discover(&home).await? {
            ExecutionBackend::Local(lock) => Some(lock),
            ExecutionBackend::Service(_) => anyhow::bail!(
                "this diagnostic command requires exclusive runtime ownership; stop the service first, or use its Web/API diagnostics"
            ),
        }
    } else {
        None
    };

    if let Err(e) = ensure_default_layout() {
        error!("Failed to initialize ~/.rauto layout: {}", e);
        process::exit(1);
    }
    if let Err(e) = db::init_sync() {
        error!("Failed to initialize SQLite database: {}", e);
        process::exit(1);
    }

    run(cli, runtime_lock.as_ref()).await
}

fn init_tracing(cli: &Cli) {
    let _ = tracing_log::LogTracer::init();
    let default_level = if matches!(
        cli.command,
        Commands::Web(_) | Commands::Serve(_) | Commands::Agent(_)
    ) {
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

async fn run(cli: Cli, runtime_lock: Option<&infrastructure::runtime::RuntimeLock>) -> Result<()> {
    match cli.command {
        Commands::Completion(_) => unreachable!("completion is handled before initialization"),
        Commands::Exec(cmd) => match cmd.command {
            Some(ExecSubcommand::Template { command }) => {
                cli::exec::run_template_command(command)?;
            }
            None => {
                unreachable!("exec uses the shared execution service");
            }
        },
        Commands::Show(cmd) => match cmd.command {
            Some(ShowSubcommand::Object { command }) => {
                cli::exec::run_show_object_command(command)?;
            }
            None => {
                cli::exec::run_show(cmd.run, &cli.global_opts).await?;
            }
        },
        Commands::Interactive(cmd) => match cmd.command {
            Some(InteractiveSubcommand::Template { command }) => {
                cli::interactive::run_interactive_template_command(command)?;
            }
            None => {
                unreachable!("interactive uses the shared execution service");
            }
        },
        Commands::Upload(_) => unreachable!("uploads use the shared execution service"),
        Commands::Config(cmd) => {
            cli::config_fetch::run_config_command(cmd, &cli.global_opts).await?;
        }
        Commands::TxWorkflow(cmd) => match cmd.command {
            Some(TxWorkflowSubcommand::Template { command }) => {
                cli::tx_workflow::run_tx_workflow_template_command(command)?;
            }
            None => {
                unreachable!("workflows use the shared execution service");
            }
        },
        Commands::Orchestrate(cmd) => match cmd.command {
            Some(OrchestrateSubcommand::Template { command }) => {
                orchestrator::run_orchestration_template_command(command)?;
            }
            None => {
                unreachable!("orchestration uses the shared execution service");
            }
        },
        Commands::Schedule(command) => {
            cli::schedule::run_schedule_command(command).await?;
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
        Commands::Web(args) | Commands::Serve(args) => {
            info!("Starting web service on {}:{}", args.bind, args.port);
            run_web_server(
                args,
                cli.global_opts,
                runtime_lock.expect("service holds runtime ownership"),
            )
            .await?;
        }
        Commands::Agent(args) => {
            info!("Starting agent service on {}:{}", args.bind, args.port);
            run_agent_server(
                args,
                cli.global_opts,
                runtime_lock.expect("service holds runtime ownership"),
            )
            .await?;
        }
        Commands::Device(cmd) => match cmd {
            cli::DeviceCommands::Discover(args) => match args.command {
                Some(command) => {
                    cli::discovery::run_device_discovery_command(command, &cli.global_opts).await?;
                }
                None => {
                    cli::discovery::run_device_discovery(args.scan, &cli.global_opts).await?;
                }
            },
            command => {
                cli::ops::run_device_command(command, &cli.global_opts).await?;
            }
        },
        Commands::Credential(cmd) => {
            cli::ops::run_credential_command(cmd)?;
        }
        Commands::Profile(cmd) => {
            cli::ops::run_profile_command(cmd, &cli.global_opts).await?;
        }
        Commands::Inventory(cmd) => {
            cli::ops::run_inventory_command(cmd)?;
        }
        Commands::Session(args) => {
            cli::session::run_session_command(args, &cli.global_opts)?;
        }
        Commands::Blacklist(cmd) => {
            cli::ops::run_blacklist_command(cmd)?;
        }
        Commands::Textfsm(cmd) => {
            cli::exec::run_textfsm_command(cmd)?;
        }
    }

    Ok(())
}
