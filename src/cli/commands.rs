use super::args::{
    AgentArgs, CommandFlowArgs, ExecArgs, GlobalOpts, OrchestrateArgs, RecordLevelOpt, ShowArgs,
    TemplateArgs, TxArgs, TxWorkflowArgs, UploadArgs, WebArgs,
};
use crate::config::device_credential_store::DeviceAuthType;
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
#[allow(clippy::large_enum_variant)]
pub enum Commands {
    /// Render and execute a command template
    Template(TemplateArgs),

    /// Execute a raw command directly
    Exec(ExecArgs),

    /// Execute an NTC-supported show object for the selected device profile
    Show(ShowArgs),

    /// Manage custom show objects for device profiles
    #[command(name = "show-object")]
    #[command(subcommand)]
    ShowObject(ShowObjectCommands),

    /// Execute a reusable interactive command flow template
    #[command(name = "flow")]
    Flow(CommandFlowArgs),

    /// Manage saved command flow templates
    #[command(name = "flow-template")]
    #[command(subcommand)]
    FlowTemplate(CommandFlowTemplateCommands),

    /// Upload a local file to the remote host over SFTP
    Upload(UploadArgs),

    /// Fetch device configurations and manage config fetch commands
    Config(ConfigCmd),

    /// Start web service with visual UI
    Web(WebArgs),

    /// Start managed agent service for rauto-manager
    Agent(AgentArgs),

    /// Manage saved device connections and connectivity checks
    #[command(visible_alias = "connection")]
    #[command(subcommand)]
    Device(DeviceCommands),

    /// Manage reusable device credentials
    #[command(visible_alias = "credentials")]
    #[command(subcommand)]
    Credential(CredentialCommands),

    /// Manage device profiles
    #[command(subcommand)]
    Profile(ProfileCommands),

    /// Manage inventory groups and variable resolution over saved connections
    #[command(subcommand)]
    Inventory(InventoryCommands),

    /// Inspect, manage, and replay session records; defaults to the most recent record
    Session(SessionArgs),

    /// Manage blocked command patterns
    #[command(subcommand)]
    Blacklist(BlacklistCommands),

    /// Manage stored command templates
    #[command(subcommand)]
    Templates(TemplateCommands),

    /// Manage custom TextFSM templates and profile command mappings
    #[command(subcommand)]
    Textfsm(TextfsmCommands),

    /// Execute commands as a transaction-like block with rollback support
    Tx(TxArgs),

    /// Execute transaction workflows and manage workflow templates
    #[command(name = "tx-workflow")]
    TxWorkflow(TxWorkflowCommand),

    /// Execute orchestration plans and manage orchestration templates
    #[command(name = "orchestrate")]
    Orchestrate(OrchestrateCommand),

    /// Backup and restore rauto runtime data
    #[command(subcommand)]
    Backup(BackupCommands),
}

#[derive(Args, Debug)]
pub struct TxWorkflowCommand {
    #[command(flatten)]
    pub run: TxWorkflowArgs,
    #[command(subcommand)]
    pub command: Option<TxWorkflowSubcommand>,
}

#[derive(Subcommand, Debug)]
pub enum TxWorkflowSubcommand {
    /// Manage saved transaction workflow JSON templates
    Template {
        #[command(subcommand)]
        command: JsonTemplateCommands,
    },
}

#[derive(Args, Debug)]
pub struct OrchestrateCommand {
    #[command(flatten)]
    pub run: OrchestrateArgs,
    #[command(subcommand)]
    pub command: Option<OrchestrateSubcommand>,
}

#[derive(Subcommand, Debug)]
pub enum OrchestrateSubcommand {
    /// Manage saved orchestration JSON templates
    Template {
        #[command(subcommand)]
        command: JsonTemplateCommands,
    },
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
pub enum TextfsmCommands {
    /// Manage custom TextFSM templates saved in SQLite
    Template {
        #[command(subcommand)]
        command: TextfsmTemplateCommands,
    },
    /// Manage device profile command to TextFSM template mappings
    Mapping {
        #[command(subcommand)]
        command: TextfsmMappingCommands,
    },
}

#[derive(Subcommand, Debug)]
pub enum TextfsmTemplateCommands {
    /// List custom TextFSM templates
    List,
    /// Show a custom TextFSM template
    Show {
        /// TextFSM template name
        name: String,
    },
    /// Create a custom TextFSM template
    Create {
        /// TextFSM template name
        name: String,
        /// Path to TextFSM template content file
        #[arg(long)]
        file: Option<PathBuf>,
        /// Inline TextFSM template content
        #[arg(long)]
        content: Option<String>,
    },
    /// Update a custom TextFSM template
    Update {
        /// TextFSM template name
        name: String,
        /// Path to TextFSM template content file
        #[arg(long)]
        file: Option<PathBuf>,
        /// Inline TextFSM template content
        #[arg(long)]
        content: Option<String>,
    },
    /// Delete a custom TextFSM template and related mappings
    Delete {
        /// TextFSM template name
        name: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum TextfsmMappingCommands {
    /// List custom TextFSM mappings
    List {
        /// Filter by device profile
        #[arg(long)]
        profile: Option<String>,
    },
    /// Bind a device profile command to a custom TextFSM template
    Set {
        /// Device profile name
        #[arg(long)]
        profile: String,
        /// Exact command text after whitespace normalization
        #[arg(long)]
        command: String,
        /// Custom TextFSM template name
        #[arg(long)]
        template: String,
    },
    /// Delete a device profile command mapping
    Delete {
        /// Device profile name
        #[arg(long)]
        profile: String,
        /// Exact command text after whitespace normalization
        #[arg(long)]
        command: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum ShowObjectCommands {
    /// List custom show objects
    List {
        /// Filter by device profile
        #[arg(long)]
        profile: Option<String>,
    },
    /// Add or update a custom show object
    Set {
        /// Device profile name
        #[arg(long)]
        profile: String,
        /// Friendly object name, for example route or access-list
        #[arg(long)]
        object: String,
        /// Exact command to execute for this object
        #[arg(long)]
        command: String,
        /// Optional execution mode or candidate modes, for example Enable or Root,User
        #[arg(long, short = 'm')]
        mode: Option<String>,
        /// Optional custom TextFSM template name used to parse this show object
        #[arg(long)]
        textfsm_template: Option<String>,
        /// Optional strong reference to a Profile TextFSM command mapping
        #[arg(long)]
        textfsm_mapping_command: Option<String>,
        /// Disable this custom object without deleting it
        #[arg(long)]
        disabled: bool,
    },
    /// Delete a custom show object
    Delete {
        /// Device profile name
        #[arg(long)]
        profile: String,
        /// Friendly object name
        #[arg(long)]
        object: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum JsonTemplateCommands {
    /// List saved JSON templates
    List,
    /// Show a saved JSON template
    Show {
        /// Template name
        name: String,
    },
    /// Create a new JSON template
    Create {
        /// Template name
        name: String,
        /// Path to JSON content file
        #[arg(long)]
        file: Option<PathBuf>,
        /// Inline JSON content
        #[arg(long)]
        content: Option<String>,
    },
    /// Update an existing JSON template
    Update {
        /// Template name
        name: String,
        /// Path to JSON content file
        #[arg(long)]
        file: Option<PathBuf>,
        /// Inline JSON content
        #[arg(long)]
        content: Option<String>,
    },
    /// Delete a JSON template
    Delete {
        /// Template name
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
pub enum CredentialCommands {
    /// List device credentials without exposing secret values
    List {
        /// Output credentials as JSON
        #[arg(long)]
        json: bool,
    },
    /// Show one device credential by name or id
    #[command(visible_alias = "get")]
    Show {
        /// Credential name or stable id
        selector: String,
        /// Output credential metadata as JSON
        #[arg(long)]
        json: bool,
    },
    /// Add a device credential
    #[command(visible_alias = "create")]
    Add {
        /// Unique credential name
        name: String,
        /// SSH login username; prompted when omitted
        #[arg(long)]
        login_username: Option<String>,
        /// SSH authentication method
        #[arg(long, default_value = "password")]
        auth_type: DeviceAuthType,
        /// SSH login password; securely prompted when password auth is selected and omitted
        #[arg(long)]
        login_secret: Option<String>,
        /// Read an inline private key from this local file and store its contents encrypted
        #[arg(long, value_name = "PATH")]
        private_key: Option<PathBuf>,
        /// Private key path to load at connection time
        #[arg(long, value_name = "PATH")]
        private_key_file: Option<PathBuf>,
        /// Optional private-key passphrase
        #[arg(long)]
        passphrase: Option<String>,
        /// Optional Enable/Secret value
        #[arg(long)]
        enable_secret: Option<String>,
        /// Enable the device Enable stage; a missing secret submits an empty Enter
        #[arg(long)]
        enable: bool,
        /// Output the created credential metadata as JSON
        #[arg(long)]
        json: bool,
    },
    /// Update a device credential by name or id
    Update {
        /// Credential name or stable id
        selector: String,
        /// New unique credential name
        #[arg(long)]
        name: Option<String>,
        /// New SSH login username
        #[arg(long)]
        login_username: Option<String>,
        /// Change the SSH authentication method
        #[arg(long)]
        auth_type: Option<DeviceAuthType>,
        /// New SSH login secret; omitted values preserve the current secret
        #[arg(long)]
        login_secret: Option<String>,
        /// Replace the stored inline private key with contents read from this local file
        #[arg(long, value_name = "PATH")]
        private_key: Option<PathBuf>,
        /// Set the private key path loaded at connection time
        #[arg(long, value_name = "PATH")]
        private_key_file: Option<PathBuf>,
        /// Set or replace the private-key passphrase
        #[arg(long)]
        passphrase: Option<String>,
        /// Set the optional Enable/Secret value; omitting it clears the current value
        #[arg(long)]
        enable_secret: Option<String>,
        /// Enable the device Enable stage; a missing secret submits an empty Enter
        #[arg(long, conflicts_with = "disable_enable")]
        enable: bool,
        /// Disable the device Enable stage and remove its stored secret
        #[arg(long = "disable-enable", conflicts_with = "enable")]
        disable_enable: bool,
        /// Output the updated credential metadata as JSON
        #[arg(long)]
        json: bool,
    },
    /// Import device credentials from CSV or Excel using name-based upsert
    Import {
        /// Path to .csv, .xlsx, .xls, .xlsm, or .xlsb file
        file: PathBuf,
        /// Output import summary as JSON
        #[arg(long)]
        json: bool,
    },
    /// Delete a device credential by name or id
    #[command(visible_alias = "remove")]
    Delete {
        /// Credential name or stable id
        selector: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum InventoryCommands {
    /// Manage inventory groups
    #[command(subcommand)]
    Group(InventoryGroupCommands),
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

#[derive(Args, Debug)]
pub struct SessionArgs {
    #[command(subcommand)]
    pub command: Option<SessionCommands>,
}

#[derive(Subcommand, Debug)]
pub enum SessionCommands {
    /// List session records, newest first
    List {
        /// Optional saved connection name to filter by
        connection: Option<String>,
        /// Maximum number of records
        #[arg(long, default_value_t = 20)]
        limit: usize,
        /// Output records as JSON
        #[arg(long)]
        json: bool,
    },
    /// Show a session record; defaults to the most recent record
    Show {
        /// Session record ID
        id: Option<String>,
        /// Output metadata and events as JSON
        #[arg(long)]
        json: bool,
        /// Output the original JSONL recording
        #[arg(long, conflicts_with = "json")]
        raw: bool,
    },
    /// Delete a session record
    Delete {
        /// Session record ID
        id: String,
    },
    /// Replay or inspect a database record or JSONL recording file
    Replay(SessionReplayArgs),
}

#[derive(Args, Debug)]
pub struct SessionReplayArgs {
    /// Optional JSONL recording file; defaults to a database record
    #[arg(
        value_name = "RECORD_FILE",
        conflicts_with_all = ["id", "connection"]
    )]
    pub record_file: Option<PathBuf>,

    /// Database session record ID; defaults to the most recent record
    #[arg(long)]
    pub id: Option<String>,

    /// Command to replay once (matched against recorded command output events)
    #[arg(long)]
    pub command: Option<String>,

    /// Optional mode constraint for replay command (e.g. Enable, Config)
    #[arg(long, requires = "command")]
    pub mode: Option<String>,

    /// List recorded command output entries
    #[arg(long)]
    pub list: bool,
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
pub struct ConfigCmd {
    #[command(subcommand)]
    pub command: ConfigCommands,
}

#[derive(Subcommand, Debug)]
pub enum ConfigCommands {
    /// Fetch device configuration text with hashes for drift detection
    Fetch(ConfigFetchArgs),

    /// Manage per-profile config fetch command mappings
    #[command(subcommand)]
    Command(ConfigCommandCommands),

    /// Manage volatile-line patterns used for normalized drift hashing
    #[command(subcommand)]
    Volatile(ConfigVolatileCommands),
}

#[derive(Args, Debug)]
pub struct ConfigFetchArgs {
    /// Config kind to fetch (for example running, startup)
    #[arg(long, default_value = "running")]
    pub kind: String,

    /// Saved connection name to fetch from. Repeat to target multiple devices.
    #[arg(long = "target", value_name = "CONNECTION")]
    pub targets: Vec<String>,

    /// Inventory group name. Repeat to include devices from multiple groups.
    #[arg(long = "group", value_name = "GROUP")]
    pub groups: Vec<String>,

    /// Saved connection label/tag. Repeat to include devices matching any label.
    #[arg(long = "label", visible_alias = "tag", value_name = "LABEL")]
    pub labels: Vec<String>,

    /// Maximum concurrent device connections for multi-target fetch (default 4)
    #[arg(long, value_name = "N")]
    pub max_parallel: Option<usize>,

    /// Write each fetched config to this directory instead of stdout
    #[arg(long, value_name = "DIR")]
    pub output_dir: Option<PathBuf>,

    /// Write a single fetched config to this exact file instead of stdout
    #[arg(
        long,
        value_name = "FILE",
        conflicts_with_all = ["output_dir", "targets", "groups", "labels"]
    )]
    pub output: Option<PathBuf>,

    /// Print/store the normalized content (volatile lines removed) instead of the raw text
    #[arg(long)]
    pub normalized: bool,

    /// Session recording level
    #[arg(long, short = 'l', value_enum, default_value_t = RecordLevelOpt::KeyEventsOnly)]
    pub record_level: RecordLevelOpt,
}

#[derive(Subcommand, Debug)]
pub enum ConfigVolatileCommands {
    /// List volatile-line patterns (builtin merged with custom additions)
    List {
        /// Only show patterns for this device profile
        #[arg(long)]
        profile: Option<String>,
    },
    /// Add a custom volatile-line pattern for a profile (validated as regex)
    Add {
        /// Device profile name (for example cisco_ios)
        profile: String,
        /// Line regex, for example '^! Last modified .*'
        pattern: String,
    },
    /// Remove a custom volatile-line pattern
    Remove {
        /// Device profile name
        profile: String,
        /// Exact pattern text previously added
        pattern: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum ConfigCommandCommands {
    /// List config fetch commands (builtin merged with custom overrides)
    List {
        /// Only show commands for this device profile
        #[arg(long)]
        profile: Option<String>,
    },
    /// Create or update a custom config fetch command for a profile
    Set {
        /// Device profile name (for example cisco_ios)
        profile: String,
        /// Config kind (for example running, startup)
        kind: String,
        /// Device command used to fetch this config kind
        command: String,
        /// Execution mode override or candidate modes, for example Enable or Root,User
        #[arg(long)]
        mode: Option<String>,
    },
    /// Remove a custom config fetch command override
    Unset {
        /// Device profile name
        profile: String,
        /// Config kind
        kind: String,
    },
}

#[cfg(test)]
mod tests {
    use super::{Cli, Commands, CredentialCommands, DeviceAuthType, SessionCommands};
    use clap::Parser;
    use std::path::PathBuf;

    #[test]
    fn credential_flag_is_accepted() {
        let cli = Cli::try_parse_from([
            "rauto",
            "exec",
            "show version",
            "--host",
            "192.0.2.10",
            "--credential",
            "network-admin",
        ])
        .expect("--credential should be accepted");

        assert_eq!(cli.global_opts.credential.as_deref(), Some("network-admin"));
    }

    #[test]
    fn legacy_connection_authentication_flags_are_rejected() {
        for flag in [
            "--username",
            "--password",
            "--enable-password",
            "--save-password",
        ] {
            let mut args = vec!["rauto", "exec", "show version", flag];
            if flag != "--save-password" {
                args.push("legacy-value");
            }
            let error = Cli::try_parse_from(args)
                .expect_err("legacy authentication flags must not be accepted");
            assert_eq!(error.kind(), clap::error::ErrorKind::UnknownArgument);
        }
    }

    #[test]
    fn credential_crud_commands_are_accepted() {
        let add = Cli::try_parse_from([
            "rauto",
            "credential",
            "add",
            "network-admin",
            "--login-username",
            "admin",
            "--login-secret",
            "login-secret",
            "--enable-secret",
            "enable-secret",
            "--json",
        ])
        .expect("credential add should parse");
        let Commands::Credential(CredentialCommands::Add {
            name,
            login_username,
            login_secret,
            enable_secret,
            json,
            ..
        }) = add.command
        else {
            panic!("expected credential add command");
        };
        assert_eq!(name, "network-admin");
        assert_eq!(login_username.as_deref(), Some("admin"));
        assert_eq!(login_secret.as_deref(), Some("login-secret"));
        assert_eq!(enable_secret.as_deref(), Some("enable-secret"));
        assert!(json);

        let private_key = Cli::try_parse_from([
            "rauto",
            "credential",
            "add",
            "linux-key",
            "--login-username",
            "root",
            "--auth-type",
            "private-key",
            "--private-key",
            "/run/secrets/id_ed25519",
            "--passphrase",
            "key-passphrase",
        ])
        .expect("private-key credential add should parse");
        assert!(matches!(
            private_key.command,
            Commands::Credential(CredentialCommands::Add {
                auth_type: DeviceAuthType::PrivateKey,
                private_key: Some(_),
                passphrase: Some(_),
                ..
            })
        ));

        let update = Cli::try_parse_from([
            "rauto",
            "credential",
            "update",
            "network-admin",
            "--name",
            "network-ops",
            "--enable",
        ])
        .expect("credential update should parse");
        assert!(matches!(
            update.command,
            Commands::Credential(CredentialCommands::Update {
                selector,
                name,
                enable: true,
                ..
            }) if selector == "network-admin" && name.as_deref() == Some("network-ops")
        ));

        let removed_flag = Cli::try_parse_from([
            "rauto",
            "credential",
            "update",
            "network-ops",
            "--enable-empty-enter",
        ])
        .expect_err("the old empty-Enter flag must be rejected");
        assert_eq!(removed_flag.kind(), clap::error::ErrorKind::UnknownArgument);

        for args in [
            vec!["rauto", "credential", "list", "--json"],
            vec!["rauto", "credential", "show", "network-ops", "--json"],
            vec!["rauto", "credential", "import", "credentials.csv", "--json"],
            vec!["rauto", "credential", "delete", "network-ops"],
        ] {
            Cli::try_parse_from(args).expect("credential read/delete command should parse");
        }
    }

    #[test]
    fn session_commands_unify_recent_history_and_replay() {
        let recent = Cli::try_parse_from(["rauto", "session"])
            .expect("session should default to the most recent record");
        assert!(matches!(
            recent.command,
            Commands::Session(super::SessionArgs { command: None })
        ));

        let list = Cli::try_parse_from([
            "rauto", "session", "list", "edge92", "--limit", "10", "--json",
        ])
        .expect("session list should parse");
        assert!(matches!(
            list.command,
            Commands::Session(super::SessionArgs {
                command: Some(SessionCommands::List {
                    connection: Some(connection),
                    limit: 10,
                    json: true,
                }),
            }) if connection == "edge92"
        ));

        for args in [
            vec!["rauto", "session", "show"],
            vec!["rauto", "session", "show", "record-id", "--raw"],
            vec!["rauto", "session", "delete", "record-id"],
            vec!["rauto", "session", "replay", "record.jsonl", "--list"],
            vec!["rauto", "session", "replay", "--id", "record-id", "--list"],
            vec!["rauto", "session", "replay", "--connection", "edge92"],
        ] {
            Cli::try_parse_from(args).expect("unified session command should parse");
        }

        for args in [
            vec![
                "rauto",
                "session",
                "replay",
                "record.jsonl",
                "--connection",
                "edge92",
            ],
            vec!["rauto", "session", "replay", "--mode", "Enable"],
        ] {
            Cli::try_parse_from(args).expect_err("ambiguous replay source must be rejected");
        }
    }

    #[test]
    fn removed_history_and_replay_commands_are_rejected() {
        for args in [
            vec!["rauto", "history", "list", "edge92"],
            vec!["rauto", "replay", "record.jsonl", "--list"],
        ] {
            let error =
                Cli::try_parse_from(args).expect_err("old session commands must be removed");
            assert_eq!(error.kind(), clap::error::ErrorKind::InvalidSubcommand);
        }
    }

    #[test]
    fn config_fetch_and_command_mapping_parse() {
        let cli = Cli::try_parse_from([
            "rauto",
            "config",
            "fetch",
            "--kind",
            "startup",
            "--target",
            "edge-1",
            "--group",
            "access",
            "--output-dir",
            "./backups",
            "--normalized",
            "--max-parallel",
            "6",
        ])
        .expect("config fetch with selectors should parse");
        let Commands::Config(cmd) = cli.command else {
            panic!("expected config command");
        };
        let super::ConfigCommands::Fetch(args) = cmd.command else {
            panic!("expected config fetch");
        };
        assert_eq!(args.kind, "startup");
        assert_eq!(args.targets, vec!["edge-1".to_string()]);
        assert_eq!(args.groups, vec!["access".to_string()]);
        assert!(args.normalized);
        assert_eq!(args.max_parallel, Some(6));
        assert!(args.output_dir.is_some());
        assert!(args.output.is_none());

        let cli = Cli::try_parse_from(["rauto", "config", "fetch", "--output", "./running.cfg"])
            .expect("single-target config fetch output file should parse");
        let Commands::Config(cmd) = cli.command else {
            panic!("expected config command");
        };
        let super::ConfigCommands::Fetch(args) = cmd.command else {
            panic!("expected config fetch");
        };
        assert_eq!(args.output, Some(PathBuf::from("./running.cfg")));

        let error = Cli::try_parse_from([
            "rauto",
            "config",
            "fetch",
            "--output",
            "./running.cfg",
            "--output-dir",
            "./configs",
        ])
        .expect_err("exact output file and output directory must conflict");
        assert_eq!(error.kind(), clap::error::ErrorKind::ArgumentConflict);

        let cli = Cli::try_parse_from([
            "rauto",
            "config",
            "command",
            "set",
            "cisco_ios",
            "running",
            "show running-config full",
            "--mode",
            "Enable",
        ])
        .expect("config command set should parse");
        let Commands::Config(cmd) = cli.command else {
            panic!("expected config command");
        };
        assert!(matches!(
            cmd.command,
            super::ConfigCommands::Command(super::ConfigCommandCommands::Set { .. })
        ));
    }

    #[test]
    fn global_session_retry_options_parse() {
        let cli = Cli::try_parse_from([
            "rauto",
            "exec",
            "show version",
            "--session-retries",
            "2",
            "--retry-initial-backoff-ms",
            "50",
            "--retry-max-backoff-ms",
            "500",
            "--retry-authentication-errors",
        ])
        .expect("session retry options should parse globally");

        assert_eq!(cli.global_opts.session_retries, 2);
        assert_eq!(cli.global_opts.retry_initial_backoff_ms, 50);
        assert_eq!(cli.global_opts.retry_max_backoff_ms, 500);
        assert!(cli.global_opts.retry_authentication_errors);
    }

    #[test]
    fn config_volatile_commands_parse() {
        let cli = Cli::try_parse_from([
            "rauto",
            "config",
            "volatile",
            "add",
            "cisco_ios",
            "^! Last modified .*",
        ])
        .expect("config volatile add should parse");
        let Commands::Config(cmd) = cli.command else {
            panic!("expected config command");
        };
        assert!(matches!(
            cmd.command,
            super::ConfigCommands::Volatile(super::ConfigVolatileCommands::Add { .. })
        ));

        let cli = Cli::try_parse_from(["rauto", "config", "volatile", "list"])
            .expect("config volatile list should parse");
        let Commands::Config(cmd) = cli.command else {
            panic!("expected config command");
        };
        assert!(matches!(
            cmd.command,
            super::ConfigCommands::Volatile(super::ConfigVolatileCommands::List { profile: None })
        ));
    }

    #[test]
    fn multi_target_exec_and_flow_accept_selectors() {
        let cli = Cli::try_parse_from([
            "rauto",
            "exec",
            "show clock",
            "--target",
            "edge-1",
            "--group",
            "access",
            "--max-parallel",
            "6",
        ])
        .expect("exec with multi-target selectors should parse");
        let Commands::Exec(args) = cli.command else {
            panic!("expected exec command");
        };
        assert_eq!(args.targets, vec!["edge-1".to_string()]);
        assert_eq!(args.groups, vec!["access".to_string()]);
        assert_eq!(args.max_parallel, Some(6));

        let cli = Cli::try_parse_from([
            "rauto",
            "flow",
            "-t",
            "push-snmp",
            "--label",
            "campus",
            "--max-parallel",
            "2",
        ])
        .expect("flow with multi-target selectors should parse");
        let Commands::Flow(args) = cli.command else {
            panic!("expected flow command");
        };
        assert_eq!(args.labels, vec!["campus".to_string()]);
        assert_eq!(args.max_parallel, Some(2));
    }

    #[test]
    fn multi_target_show_accepts_and_defaults_max_parallel() {
        let cli = Cli::try_parse_from([
            "rauto",
            "show",
            "version",
            "--target",
            "edge-1",
            "--target",
            "edge-2",
            "--max-parallel",
            "8",
        ])
        .expect("show with --max-parallel should parse");
        let Commands::Show(args) = cli.command else {
            panic!("expected show command");
        };
        assert_eq!(args.max_parallel, Some(8));

        let cli = Cli::try_parse_from(["rauto", "show", "version", "--target", "edge-1"])
            .expect("show without --max-parallel should parse");
        let Commands::Show(args) = cli.command else {
            panic!("expected show command");
        };
        assert_eq!(args.max_parallel, None);
    }
}
