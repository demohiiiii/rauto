use super::args::{
    AgentArgs, CommandFlowArgs, ExecArgs, GlobalOpts, OrchestrateArgs, ReplayArgs, TemplateArgs,
    TxArgs, TxWorkflowArgs, UploadArgs, WebArgs,
};
use clap::{Parser, Subcommand};
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

    /// Execute a reusable interactive command flow template
    #[command(name = "flow")]
    Flow(CommandFlowArgs),

    /// Manage saved command flow templates
    #[command(name = "flow-template")]
    #[command(subcommand)]
    FlowTemplate(CommandFlowTemplateCommands),

    /// Upload a local file to the remote host over SFTP
    Upload(UploadArgs),

    /// Start web service with visual UI
    Web(WebArgs),

    /// Start managed agent service for rauto-manager
    Agent(AgentArgs),

    /// Manage saved device connections and connectivity checks
    #[command(visible_alias = "connection")]
    #[command(subcommand)]
    Device(DeviceCommands),

    /// Manage device profiles
    #[command(subcommand)]
    Profile(ProfileCommands),

    /// Manage inventory groups and variable resolution over saved connections
    #[command(subcommand)]
    Inventory(InventoryCommands),

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

#[derive(Subcommand, Debug)]
pub enum CommandFlowTemplateCommands {
    /// List saved command flow templates
    List,
    /// Show a saved command flow template
    Show {
        /// Command flow template name
        name: String,
    },
    /// Create a new command flow template
    Create {
        /// Command flow template name
        name: String,
        /// Path to TOML content file
        #[arg(long)]
        file: Option<PathBuf>,
        /// Inline TOML content
        #[arg(long)]
        content: Option<String>,
    },
    /// Update an existing command flow template
    Update {
        /// Command flow template name
        name: String,
        /// Path to TOML content file
        #[arg(long)]
        file: Option<PathBuf>,
        /// Inline TOML content
        #[arg(long)]
        content: Option<String>,
    },
    /// Delete a command flow template
    Delete {
        /// Command flow template name
        name: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum ProfileCommands {
    /// List available device profiles
    List,
    /// Probe a device and show profile autodetect details
    Autodetect {
        #[arg(short, long, action = clap::ArgAction::Count, help = "Increase output detail: -v shows ranked candidates, -vv shows the full debug report")]
        verbose: u8,
    },
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
pub enum DeviceCommands {
    /// Test SSH connection without executing commands
    Test,
    /// List saved devices
    List,
    /// Show a saved device connection
    Show {
        /// Saved device name
        name: String,
    },
    /// Delete a saved device connection
    Delete {
        /// Saved device name
        name: String,
    },
    /// Add or update a saved device connection directly from CLI options
    Add {
        /// Saved device name
        name: String,
    },
    /// Import saved devices from CSV or Excel
    Import {
        /// Path to .csv, .xlsx, .xls, .xlsm, or .xlsb file
        file: PathBuf,
        /// Output import summary as JSON
        #[arg(long)]
        json: bool,
    },
}

#[derive(Subcommand, Debug)]
pub enum InventoryCommands {
    /// Manage inventory groups
    #[command(subcommand)]
    Group(InventoryGroupCommands),
    /// Preview merged vars from saved connection/group/runtime inputs
    ResolveVars {
        /// Saved connection name
        #[arg(long)]
        host: Option<String>,
        /// Inventory group name (repeatable)
        #[arg(long = "group")]
        groups: Vec<String>,
        /// Runtime vars JSON file
        #[arg(long)]
        vars_file: Option<PathBuf>,
        /// Runtime vars JSON string
        #[arg(long)]
        vars_json: Option<String>,
        /// Output as JSON
        #[arg(long)]
        json: bool,
    },
}

#[derive(Subcommand, Debug)]
pub enum InventoryGroupCommands {
    /// List inventory groups
    List {
        /// Output as JSON
        #[arg(long)]
        json: bool,
    },
    /// Show an inventory group
    Show {
        /// Inventory group name
        name: String,
        /// Output as JSON
        #[arg(long)]
        json: bool,
    },
    /// Create or update an inventory group from JSON
    Upsert {
        /// Inventory group name
        name: String,
        /// Path to JSON content file
        #[arg(long)]
        file: Option<PathBuf>,
        /// Inline JSON content
        #[arg(long)]
        content: Option<String>,
    },
    /// Delete an inventory group
    Delete {
        /// Inventory group name
        name: String,
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
