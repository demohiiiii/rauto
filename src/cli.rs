use clap::{Args, Parser, Subcommand, ValueEnum};
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

    /// Start web service with visual UI
    Web(WebArgs),

    /// Manage device configuration templates
    #[command(subcommand)]
    Device(DeviceCommands),

    /// Manage stored command templates
    #[command(subcommand)]
    Templates(TemplateCommands),

    /// Replay or inspect recorded session JSONL data
    Replay(ReplayArgs),
}

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum RecordLevelOpt {
    Off,
    KeyEventsOnly,
    Full,
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
    /// Delete a custom profile
    DeleteCustom {
        /// Custom profile name
        name: String,
    },
    /// Copy a built-in profile to a custom profile file
    CopyBuiltin {
        /// Built-in profile name (e.g. cisco, huawei, juniper)
        source: String,
        /// Target custom profile name (without .toml)
        name: String,
        /// Overwrite target file if it already exists
        #[arg(long)]
        overwrite: bool,
    },
    /// Test SSH connection without executing commands
    TestConnection,
    /// List saved connection profiles
    ListConnections,
    /// Show a saved connection profile
    ShowConnection {
        /// Saved connection profile name
        name: String,
    },
    /// Delete a saved connection profile
    DeleteConnection {
        /// Saved connection profile name
        name: String,
    },
    /// Add or update a saved connection profile directly from CLI options
    AddConnection {
        /// Saved connection profile name
        name: String,
    },
    /// Show execution history for a saved connection profile
    ConnectionHistory {
        /// Saved connection profile name
        name: String,
        /// Max number of history items
        #[arg(long, default_value_t = 20)]
        limit: usize,
        /// Output history as JSON
        #[arg(long)]
        json: bool,
    },
    /// Diagnose state-machine quality for a device profile
    Diagnose {
        /// Profile name (builtin or custom)
        name: String,
        /// Output diagnostics as JSON
        #[arg(long)]
        json: bool,
    },
}

#[derive(Subcommand, Debug)]
pub enum TemplateCommands {
    /// List templates in storage
    List,
    /// Show template content
    Show {
        /// Template name
        name: String,
    },
    /// Delete template file
    Delete {
        /// Template name
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

    /// Save SSH session recording to this JSONL file
    #[arg(long)]
    pub record_file: Option<PathBuf>,

    /// Session recording level
    #[arg(long, value_enum, default_value_t = RecordLevelOpt::KeyEventsOnly)]
    pub record_level: RecordLevelOpt,
}

#[derive(Args, Debug)]
pub struct ExecArgs {
    /// The command string to execute
    pub command: String,

    /// Execution mode (e.g. "Enable", "Config", "Shell")
    #[arg(long, short = 'm')]
    pub mode: Option<String>,

    /// Save SSH session recording to this JSONL file
    #[arg(long)]
    pub record_file: Option<PathBuf>,

    /// Session recording level
    #[arg(long, value_enum, default_value_t = RecordLevelOpt::KeyEventsOnly)]
    pub record_level: RecordLevelOpt,
}

#[derive(Args, Debug)]
pub struct InteractiveArgs {}

#[derive(Args, Debug)]
pub struct ReplayArgs {
    /// Path to session recording JSONL file
    pub record_file: PathBuf,

    /// Command to replay once (matched against recorded command output events)
    #[arg(long)]
    pub command: Option<String>,

    /// Optional mode constraint for replay command (e.g. Enable, Config)
    #[arg(long)]
    pub mode: Option<String>,

    /// List recorded command output entries
    #[arg(long)]
    pub list: bool,
}

#[derive(Args, Debug)]
pub struct WebArgs {
    /// Bind address for web server
    #[arg(long, default_value = "127.0.0.1")]
    pub bind: String,

    /// Listen port for web server
    #[arg(long, default_value = "3000")]
    pub port: u16,
}

#[derive(Args, Debug, Clone)]
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
    #[arg(long = "ssh-port", short = 'P', global = true)]
    pub port: Option<u16>,

    /// Enable password (for Cisco Enable mode etc.)
    #[arg(long, short = 'e', global = true)]
    pub enable_password: Option<String>,

    /// Device profile name (e.g. cisco, huawei, or custom)
    #[arg(long, short = 'd', global = true)]
    pub device_profile: Option<String>,

    /// Custom directory for templates
    #[arg(long, global = true, env = "RAUTO_TEMPLATE_DIR")]
    pub template_dir: Option<PathBuf>,

    /// Use saved connection profile by name
    #[arg(long, global = true)]
    pub connection: Option<String>,

    /// Save effective connection profile with this name after successful connect
    #[arg(long, global = true)]
    pub save_connection: Option<String>,

    /// When used with --save-connection, also save password/enable_password
    #[arg(long, global = true, default_value_t = false)]
    pub save_password: bool,
}
