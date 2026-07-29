use crate::cli::multi_target::{
    MultiTargetRun, has_multi_target_selectors, multi_target_concurrency,
    resolve_multi_target_names, run_buffered_multi_target,
};
use crate::cli::{
    ConfigCmd, ConfigCommandCommands, ConfigCommands, ConfigFetchArgs, ConfigVolatileCommands,
    RecordLevelOpt,
};
use crate::config::{command_blacklist, config_catalog, config_command_store, template_loader};
use crate::device::DeviceClient;
use anyhow::Result;
use chrono::Utc;
use std::fmt::Write as _;
use std::fs;
use std::path::Path;
use std::path::PathBuf;

pub(crate) async fn run_config_command(
    cmd: ConfigCmd,
    opts: &crate::cli::GlobalOpts,
) -> Result<()> {
    match cmd.command {
        ConfigCommands::Fetch(args) => run_config_fetch(args, opts).await,
        ConfigCommands::Command(cmd) => run_config_command_mapping(cmd),
        ConfigCommands::Volatile(cmd) => run_config_volatile(cmd),
    }
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

struct FetchedConfig {
    kind: String,
    command: String,
    content: String,
    normalized: String,
    sha256: String,
    normalized_sha256: String,
}

/// Cloneable subset of [`ConfigFetchArgs`] needed by each concurrently
/// executing fetch target task.
#[derive(Clone)]
struct ConfigFetchOptions {
    normalized: bool,
    output: Option<PathBuf>,
    output_dir: Option<PathBuf>,
    record_level: RecordLevelOpt,
}

struct ResolvedConfigTarget {
    name: String,
    conn: crate::EffectiveConnection,
    fetch_command: config_catalog::ConfigFetchCommand,
}

async fn run_config_fetch(args: ConfigFetchArgs, opts: &crate::cli::GlobalOpts) -> Result<()> {
    if let Some(dir) = args.output_dir.as_deref() {
        fs::create_dir_all(dir)?;
    }
    if has_multi_target_selectors(&args.targets, &args.groups, &args.labels) {
        return run_multi_config_fetch(&args, opts).await;
    }

    let conn =
        crate::resolve_autodetect_connection(crate::resolve_effective_connection(opts)?).await?;
    let name = opts.connection.clone().unwrap_or_else(|| conn.host.clone());
    let options = ConfigFetchOptions {
        normalized: args.normalized,
        output: args.output.clone(),
        output_dir: args.output_dir.clone(),
        record_level: args.record_level,
    };
    let fetch_command = config_catalog::resolve_config_command(&conn.device_profile, &args.kind)?;
    command_blacklist::ensure_command_allowed(&fetch_command.command, "config fetch")?;
    let fetched = fetch_config_over_connection(&conn, &fetch_command, args.record_level).await?;
    let mut out = String::new();
    render_fetched_config(&mut out, &name, &conn.host, &fetched, &options)?;
    print!("{}", out);
    Ok(())
}

async fn run_multi_config_fetch(
    args: &ConfigFetchArgs,
    opts: &crate::cli::GlobalOpts,
) -> Result<()> {
    if opts.host.is_some() {
        return Err(anyhow::anyhow!(
            "--host cannot be used with multi-target config fetch; use saved --target connections, --group, or --label"
        ));
    }

    let target_names = resolve_multi_target_names(
        opts.connection.as_deref(),
        &args.targets,
        &args.groups,
        &args.labels,
    )?;
    if target_names.is_empty() {
        return Err(anyhow::anyhow!(
            "multi-target config fetch resolved no saved connections"
        ));
    }

    let mut resolved_targets = Vec::with_capacity(target_names.len());
    let mut errors = Vec::new();
    for name in target_names {
        match resolve_config_target(&name, args, opts).await {
            Ok(target) => resolved_targets.push(target),
            Err(err) => errors.push(format!("{}: {err:#}", name)),
        }
    }
    if !errors.is_empty() {
        return Err(anyhow::anyhow!(
            "config fetch precheck failed for {} target(s):\n{}",
            errors.len(),
            errors.join("\n")
        ));
    }

    println!(
        "# precheck: config kind '{}' is fetchable on {} target(s)",
        args.kind,
        resolved_targets.len()
    );
    let total_targets = resolved_targets.len();
    let concurrency = multi_target_concurrency(args.max_parallel, total_targets);
    if concurrency > 1 {
        println!(
            "# executing on {} target(s) with up to {} in parallel",
            total_targets, concurrency
        );
    }
    let options = ConfigFetchOptions {
        normalized: args.normalized,
        output: None,
        output_dir: args.output_dir.clone(),
        record_level: args.record_level,
    };
    let outcome = run_buffered_multi_target(resolved_targets, concurrency, move |target| {
        let options = options.clone();
        async move {
            let name = target.name.clone();
            let mut out = String::new();
            let result = async {
                let fetched = fetch_config_over_connection(
                    &target.conn,
                    &target.fetch_command,
                    options.record_level,
                )
                .await?;
                render_fetched_config(
                    &mut out,
                    &target.name,
                    &target.conn.host,
                    &fetched,
                    &options,
                )?;
                Ok(None::<()>)
            }
            .await;
            MultiTargetRun {
                name,
                output: out,
                result,
            }
        }
    })
    .await?;
    if !outcome.errors.is_empty() {
        return Err(anyhow::anyhow!(
            "multi-target config fetch failed on {} target(s):\n{}",
            outcome.errors.len(),
            outcome.errors.join("\n")
        ));
    }
    Ok(())
}

async fn resolve_config_target(
    name: &str,
    args: &ConfigFetchArgs,
    opts: &crate::cli::GlobalOpts,
) -> Result<ResolvedConfigTarget> {
    let mut target_opts = opts.clone();
    target_opts.connection = Some(name.to_string());
    target_opts.save_connection = None;
    target_opts.host = None;
    let conn =
        crate::resolve_autodetect_connection(crate::resolve_effective_connection(&target_opts)?)
            .await?;
    let fetch_command = config_catalog::resolve_config_command(&conn.device_profile, &args.kind)?;
    command_blacklist::ensure_command_allowed(&fetch_command.command, "config fetch")?;
    Ok(ResolvedConfigTarget {
        name: name.to_string(),
        conn,
        fetch_command,
    })
}

async fn fetch_config_over_connection(
    conn: &crate::EffectiveConnection,
    fetch_command: &config_catalog::ConfigFetchCommand,
    record_level: RecordLevelOpt,
) -> Result<FetchedConfig> {
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let default_mode = template_loader::default_profile_mode(&conn.device_profile)?;
    let effective_mode =
        template_loader::resolve_profile_mode(&conn.device_profile, fetch_command.mode.as_deref())?;
    let client = DeviceClient::connect_with_recording_and_retry(
        conn.host.clone(),
        conn.port,
        conn.username.clone(),
        conn.auth.clone(),
        conn.enable_password.clone(),
        handler,
        default_mode,
        crate::to_record_level(record_level),
        conn.ssh_security,
        conn.connect_timeout_secs,
        conn.retry_policy,
    )
    .await?;
    let output = client
        .execute_output(&fetch_command.command, Some(&effective_mode))
        .await?;
    if output.exit_code.unwrap_or(0) != 0 {
        return Err(anyhow::anyhow!(
            "config fetch command '{}' exited with code {}",
            fetch_command.command,
            output.exit_code.unwrap_or(-1)
        ));
    }
    crate::persist_auto_recording_history(
        &client,
        conn,
        "config_fetch",
        &fetch_command.command,
        Some(effective_mode.as_str()),
        record_level,
    )?;
    let content = output.content;
    let patterns = config_catalog::volatile_patterns(&conn.device_profile)?;
    let normalized = config_catalog::normalize_config(&content, &patterns);
    Ok(FetchedConfig {
        kind: fetch_command.kind.clone(),
        command: fetch_command.command.clone(),
        sha256: config_catalog::sha256_hex(&content),
        normalized_sha256: config_catalog::sha256_hex(&normalized),
        content,
        normalized,
    })
}

/// Renders one fetched config into the buffered output: a metadata header
/// followed by the config text, or a "saved" line when --output-dir is used.
fn render_fetched_config(
    out: &mut String,
    name: &str,
    host: &str,
    fetched: &FetchedConfig,
    options: &ConfigFetchOptions,
) -> Result<()> {
    let _ = writeln!(out, "=== target: {} ({}) ===", name, host);
    let _ = writeln!(out, "# kind: {}", fetched.kind);
    let _ = writeln!(out, "# command: {}", fetched.command);
    let _ = writeln!(out, "# sha256: {}", fetched.sha256);
    let _ = writeln!(out, "# normalized_sha256: {}", fetched.normalized_sha256);
    let content = if options.normalized {
        &fetched.normalized
    } else {
        &fetched.content
    };
    let output_path = options.output.clone().or_else(|| {
        options
            .output_dir
            .as_deref()
            .map(|dir| config_output_path(dir, name, &fetched.kind))
    });
    if let Some(path) = output_path {
        if let Some(parent) = path.parent()
            && !parent.as_os_str().is_empty()
        {
            fs::create_dir_all(parent)?;
        }
        fs::write(&path, content)?;
        let _ = writeln!(out, "# saved: {}", path.display());
    } else {
        let _ = writeln!(out, "{}", content);
    }
    Ok(())
}

fn config_output_path(dir: &Path, name: &str, kind: &str) -> PathBuf {
    let safe_name: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect();
    dir.join(format!(
        "{}_{}_{}.cfg",
        safe_name,
        kind,
        Utc::now().format("%Y%m%dT%H%M%SZ")
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn exact_output_path_creates_parents_and_writes_selected_content() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should follow the Unix epoch")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "rauto-config-fetch-test-{}-{unique}",
            std::process::id()
        ));
        let output = root.join("nested/running.cfg");
        let fetched = FetchedConfig {
            kind: "running".to_string(),
            command: "show running-config".to_string(),
            content: "raw config\n".to_string(),
            normalized: "normalized config\n".to_string(),
            sha256: "raw-hash".to_string(),
            normalized_sha256: "normalized-hash".to_string(),
        };
        let options = ConfigFetchOptions {
            normalized: true,
            output: Some(output.clone()),
            output_dir: None,
            record_level: RecordLevelOpt::KeyEventsOnly,
        };
        let mut rendered = String::new();

        render_fetched_config(&mut rendered, "edge-01", "192.0.2.10", &fetched, &options)
            .expect("config should be written to the exact output path");

        assert_eq!(
            fs::read_to_string(&output).expect("written config should be readable"),
            "normalized config\n"
        );
        assert!(rendered.contains(&format!("# saved: {}", output.display())));
        fs::remove_dir_all(&root).expect("temporary config output should be removable");
    }
}
