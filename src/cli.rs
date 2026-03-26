use crate::agent::report_mode::ManagerReportMode;
use crate::config::ssh_security::SshSecurityProfile;
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
#[allow(clippy::large_enum_variant)]
pub enum Commands {
    /// Render and execute a command template
    Template(TemplateArgs),

    /// Execute a raw command directly
    Exec(ExecArgs),

    /// Start an interactive session
    Interactive(InteractiveArgs),

    /// Start web service with visual UI
    Web(WebArgs),

    /// Start managed agent service for rauto-manager
    Agent(AgentArgs),

    /// Manage device profiles
    #[command(subcommand)]
    Device(DeviceCommands),

    /// Manage saved connection profiles and connectivity checks
    #[command(subcommand)]
    Connection(ConnectionCommands),

    /// Inspect saved connection execution history
    #[command(subcommand)]
    History(HistoryCommands),

    /// Manage blocked command patterns
    #[command(subcommand)]
    Blacklist(BlacklistCommands),

    /// Manage stored command templates
    #[command(subcommand)]
    Templates(TemplateCommands),

    /// Replay or inspect recorded session JSONL data
    Replay(ReplayArgs),

    /// Execute commands as a transaction-like block with rollback support
    Tx(TxArgs),

    /// Execute a transaction workflow loaded from JSON
    TxWorkflow(TxWorkflowArgs),

    /// Execute a multi-device orchestration plan loaded from JSON
    Orchestrate(OrchestrateArgs),

    /// Backup and restore rauto runtime data
    #[command(subcommand)]
    Backup(BackupCommands),
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
        /// Built-in profile name (e.g. cisco, huawei, juniper, linux, fortinet)
        source: String,
        /// Target custom profile name (without .toml)
        name: String,
        /// Overwrite target file if it already exists
        #[arg(long)]
        overwrite: bool,
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
pub enum ConnectionCommands {
    /// Test SSH connection without executing commands
    Test,
    /// List saved connection profiles
    List,
    /// Show a saved connection profile
    Show {
        /// Saved connection profile name
        name: String,
    },
    /// Delete a saved connection profile
    Delete {
        /// Saved connection profile name
        name: String,
    },
    /// Add or update a saved connection profile directly from CLI options
    Add {
        /// Saved connection profile name
        name: String,
    },
    /// Import saved connections from CSV or Excel
    Import {
        /// Path to .csv, .xlsx, .xls, .xlsm, or .xlsb file
        file: PathBuf,
        /// Output import summary as JSON
        #[arg(long)]
        json: bool,
    },
}

#[derive(Subcommand, Debug)]
pub enum HistoryCommands {
    /// Show execution history for a saved connection profile
    List {
        /// Saved connection profile name
        name: String,
        /// Max number of history items
        #[arg(long, default_value_t = 20)]
        limit: usize,
        /// Output history as JSON
        #[arg(long)]
        json: bool,
    },
    /// Show detailed history entry for a saved connection profile
    Show {
        /// Saved connection profile name
        name: String,
        /// History entry ID
        id: String,
        /// Output detail as JSON
        #[arg(long)]
        json: bool,
    },
    /// Delete a history entry for a saved connection profile
    Delete {
        /// Saved connection profile name
        name: String,
        /// History entry ID
        id: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum BlacklistCommands {
    /// List blocked command patterns
    List,
    /// Add a blocked command pattern
    Add {
        /// Pattern to block. Supports '*' wildcard.
        pattern: String,
    },
    /// Delete a blocked command pattern
    Delete {
        /// Pattern to remove. Supports '*' wildcard.
        pattern: String,
    },
    /// Check whether a command would be blocked
    Check {
        /// Command text to evaluate against the blacklist
        command: String,
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
    /// Create a new template
    Create {
        /// Template name
        name: String,
        /// Path to template content file
        #[arg(long)]
        file: Option<PathBuf>,
        /// Inline template content
        #[arg(long)]
        content: Option<String>,
    },
    /// Update an existing template
    Update {
        /// Template name
        name: String,
        /// Path to template content file
        #[arg(long)]
        file: Option<PathBuf>,
        /// Inline template content
        #[arg(long)]
        content: Option<String>,
    },
    /// Delete template file
    Delete {
        /// Template name
        name: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum BackupCommands {
    /// Create a full backup archive of ~/.rauto data
    Create {
        /// Output archive path (.tar.gz). Defaults to ~/.rauto/backups/rauto-backup-<ts>.tar.gz
        #[arg(long)]
        output: Option<PathBuf>,
    },
    /// Restore data from backup archive (.tar.gz)
    Restore {
        /// Backup archive path
        archive: PathBuf,
        /// Replace existing ~/.rauto data before restore
        #[arg(long)]
        replace: bool,
    },
    /// List existing backup archives
    List,
}

#[derive(Args, Debug)]
pub struct TemplateArgs {
    /// Name of the stored command template
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
pub struct TxArgs {
    /// Transaction block name used in logs/recording
    #[arg(long, default_value = "tx-block")]
    pub name: String,

    /// Template file to render commands from (optional)
    #[arg(long)]
    pub template: Option<String>,

    /// Path to a JSON file containing variables for --template
    #[arg(long, short = 'v')]
    pub vars: Option<PathBuf>,

    /// Direct command lines for transaction step(s), can be repeated
    #[arg(long = "command")]
    pub commands: Vec<String>,

    /// Per-step rollback command lines, must match --command count (or rendered commands)
    #[arg(long = "rollback-command")]
    pub rollback_commands: Vec<String>,

    /// Path to file containing per-step rollback commands (one per line)
    #[arg(long)]
    pub rollback_commands_file: Option<PathBuf>,

    /// Path to JSON file containing per-step rollback commands (string array)
    #[arg(long)]
    pub rollback_commands_json: Option<PathBuf>,

    /// Roll back the failed step itself when using per-step rollback
    #[arg(long)]
    pub rollback_on_failure: bool,

    /// Trigger step index for whole-resource rollback (default 0)
    #[arg(long)]
    pub rollback_trigger_step_index: Option<usize>,

    /// Target mode for generated tx steps
    #[arg(long, default_value = "Config")]
    pub mode: String,

    /// Timeout (seconds) for each tx step
    #[arg(long)]
    pub timeout_secs: Option<u64>,

    /// Explicit whole-resource rollback command (optional)
    #[arg(long)]
    pub resource_rollback_command: Option<String>,

    /// Profile/template key for rollback inference (defaults to effective --device-profile)
    #[arg(long)]
    pub template_profile: Option<String>,

    /// Dry run: print planned tx block and exit
    #[arg(long)]
    pub dry_run: bool,

    /// Print tx result as JSON
    #[arg(long)]
    pub json: bool,

    /// Save SSH session recording to this JSONL file
    #[arg(long)]
    pub record_file: Option<PathBuf>,

    /// Session recording level
    #[arg(long, value_enum, default_value_t = RecordLevelOpt::KeyEventsOnly)]
    pub record_level: RecordLevelOpt,
}

#[derive(Args, Debug)]
pub struct TxWorkflowArgs {
    /// Path to TxWorkflow JSON file
    pub workflow_file: PathBuf,

    /// Dry run: print workflow plan and exit (use --json for raw JSON)
    #[arg(long)]
    pub dry_run: bool,

    /// Visualize workflow structure and rollback plan in terminal, then exit
    #[arg(long)]
    pub view: bool,

    /// Print workflow result as JSON
    #[arg(long)]
    pub json: bool,

    /// Save SSH session recording to this JSONL file
    #[arg(long)]
    pub record_file: Option<PathBuf>,

    /// Session recording level
    #[arg(long, value_enum, default_value_t = RecordLevelOpt::KeyEventsOnly)]
    pub record_level: RecordLevelOpt,
}

#[derive(Args, Debug)]
pub struct OrchestrateArgs {
    /// Path to orchestration plan JSON file
    pub plan_file: PathBuf,

    /// Dry run: print orchestration plan and exit (use --json for raw JSON)
    #[arg(long)]
    pub dry_run: bool,

    /// Visualize orchestration structure in terminal, then exit
    #[arg(long)]
    pub view: bool,

    /// Print orchestration result as JSON
    #[arg(long)]
    pub json: bool,

    /// Session recording level for each target execution
    #[arg(long, value_enum, default_value_t = RecordLevelOpt::KeyEventsOnly)]
    pub record_level: RecordLevelOpt,
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

#[derive(Args, Debug)]
pub struct AgentArgs {
    /// Bind address for agent web server
    #[arg(long, default_value = "0.0.0.0")]
    pub bind: String,

    /// Listen port for agent web server
    #[arg(long, default_value = "8123")]
    pub port: u16,

    /// Manager URL for agent registration (e.g. http://manager:3000)
    #[arg(long, env = "RAUTO_MANAGER_URL")]
    pub manager_url: Option<String>,

    /// Agent name for registration (must be unique across all agents)
    #[arg(long, env = "RAUTO_AGENT_NAME")]
    pub agent_name: Option<String>,

    /// API token for authentication and manager callbacks
    #[arg(long, env = "RAUTO_AGENT_TOKEN")]
    pub agent_token: Option<String>,

    /// Manager reporting transport mode
    #[arg(long, env = "RAUTO_MANAGER_REPORT_MODE", value_enum)]
    pub report_mode: Option<ManagerReportMode>,

    /// Path to agent config file (default: ~/.rauto/agent.toml)
    #[arg(long)]
    pub agent_config: Option<PathBuf>,

    /// Periodic device liveness probe/report interval in seconds (0 disables it)
    #[arg(long, env = "RAUTO_AGENT_PROBE_REPORT_INTERVAL")]
    pub probe_report_interval: Option<u64>,
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

    /// SSH security profile for key exchange / cipher compatibility
    #[arg(long, global = true, value_enum)]
    pub ssh_security: Option<SshSecurityProfile>,

    /// Device profile name (e.g. cisco, huawei, linux, fortinet, or custom)
    #[arg(long, short = 'd', global = true)]
    pub device_profile: Option<String>,

    /// Deprecated: stored templates and custom profiles are loaded from SQLite
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
