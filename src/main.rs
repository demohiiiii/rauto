mod agent;
mod agent_task_grpc;
mod cli;
#[path = "cli/exec.rs"]
mod cli_exec;
#[path = "cli/flow.rs"]
mod cli_flow;
#[path = "cli/json_templates.rs"]
mod cli_json_templates;
#[path = "cli/ops.rs"]
mod cli_ops;
#[path = "cli/runtime.rs"]
mod cli_runtime;
#[path = "cli/tx_block.rs"]
mod cli_tx_block;
#[path = "cli/tx_workflow.rs"]
mod cli_tx_workflow;
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
use cli::{BackupCommands, Cli, Commands, OrchestrateSubcommand, TxWorkflowSubcommand};
use config::backup;
use config::paths::ensure_default_layout;
use std::process;
use tracing::{error, info};
use tracing_subscriber::{EnvFilter, fmt, fmt::format::Writer, fmt::time::FormatTime};
use web::{run_agent_server, run_web_server};

pub(crate) use cli_runtime::{
    EffectiveConnection, manager_connection_request, manager_execution_context_with_security,
    maybe_save_connection_profile, normalize_recording_jsonl_for_cli_level,
    persist_auto_recording_history, persist_auto_recording_history_jsonl, read_required_text_input,
    resolve_autodetect_connection, resolve_effective_connection, resolve_flow_runtime_vars,
    resolve_runtime_vars_for_connection, save_named_connection, to_record_level,
    write_recording_if_requested, write_recording_text_if_requested,
};

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

async fn run(cli: Cli) -> Result<()> {
    match cli.command {
        Commands::Template(args) => {
            cli_exec::run_template(args, &cli.global_opts).await?;
        }
        Commands::Exec(args) => {
            cli_exec::run_exec(args, &cli.global_opts).await?;
        }
        Commands::Show(args) => {
            cli_exec::run_show(args, &cli.global_opts).await?;
        }
        Commands::ShowObject(cmd) => {
            cli_exec::run_show_object_command(cmd)?;
        }
        Commands::Flow(args) => {
            cli_flow::run_command_flow(args, &cli.global_opts).await?;
        }
        Commands::FlowTemplate(cmd) => {
            cli_flow::run_command_flow_template_command(cmd)?;
        }
        Commands::Upload(args) => {
            cli_flow::run_upload(args, &cli.global_opts).await?;
        }
        Commands::Tx(args) => {
            cli_tx_block::run_tx_block(args, &cli.global_opts).await?;
        }
        Commands::TxWorkflow(cmd) => match cmd.command {
            Some(TxWorkflowSubcommand::Template { command }) => {
                cli_tx_workflow::run_tx_workflow_template_command(command)?;
            }
            None => {
                cli_tx_workflow::run_tx_workflow(cmd.run, &cli.global_opts).await?;
            }
        },
        Commands::Orchestrate(cmd) => match cmd.command {
            Some(OrchestrateSubcommand::Template { command }) => {
                orchestrator::run_orchestration_template_command(command)?;
            }
            None => {
                orchestrator::run(cmd.run, &cli.global_opts).await?;
            }
        },
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
            cli_ops::run_device_command(cmd, &cli.global_opts).await?;
        }
        Commands::Profile(cmd) => {
            cli_ops::run_profile_command(cmd, &cli.global_opts).await?;
        }
        Commands::Inventory(cmd) => {
            cli_ops::run_inventory_command(cmd)?;
        }
        Commands::History(cmd) => {
            cli_ops::run_history_command(cmd)?;
        }
        Commands::Blacklist(cmd) => {
            cli_ops::run_blacklist_command(cmd)?;
        }
        Commands::Templates(cmd) => {
            cli_exec::run_templates_command(cmd)?;
        }
        Commands::Textfsm(cmd) => {
            cli_exec::run_textfsm_command(cmd)?;
        }
        Commands::Replay(args) => {
            cli_exec::run_replay(args)?;
        }
    }

    Ok(())
}
