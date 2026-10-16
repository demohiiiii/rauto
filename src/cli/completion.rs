use super::Cli;
use clap::{Args, Command, ValueEnum, ValueHint};
use clap_complete::aot::{Generator, Shell};
use serde::Serialize;
use std::io::{self, Write};

#[derive(Clone, Copy, Debug, ValueEnum)]
pub enum CompletionShell {
    Bash,
    Zsh,
    Fish,
    #[value(alias = "pwsh")]
    Powershell,
}

#[derive(Args, Debug)]
pub struct CompletionArgs {
    /// Shell to generate static completions for
    #[arg(value_enum)]
    pub shell: CompletionShell,
}

pub fn generate(shell: CompletionShell, output: &mut dyn Write) -> io::Result<()> {
    let generator = match shell {
        CompletionShell::Bash => Shell::Bash,
        CompletionShell::Zsh => Shell::Zsh,
        CompletionShell::Fish => Shell::Fish,
        CompletionShell::Powershell => Shell::PowerShell,
    };
    let mut command = completion_command(Cli::completion_command());
    command.set_bin_name("rauto");
    command.build();
    let mut globals = super::GlobalOpts::augment_args(Command::new("rauto"));
    globals.build();
    let prefix_options = globals
        .get_arguments()
        .filter(|arg| arg.is_global_set())
        .map(StaticOption::from_arg)
        .collect::<Vec<_>>();
    if matches!(shell, CompletionShell::Powershell) {
        // The upstream static PowerShell generator does not complete enum values.
        let mut spec = StaticCommand::from_command(&command);
        // Recognize shared options before a subcommand without advertising them
        // at the root or mistaking their values for command names.
        spec.prefix_options = prefix_options;
        writeln!(
            output,
            "$rautoStaticCompletionSpec = ConvertFrom-Json -InputObject @'"
        )?;
        serde_json::to_writer(&mut *output, &spec).map_err(io::Error::other)?;
        writeln!(output, "\n'@")?;
        return output.write_all(include_bytes!("completion/powershell.ps1"));
    }
    if matches!(shell, CompletionShell::Zsh) {
        let mut generated = Vec::new();
        generator.try_generate(&command, &mut generated)?;
        let generated = String::from_utf8(generated).map_err(io::Error::other)?;
        // Install the wrapper before the generator's first-autoload dispatch.
        let (definitions, dispatch) = generated
            .split_once("\nif [ \"$funcstack[1]\" = \"_rauto\" ]; then")
            .ok_or_else(|| io::Error::other("missing Zsh completion dispatch"))?;
        output.write_all(definitions.as_bytes())?;
        write_prefix_options(&prefix_options, output)?;
        output.write_all(include_bytes!("completion/zsh.zsh"))?;
        writeln!(
            output,
            "\nif [ \"$funcstack[1]\" = \"_rauto\" ]; then{dispatch}"
        )?;
        return Ok(());
    }
    generator.try_generate(&command, output)?;
    if matches!(shell, CompletionShell::Bash) {
        write_prefix_options(&prefix_options, output)?;
        output.write_all(include_bytes!("completion/bash.bash"))?;
    } else if matches!(shell, CompletionShell::Fish) {
        write_fish_prefix_options(&command, &prefix_options, output)?;
    }
    Ok(())
}

fn shell_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn write_prefix_options(options: &[StaticOption], output: &mut dyn Write) -> io::Result<()> {
    writeln!(output, "\n_rauto_prefix_option() {{\n    case \"$1\" in")?;
    for option in options {
        writeln!(
            output,
            "        {}) _rauto_prefix_takes_value={}; _rauto_prefix_values=({}) ;;",
            option
                .names
                .iter()
                .map(|name| shell_literal(name))
                .collect::<Vec<_>>()
                .join("|"),
            option.takes_value,
            option
                .values
                .iter()
                .map(|value| shell_literal(value))
                .collect::<Vec<_>>()
                .join(" "),
        )?;
    }
    writeln!(output, "        *) return 1 ;;\n    esac\n}}")
}

fn write_fish_prefix_options(
    command: &Command,
    options: &[StaticOption],
    output: &mut dyn Write,
) -> io::Result<()> {
    // Fish's generated command detector must skip prefix option values too.
    writeln!(output, "\nfunction __fish_rauto_global_optspecs")?;
    for option in command
        .get_arguments()
        .filter(|arg| !arg.is_positional())
        .map(StaticOption::from_arg)
        .chain(options.iter().cloned())
    {
        for name in option.names {
            writeln!(
                output,
                "    echo '{}'",
                name.trim_start_matches('-').to_owned() + if option.takes_value { "=" } else { "" },
            )?;
        }
    }
    writeln!(output, "end")?;
    writeln!(
        output,
        "\nfunction __fish_rauto_prefix_option\n    switch $argv[1]"
    )?;
    for takes_value in [true, false] {
        let names = options
            .iter()
            .filter(|option| option.takes_value == takes_value)
            .flat_map(|option| &option.names)
            .map(|name| shell_literal(name))
            .collect::<Vec<_>>()
            .join(" ");
        writeln!(
            output,
            "        case {names}\n            echo {}",
            if takes_value { "value" } else { "flag" },
        )?;
    }
    writeln!(
        output,
        "        case '*'\n            return 1\n    end\nend"
    )?;
    output.write_all(include_bytes!("completion/fish.fish"))?;
    for option in options.iter().filter(|option| option.takes_value) {
        let names = option
            .names
            .iter()
            .map(|name| shell_literal(name))
            .collect::<Vec<_>>()
            .join(" ");
        write!(
            output,
            "complete -c rauto -n \"__fish_rauto_prefix_value {names}\" -r -f"
        )?;
        for name in &option.names {
            write!(
                output,
                " {} {}",
                if name.starts_with("--") { "-l" } else { "-s" },
                shell_literal(name.trim_start_matches('-')),
            )?;
        }
        writeln!(output, " -a '{}'", option.values.join(" "))?;
    }
    Ok(())
}

#[derive(Serialize)]
struct StaticCommand {
    names: Vec<String>,
    help: String,
    options: Vec<StaticOption>,
    prefix_options: Vec<StaticOption>,
    positionals: Vec<Vec<String>>,
    commands: Vec<Self>,
}

#[derive(Clone, Serialize)]
struct StaticOption {
    names: Vec<String>,
    help: String,
    takes_value: bool,
    values: Vec<String>,
}

fn enum_values(arg: &clap::Arg) -> Vec<String> {
    if !arg.get_num_args().is_some_and(|range| range.takes_values()) {
        return Vec::new();
    }
    arg.get_possible_values()
        .into_iter()
        .filter(|value| !value.is_hide_set())
        .map(|value| value.get_name().to_owned())
        .collect()
}

impl StaticOption {
    fn from_arg(arg: &clap::Arg) -> Self {
        Self {
            names: arg
                .get_short_and_visible_aliases()
                .unwrap_or_default()
                .into_iter()
                .map(|name| format!("-{name}"))
                .chain(
                    arg.get_long_and_visible_aliases()
                        .unwrap_or_default()
                        .into_iter()
                        .map(|name| format!("--{name}")),
                )
                .collect(),
            help: arg.get_help().map(ToString::to_string).unwrap_or_default(),
            takes_value: arg.get_num_args().is_some_and(|range| range.takes_values()),
            values: enum_values(arg),
        }
    }
}

impl StaticCommand {
    fn from_command(command: &Command) -> Self {
        Self {
            names: command
                .get_name_and_visible_aliases()
                .into_iter()
                .map(str::to_owned)
                .collect(),
            help: command
                .get_about()
                .map(ToString::to_string)
                .unwrap_or_default(),
            options: command
                .get_arguments()
                .filter(|arg| !arg.is_positional() && !arg.is_hide_set())
                .map(StaticOption::from_arg)
                .collect(),
            prefix_options: Vec::new(),
            positionals: command.get_positionals().map(enum_values).collect(),
            commands: command
                .get_subcommands()
                .filter(|command| !command.is_hide_set())
                .map(Self::from_command)
                .collect(),
        }
    }
}

fn completion_command(command: Command) -> Command {
    command
        .mut_args(|arg| {
            if !arg.get_action().takes_values() {
                return arg;
            }
            let hint = match arg.get_value_hint() {
                // The Bash generator preserves spaces and enables quoting for FilePath.
                ValueHint::AnyPath | ValueHint::DirPath | ValueHint::ExecutablePath => {
                    ValueHint::FilePath
                }
                // Names and arbitrary strings have no static value candidates.
                ValueHint::Unknown => ValueHint::Other,
                hint => hint,
            };
            arg.value_hint(hint)
        })
        .mut_subcommands(completion_command)
}
