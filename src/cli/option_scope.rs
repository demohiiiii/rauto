use clap::{Arg, ArgAction, ArgMatches, Args, Command, error::ErrorKind, parser::ValueSource};

// Parsing retains global definitions to collect values passed before or after
// subcommands; validate rejects explicitly supplied options the handler cannot use.
// Shell generators need a tree without hidden arguments to scope completions.
pub(super) fn configure(mut command: Command, parsing: bool) -> Command {
    let globals = command
        .get_arguments()
        .filter(|arg| arg.is_global_set())
        .cloned()
        .collect::<Vec<_>>();
    if parsing {
        command = command.mut_args(|arg| {
            if arg.is_global_set() {
                let hidden = !visible(&[], arg.get_id().as_str());
                arg.hide(hidden)
            } else {
                arg
            }
        });
    } else {
        command = Command::new("rauto")
            .version(env!("CARGO_PKG_VERSION"))
            .about(command.get_about().cloned().unwrap_or_default())
            .subcommands(command.get_subcommands().cloned())
            .args(
                globals
                    .iter()
                    .filter(|arg| visible(&[], arg.get_id().as_str()))
                    .cloned()
                    .map(|arg| arg.global(false)),
            );
    }
    command =
        command.mut_subcommands(|command| configure_subcommand(command, &globals, &[], parsing));
    order_options(command, &[])
}

fn configure_subcommand(
    mut command: Command,
    globals: &[Arg],
    parent: &[&str],
    parsing: bool,
) -> Command {
    let name = command.get_name().to_owned();
    let mut path = parent.to_vec();
    path.push(&name);
    for arg in globals {
        // A local argument owns its semantics, e.g. session list's positional
        // connection filter or config history's --device.
        if command
            .get_arguments()
            .any(|local| local.get_id() == arg.get_id())
        {
            continue;
        }
        let visible = visible(&path, arg.get_id().as_str());
        if parsing || visible {
            command = command.arg(arg.clone().global(parsing).hide(!visible));
        }
    }
    command =
        command.mut_subcommands(|command| configure_subcommand(command, globals, &path, parsing));
    order_options(command, &path)
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum OptionSection {
    Service,
    Discovery,
    Device,
    Targets,
    Input,
    Authentication,
    Filters,
    Output,
    Recording,
    Retries,
    Help,
}

impl OptionSection {
    fn heading(self) -> &'static str {
        match self {
            Self::Service => "Service",
            Self::Discovery => "Discovery",
            Self::Device => "Device",
            Self::Targets => "Targets",
            Self::Input => "Input and execution",
            Self::Authentication => "Authentication",
            Self::Filters => "Filters",
            Self::Output => "Parsing and output",
            Self::Recording => "Recording",
            Self::Retries => "Retries",
            Self::Help => "Help",
        }
    }
}

fn option_order(path: &[&str], id: &str) -> (OptionSection, usize) {
    use OptionSection::*;

    let sections: &[(OptionSection, &[&str])] = &[
        (
            Service,
            &[
                "bind",
                "port",
                "agent_config",
                "manager_url",
                "agent_name",
                "agent_token",
                "report_mode",
                "probe_report_interval",
            ],
        ),
        (
            Device,
            &[
                "connection",
                "host",
                "ssh_port",
                "credential",
                "device_profile",
                "linux_shell_flavor",
                "ssh_security",
                "force_autodetect",
                "save_connection",
            ],
        ),
        (Targets, &["targets", "groups", "labels", "max_parallel"]),
        (
            Input,
            &[
                "template",
                "file",
                "content",
                "vars",
                "vars_json",
                "profile",
                "object",
                "command",
                "mode",
                "kind",
                "list",
                "id",
                "local_path",
                "remote_path",
                "timeout_secs",
                "buffer_size",
                "connection_name",
                "auto_save",
                "overwrite",
                "disabled",
                "replace",
                "timezone",
                "count",
                "view",
                "dry_run",
            ],
        ),
        (
            Authentication,
            &[
                "name",
                "login_username",
                "auth_type",
                "login_secret",
                "private_key",
                "private_key_file",
                "passphrase",
                "enable",
                "enable_secret",
                "disable_enable",
            ],
        ),
        (
            Filters,
            &[
                "status", "profiles", "ports", "search", "from", "to", "sort", "limit",
            ],
        ),
        (
            Output,
            &[
                "parse_textfsm",
                "no_parse",
                "textfsm_template",
                "textfsm_mapping_command",
                "textfsm_strict_errors",
                "textfsm_excel",
                "print_command",
                "normalized",
                "json",
                "raw",
                "output",
                "output_dir",
                "no_tui",
                "show_progress",
                "verbose",
            ],
        ),
        (Recording, &["record_file", "record_level"]),
        (
            Retries,
            &[
                "session_retries",
                "retry_initial_backoff_ms",
                "retry_max_backoff_ms",
                "retry_authentication_errors",
            ],
        ),
        (Help, &["help", "version"]),
    ];
    if path == ["device", "discover"]
        && let Some(index) = [
            "ports",
            "credential",
            "probe_credentials",
            "concurrency",
            "tcp_timeout_ms",
            "probe_timeout_secs",
        ]
        .iter()
        .position(|candidate| *candidate == id)
    {
        return (Discovery, index);
    }
    if id == "connection"
        && (path.starts_with(&["session"]) || path == ["config", "history", "list"])
    {
        return (Filters, 0);
    }
    if id == "kind" && path == ["config", "history", "list"] {
        return (Filters, 1);
    }
    if id == "profile" && path.last() == Some(&"list") {
        return (Filters, 1);
    }
    for (section, ids) in sections {
        if let Some(index) = ids.iter().position(|candidate| *candidate == id) {
            return (*section, index + 1);
        }
    }
    (Input, usize::MAX)
}

fn order_options(mut command: Command, path: &[&str]) -> Command {
    // Define the standard flags explicitly so they can share the final heading.
    // Clap otherwise inserts them into an ungrouped Options section at the top.
    command = command.disable_help_flag(true).arg(
        Arg::new("help")
            .short('h')
            .long("help")
            .action(ArgAction::Help)
            .help("Print help"),
    );
    if command.get_version().is_some() || command.get_long_version().is_some() {
        command = command.disable_version_flag(true).arg(
            Arg::new("version")
                .short('V')
                .long("version")
                .action(ArgAction::Version)
                .help("Print version"),
        );
    }
    let mut options = command
        .get_arguments()
        .filter(|arg| !arg.is_positional())
        .map(|arg| {
            (
                option_order(path, arg.get_id().as_str()),
                arg.get_id().clone(),
            )
        })
        .collect::<Vec<_>>();
    options.sort_by_key(|(order, _)| *order);
    // Clap orders headings by argument insertion, independently of display_order.
    // Reinsert only options so positional indices retain their declaration order.
    for ((section, index), id) in options {
        let heading = if path.is_empty() && section == OptionSection::Help {
            "Options"
        } else {
            section.heading()
        };
        command = command.mut_arg(id.as_str(), |arg| {
            arg.help_heading(heading).display_order(index)
        });
    }
    command
}

pub(super) fn validate(matches: &ArgMatches) -> Result<(), clap::Error> {
    let mut selected = matches;
    let mut path = Vec::new();
    while let Some((name, child)) = selected.subcommand() {
        path.push(name);
        selected = child;
    }
    if path == ["exec"]
        && selected.get_one::<String>("template").is_none()
        && selected
            .get_many::<std::path::PathBuf>("textfsm_template")
            .is_some_and(|files| files.len() > 1)
    {
        return Err(clap::Error::raw(
            ErrorKind::ArgumentConflict,
            "--textfsm-template can only be repeated when executing a saved template with --template\n",
        ));
    }
    let globals = super::GlobalOpts::augment_args(Command::new("rauto"));
    for option in globals.get_arguments() {
        let id = option.get_id().as_str();
        if matches.value_source(id) == Some(ValueSource::CommandLine) && !visible(&path, id) {
            return Err(clap::Error::raw(
                ErrorKind::UnknownArgument,
                format!(
                    "unexpected argument '--{}' for 'rauto {}'\n\nFor more information, try 'rauto {} --help'.\n",
                    option.get_long().unwrap_or(id),
                    path.join(" "),
                    path.join(" "),
                ),
            ));
        }
    }
    Ok(())
}

fn visible(path: &[&str], option: &str) -> bool {
    let retry = matches!(
        option,
        "session_retries"
            | "retry_initial_backoff_ms"
            | "retry_max_backoff_ms"
            | "retry_authentication_errors"
    );
    match path {
        ["exec" | "show" | "interactive"] | ["device", "test"] => true,
        ["upload" | "tx-workflow"] => !retry,
        ["orchestrate"] => !retry && option != "save_connection",
        ["web" | "agent"] | ["config", "fetch"] => option != "save_connection",
        ["device", "add"] => !retry && !matches!(option, "force_autodetect" | "save_connection"),
        ["profile", "autodetect"] => matches!(
            option,
            "host" | "ssh_port" | "ssh_security" | "connection" | "credential"
        ),
        ["device", "discover"] => option == "credential",
        ["config", "history", "list"] => option == "connection",
        ["session", ..] => option == "connection",
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use crate::cli::{Cli, Commands};
    use clap::{Args, CommandFactory, Parser, error::ErrorKind};

    fn help(path: &[&str], flag: &str) -> String {
        let error = Cli::try_parse_from(
            ["rauto"]
                .into_iter()
                .chain(path.iter().copied())
                .chain([flag]),
        )
        .expect_err("help should exit before runtime initialization");
        assert_eq!(error.kind(), ErrorKind::DisplayHelp, "{path:?}: {error}");
        error.to_string()
    }

    fn advertises(help: &str, option: &str) -> bool {
        help.lines()
            .filter(|line| line.trim_start().starts_with('-'))
            .any(|line| line.split_whitespace().any(|word| word == option))
    }

    fn assert_help_order(help: &str, entries: &[&str]) {
        let positions = entries
            .iter()
            .map(|entry| {
                help.lines()
                    .position(|line| {
                        line == *entry
                            || (line.trim_start().starts_with('-')
                                && line.split_whitespace().any(|word| word == *entry))
                    })
                    .unwrap_or_else(|| panic!("missing {entry} in help:\n{help}"))
            })
            .collect::<Vec<_>>();
        assert!(
            positions.windows(2).all(|pair| pair[0] < pair[1]),
            "help entries are out of order: {entries:?}\n{help}"
        );
    }

    #[test]
    fn execution_help_groups_options_by_priority() {
        for path in [vec!["exec"], vec!["show"], vec!["interactive"]] {
            for flag in ["-h", "--help"] {
                let text = help(&path, flag);
                assert_help_order(
                    &text,
                    &[
                        "Device:",
                        "--device",
                        "--host",
                        "--ssh-port",
                        "--credential",
                        "--device-profile",
                        "--linux-shell-flavor",
                        "--ssh-security",
                        "--force-autodetect",
                        "--save-device",
                        "Targets:",
                        "--target",
                        "--group",
                        "--label",
                        "--max-parallel",
                        "Input and execution:",
                        "Parsing and output:",
                        "--textfsm-strict-errors",
                        "--textfsm-excel",
                        "Recording:",
                        "--record-file",
                        "--record-level",
                        "Retries:",
                        "--session-retries",
                        "--retry-initial-backoff-ms",
                        "--retry-max-backoff-ms",
                        "--retry-authentication-errors",
                        "Help:",
                        "--help",
                    ],
                );
                assert!(!advertises(&text, "--connection"));
                assert!(!advertises(&text, "--save-connection"));
                assert!(text.contains("--device <DEVICE>"));
                assert!(text.contains("--target <DEVICE>"));
            }
        }
        assert_help_order(
            &help(&["exec"], "--help"),
            &["--template", "--vars", "--mode", "--dry-run"],
        );
        for path in [vec!["tx-workflow"], vec!["orchestrate"]] {
            let text = help(&path, "--help");
            assert_help_order(
                &text,
                &[
                    "Device:",
                    "Input and execution:",
                    "--template",
                    "--vars",
                    "--vars-json",
                    "--view",
                    "--dry-run",
                    "Parsing and output:",
                    "Recording:",
                    "Help:",
                ],
            );
            assert!(!text.contains("Retries:"));
        }
    }

    #[test]
    fn service_discovery_and_management_help_prioritize_their_own_inputs() {
        for path in [vec!["web"], vec!["agent"]] {
            assert_help_order(
                &help(&path, "--help"),
                &[
                    "Service:", "--bind", "--port", "Device:", "Retries:", "Help:",
                ],
            );
        }
        assert_help_order(
            &help(&["device", "discover"], "--help"),
            &[
                "Discovery:",
                "--port",
                "--credential",
                "--probe-credential",
                "--concurrency",
                "--tcp-timeout-ms",
                "--probe-timeout-secs",
                "--auto-save",
                "Filters:",
                "--status",
                "Parsing and output:",
                "--json",
                "--no-tui",
                "Help:",
            ],
        );
        assert_help_order(
            &help(&["config", "history", "list"], "--help"),
            &[
                "Filters:",
                "--device",
                "--kind",
                "--from",
                "--to",
                "--sort",
                "--limit",
                "Parsing and output:",
                "--json",
                "Help:",
            ],
        );
        assert_help_order(
            &help(&["credential", "add"], "--help"),
            &[
                "Authentication:",
                "--login-username",
                "--auth-type",
                "--login-secret",
                "--private-key",
                "--private-key-file",
                "--passphrase",
                "--enable",
                "--enable-secret",
                "Parsing and output:",
                "Help:",
            ],
        );
        let direct = help(&["exec"], "--help");
        let via_help = Cli::try_parse_from(["rauto", "help", "exec"])
            .expect_err("help subcommand should exit");
        assert_eq!(via_help.kind(), ErrorKind::DisplayHelp);
        assert_eq!(via_help.to_string(), direct);
    }

    #[test]
    fn device_options_select_and_save_without_renaming_internal_contracts() {
        for selector in ["--device", "-d"] {
            for saver in ["--save-device", "--save", "-S"] {
                for args in [
                    vec![
                        "rauto",
                        selector,
                        "edge",
                        "-D",
                        "linux",
                        saver,
                        "edge-copy",
                        "exec",
                        "id",
                    ],
                    vec![
                        "rauto",
                        "exec",
                        "id",
                        selector,
                        "edge",
                        "-D",
                        "linux",
                        saver,
                        "edge-copy",
                    ],
                ] {
                    let cli = Cli::try_parse_from(&args).unwrap();
                    assert_eq!(cli.global_opts.connection.as_deref(), Some("edge"));
                    assert_eq!(cli.global_opts.device_profile.as_deref(), Some("linux"));
                    assert_eq!(
                        cli.global_opts.save_connection.as_deref(),
                        Some("edge-copy")
                    );
                }
            }
            let cli = Cli::try_parse_from(["rauto", "config", "history", "list", selector, "edge"])
                .unwrap();
            assert!(matches!(
                cli.command,
                Commands::Config(super::super::ConfigCmd {
                    command: super::super::ConfigCommands::History(
                        super::super::ConfigHistoryCommands::List { connection: Some(name), .. }
                    ),
                }) if name == "edge"
            ));
        }
        for args in [
            vec!["rauto", "exec", "id", "-c", "edge"],
            vec!["rauto", "config", "history", "list", "-c", "edge"],
            vec!["rauto", "exec", "id", "--connection", "edge"],
            vec!["rauto", "exec", "id", "--save-connection", "edge"],
            vec!["rauto", "config", "history", "list", "--connection", "edge"],
            vec![
                "rauto",
                "device",
                "discover",
                "save",
                "--connection-name",
                "edge",
            ],
        ] {
            let error = Cli::try_parse_from(&args).unwrap_err();
            assert_eq!(
                error.kind(),
                ErrorKind::UnknownArgument,
                "{args:?}: {error}"
            );
        }
        assert!(help(&["session", "list"], "--help").contains("[DEVICE]"));
        assert!(help(&["device", "discover", "save"], "--help").contains("--device-name <NAME>"));
    }

    #[test]
    fn root_help_only_advertises_help_and_version() {
        let globals = super::super::GlobalOpts::augment_args(clap::Command::new("rauto"));
        for args in [
            vec!["rauto", "--help"],
            vec!["rauto", "-h"],
            vec!["rauto", "help"],
            vec!["rauto"],
        ] {
            let error = Cli::try_parse_from(&args).expect_err("root help should exit");
            assert!(matches!(
                error.kind(),
                ErrorKind::DisplayHelp | ErrorKind::DisplayHelpOnMissingArgumentOrSubcommand
            ));
            let text = error.to_string();
            assert!(advertises(&text, "--help"), "{args:?}: {text}");
            assert!(advertises(&text, "--version"), "{args:?}: {text}");
            for option in globals.get_arguments() {
                let flag = format!("--{}", option.get_long().unwrap());
                assert!(
                    !advertises(&text, &flag),
                    "{args:?} advertises {flag}: {text}"
                );
            }
        }
    }

    #[test]
    fn management_help_omits_device_execution_options() {
        for path in [
            vec!["completion"],
            vec!["credential"],
            vec!["credential", "list"],
            vec!["credentials", "add"],
            vec!["device", "list"],
            vec!["device"],
            vec!["connection", "import"],
            vec!["device", "discover", "list"],
            vec!["profile", "list"],
            vec!["profile"],
            vec!["config"],
            vec!["config", "command", "list"],
            vec!["config", "history", "devices"],
            vec!["inventory", "group", "list"],
            vec!["show", "object"],
            vec!["show", "object", "list"],
            vec!["show", "object", "set"],
            vec!["show", "object", "delete"],
            vec!["exec", "template"],
            vec!["exec", "template", "list"],
            vec!["interactive", "template"],
            vec!["interactive", "template", "list"],
            vec!["tx-workflow", "template", "create"],
            vec!["orchestrate", "template", "list"],
            vec!["textfsm", "template", "list"],
            vec!["schedule", "list"],
            vec!["backup", "create"],
        ] {
            for flag in ["--help", "-h"] {
                let text = help(&path, flag);
                for option in [
                    "--host",
                    "--ssh-port",
                    "--credential",
                    "--device",
                    "--save-device",
                    "--session-retries",
                    "--template-dir",
                ] {
                    assert!(
                        !advertises(&text, option),
                        "{path:?} advertises {option}: {text}"
                    );
                }
            }
        }
    }

    #[test]
    fn help_advertises_only_the_connection_features_used_by_each_handler() {
        for path in [
            vec!["exec"],
            vec!["show"],
            vec!["interactive"],
            vec!["device", "test"],
            vec!["config", "fetch"],
            vec!["web"],
            vec!["agent"],
        ] {
            let text = help(&path, "--help");
            for option in ["--host", "--ssh-port", "--device", "--session-retries"] {
                assert!(
                    text.contains(option),
                    "{path:?} is missing {option}: {text}"
                );
            }
            assert!(!text.contains("--template-dir"));
        }
        for path in [vec!["upload"], vec!["tx-workflow"], vec!["orchestrate"]] {
            let text = help(&path, "--help");
            assert!(text.contains("--host"));
            assert!(!text.contains("--session-retries"));
        }
        for path in [vec!["session"], vec!["session", "replay"]] {
            let text = help(&path, "--help");
            assert!(text.contains("--device"));
            assert!(!text.contains("--host"));
        }
        let text = help(&["device", "discover"], "--help");
        assert!(text.contains("--credential"));
        assert!(!text.contains("--host"));
        let text = help(&["config", "history", "list"], "--help");
        assert!(text.contains("--device"));
        assert!(!text.contains("--host"));
    }

    #[test]
    fn shared_option_positions_and_local_connection_filters_parse() {
        for args in [
            vec!["rauto", "-d", "edge", "exec", "id"],
            vec!["rauto", "exec", "id", "-d", "edge"],
            vec!["rauto", "-d", "edge", "device", "test"],
            vec!["rauto", "device", "-d", "edge", "test"],
            vec!["rauto", "device", "test", "-d", "edge"],
            vec!["rauto", "session", "replay", "-d", "edge"],
        ] {
            let cli = Cli::try_parse_from(&args).unwrap();
            assert_eq!(
                cli.global_opts.connection.as_deref(),
                Some("edge"),
                "{args:?}"
            );
            assert_eq!(cli.global_opts.retry_initial_backoff_ms, 200);
        }
        Cli::try_parse_from(["rauto", "session", "list", "edge"])
            .expect("positional connection filter still parses");
        Cli::try_parse_from(["rauto", "config", "history", "list", "-d", "edge"])
            .expect("local connection option still parses");
        let mut cli = Cli::try_parse_from(["rauto", "device", "test"]).unwrap();
        cli.try_update_from(["rauto", "device", "test", "-d", "edge"])
            .unwrap();
        assert_eq!(cli.global_opts.connection.as_deref(), Some("edge"));
    }

    #[test]
    fn connection_aliases_work_before_and_after_the_selected_command() {
        for credential in ["--credential", "--cred", "-C"] {
            for before in [true, false] {
                let options = [
                    credential,
                    "network-admin",
                    "--shell",
                    "fish",
                    "--security",
                    "secure",
                    "--retries",
                    "2",
                    "--retry-delay-ms",
                    "100",
                    "--retry-max-ms",
                    "500",
                    "--retry-auth",
                    "--save",
                    "edge",
                ];
                let args = if before {
                    [vec!["rauto"], options.to_vec(), vec!["exec", "id"]].concat()
                } else {
                    [vec!["rauto", "exec", "id"], options.to_vec()].concat()
                };
                let cli = Cli::try_parse_from(&args).unwrap();
                let options = cli.global_opts;
                assert_eq!(options.credential.as_deref(), Some("network-admin"));
                assert_eq!(
                    options.linux_shell_flavor,
                    Some(crate::config::linux_shell::LinuxShellFlavor::Fish)
                );
                assert_eq!(
                    options.ssh_security,
                    Some(crate::config::ssh_security::SshSecurityProfile::Secure)
                );
                assert_eq!(options.session_retries, 2);
                assert_eq!(options.retry_initial_backoff_ms, 100);
                assert_eq!(options.retry_max_backoff_ms, 500);
                assert!(options.retry_authentication_errors);
                assert_eq!(options.save_connection.as_deref(), Some("edge"));
            }
        }
    }

    #[test]
    fn batch_selector_shortcuts_are_consistent_across_execution_commands() {
        for command in [
            vec!["exec", "id"],
            vec!["show", "version"],
            vec!["interactive", "-t", "inspect"],
            vec!["config", "fetch"],
        ] {
            for parallel in ["-N", "--parallel", "--max-parallel"] {
                let args = [
                    vec!["rauto"],
                    command.clone(),
                    vec![
                        "-T", "edge-1", "-T", "edge-2", "-g", "core", "-L", "prod", parallel, "3",
                    ],
                ]
                .concat();
                let cli = Cli::try_parse_from(&args).unwrap();
                let (targets, groups, labels, max_parallel) = match cli.command {
                    Commands::Exec(args) => (
                        args.run.targets,
                        args.run.groups,
                        args.run.labels,
                        args.run.max_parallel,
                    ),
                    Commands::Show(args) => (
                        args.run.targets,
                        args.run.groups,
                        args.run.labels,
                        args.run.max_parallel,
                    ),
                    Commands::Interactive(args) => (
                        args.run.targets,
                        args.run.groups,
                        args.run.labels,
                        args.run.max_parallel,
                    ),
                    Commands::Config(crate::cli::ConfigCmd {
                        command: crate::cli::ConfigCommands::Fetch(args),
                    }) => (args.targets, args.groups, args.labels, args.max_parallel),
                    _ => unreachable!(),
                };
                assert_eq!(targets, ["edge-1", "edge-2"]);
                assert_eq!(groups, ["core"]);
                assert_eq!(labels, ["prod"]);
                assert_eq!(max_parallel, Some(3));
            }
        }
    }

    #[test]
    fn execution_shortcuts_preserve_template_and_textfsm_options() {
        for (parse, template, excel) in [
            ("--parse-textfsm", "--textfsm-template", "--textfsm-excel"),
            ("--parse", "--tfsm", "--excel"),
            ("-p", "-F", "-x"),
        ] {
            let cli = Cli::try_parse_from([
                "rauto",
                "exec",
                "-t",
                "inspect",
                "-v",
                "vars.json",
                "-n",
                parse,
                template,
                "first.textfsm",
                template,
                "second.textfsm",
                excel,
                "result.xlsx",
                "--strict",
            ])
            .unwrap();
            let Commands::Exec(args) = cli.command else {
                panic!("expected exec")
            };
            let args = args.run;
            assert!(args.dry_run);
            assert!(args.parse_textfsm);
            assert!(args.textfsm_strict_errors);
            assert_eq!(args.vars, Some("vars.json".into()));
            assert_eq!(
                args.textfsm_template,
                [
                    std::path::PathBuf::from("first.textfsm"),
                    "second.textfsm".into()
                ]
            );
            assert_eq!(args.textfsm_excel, Some("result.xlsx".into()));
        }

        let cli = Cli::try_parse_from([
            "rauto",
            "interactive",
            "-f",
            "inspect.toml",
            "-J",
            "{}",
            "--parse",
            "--tfsm",
            "inspect.textfsm",
            "--excel",
            "result.xlsx",
        ])
        .unwrap();
        let Commands::Interactive(args) = cli.command else {
            panic!("expected interactive")
        };
        assert_eq!(args.run.file, Some("inspect.toml".into()));
        assert_eq!(args.run.vars_json.as_deref(), Some("{}"));
        assert!(args.run.parse_textfsm);
        assert_eq!(
            args.run.textfsm_template,
            [std::path::PathBuf::from("inspect.textfsm")]
        );
        assert_eq!(args.run.textfsm_excel, Some("result.xlsx".into()));

        for command in ["tx-workflow", "orchestrate"] {
            let cli = Cli::try_parse_from([
                "rauto",
                command,
                "plan.json",
                "-J",
                "{}",
                "-n",
                "-j",
                "-F",
                "inspect.textfsm",
                "-l",
                "full",
            ])
            .unwrap();
            let (vars_json, dry_run, json, textfsm_template, record_level) = match cli.command {
                Commands::TxWorkflow(args) => (
                    args.run.vars_json,
                    args.run.dry_run,
                    args.run.json,
                    args.run.textfsm_template,
                    args.run.record_level,
                ),
                Commands::Orchestrate(args) => (
                    args.run.vars_json,
                    args.run.dry_run,
                    args.run.json,
                    args.run.textfsm_template,
                    args.run.record_level,
                ),
                _ => unreachable!(),
            };
            assert_eq!(vars_json.as_deref(), Some("{}"));
            assert!(dry_run && json);
            assert_eq!(textfsm_template, Some("inspect.textfsm".into()));
            assert!(matches!(record_level, crate::cli::RecordLevelOpt::Full));
        }
    }

    #[test]
    fn removed_entries_and_inapplicable_options_are_rejected() {
        for args in [
            vec!["rauto", "--template-dir", "/tmp/templates", "exec", "id"],
            vec!["rauto", "exec", "id", "--template-dir", "/tmp/templates"],
            vec!["rauto", "flow", "--template", "example"],
            vec!["rauto", "flow-template", "list"],
            vec!["rauto", "device", "discovery", "list"],
            vec!["rauto", "credential", "list", "--host", "192.0.2.1"],
            vec!["rauto", "--host", "192.0.2.1", "credential", "list"],
            vec!["rauto", "tx-workflow", "template", "list", "-d", "edge"],
            vec![
                "rauto",
                "upload",
                "--session-retries",
                "2",
                "a.txt",
                "/tmp/a.txt",
            ],
            vec!["rauto", "session", "--ssh-port", "2222"],
            vec!["rauto", "credential", "list", "--cred", "network-admin"],
            vec!["rauto", "-C", "network-admin", "exec", "template", "list"],
            vec!["rauto", "show", "object", "list", "--shell", "fish"],
            vec!["rauto", "tx-workflow", "plan.json", "--retries", "2"],
        ] {
            let error = Cli::try_parse_from(&args).expect_err("unused entries must be rejected");
            assert!(
                matches!(
                    error.kind(),
                    ErrorKind::UnknownArgument | ErrorKind::InvalidSubcommand
                ),
                "{args:?}: {error}"
            );
        }
    }

    #[test]
    fn ssh_and_service_ports_are_independent() {
        for service in ["web", "agent"] {
            for (listen_port, ssh_port) in [("--port", "--ssh-port"), ("-p", "-P")] {
                let cli = Cli::try_parse_from(["rauto", service, listen_port, "8124"]).unwrap();
                assert_eq!(cli.global_opts.port, None);
                let cli =
                    Cli::try_parse_from(["rauto", ssh_port, "2222", service, listen_port, "8124"])
                        .unwrap();
                assert_eq!(cli.global_opts.port, Some(2222));
                match cli.command {
                    Commands::Web(args) => assert_eq!(args.port, 8124),
                    Commands::Agent(args) => assert_eq!(args.port, 8124),
                    _ => unreachable!(),
                }
                let cli =
                    Cli::try_parse_from(["rauto", service, listen_port, "8124", ssh_port, "2222"])
                        .unwrap();
                assert_eq!(cli.global_opts.port, Some(2222));
            }
        }
    }

    #[test]
    fn transfer_and_collection_shortcuts_keep_file_roles_distinct() {
        for (local, remote) in [
            ("--local-path", "--remote-path"),
            ("--local", "--remote"),
            ("-f", "-o"),
        ] {
            let cli = Cli::try_parse_from([
                "rauto",
                "upload",
                local,
                "package.tar",
                remote,
                "/tmp/package.tar",
                "--timeout",
                "30",
                "--buffer",
                "1024",
                "--progress",
            ])
            .unwrap();
            let Commands::Upload(args) = cli.command else {
                panic!("expected upload")
            };
            assert_eq!(args.local_path, std::path::PathBuf::from("package.tar"));
            assert_eq!(args.remote_path, "/tmp/package.tar");
            assert_eq!(args.timeout_secs, 30);
            assert_eq!(args.buffer_size, Some(1024));
            assert!(args.show_progress);
        }
        let cli = Cli::try_parse_from([
            "rauto",
            "config",
            "fetch",
            "-d",
            "edge",
            "-k",
            "startup",
            "-o",
            "config.cfg",
        ])
        .unwrap();
        let Commands::Config(crate::cli::ConfigCmd {
            command: crate::cli::ConfigCommands::Fetch(args),
        }) = cli.command
        else {
            panic!("expected config fetch")
        };
        assert_eq!(args.kind, "startup");
        assert_eq!(args.output, Some("config.cfg".into()));
        assert!(args.output_dir.is_none());

        for output_dir in ["-O", "--out-dir", "--output-dir"] {
            let cli = Cli::try_parse_from([
                "rauto", "config", "fetch", "-g", "core", output_dir, "configs",
            ])
            .unwrap();
            let Commands::Config(crate::cli::ConfigCmd {
                command: crate::cli::ConfigCommands::Fetch(args),
            }) = cli.command
            else {
                panic!("expected config fetch")
            };
            assert_eq!(args.output_dir, Some("configs".into()));
            assert!(args.output.is_none());
        }
    }

    #[test]
    fn command_definitions_are_consistent() {
        Cli::command().debug_assert();
        Cli::command_for_update().debug_assert();
        Cli::completion_command().debug_assert();
    }

    #[test]
    fn completion_options_match_visible_help_throughout_the_command_tree() {
        fn compare(help: &clap::Command, completion: &clap::Command) {
            let visible = |command: &clap::Command| {
                command
                    .get_arguments()
                    .filter(|arg| !arg.is_hide_set())
                    .map(|arg| arg.get_id().to_string())
                    .collect::<std::collections::BTreeSet<_>>()
            };
            assert_eq!(visible(help), visible(completion), "{}", help.get_name());
            assert!(completion.get_arguments().all(|arg| !arg.is_hide_set()));
            for arg in completion.get_arguments() {
                match arg.get_long() {
                    Some("device") => assert_eq!(arg.get_short(), Some('d')),
                    Some("device-profile") => assert_eq!(arg.get_short(), Some('D')),
                    _ => {}
                }
            }
            for child in help.get_subcommands() {
                compare(child, completion.find_subcommand(child.get_name()).unwrap());
            }
        }
        let mut help = Cli::command();
        let mut completion = Cli::completion_command();
        help.build();
        completion.build();
        compare(&help, &completion);
    }
}
