use crate::cli::{
    ConfigCmd, ConfigCommandCommands, ConfigCommands, ConfigHistoryCommands,
    ConfigHistorySortOrder, ConfigVolatileCommands,
};
use crate::config::{config_catalog, config_command_store};
use crate::domain::device::DeviceConfigSnapshotSortOrder;
use crate::infrastructure::db::device_config_store;
use anyhow::{Result, anyhow};
use chrono::DateTime;
use std::fs;

pub(crate) async fn run_config_command(
    cmd: ConfigCmd,
    _opts: &crate::cli::GlobalOpts,
) -> Result<()> {
    match cmd.command {
        ConfigCommands::Fetch(_) => unreachable!("config fetch uses the shared execution service"),
        ConfigCommands::Command(cmd) => run_config_command_mapping(cmd),
        ConfigCommands::Volatile(cmd) => run_config_volatile(cmd),
        ConfigCommands::History(cmd) => run_config_history(cmd).await,
    }
}

async fn run_config_history(cmd: ConfigHistoryCommands) -> Result<()> {
    match cmd {
        ConfigHistoryCommands::Devices { json } => {
            let devices = device_config_store::list_history_devices().await?;
            if json {
                println!("{}", serde_json::to_string_pretty(&devices)?);
            } else if devices.is_empty() {
                println!("-");
            } else {
                for device in devices {
                    println!(
                        "{}\t{}\t{}",
                        device.name, device.host, device.device_profile
                    );
                }
            }
        }
        ConfigHistoryCommands::List {
            connection,
            kind,
            from,
            to,
            sort,
            limit,
            json,
        } => {
            let from_ms = parse_history_timestamp(from.as_deref(), "from")?;
            let to_ms = parse_history_timestamp(to.as_deref(), "to")?;
            if from_ms.zip(to_ms).is_some_and(|(from, to)| from > to) {
                return Err(anyhow!("--from must be earlier than or equal to --to"));
            }
            let sort_order = match sort {
                ConfigHistorySortOrder::Asc => DeviceConfigSnapshotSortOrder::Ascending,
                ConfigHistorySortOrder::Desc => DeviceConfigSnapshotSortOrder::Descending,
            };
            let snapshots = device_config_store::list_snapshots(
                connection.as_deref(),
                kind.as_deref(),
                from_ms,
                to_ms,
                sort_order,
                limit,
            )
            .await?;
            if json {
                println!("{}", serde_json::to_string_pretty(&snapshots)?);
            } else if snapshots.is_empty() {
                println!("-");
            } else {
                for snapshot in snapshots {
                    let change = match snapshot.changed_from_previous {
                        Some(true) => "changed",
                        Some(false) => "unchanged",
                        None => "baseline",
                    };
                    println!(
                        "{}\t{}\t{}\t{}\t{}\t{}\t{}",
                        snapshot.id,
                        snapshot.fetched_at,
                        snapshot.connection_name,
                        snapshot.kind,
                        change,
                        snapshot.content_size_bytes,
                        snapshot.sha256
                    );
                }
            }
        }
        ConfigHistoryCommands::Show { id, output, json } => {
            let snapshot = device_config_store::get_snapshot(&id)
                .await?
                .ok_or_else(|| anyhow!("configuration snapshot '{}' not found", id.trim()))?;
            if let Some(path) = output {
                if let Some(parent) = path.parent()
                    && !parent.as_os_str().is_empty()
                {
                    fs::create_dir_all(parent)?;
                }
                fs::write(&path, &snapshot.content)?;
                println!("Configuration written to {}", path.display());
            } else if json {
                println!("{}", serde_json::to_string_pretty(&snapshot)?);
            } else {
                println!("# id: {}", snapshot.summary.id);
                println!("# connection: {}", snapshot.summary.connection_name);
                println!("# host: {}", snapshot.summary.host);
                println!("# profile: {}", snapshot.summary.profile);
                println!("# kind: {}", snapshot.summary.kind);
                println!("# fetched_at: {}", snapshot.summary.fetched_at);
                println!("# sha256: {}", snapshot.summary.sha256);
                print!("{}", snapshot.content);
                if !snapshot.content.ends_with('\n') {
                    println!();
                }
            }
        }
        ConfigHistoryCommands::Delete { id } => {
            if !device_config_store::delete_snapshot(&id).await? {
                return Err(anyhow!("configuration snapshot '{}' not found", id.trim()));
            }
            println!("Deleted configuration snapshot '{}'", id.trim());
        }
    }
    Ok(())
}

fn parse_history_timestamp(value: Option<&str>, option: &str) -> Result<Option<i64>> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| {
            DateTime::parse_from_rfc3339(value)
                .map(|timestamp| timestamp.timestamp_millis())
                .map_err(|_| anyhow!("--{option} must be an RFC 3339 timestamp"))
        })
        .transpose()
}

fn run_config_volatile(cmd: ConfigVolatileCommands) -> Result<()> {
    match cmd {
        ConfigVolatileCommands::List { profile } => {
            let entries = config_catalog::list_volatile_patterns(profile.as_deref())?;
            if entries.is_empty() {
                println!("-");
                return Ok(());
            }
            for entry in entries {
                println!(
                    "{}\t{}\t{}",
                    entry.profile,
                    entry.source.label(),
                    entry.pattern
                );
            }
            Ok(())
        }
        ConfigVolatileCommands::Add { profile, pattern } => {
            if config_command_store::add_volatile_pattern(&profile, &pattern)? {
                println!("Added volatile pattern for '{}'", profile);
            } else {
                println!("Volatile pattern already exists for '{}'", profile);
            }
            Ok(())
        }
        ConfigVolatileCommands::Remove { profile, pattern } => {
            if config_command_store::remove_volatile_pattern(&profile, &pattern)? {
                println!("Removed volatile pattern for '{}'", profile);
                Ok(())
            } else {
                Err(anyhow::anyhow!(
                    "no custom volatile pattern '{}' for '{}'",
                    pattern,
                    profile
                ))
            }
        }
    }
}

fn run_config_command_mapping(cmd: ConfigCommandCommands) -> Result<()> {
    match cmd {
        ConfigCommandCommands::List { profile } => {
            let commands = config_catalog::list_config_commands(profile.as_deref())?;
            if commands.is_empty() {
                println!("-");
                return Ok(());
            }
            for command in commands {
                println!(
                    "{}\t{}\t{}\t{}\t{}",
                    command.profile,
                    command.kind,
                    command.mode.as_deref().unwrap_or("-"),
                    command.source.label(),
                    command.command
                );
            }
            Ok(())
        }
        ConfigCommandCommands::Set {
            profile,
            kind,
            command,
            mode,
        } => {
            config_command_store::upsert(&profile, &kind, &command, mode.as_deref())?;
            println!("Set config fetch command for '{}' kind '{}'", profile, kind);
            Ok(())
        }
        ConfigCommandCommands::Unset { profile, kind } => {
            if config_command_store::delete(&profile, &kind)? {
                println!(
                    "Removed config fetch command override for '{}' kind '{}'",
                    profile, kind
                );
                Ok(())
            } else {
                Err(anyhow::anyhow!(
                    "no config fetch command override for '{}' kind '{}'",
                    profile,
                    kind
                ))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::parse_history_timestamp;
    #[test]
    fn history_timestamps_require_rfc3339() {
        assert_eq!(
            parse_history_timestamp(Some("2026-08-27T12:00:00+08:00"), "from").unwrap(),
            Some(1_787_803_200_000)
        );
        assert!(parse_history_timestamp(Some("2026-08-27 12:00"), "from").is_err());
        assert_eq!(parse_history_timestamp(Some("  "), "from").unwrap(), None);
    }
}
