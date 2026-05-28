use crate::agent::report_mode::ManagerReportMode;
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::ssh_security::SshSecurityProfile;
use clap::{Args, ValueEnum};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum RecordLevelOpt {
    KeyEventsOnly,
    Full,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum TxRunKind {
    Commands,
    CommandFlow,
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
    #[arg(long, short = 'r')]
    pub record_file: Option<PathBuf>,

    /// Session recording level
    #[arg(long, short = 'l', value_enum, default_value_t = RecordLevelOpt::KeyEventsOnly)]
    pub record_level: RecordLevelOpt,
}

#[derive(Args, Debug)]
pub struct CommandFlowArgs {
    /// Saved command flow template name
    #[arg(long, short = 't')]
    pub template: Option<String>,

    /// Path to a TOML file containing an ad-hoc command flow template
    #[arg(long, short = 'f')]
    pub file: Option<PathBuf>,

    /// Path to a JSON file containing template variables
    #[arg(long, short = 'v')]
    pub vars: Option<PathBuf>,

    /// Inline JSON variables
    #[arg(long)]
    pub vars_json: Option<String>,

    /// Save SSH session recording to this JSONL file
    #[arg(long, short = 'r')]
    pub record_file: Option<PathBuf>,

    /// Session recording level
    #[arg(long, short = 'l', value_enum, default_value_t = RecordLevelOpt::KeyEventsOnly)]
    pub record_level: RecordLevelOpt,
}

#[derive(Args, Debug)]
pub struct UploadArgs {
    /// Local file path on the machine running rauto
    #[arg(long)]
    pub local_path: PathBuf,

    /// Destination file path on the remote host
    #[arg(long)]
    pub remote_path: String,

    /// Upload timeout in seconds
    #[arg(long, default_value_t = 300)]
    pub timeout_secs: u64,

    /// Optional upload buffer size in bytes
    #[arg(long)]
    pub buffer_size: Option<usize>,

    /// Emit upload progress logs from the SFTP helper
    #[arg(long)]
    pub show_progress: bool,

    /// Save SSH session recording to this JSONL file
    #[arg(long, short = 'r')]
    pub record_file: Option<PathBuf>,

    /// Save SSH session recording level
    #[arg(long, short = 'l', value_enum, default_value_t = RecordLevelOpt::KeyEventsOnly)]
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
    #[arg(long, short = 'r')]
    pub record_file: Option<PathBuf>,

    /// Session recording level
    #[arg(long, short = 'l', value_enum, default_value_t = RecordLevelOpt::KeyEventsOnly)]
    pub record_level: RecordLevelOpt,
}

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

    /// Transaction block input mode
    #[arg(long, value_enum, default_value_t = TxRunKind::Commands)]
    pub run_kind: TxRunKind,

    /// Template file to render commands from (optional)
    #[arg(long, short = 't')]
    pub template: Option<String>,

    /// Path to a JSON file containing variables for --template
    #[arg(long, short = 'v')]
    pub vars: Option<PathBuf>,

    /// Saved command flow template name for --run-kind command-flow
    #[arg(long)]
    pub flow_template: Option<String>,

    /// Path to a TOML file containing an ad-hoc command flow template
    #[arg(long)]
    pub flow_file: Option<PathBuf>,

    /// Path to a JSON file containing variables for the main command flow
    #[arg(long)]
    pub flow_vars: Option<PathBuf>,

    /// Inline JSON variables for the main command flow
    #[arg(long)]
    pub flow_vars_json: Option<String>,

    /// Saved rollback command flow template name
    #[arg(long)]
    pub rollback_flow_template: Option<String>,

    /// Path to a TOML file containing an ad-hoc rollback command flow template
    #[arg(long)]
    pub rollback_flow_file: Option<PathBuf>,

    /// Path to a JSON file containing variables for the rollback command flow
    #[arg(long)]
    pub rollback_flow_vars: Option<PathBuf>,

    /// Inline JSON variables for the rollback command flow
    #[arg(long)]
    pub rollback_flow_vars_json: Option<String>,

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

    /// Target mode for generated tx steps or command flow execution
    #[arg(long, short = 'm')]
    pub mode: Option<String>,

    /// Timeout (seconds) for each tx step
    #[arg(long)]
    pub timeout_secs: Option<u64>,

    /// Explicit whole-resource rollback command (optional)
    #[arg(long)]
    pub resource_rollback_command: Option<String>,

    /// Dry run: print planned tx block and exit
    #[arg(long)]
    pub dry_run: bool,

    /// Print tx result as JSON
    #[arg(long)]
    pub json: bool,

    /// Save SSH session recording to this JSONL file
    #[arg(long, short = 'r')]
    pub record_file: Option<PathBuf>,

    /// Session recording level
    #[arg(long, short = 'l', value_enum, default_value_t = RecordLevelOpt::KeyEventsOnly)]
    pub record_level: RecordLevelOpt,
}

#[derive(Args, Debug)]
pub struct TxWorkflowArgs {
    /// Path to TxWorkflow JSON file
    pub workflow_file: Option<PathBuf>,

    /// Saved TxWorkflow JSON template name
    #[arg(long, short = 't')]
    pub template: Option<String>,

    /// Path to a JSON file containing variables for --template
    #[arg(long, short = 'v')]
    pub vars: Option<PathBuf>,

    /// Inline JSON variables for --template
    #[arg(long)]
    pub vars_json: Option<String>,

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
    #[arg(long, short = 'r')]
    pub record_file: Option<PathBuf>,

    /// Session recording level
    #[arg(long, short = 'l', value_enum, default_value_t = RecordLevelOpt::KeyEventsOnly)]
    pub record_level: RecordLevelOpt,
}

#[derive(Args, Debug)]
pub struct OrchestrateArgs {
    /// Path to orchestration plan JSON file
    pub plan_file: Option<PathBuf>,

    /// Saved orchestration JSON template name
    #[arg(long, short = 't')]
    pub template: Option<String>,

    /// Path to a JSON file containing variables for --template
    #[arg(long, short = 'v')]
    pub vars: Option<PathBuf>,

    /// Inline JSON variables for --template
    #[arg(long)]
    pub vars_json: Option<String>,

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
    #[arg(long, short = 'H', global = true)]
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

    /// Linux shell flavor used by linux profile exit-code capture (posix/bash or fish)
    #[arg(long, global = true, value_enum)]
    pub linux_shell_flavor: Option<LinuxShellFlavor>,

    /// Device profile name (e.g. cisco, huawei, linux, fortinet, or custom)
    #[arg(long, short = 'd', global = true)]
    pub device_profile: Option<String>,

    /// Deprecated: stored templates and custom profiles are loaded from SQLite
    #[arg(long, global = true, env = "RAUTO_TEMPLATE_DIR")]
    pub template_dir: Option<PathBuf>,

    /// Ignore autodetect cache and probe the target again, then refresh the cached profile
    #[arg(long, global = true, default_value_t = false)]
    pub force_autodetect: bool,

    /// Use saved connection profile by name
    #[arg(long, short = 'c', global = true)]
    pub connection: Option<String>,

    /// Save effective connection profile with this name after successful connect
    #[arg(long, short = 'S', global = true)]
    pub save_connection: Option<String>,

    /// When used with --save-connection, also save password/enable_password
    #[arg(long, global = true, default_value_t = false)]
    pub save_password: bool,
}
