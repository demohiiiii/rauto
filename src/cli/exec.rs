use crate::cli::multi_target::{
    MultiTargetRun, has_multi_target_selectors, multi_target_concurrency,
    resolve_multi_target_names, run_buffered_multi_target,
};
use crate::cli::{
    ExecArgs, RecordLevelOpt, ShowArgs, ShowObjectCommands, TemplateArgs, TemplateCommands,
    TextfsmCommands, TextfsmMappingCommands, TextfsmTemplateCommands,
};
use crate::config::{
    command_blacklist, content_store, custom_show_object_store, custom_textfsm_store, show_catalog,
    template_loader, textfsm, textfsm_export,
};
use crate::device::DeviceClient;
use crate::template::renderer::Renderer;
use anyhow::Result;
use serde_json::{Map, Value};
use std::collections::BTreeMap;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::info;

/// Copyable subset of [`ShowArgs`] needed by each concurrently executing
/// show target task.
#[derive(Clone, Copy)]
struct MultiShowExecutionOptions {
    print_command: bool,
    no_parse: bool,
    textfsm_strict_errors: bool,
    record_level: RecordLevelOpt,
}

/// Cloneable subset of [`ExecArgs`] needed by each concurrently executing
/// exec target task.
#[derive(Clone)]
struct MultiExecOptions {
    command: String,
    textfsm_template: Option<PathBuf>,
    parse_enabled: bool,
    textfsm_platform: Option<String>,
    textfsm_strict_errors: bool,
    record_level: RecordLevelOpt,
}

struct ResolvedExecTarget {
    name: String,
    conn: crate::EffectiveConnection,
    effective_mode: String,
}

async fn run_multi_exec(args: &ExecArgs, opts: &crate::cli::GlobalOpts) -> Result<()> {
    if args.record_file.is_some() {
        return Err(anyhow::anyhow!(
            "--record-file is not supported with multi-target exec; session history is still saved automatically"
        ));
    }
    if opts.host.is_some() {
        return Err(anyhow::anyhow!(
            "--host cannot be used with multi-target exec; use saved --target connections, --group, or --label"
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
            "multi-target exec resolved no saved connections"
        ));
    }

    let mut resolved_targets = Vec::with_capacity(target_names.len());
    let mut errors = Vec::new();
    for name in target_names {
        match resolve_exec_target(&name, args, opts).await {
            Ok(target) => resolved_targets.push(target),
            Err(err) => errors.push(format!("{}: {err:#}", name)),
        }
    }
    if !errors.is_empty() {
        return Err(anyhow::anyhow!(
            "exec precheck failed for {} target(s):\n{}",
            errors.len(),
            errors.join("\n")
        ));
    }

    println!(
        "# precheck: command is executable on {} target(s)",
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
    let options = MultiExecOptions {
        command: args.command.clone(),
        textfsm_template: args.textfsm_template.clone(),
        parse_enabled: args.parse_textfsm
            || args.textfsm_template.is_some()
            || args.textfsm_excel.is_some(),
        textfsm_platform: args.textfsm_platform.clone(),
        textfsm_strict_errors: args.textfsm_strict_errors,
        record_level: args.record_level,
    };
    let outcome = run_buffered_multi_target(resolved_targets, concurrency, move |target| {
        let options = options.clone();
        async move {
            let name = target.name.clone();
            let (output, result) = execute_resolved_exec_target(&target, &options).await;
            MultiTargetRun {
                name,
                output,
                result,
            }
        }
    })
    .await?;
    if let Some(path) = args.textfsm_excel.as_deref()
        && !outcome.parsed.is_empty()
    {
        let parsed_sheets = merge_multi_show_parsed_outputs(outcome.parsed);
        write_textfsm_excel(path, parsed_sheets)?;
    }
    if !outcome.errors.is_empty() {
        return Err(anyhow::anyhow!(
            "multi-target exec failed on {} target(s):\n{}",
            outcome.errors.len(),
            outcome.errors.join("\n")
        ));
    }
    Ok(())
}

async fn resolve_exec_target(
    name: &str,
    args: &ExecArgs,
    opts: &crate::cli::GlobalOpts,
) -> Result<ResolvedExecTarget> {
    let mut target_opts = opts.clone();
    target_opts.connection = Some(name.to_string());
    target_opts.save_connection = None;
    target_opts.host = None;
    let conn =
        crate::resolve_autodetect_connection(crate::resolve_effective_connection(&target_opts)?)
            .await?;
    let effective_mode =
        template_loader::resolve_profile_mode(&conn.device_profile, args.mode.as_deref())?;
    Ok(ResolvedExecTarget {
        name: name.to_string(),
        conn,
        effective_mode,
    })
}

async fn execute_resolved_exec_target(
    target: &ResolvedExecTarget,
    options: &MultiExecOptions,
) -> (String, Result<Option<MultiShowParsedOutput>>) {
    let mut out = String::new();
    let result = execute_resolved_exec_target_buffered(target, options, &mut out).await;
    (out, result)
}

async fn execute_resolved_exec_target_buffered(
    target: &ResolvedExecTarget,
    options: &MultiExecOptions,
    out: &mut String,
) -> Result<Option<MultiShowParsedOutput>> {
    let _ = writeln!(
        out,
        "=== target: {} ({}) ===",
        target.name, target.conn.host
    );
    let handler = template_loader::load_device_profile_for_connection(
        &target.conn.device_profile,
        target.conn.linux_shell_flavor,
    )?;
    let default_mode = template_loader::default_profile_mode(&target.conn.device_profile)?;
    let client = DeviceClient::connect_with_recording(
        target.conn.host.clone(),
        target.conn.port,
        target.conn.username.clone(),
        target.conn.auth.clone(),
        target.conn.enable_password.clone(),
        handler,
        default_mode,
        crate::to_record_level(options.record_level),
        target.conn.ssh_security,
        target.conn.connect_timeout_secs,
    )
    .await?;

    info!(
        "Executing command '{}' on '{}'",
        options.command, target.name
    );
    let output = client
        .execute(&options.command, Some(&target.effective_mode))
        .await?;
    crate::persist_auto_recording_history(
        &client,
        &target.conn,
        "exec",
        &options.command,
        Some(target.effective_mode.as_str()),
        options.record_level,
    )?;
    let _ = writeln!(out, "{}", output);
    if !options.parse_enabled {
        return Ok(None);
    }

    let (parsed_output, parse_error) = textfsm::parse_command_output_optional(
        &output,
        &options.command,
        &textfsm::ParseOptions {
            template_file: options.textfsm_template.clone(),
            enabled: true,
            platform: options.textfsm_platform.clone(),
            device_profile: Some(target.conn.device_profile.clone()),
            filter_error_rules: !options.textfsm_strict_errors,
            ..Default::default()
        },
    );
    if let Some(err) = parse_error {
        let _ = writeln!(out, "--- Parse Error ---");
        let _ = writeln!(out, "{}", err);
    }
    let Some(parsed_output) = parsed_output else {
        return Ok(None);
    };
    let _ = writeln!(out, "--- Parsed Output ---");
    let _ = writeln!(
        out,
        "{}",
        textfsm::format_parsed_output_table(&parsed_output)
    );
    Ok(Some(MultiShowParsedOutput {
        object: options.command.clone(),
        rows: add_multi_target_metadata(
            &target.name,
            &target.conn.device_profile,
            &options.command,
            parsed_output,
        )?,
    }))
}

pub(crate) async fn run_template(args: TemplateArgs, opts: &crate::cli::GlobalOpts) -> Result<()> {
    info!("Running template mode");

    let renderer = Renderer::new();
    let vars = if let Some(vars_path) = args.vars {
        let content = fs::read_to_string(&vars_path)?;
        serde_json::from_str(&content)?
    } else {
        Value::Null
    };

    let rendered_commands = renderer.render_file(&args.template, vars)?;
    println!("--- Rendered Commands ---\n{}", rendered_commands);
    println!("-------------------------");

    if args.dry_run {
        info!("Dry run enabled, skipping execution");
        return Ok(());
    }

    let lines: Vec<String> = rendered_commands
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();
    command_blacklist::ensure_commands_allowed(
        lines.iter().map(String::as_str),
        "template execution",
    )?;

    let conn =
        crate::resolve_autodetect_connection(crate::resolve_effective_connection(opts)?).await?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let default_mode = template_loader::default_profile_mode(&conn.device_profile)?;

    info!("Connecting to device...");
    let client = DeviceClient::connect_with_recording(
        conn.host.clone(),
        conn.port,
        conn.username.clone(),
        conn.auth.clone(),
        conn.enable_password.clone(),
        handler,
        default_mode.clone(),
        crate::to_record_level(args.record_level),
        conn.ssh_security,
        conn.connect_timeout_secs,
    )
    .await?;

    crate::maybe_save_connection_profile(opts, &conn)?;

    info!("Executing {} commands...", lines.len());
    let mut parsed_sheets = Vec::new();
    for (command_index, command) in lines.into_iter().enumerate() {
        print!("Executing '{}' ... ", command);
        match client.execute(&command, None).await {
            Ok(output) => {
                println!("Success\nOutput:\n{}", output);
                let (parsed_output, parse_error) = textfsm::parse_command_output_optional(
                    &output,
                    &command,
                    &textfsm::ParseOptions {
                        template_file: textfsm_template_for_index(
                            &args.textfsm_template,
                            command_index,
                        ),
                        enabled: args.parse_textfsm
                            || !args.textfsm_template.is_empty()
                            || args.textfsm_excel.is_some(),
                        platform: args.textfsm_platform.clone(),
                        device_profile: Some(conn.device_profile.clone()),
                        filter_error_rules: !args.textfsm_strict_errors,
                        ..Default::default()
                    },
                );
                if let Some(parsed_output) = parsed_output {
                    println!(
                        "Parsed Output:\n{}",
                        textfsm::format_parsed_output_table(&parsed_output)
                    );
                    parsed_sheets.push(textfsm_export::ParsedOutputSheet {
                        name: command.clone(),
                        parsed_output,
                    });
                }
                if let Some(err) = parse_error {
                    println!("Parse Error: {}", err);
                }
            }
            Err(error) => println!("Failed: {}", error),
        }
    }
    if let Some(path) = args.textfsm_excel.as_deref() {
        write_textfsm_excel(path, parsed_sheets)?;
    }
    crate::write_recording_if_requested(args.record_file.as_ref(), &client, args.record_level)?;
    crate::persist_auto_recording_history(
        &client,
        &conn,
        "template_execute",
        &format!("template: {}", args.template),
        Some(default_mode.as_str()),
        args.record_level,
    )?;
    Ok(())
}

pub(crate) async fn run_exec(args: ExecArgs, opts: &crate::cli::GlobalOpts) -> Result<()> {
    command_blacklist::ensure_command_allowed(&args.command, "direct execution")?;
    if has_multi_target_selectors(&args.targets, &args.groups, &args.labels) {
        return run_multi_exec(&args, opts).await;
    }
    let conn =
        crate::resolve_autodetect_connection(crate::resolve_effective_connection(opts)?).await?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let default_mode = template_loader::default_profile_mode(&conn.device_profile)?;
    let effective_mode =
        template_loader::resolve_profile_mode(&conn.device_profile, args.mode.as_deref())?;

    let client = DeviceClient::connect_with_recording(
        conn.host.clone(),
        conn.port,
        conn.username.clone(),
        conn.auth.clone(),
        conn.enable_password.clone(),
        handler,
        default_mode.clone(),
        crate::to_record_level(args.record_level),
        conn.ssh_security,
        conn.connect_timeout_secs,
    )
    .await?;

    crate::maybe_save_connection_profile(opts, &conn)?;

    info!("Executing command: {}", args.command);
    let output = client.execute(&args.command, Some(&effective_mode)).await?;
    let (parsed_output, parse_error) = textfsm::parse_command_output_optional(
        &output,
        &args.command,
        &textfsm::ParseOptions {
            template_file: args.textfsm_template.clone(),
            enabled: args.parse_textfsm
                || args.textfsm_template.is_some()
                || args.textfsm_excel.is_some(),
            platform: args.textfsm_platform.clone(),
            device_profile: Some(conn.device_profile.clone()),
            filter_error_rules: !args.textfsm_strict_errors,
            ..Default::default()
        },
    );
    crate::write_recording_if_requested(args.record_file.as_ref(), &client, args.record_level)?;
    crate::persist_auto_recording_history(
        &client,
        &conn,
        "exec",
        &args.command,
        Some(effective_mode.as_str()),
        args.record_level,
    )?;
    println!("{}", output);
    if let Some(parsed_output) = parsed_output {
        println!("--- Parsed Output ---");
        println!("{}", textfsm::format_parsed_output_table(&parsed_output));
        if let Some(path) = args.textfsm_excel.as_deref() {
            textfsm_export::write_parsed_output_xlsx(
                path,
                textfsm_export::ParsedOutputSheet {
                    name: args.command.clone(),
                    parsed_output,
                },
            )?;
            println!("--- TextFSM Excel ---");
            println!("{}", path.display());
        }
    }
    if let Some(err) = parse_error {
        println!("--- Parse Error ---");
        println!("{}", err);
    }
    Ok(())
}

struct ResolvedShowTarget {
    name: String,
    conn: crate::EffectiveConnection,
    platform: Option<String>,
    show: show_catalog::ShowCommand,
    effective_mode: String,
}

pub(crate) struct MultiShowParsedOutput {
    pub(crate) object: String,
    pub(crate) rows: Vec<Value>,
}

pub(crate) async fn run_show(args: ShowArgs, opts: &crate::cli::GlobalOpts) -> Result<()> {
    if args.no_parse && args.textfsm_excel.is_some() {
        return Err(anyhow::anyhow!(
            "--textfsm-excel requires TextFSM parsing; remove --no-parse"
        ));
    }

    if args.list {
        let platform = show_catalog::platform_for_show(
            opts.device_profile.as_deref().unwrap_or_default(),
            args.textfsm_platform.as_deref(),
        );
        print_show_objects(opts.device_profile.as_deref(), platform.as_deref())?;
        return Ok(());
    }

    let object = args
        .object
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| anyhow::anyhow!("show object required, or use --list"))?;

    if has_multi_target_selectors(&args.targets, &args.groups, &args.labels) {
        run_multi_show(&args, opts, object).await?;
        return Ok(());
    }

    let conn =
        crate::resolve_autodetect_connection(crate::resolve_effective_connection(opts)?).await?;
    let platform =
        show_catalog::platform_for_show(&conn.device_profile, args.textfsm_platform.as_deref());
    let show =
        show_catalog::resolve_show_command(object, platform.as_deref(), &conn.device_profile)?;
    command_blacklist::ensure_command_allowed(&show.command, "show execution")?;

    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let default_mode = template_loader::default_profile_mode(&conn.device_profile)?;
    let requested_mode = args.mode.as_deref().or(show.mode.as_deref());
    let effective_mode =
        template_loader::resolve_profile_mode(&conn.device_profile, requested_mode)?;

    let client = DeviceClient::connect_with_recording(
        conn.host.clone(),
        conn.port,
        conn.username.clone(),
        conn.auth.clone(),
        conn.enable_password.clone(),
        handler,
        default_mode,
        crate::to_record_level(args.record_level),
        conn.ssh_security,
        conn.connect_timeout_secs,
    )
    .await?;

    crate::maybe_save_connection_profile(opts, &conn)?;

    if args.print_command {
        println!("# command: {}", show.command);
        if let Some(mode) = show.mode.as_deref() {
            println!("# mapping_mode: {}", mode);
        }
        if let Some(template_name) = show.textfsm_template_name.as_deref() {
            println!("# textfsm_template: {}", template_name);
        }
        println!("# effective_mode: {}", effective_mode);
    }
    info!(
        "Executing show object '{}' as command: {}",
        show.object, show.command
    );
    let output = client
        .execute_output(&show.command, Some(&effective_mode))
        .await?;
    let exit_code = output.exit_code;
    crate::write_recording_if_requested(args.record_file.as_ref(), &client, args.record_level)?;
    crate::persist_auto_recording_history(
        &client,
        &conn,
        "show",
        &show.command,
        Some(effective_mode.as_str()),
        args.record_level,
    )?;

    println!("{}", output.content);
    if !args.no_parse && exit_code.unwrap_or(0) == 0 {
        let template_content = show
            .textfsm_template_name
            .as_deref()
            .map(|name| {
                custom_textfsm_store::load_template(name)?
                    .ok_or_else(|| anyhow::anyhow!("TextFSM template '{}' not found", name))
            })
            .transpose()?
            .map(|template| template.content);
        let (parsed_output, parse_error) = textfsm::parse_command_output_optional(
            &output.content,
            &show.command,
            &textfsm::ParseOptions {
                template_content,
                enabled: true,
                platform,
                device_profile: Some(conn.device_profile.clone()),
                filter_error_rules: !args.textfsm_strict_errors,
                ..Default::default()
            },
        );
        if let Some(parsed_output) = parsed_output {
            println!("--- Parsed Output ---");
            println!("{}", textfsm::format_parsed_output_table(&parsed_output));
            if let Some(path) = args.textfsm_excel.as_deref() {
                textfsm_export::write_parsed_output_xlsx(
                    path,
                    textfsm_export::ParsedOutputSheet {
                        name: show.object.clone(),
                        parsed_output,
                    },
                )?;
                println!("--- TextFSM Excel ---");
                println!("{}", path.display());
            }
        }
        if let Some(err) = parse_error {
            println!("--- Parse Error ---");
            println!("{}", err);
        }
    }
    Ok(())
}

async fn run_multi_show(
    args: &ShowArgs,
    opts: &crate::cli::GlobalOpts,
    object: &str,
) -> Result<()> {
    if args.record_file.is_some() {
        return Err(anyhow::anyhow!(
            "--record-file is not supported with multi-target show; session history is still saved automatically"
        ));
    }
    if opts.host.is_some() {
        return Err(anyhow::anyhow!(
            "--host cannot be used with multi-target show; use saved --target connections, --group, or --label"
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
            "multi-target show resolved no saved connections"
        ));
    }

    let mut resolved_targets = Vec::with_capacity(target_names.len());
    let mut errors = Vec::new();
    for name in target_names {
        match resolve_show_target(&name, args, opts, object).await {
            Ok(target) => resolved_targets.push(target),
            Err(err) => errors.push(format!("{}: {err:#}", name)),
        }
    }
    if !errors.is_empty() {
        return Err(anyhow::anyhow!(
            "show object precheck failed for {} target(s):\n{}",
            errors.len(),
            errors.join("\n")
        ));
    }

    println!(
        "# precheck: show object '{}' is available on {} target(s)",
        object,
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
    let options = MultiShowExecutionOptions {
        print_command: args.print_command,
        no_parse: args.no_parse,
        textfsm_strict_errors: args.textfsm_strict_errors,
        record_level: args.record_level,
    };
    let outcome =
        run_buffered_multi_target(resolved_targets, concurrency, move |target| async move {
            let name = target.name.clone();
            let (output, result) = execute_resolved_show_target(&target, options).await;
            MultiTargetRun {
                name,
                output,
                result,
            }
        })
        .await?;
    let parsed_outputs = outcome.parsed;
    let execution_errors = outcome.errors;
    if let Some(path) = args.textfsm_excel.as_deref()
        && !parsed_outputs.is_empty()
    {
        let parsed_sheets = merge_multi_show_parsed_outputs(parsed_outputs);
        write_textfsm_excel(path, parsed_sheets)?;
    }
    if !execution_errors.is_empty() {
        return Err(anyhow::anyhow!(
            "multi-target show failed on {} target(s):\n{}",
            execution_errors.len(),
            execution_errors.join("\n")
        ));
    }
    Ok(())
}

async fn resolve_show_target(
    name: &str,
    args: &ShowArgs,
    opts: &crate::cli::GlobalOpts,
    object: &str,
) -> Result<ResolvedShowTarget> {
    let mut target_opts = opts.clone();
    target_opts.connection = Some(name.to_string());
    target_opts.save_connection = None;
    target_opts.host = None;
    let conn =
        crate::resolve_autodetect_connection(crate::resolve_effective_connection(&target_opts)?)
            .await?;
    let platform =
        show_catalog::platform_for_show(&conn.device_profile, args.textfsm_platform.as_deref());
    let show =
        show_catalog::resolve_show_command(object, platform.as_deref(), &conn.device_profile)?;
    command_blacklist::ensure_command_allowed(&show.command, "multi-target show execution")?;
    let requested_mode = args.mode.as_deref().or(show.mode.as_deref());
    let effective_mode =
        template_loader::resolve_profile_mode(&conn.device_profile, requested_mode)?;
    Ok(ResolvedShowTarget {
        name: name.to_string(),
        conn,
        platform,
        show,
        effective_mode,
    })
}

/// Executes one resolved show target and returns its buffered console output
/// alongside the parse result. Output is buffered instead of printed so
/// concurrently executing targets never interleave on stdout.
async fn execute_resolved_show_target(
    target: &ResolvedShowTarget,
    options: MultiShowExecutionOptions,
) -> (String, Result<Option<MultiShowParsedOutput>>) {
    let mut out = String::new();
    let result = execute_resolved_show_target_buffered(target, options, &mut out).await;
    (out, result)
}

async fn execute_resolved_show_target_buffered(
    target: &ResolvedShowTarget,
    options: MultiShowExecutionOptions,
    out: &mut String,
) -> Result<Option<MultiShowParsedOutput>> {
    let _ = writeln!(
        out,
        "=== target: {} ({}) ===",
        target.name, target.conn.host
    );
    if options.print_command {
        let _ = writeln!(out, "# command: {}", target.show.command);
        if let Some(mode) = target.show.mode.as_deref() {
            let _ = writeln!(out, "# mapping_mode: {}", mode);
        }
        if let Some(template_name) = target.show.textfsm_template_name.as_deref() {
            let _ = writeln!(out, "# textfsm_template: {}", template_name);
        }
        let _ = writeln!(out, "# effective_mode: {}", target.effective_mode);
    }

    let handler = template_loader::load_device_profile_for_connection(
        &target.conn.device_profile,
        target.conn.linux_shell_flavor,
    )?;
    let default_mode = template_loader::default_profile_mode(&target.conn.device_profile)?;
    let client = DeviceClient::connect_with_recording(
        target.conn.host.clone(),
        target.conn.port,
        target.conn.username.clone(),
        target.conn.auth.clone(),
        target.conn.enable_password.clone(),
        handler,
        default_mode,
        crate::to_record_level(options.record_level),
        target.conn.ssh_security,
        target.conn.connect_timeout_secs,
    )
    .await?;

    info!(
        "Executing show object '{}' on '{}' as command: {}",
        target.show.object, target.name, target.show.command
    );
    let output = client
        .execute_output(&target.show.command, Some(&target.effective_mode))
        .await?;
    let exit_code = output.exit_code;
    crate::persist_auto_recording_history(
        &client,
        &target.conn,
        "show",
        &target.show.command,
        Some(target.effective_mode.as_str()),
        options.record_level,
    )?;

    let _ = writeln!(out, "{}", output.content);
    if options.no_parse || exit_code.unwrap_or(0) != 0 {
        return Ok(None);
    }

    let template_content = target
        .show
        .textfsm_template_name
        .as_deref()
        .map(|name| {
            custom_textfsm_store::load_template(name)?
                .ok_or_else(|| anyhow::anyhow!("TextFSM template '{}' not found", name))
        })
        .transpose()?
        .map(|template| template.content);
    let (parsed_output, parse_error) = textfsm::parse_command_output_optional(
        &output.content,
        &target.show.command,
        &textfsm::ParseOptions {
            template_content,
            enabled: true,
            platform: target.platform.clone(),
            device_profile: Some(target.conn.device_profile.clone()),
            filter_error_rules: !options.textfsm_strict_errors,
            ..Default::default()
        },
    );
    if let Some(err) = parse_error {
        let _ = writeln!(out, "--- Parse Error ---");
        let _ = writeln!(out, "{}", err);
    }
    let Some(parsed_output) = parsed_output else {
        return Ok(None);
    };
    let _ = writeln!(out, "--- Parsed Output ---");
    let _ = writeln!(
        out,
        "{}",
        textfsm::format_parsed_output_table(&parsed_output)
    );
    Ok(Some(MultiShowParsedOutput {
        object: target.show.object.clone(),
        rows: add_multi_target_metadata(
            &target.name,
            &target.conn.device_profile,
            &target.show.command,
            parsed_output,
        )?,
    }))
}

pub(crate) fn add_multi_target_metadata(
    device: &str,
    profile: &str,
    command: &str,
    parsed_output: Value,
) -> Result<Vec<Value>> {
    let rows = parsed_output
        .as_array()
        .ok_or_else(|| anyhow::anyhow!("TextFSM parsed output must be a JSON array"))?;
    let mut enriched_rows = Vec::with_capacity(rows.len());
    for row in rows {
        let source = row
            .as_object()
            .ok_or_else(|| anyhow::anyhow!("TextFSM parsed output rows must be JSON objects"))?;
        let mut enriched = source.clone();
        insert_multi_show_metadata(&mut enriched, "device", Value::String(device.to_string()));
        insert_multi_show_metadata(&mut enriched, "profile", Value::String(profile.to_string()));
        insert_multi_show_metadata(&mut enriched, "command", Value::String(command.to_string()));
        enriched_rows.push(Value::Object(enriched));
    }
    Ok(enriched_rows)
}

fn insert_multi_show_metadata(object: &mut Map<String, Value>, key: &str, value: Value) {
    if let Some(existing) = object.remove(key) {
        object.insert(format!("parsed_{key}"), existing);
    }
    object.insert(key.to_string(), value);
}

pub(crate) fn merge_multi_show_parsed_outputs(
    outputs: Vec<MultiShowParsedOutput>,
) -> Vec<textfsm_export::ParsedOutputSheet> {
    let mut object_order = Vec::new();
    let mut grouped: BTreeMap<String, Vec<Value>> = BTreeMap::new();
    for output in outputs {
        if !grouped.contains_key(&output.object) {
            object_order.push(output.object.clone());
        }
        grouped
            .entry(output.object)
            .or_default()
            .extend(output.rows);
    }
    object_order
        .into_iter()
        .map(|object| textfsm_export::ParsedOutputSheet {
            parsed_output: Value::Array(grouped.remove(&object).unwrap_or_default()),
            name: object,
        })
        .collect()
}

fn print_show_objects(device_profile: Option<&str>, platform: Option<&str>) -> Result<()> {
    if let Some(platform) = platform.filter(|value| !value.trim().is_empty()) {
        let commands =
            show_catalog::list_show_commands_for_profile(device_profile, Some(platform))?;
        if commands.is_empty() {
            println!("# platform: {}", platform);
            println!("-");
            return Ok(());
        }
        println!("# platform: {}", platform);
        for command in commands {
            let source = match command.source {
                show_catalog::ShowCommandSource::Builtin => "builtin",
                show_catalog::ShowCommandSource::Custom => "custom",
            };
            let mut suffixes = vec![format!("source: {source}")];
            if let Some(mode) = command.mode.as_deref() {
                suffixes.push(format!("mode: {mode}"));
            }
            if let Some(template_name) = command.textfsm_template_name.as_deref() {
                suffixes.push(format!("textfsm: {template_name}"));
            }
            println!("- {} ({})", command.object, suffixes.join(", "));
        }
    } else if let Some(device_profile) = device_profile
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let commands = show_catalog::list_show_commands_for_profile(Some(device_profile), None)?;
        if commands.is_empty() {
            println!("-");
            return Ok(());
        }
        println!("# profile: {}", device_profile);
        for command in commands {
            let mut suffixes = vec!["source: custom".to_string()];
            if let Some(mode) = command.mode.as_deref() {
                suffixes.push(format!("mode: {mode}"));
            }
            if let Some(template_name) = command.textfsm_template_name.as_deref() {
                suffixes.push(format!("textfsm: {template_name}"));
            }
            println!("- {} ({})", command.object, suffixes.join(", "));
        }
    } else {
        for object in show_catalog::list_all_show_objects() {
            println!("- {}", object);
        }
    }
    Ok(())
}

pub(crate) fn write_textfsm_excel(
    path: &Path,
    sheets: Vec<textfsm_export::ParsedOutputSheet>,
) -> Result<()> {
    textfsm_export::write_parsed_outputs_xlsx(path, &sheets)?;
    println!("TextFSM Excel: {}", path.display());
    Ok(())
}

pub(crate) fn textfsm_template_for_index(templates: &[PathBuf], index: usize) -> Option<PathBuf> {
    if templates.is_empty() {
        return None;
    }
    templates.get(index).or_else(|| templates.last()).cloned()
}

pub(crate) fn run_templates_command(cmd: TemplateCommands) -> Result<()> {
    match cmd {
        TemplateCommands::List => {
            let names = content_store::list_command_template_names()?;
            if names.is_empty() {
                println!("-");
                return Ok(());
            }
            for name in names {
                println!("- {}", name);
            }
        }
        TemplateCommands::Show { name } => {
            let safe_name = safe_template_name(&name)?;
            let template = content_store::load_command_template(&safe_name)?
                .ok_or_else(|| anyhow::anyhow!("template '{}' not found", safe_name))?;
            println!("{}", template.content);
        }
        TemplateCommands::Create {
            name,
            file,
            content,
        } => {
            let safe_name = safe_template_name(&name)?;
            let body = read_template_body(file, content)?;
            let created = content_store::create_command_template(&safe_name, &body)?;
            if !created {
                return Err(anyhow::anyhow!("template '{}' already exists", safe_name));
            }
            println!("Created template '{}'", safe_name);
        }
        TemplateCommands::Update {
            name,
            file,
            content,
        } => {
            let safe_name = safe_template_name(&name)?;
            let body = read_template_body(file, content)?;
            let updated = content_store::update_command_template(&safe_name, &body)?;
            if !updated {
                return Err(anyhow::anyhow!("template '{}' not found", safe_name));
            }
            println!("Updated template '{}'", safe_name);
        }
        TemplateCommands::Delete { name } => {
            let safe_name = safe_template_name(&name)?;
            let deleted = content_store::delete_command_template(&safe_name)?;
            if !deleted {
                return Err(anyhow::anyhow!("template '{}' not found", safe_name));
            }
            println!("Deleted template '{}'", safe_name);
        }
    }
    Ok(())
}

pub(crate) fn run_textfsm_command(cmd: TextfsmCommands) -> Result<()> {
    match cmd {
        TextfsmCommands::Template { command } => run_textfsm_template_command(command),
        TextfsmCommands::Mapping { command } => run_textfsm_mapping_command(command),
    }
}

pub(crate) fn run_show_object_command(cmd: ShowObjectCommands) -> Result<()> {
    match cmd {
        ShowObjectCommands::List { profile } => {
            let items = custom_show_object_store::list(profile.as_deref())?;
            if items.is_empty() {
                println!("-");
                return Ok(());
            }
            for item in items {
                let mode = item.mode.as_deref().unwrap_or("-");
                let mapping = item.textfsm_mapping_command.as_deref().unwrap_or("-");
                let template = item.textfsm_template_name.as_deref().unwrap_or("-");
                println!(
                    "- profile={} object={} command={} mode={} textfsm_mapping_command={} textfsm_template={} enabled={} created_at_ms={} updated_at_ms={}",
                    item.device_profile,
                    item.object,
                    item.command,
                    mode,
                    mapping,
                    template,
                    item.enabled,
                    item.created_at_ms,
                    item.updated_at_ms
                );
            }
        }
        ShowObjectCommands::Set {
            profile,
            object,
            command,
            mode,
            textfsm_template,
            textfsm_mapping_command,
            disabled,
        } => {
            custom_show_object_store::upsert(
                &profile,
                &object,
                &command,
                mode.as_deref(),
                textfsm_mapping_command.as_deref(),
                textfsm_template.as_deref(),
                !disabled,
            )?;
            println!(
                "Saved show object '{}' for profile='{}' command='{}'",
                object, profile, command
            );
        }
        ShowObjectCommands::Delete { profile, object } => {
            let deleted = custom_show_object_store::delete(&profile, &object)?;
            if !deleted {
                return Err(anyhow::anyhow!(
                    "show object '{}' not found for profile='{}'",
                    object,
                    profile
                ));
            }
            println!("Deleted show object '{}' for profile='{}'", object, profile);
        }
    }
    Ok(())
}

fn run_textfsm_template_command(cmd: TextfsmTemplateCommands) -> Result<()> {
    match cmd {
        TextfsmTemplateCommands::List => {
            let items = custom_textfsm_store::list_templates()?;
            if items.is_empty() {
                println!("-");
                return Ok(());
            }
            for item in items {
                println!(
                    "- {} created_at_ms={} updated_at_ms={}",
                    item.name, item.created_at_ms, item.updated_at_ms
                );
            }
        }
        TextfsmTemplateCommands::Show { name } => {
            let item = custom_textfsm_store::load_template(&name)?
                .ok_or_else(|| anyhow::anyhow!("TextFSM template '{}' not found", name))?;
            println!("{}", item.content);
        }
        TextfsmTemplateCommands::Create {
            name,
            file,
            content,
        } => {
            let body = read_text_body("TextFSM template", file, content)?;
            let created = custom_textfsm_store::create_template(&name, &body)?;
            if !created {
                return Err(anyhow::anyhow!(
                    "TextFSM template '{}' already exists",
                    name
                ));
            }
            println!("Created TextFSM template '{}'", name);
        }
        TextfsmTemplateCommands::Update {
            name,
            file,
            content,
        } => {
            let body = read_text_body("TextFSM template", file, content)?;
            let updated = custom_textfsm_store::update_template(&name, &body)?;
            if !updated {
                return Err(anyhow::anyhow!("TextFSM template '{}' not found", name));
            }
            println!("Updated TextFSM template '{}'", name);
        }
        TextfsmTemplateCommands::Delete { name } => {
            let deleted = custom_textfsm_store::delete_template(&name)?;
            if !deleted {
                return Err(anyhow::anyhow!("TextFSM template '{}' not found", name));
            }
            println!("Deleted TextFSM template '{}'", name);
        }
    }
    Ok(())
}

fn run_textfsm_mapping_command(cmd: TextfsmMappingCommands) -> Result<()> {
    match cmd {
        TextfsmMappingCommands::List { profile } => {
            let items = custom_textfsm_store::list_mappings(profile.as_deref())?;
            if items.is_empty() {
                println!("-");
                return Ok(());
            }
            for item in items {
                println!(
                    "- profile={} command={} template={} created_at_ms={} updated_at_ms={}",
                    item.device_profile,
                    item.command,
                    item.template_name,
                    item.created_at_ms,
                    item.updated_at_ms
                );
            }
        }
        TextfsmMappingCommands::Set {
            profile,
            command,
            template,
        } => {
            custom_textfsm_store::upsert_mapping(&profile, &command, &template)?;
            println!(
                "Mapped profile='{}' command='{}' to TextFSM template '{}'",
                profile, command, template
            );
        }
        TextfsmMappingCommands::Delete { profile, command } => {
            let deleted = custom_textfsm_store::delete_mapping(&profile, &command)?;
            if !deleted {
                return Err(anyhow::anyhow!(
                    "TextFSM mapping not found for profile='{}' command='{}'",
                    profile,
                    command
                ));
            }
            println!(
                "Deleted TextFSM mapping for profile='{}' command='{}'",
                profile, command
            );
        }
    }
    Ok(())
}

pub(crate) fn read_text_body(
    kind: &str,
    file: Option<PathBuf>,
    content: Option<String>,
) -> Result<String> {
    if let Some(text) = content {
        if text.trim().is_empty() {
            return Err(anyhow::anyhow!("{kind} content must not be empty"));
        }
        return Ok(text);
    }
    if let Some(path) = file {
        let text = fs::read_to_string(&path)?;
        if text.trim().is_empty() {
            return Err(anyhow::anyhow!("{kind} file content is empty"));
        }
        return Ok(text);
    }
    Err(anyhow::anyhow!(
        "{kind} content required: use --content or --file"
    ))
}

fn safe_template_name(raw: &str) -> Result<String> {
    let normalized = raw.trim();
    if normalized.is_empty()
        || normalized.contains('/')
        || normalized.contains('\\')
        || normalized.contains("..")
        || !normalized
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' || ch == '.')
    {
        return Err(anyhow::anyhow!("invalid template name"));
    }
    Ok(normalized.to_string())
}

fn read_template_body(file: Option<PathBuf>, content: Option<String>) -> Result<String> {
    read_text_body("template", file, content)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn multi_show_excel_sheets_are_grouped_by_object() {
        let sheets = merge_multi_show_parsed_outputs(vec![
            MultiShowParsedOutput {
                object: "route".to_string(),
                rows: vec![json!({"device": "sw1", "command": "show ip route"})],
            },
            MultiShowParsedOutput {
                object: "route".to_string(),
                rows: vec![json!({"device": "sw2", "command": "display ip routing-table"})],
            },
        ]);

        assert_eq!(sheets.len(), 1);
        assert_eq!(sheets[0].name, "route");
        assert_eq!(sheets[0].parsed_output.as_array().unwrap().len(), 2);
    }
}
