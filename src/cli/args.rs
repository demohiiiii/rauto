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

#[derive(Args, Debug)]
pub struct InteractiveArgs {
    /// Saved interactive command template name
    #[arg(long, short = 't')]
    pub template: Option<String>,

    /// Saved device name to execute against. Repeat to target multiple devices.
    #[arg(short = 'T', long = "target", value_name = "DEVICE")]
    pub targets: Vec<String>,

    /// Inventory group name. Repeat to include devices from multiple groups.
    #[arg(short = 'g', long = "group", value_name = "GROUP")]
    pub groups: Vec<String>,

    /// Saved device label/tag. Repeat to include devices matching any label.
    #[arg(
        short = 'L',
        long = "label",
        visible_alias = "tag",
        value_name = "LABEL"
    )]
    pub labels: Vec<String>,

    /// Maximum concurrent device connections for multi-target interactive command execution (default 4)
    #[arg(short = 'N', visible_alias = "parallel", long, value_name = "N")]
    pub max_parallel: Option<usize>,

    /// Path to a TOML file containing an ad-hoc interactive command template
    #[arg(long, short = 'f')]
    pub file: Option<PathBuf>,

    /// Path to a JSON file containing template variables
    #[arg(long, short = 'v')]
    pub vars: Option<PathBuf>,

    /// Inline JSON variables
    #[arg(short = 'J', long)]
    pub vars_json: Option<String>,

    /// TextFSM template file(s) to parse command output.
    /// Repeat this option to match templates by command order; the last template is reused when there are more commands than templates.
    #[arg(short = 'F', visible_alias = "tfsm", long)]
    pub textfsm_template: Vec<PathBuf>,

    /// Parse command output with TextFSM. The platform is inferred from the device profile.
    #[arg(short = 'p', visible_alias = "parse", long)]
    pub parse_textfsm: bool,

    /// Export successful TextFSM parsed output to an Excel .xlsx file
    #[arg(short = 'x', visible_alias = "excel", long)]
    pub textfsm_excel: Option<PathBuf>,

    /// Keep TextFSM Error rules such as `^. -> Error` instead of filtering them
    #[arg(visible_alias = "strict", long)]
    pub textfsm_strict_errors: bool,

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
    #[arg(short = 'f', visible_alias = "local", long)]
    pub local_path: PathBuf,

    /// Destination file path on the remote host
    #[arg(short = 'o', visible_alias = "remote", long)]
    pub remote_path: String,

    /// Upload timeout in seconds
    #[arg(visible_alias = "timeout", long, default_value_t = 300)]
    pub timeout_secs: u64,

    /// Optional upload buffer size in bytes
    #[arg(visible_alias = "buffer", long)]
    pub buffer_size: Option<usize>,

    /// Emit upload progress logs from the SFTP helper
    #[arg(visible_alias = "progress", long)]
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
    #[arg(required_unless_present = "template", conflicts_with = "template")]
    pub command: Option<String>,

    /// Saved command template name
    #[arg(
        long,
        short = 't',
        conflicts_with_all = ["command", "targets", "groups", "labels", "max_parallel", "mode"]
    )]
    pub template: Option<String>,

    /// Path to a JSON file containing variables for --template
    #[arg(long, short = 'v', requires = "template", conflicts_with = "command")]
    pub vars: Option<PathBuf>,

    /// Dry run: render --template without executing on the device
    #[arg(short = 'n', long, requires = "template", conflicts_with = "command")]
    pub dry_run: bool,

    /// Saved device name to execute against. Repeat to target multiple devices.
    #[arg(short = 'T', long = "target", value_name = "DEVICE")]
    pub targets: Vec<String>,

    /// Inventory group name. Repeat to include devices from multiple groups.
    #[arg(short = 'g', long = "group", value_name = "GROUP")]
    pub groups: Vec<String>,

    /// Saved device label/tag. Repeat to include devices matching any label.
    #[arg(
        short = 'L',
        long = "label",
        visible_alias = "tag",
        value_name = "LABEL"
    )]
    pub labels: Vec<String>,

    /// Maximum concurrent device connections for multi-target exec (default 4)
    #[arg(short = 'N', visible_alias = "parallel", long, value_name = "N")]
    pub max_parallel: Option<usize>,

    /// TextFSM template file to parse command output.
    /// With --template, repeat to match rendered commands in order; the last file is reused for remaining commands.
    #[arg(short = 'F', visible_alias = "tfsm", long)]
    pub textfsm_template: Vec<PathBuf>,

    /// Parse command output with TextFSM. The platform is inferred from the device profile.
    #[arg(short = 'p', visible_alias = "parse", long)]
    pub parse_textfsm: bool,

    /// Export successful TextFSM parsed output to an Excel .xlsx file
    #[arg(short = 'x', visible_alias = "excel", long)]
    pub textfsm_excel: Option<PathBuf>,

    /// Keep TextFSM Error rules such as `^. -> Error` instead of filtering them
    #[arg(visible_alias = "strict", long)]
    pub textfsm_strict_errors: bool,

    /// Execution mode or candidate modes separated by comma/pipe (e.g. "Enable", "Root,User")
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
pub struct ShowArgs {
    /// NTC-supported show object, for example version, interfaces, route, arp
    pub object: Option<String>,

    /// Saved device name to execute against. Repeat to target multiple devices.
    #[arg(short = 'T', long = "target", value_name = "DEVICE")]
    pub targets: Vec<String>,

    /// Inventory group name. Repeat to include devices from multiple groups.
    #[arg(short = 'g', long = "group", value_name = "GROUP")]
    pub groups: Vec<String>,

    /// Saved device label/tag. Repeat to include devices matching any label.
    #[arg(
        short = 'L',
        long = "label",
        visible_alias = "tag",
        value_name = "LABEL"
    )]
    pub labels: Vec<String>,

    /// Maximum concurrent device connections for multi-target show (default 4)
    #[arg(short = 'N', visible_alias = "parallel", long, value_name = "N")]
    pub max_parallel: Option<usize>,

    /// List available show objects for the resolved or selected platform
    #[arg(long)]
    pub list: bool,

    /// Execution mode or candidate modes separated by comma/pipe (e.g. "Enable", "Root,User")
    #[arg(long, short = 'm')]
    pub mode: Option<String>,

    /// Print the resolved device command before execution
    #[arg(visible_alias = "print-cmd", long)]
    pub print_command: bool,

    /// Disable automatic TextFSM parsing for show output
    #[arg(long)]
    pub no_parse: bool,

    /// Export successful TextFSM parsed output to an Excel .xlsx file
    #[arg(short = 'x', visible_alias = "excel", long)]
    pub textfsm_excel: Option<PathBuf>,

    /// Keep TextFSM Error rules such as `^. -> Error` instead of filtering them
    #[arg(visible_alias = "strict", long)]
    pub textfsm_strict_errors: bool,

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

    /// Path to a JSON file containing variables for templates or workflow controls
    #[arg(long, short = 'v')]
    pub vars: Option<PathBuf>,

    /// Optional TextFSM template file to parse each command output
    #[arg(short = 'F', visible_alias = "tfsm", long)]
    pub textfsm_template: Option<PathBuf>,

    /// Inline JSON variables for templates or workflow controls
    #[arg(short = 'J', long)]
    pub vars_json: Option<String>,

    /// Dry run: print workflow plan and exit (use --json for raw JSON)
    #[arg(short = 'n', long)]
    pub dry_run: bool,

    /// Visualize workflow structure and rollback plan in terminal, then exit
    #[arg(long)]
    pub view: bool,

    /// Print workflow result as JSON
    #[arg(short = 'j', long)]
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

    /// Optional TextFSM template file to parse each command output
    #[arg(short = 'F', visible_alias = "tfsm", long)]
    pub textfsm_template: Option<PathBuf>,

    /// Inline JSON variables for --template
    #[arg(short = 'J', long)]
    pub vars_json: Option<String>,

    /// Dry run: print orchestration plan and exit (use --json for raw JSON)
    #[arg(short = 'n', long)]
    pub dry_run: bool,

    /// Visualize orchestration structure in terminal, then exit
    #[arg(long)]
    pub view: bool,

    /// Print orchestration result as JSON
    #[arg(short = 'j', long)]
    pub json: bool,

    /// Session recording level for each target execution
    #[arg(long, short = 'l', value_enum, default_value_t = RecordLevelOpt::KeyEventsOnly)]
    pub record_level: RecordLevelOpt,
}

#[derive(Args, Debug)]
pub struct WebArgs {
    /// Bind address for web server
    #[arg(short = 'b', long, default_value = "127.0.0.1")]
    pub bind: String,

    /// Listen port for web server
    #[arg(short = 'p', long, default_value = "3000")]
    pub port: u16,
}

#[derive(Args, Debug)]
pub struct AgentArgs {
    /// Bind address for agent web server
    #[arg(short = 'b', long, default_value = "0.0.0.0")]
    pub bind: String,

    /// Listen port for agent web server
    #[arg(short = 'p', long, default_value = "8123")]
    pub port: u16,

    /// Manager URL for agent registration (e.g. http://manager:3000)
    #[arg(visible_alias = "manager", long, env = "RAUTO_MANAGER_URL")]
    pub manager_url: Option<String>,

    /// Agent name for registration (must be unique across all agents)
    #[arg(visible_alias = "name", long, env = "RAUTO_AGENT_NAME")]
    pub agent_name: Option<String>,

    /// API token for authentication and manager callbacks
    #[arg(visible_alias = "token", long, env = "RAUTO_AGENT_TOKEN")]
    pub agent_token: Option<String>,

    /// Manager reporting transport mode
    #[arg(long, env = "RAUTO_MANAGER_REPORT_MODE", value_enum)]
    pub report_mode: Option<ManagerReportMode>,

    /// Path to agent config file (default: ~/.rauto/agent.toml)
    #[arg(short = 'f', visible_alias = "config", long)]
    pub agent_config: Option<PathBuf>,

    /// Periodic device liveness probe/report interval in seconds (0 disables it)
    #[arg(
        visible_alias = "probe-interval",
        long,
        env = "RAUTO_AGENT_PROBE_REPORT_INTERVAL"
    )]
    pub probe_report_interval: Option<u64>,
}

#[derive(Args, Debug, Clone)]
pub struct GlobalOpts {
    /// Device hostname or IP address
    #[arg(long, short = 'H', global = true)]
    pub host: Option<String>,

    /// SSH port
    #[arg(
        id = "ssh_port",
        long = "ssh-port",
        short = 'P',
        value_name = "PORT",
        global = true
    )]
    pub port: Option<u16>,

    /// SSH security profile for key exchange / cipher compatibility
    #[arg(visible_alias = "security", long, global = true, value_enum)]
    pub ssh_security: Option<SshSecurityProfile>,

    /// Linux shell flavor used by linux profile exit-code capture (posix/bash or fish)
    #[arg(visible_alias = "shell", long, global = true, value_enum)]
    pub linux_shell_flavor: Option<LinuxShellFlavor>,

    /// Device profile name (e.g. cisco, huawei, linux, fortinet, or custom)
    #[arg(long, short = 'D', global = true)]
    pub device_profile: Option<String>,

    /// Ignore autodetect cache and probe the target again, then refresh the cached profile
    #[arg(long, global = true, default_value_t = false)]
    pub force_autodetect: bool,

    /// Retry transient connection failures for ordinary commands and interactive commands.
    /// Retries have at-least-once semantics; keep disabled for commands that are unsafe to repeat.
    #[arg(
        visible_alias = "retries",
        long,
        global = true,
        env = "RAUTO_SESSION_RETRIES",
        default_value_t = 0
    )]
    pub session_retries: usize,

    /// Initial delay before retrying a transient session failure
    #[arg(
        visible_alias = "retry-delay-ms",
        long,
        global = true,
        env = "RAUTO_RETRY_INITIAL_BACKOFF_MS",
        default_value_t = 200
    )]
    pub retry_initial_backoff_ms: u64,

    /// Maximum exponential backoff delay for session retries
    #[arg(
        visible_alias = "retry-max-ms",
        long,
        global = true,
        env = "RAUTO_RETRY_MAX_BACKOFF_MS",
        default_value_t = 2000
    )]
    pub retry_max_backoff_ms: u64,

    /// Also retry SSH authentication rejections (disabled by default)
    #[arg(
        visible_alias = "retry-auth",
        long,
        global = true,
        env = "RAUTO_RETRY_AUTHENTICATION_ERRORS",
        default_value_t = false
    )]
    pub retry_authentication_errors: bool,

    /// Select a saved device by name
    #[arg(long = "device", short = 'd', value_name = "DEVICE", global = true)]
    pub connection: Option<String>,

    /// Reusable device credential name or id
    #[arg(short = 'C', visible_alias = "cred", long, global = true)]
    pub credential: Option<String>,

    /// Save the effective device settings with this name after a successful connection
    #[arg(
        visible_alias = "save",
        long = "save-device",
        short = 'S',
        value_name = "NAME",
        global = true
    )]
    pub save_connection: Option<String>,
}
