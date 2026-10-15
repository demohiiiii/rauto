use super::Cli;
use clap::{Args, Command, CommandFactory, ValueEnum, ValueHint};
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
    let mut command = completion_command(Cli::command());
    command.set_bin_name("rauto");
    command.build();
    if matches!(shell, CompletionShell::Powershell) {
        // The upstream static PowerShell generator does not complete enum values.
        writeln!(
            output,
            "$rautoStaticCompletionSpec = ConvertFrom-Json -InputObject @'"
        )?;
        serde_json::to_writer(&mut *output, &StaticCommand::from_command(&command))
            .map_err(io::Error::other)?;
        writeln!(output, "\n'@")?;
        return output.write_all(include_bytes!("completion/powershell.ps1"));
    }
    generator.try_generate(&command, output)?;
    if matches!(shell, CompletionShell::Bash) {
        output.write_all(include_bytes!("completion/bash.bash"))?;
    }
    Ok(())
}

#[derive(Serialize)]
struct StaticCommand {
    names: Vec<String>,
    help: String,
    options: Vec<StaticOption>,
    positionals: Vec<Vec<String>>,
    commands: Vec<Self>,
}

#[derive(Serialize)]
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
                .map(|arg| StaticOption {
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
                })
                .collect(),
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
