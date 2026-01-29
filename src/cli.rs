use clap::{Args, Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(name = "rauto", version, about = "Network Device Automation CLI", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    #[command(flatten)]
    pub global_opts: GlobalOpts,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Render and execute a command template
    Template(TemplateArgs),

    /// Execute a raw command directly
    Exec(ExecArgs),

    /// Start an interactive session
    Interactive(InteractiveArgs),

    /// Manage device configuration templates
    #[command(subcommand)]
    Device(DeviceCommands),
}

#[derive(Subcommand, Debug)]
pub enum DeviceCommands {
    /// List available device profiles
    List,
    /// Show details of a specific device profile
    Show {
        /// Name of the device profile
        name: String,
    },
}

#[derive(Args, Debug)]
pub struct TemplateArgs {
    /// Path to the command template file (relative to templates/commands/ or absolute)
    pub template: String,

    /// Path to a JSON/YAML file containing variables for the template
    #[arg(long, short = 'v')]
    pub vars: Option<PathBuf>,

    /// Dry run: render the template but do not execute on device
    #[arg(long)]
    pub dry_run: bool,
}

#[derive(Args, Debug)]
pub struct ExecArgs {
    /// The command string to execute
    pub command: String,

    /// Execution mode (e.g. "Enable", "Config", "Shell")
    #[arg(long, short = 'm')]
    pub mode: Option<String>,
}

#[derive(Args, Debug)]
pub struct InteractiveArgs {}

#[derive(Args, Debug)]
pub struct GlobalOpts {
    /// Device hostname or IP address
    #[arg(long, global = true)]
    pub host: Option<String>,

    /// SSH username
    #[arg(long, short = 'u', global = true)]
    pub username: Option<String>,

    /// SSH password (if not provided, will prompt or use agent)
    #[arg(long, short = 'p', global = true)]
    pub password: Option<String>,

    /// SSH port
    #[arg(long, short = 'P', global = true, default_value = "22")]
    pub port: u16,

    /// Enable password (for Cisco Enable mode etc.)
    #[arg(long, short = 'e', global = true)]
    pub enable_password: Option<String>,

    /// Device profile name (e.g. cisco, huawei, or custom)
    #[arg(long, short = 'd', global = true, default_value = "cisco")]
    pub device_profile: String,

    /// Custom directory for templates
    #[arg(long, global = true, env = "RAUTO_TEMPLATE_DIR")]
    pub template_dir: Option<PathBuf>,
}
