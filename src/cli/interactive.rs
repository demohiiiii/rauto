use crate::cli::exec::{
    MultiShowParsedOutput, add_multi_target_metadata, merge_multi_show_parsed_outputs,
    textfsm_template_for_index, write_textfsm_excel,
};
use crate::cli::multi_target::{
    MultiTargetRun, has_multi_target_selectors, multi_target_concurrency,
    resolve_multi_target_names, run_buffered_multi_target,
};
use crate::cli::{InteractiveArgs, InteractiveTemplateCommands, RecordLevelOpt, UploadArgs};
use crate::config::interactive_template::{
    InteractiveTemplate, build_interactive_runtime, cisco_like_copy_interactive_template,
    normalize_interactive_template_body, parse_interactive_template,
    resolve_interactive_runtime_default_mode,
};
use crate::config::{command_blacklist, content_store, template_loader, textfsm, textfsm_export};
use crate::device::DeviceClient;
use anyhow::Result;
use rneter::session::{CommandFlow as ExecutionSequence, MANAGER};
use std::fmt::Write as _;
use std::fs;
use std::path::PathBuf;

pub(crate) fn run_interactive_template_command(cmd: InteractiveTemplateCommands) -> Result<()> {
    match cmd {
        InteractiveTemplateCommands::List => {
            let names = content_store::list_interactive_template_names()?;
            if names.is_empty() {
                println!("-");
            } else {
                for name in names {
                    println!("- {}", name);
                }
            }
        }
        InteractiveTemplateCommands::Show { name } => {
            let safe_name = safe_interactive_template_name(&name)?;
            let stored =
                content_store::load_interactive_template(&safe_name)?.ok_or_else(|| {
                    anyhow::anyhow!("interactive command template '{}' not found", safe_name)
                })?;
            println!("{}", stored.content);
        }
        InteractiveTemplateCommands::Create {
            name,
            file,
            content,
        } => {
            let safe_name = safe_interactive_template_name(&name)?;
            let body = normalize_interactive_template_body_from_input(&safe_name, file, content)?;
            let created = content_store::create_interactive_template(&safe_name, &body)?;
            if !created {
                return Err(anyhow::anyhow!(
                    "interactive command template '{}' already exists",
                    safe_name
                ));
            }
            println!("Created interactive command template '{}'", safe_name);
        }
        InteractiveTemplateCommands::Update {
            name,
            file,
            content,
        } => {
            let safe_name = safe_interactive_template_name(&name)?;
            let body = normalize_interactive_template_body_from_input(&safe_name, file, content)?;
            let updated = content_store::update_interactive_template(&safe_name, &body)?;
            if !updated {
                return Err(anyhow::anyhow!(
                    "interactive command template '{}' not found",
                    safe_name
                ));
            }
            println!("Updated interactive command template '{}'", safe_name);
        }
        InteractiveTemplateCommands::Delete { name } => {
            let safe_name = safe_interactive_template_name(&name)?;
            let deleted = content_store::delete_interactive_template(&safe_name)?;
            if !deleted {
                return Err(anyhow::anyhow!(
                    "interactive command template '{}' not found",
                    safe_name
                ));
            }
            println!("Deleted interactive command template '{}'", safe_name);
        }
    }
    Ok(())
}

pub(crate) async fn run_interactive(
    args: InteractiveArgs,
    opts: &crate::cli::GlobalOpts,
) -> Result<()> {
    let template = resolve_interactive_template(&args)?;
    let vars =
        crate::cli::tx_block::load_vars_json_input(args.vars.as_ref(), args.vars_json.as_deref())?;
    if has_multi_target_selectors(&args.targets, &args.groups, &args.labels) {
        return run_multi_interactive(&args, opts, &template, vars).await;
    }
    let conn =
        crate::resolve_autodetect_connection(crate::resolve_effective_connection(opts)?).await?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let profile_default_mode =
        template_loader::default_profile_mode_for_connection(&conn.device_profile, &conn.username)?;
    let runtime_vars = crate::resolve_interactive_connection_vars(&template, vars, &conn)?;
    let runtime_default_mode = resolve_interactive_runtime_default_mode(
        None,
        template.operation.mode.as_deref(),
        &profile_default_mode,
    );
    let effective_interactive_mode = runtime_default_mode
        .clone()
        .or_else(|| {
            template
                .operation
                .mode
                .as_deref()
                .map(str::trim)
                .filter(|mode| !mode.is_empty())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| profile_default_mode.clone());

    let interactive = template.to_execution_sequence(&build_interactive_runtime(
        runtime_default_mode,
        runtime_vars,
    ))?;

    command_blacklist::ensure_commands_allowed(
        interactive
            .steps
            .iter()
            .map(|command| command.command.as_str()),
        "interactive command",
    )?;
    if interactive.steps.is_empty() {
        return Err(anyhow::anyhow!("interactive command has no steps"));
    }

    let client = DeviceClient::connect_with_recording_and_retry(
        conn.host.clone(),
        conn.port,
        conn.username.clone(),
        conn.auth.clone(),
        conn.enable_password.clone(),
        handler,
        conn.output_encoding,
        profile_default_mode.clone(),
        crate::to_record_level(args.record_level),
        conn.ssh_security,
        conn.connect_timeout_secs,
        conn.retry_policy,
    )
    .await?;

    crate::maybe_save_connection_profile(opts, &conn)?;

    let interactive_commands = interactive
        .steps
        .iter()
        .map(|step| step.command.clone())
        .collect::<Vec<_>>();
    let result = client.execute_sequence(interactive).await?;
    let parse_options = InteractiveParseOptions {
        template_files: args.textfsm_template.clone(),
        enabled: args.parse_textfsm
            || !args.textfsm_template.is_empty()
            || args.textfsm_excel.is_some(),
        device_profile: Some(conn.device_profile.clone()),
        filter_error_rules: !args.textfsm_strict_errors,
    };
    let mut interactive_output_text = String::new();
    let parsed_steps = write_interactive_output(
        &mut interactive_output_text,
        &result,
        &interactive_commands,
        &parse_options,
    )?;
    print!("{}", interactive_output_text);
    if let Some(path) = args.textfsm_excel.as_deref() {
        let parsed_sheets: Vec<textfsm_export::ParsedOutputSheet> = parsed_steps
            .into_iter()
            .map(|step| textfsm_export::ParsedOutputSheet {
                name: step.sheet_name,
                parsed_output: step.parsed_output,
            })
            .collect();
        textfsm_export::write_parsed_outputs_xlsx(path, &parsed_sheets)?;
        println!("TextFSM Excel: {}", path.display());
    }
    crate::write_recording_if_requested(args.record_file.as_ref(), &client, args.record_level)?;
    crate::persist_auto_recording_history(
        &client,
        &conn,
        "interactive",
        &format!("template: {}", template.name),
        Some(effective_interactive_mode.as_str()),
        args.record_level,
    )?;

    if !result.success {
        return Err(anyhow::anyhow!("interactive command completed with errors"));
    }
    Ok(())
}

/// Cloneable subset of [`InteractiveArgs`] needed by each concurrently
/// executing interactive target task.
#[derive(Clone)]
struct MultiInteractiveOptions {
    template_name: String,
    template_files: Vec<PathBuf>,
    parse_enabled: bool,
    textfsm_strict_errors: bool,
    record_level: RecordLevelOpt,
}

struct ResolvedInteractiveTarget {
    name: String,
    conn: crate::EffectiveConnection,
    interactive: ExecutionSequence,
    effective_interactive_mode: String,
    profile_default_mode: String,
}

async fn run_multi_interactive(
    args: &InteractiveArgs,
    opts: &crate::cli::GlobalOpts,
    template: &InteractiveTemplate,
    vars: serde_json::Value,
) -> Result<()> {
    if args.record_file.is_some() {
        return Err(anyhow::anyhow!(
            "--record-file is not supported with multi-target interactive; session history is still saved automatically"
        ));
    }
    if opts.host.is_some() {
        return Err(anyhow::anyhow!(
            "--host cannot be used with multi-target interactive; use saved --target connections, --group, or --label"
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
            "multi-target interactive resolved no saved connections"
        ));
    }

    let mut resolved_targets = Vec::with_capacity(target_names.len());
    let mut errors = Vec::new();
    for name in target_names {
        match resolve_interactive_target(&name, template, &vars, opts).await {
            Ok(target) => resolved_targets.push(target),
            Err(err) => errors.push(format!("{}: {err:#}", name)),
        }
    }
    if !errors.is_empty() {
        return Err(anyhow::anyhow!(
            "interactive precheck failed for {} target(s):\n{}",
            errors.len(),
            errors.join("\n")
        ));
    }

    println!(
        "# precheck: interactive command '{}' is executable on {} target(s)",
        template.name,
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
    let options = MultiInteractiveOptions {
        template_name: template.name.clone(),
        template_files: args.textfsm_template.clone(),
        parse_enabled: args.parse_textfsm
            || !args.textfsm_template.is_empty()
            || args.textfsm_excel.is_some(),
        textfsm_strict_errors: args.textfsm_strict_errors,
        record_level: args.record_level,
    };
    let outcome = run_buffered_multi_target(resolved_targets, concurrency, move |target| {
        let options = options.clone();
        async move {
            let name = target.name.clone();
            let (output, result) = execute_resolved_interactive_target(&target, &options).await;
            MultiTargetRun {
                name,
                output,
                result,
            }
        }
    })
    .await?;
    if let Some(path) = args.textfsm_excel.as_deref() {
        let parsed: Vec<MultiShowParsedOutput> = outcome.parsed.into_iter().flatten().collect();
        if !parsed.is_empty() {
            let parsed_sheets = merge_multi_show_parsed_outputs(parsed);
            write_textfsm_excel(path, parsed_sheets)?;
        }
    }
    if !outcome.errors.is_empty() {
        return Err(anyhow::anyhow!(
            "multi-target interactive failed on {} target(s):\n{}",
            outcome.errors.len(),
            outcome.errors.join("\n")
        ));
    }
    Ok(())
}

async fn resolve_interactive_target(
    name: &str,
    template: &InteractiveTemplate,
    vars: &serde_json::Value,
    opts: &crate::cli::GlobalOpts,
) -> Result<ResolvedInteractiveTarget> {
    let mut target_opts = opts.clone();
    target_opts.connection = Some(name.to_string());
    target_opts.save_connection = None;
    target_opts.host = None;
    let conn =
        crate::resolve_autodetect_connection(crate::resolve_effective_connection(&target_opts)?)
            .await?;
    let profile_default_mode =
        template_loader::default_profile_mode_for_connection(&conn.device_profile, &conn.username)?;
    let runtime_vars = crate::resolve_interactive_connection_vars(template, vars.clone(), &conn)?;
    let runtime_default_mode = resolve_interactive_runtime_default_mode(
        None,
        template.operation.mode.as_deref(),
        &profile_default_mode,
    );
    let effective_interactive_mode = runtime_default_mode
        .clone()
        .or_else(|| {
            template
                .operation
                .mode
                .as_deref()
                .map(str::trim)
                .filter(|mode| !mode.is_empty())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| profile_default_mode.clone());
    let interactive = template.to_execution_sequence(&build_interactive_runtime(
        runtime_default_mode,
        runtime_vars,
    ))?;
    command_blacklist::ensure_commands_allowed(
        interactive
            .steps
            .iter()
            .map(|command| command.command.as_str()),
        "interactive command",
    )?;
    if interactive.steps.is_empty() {
        return Err(anyhow::anyhow!("interactive command has no steps"));
    }
    Ok(ResolvedInteractiveTarget {
        name: name.to_string(),
        conn,
        interactive,
        effective_interactive_mode,
        profile_default_mode,
    })
}

async fn execute_resolved_interactive_target(
    target: &ResolvedInteractiveTarget,
    options: &MultiInteractiveOptions,
) -> (String, Result<Option<Vec<MultiShowParsedOutput>>>) {
    let mut out = String::new();
    let result = execute_resolved_interactive_target_buffered(target, options, &mut out).await;
    (out, result)
}

async fn execute_resolved_interactive_target_buffered(
    target: &ResolvedInteractiveTarget,
    options: &MultiInteractiveOptions,
    out: &mut String,
) -> Result<Option<Vec<MultiShowParsedOutput>>> {
    let _ = writeln!(
        out,
        "=== target: {} ({}) ===",
        target.name, target.conn.host
    );
    let handler = template_loader::load_device_profile_for_connection(
        &target.conn.device_profile,
        target.conn.linux_shell_flavor,
    )?;
    let client = DeviceClient::connect_with_recording_and_retry(
        target.conn.host.clone(),
        target.conn.port,
        target.conn.username.clone(),
        target.conn.auth.clone(),
        target.conn.enable_password.clone(),
        handler,
        target.conn.output_encoding,
        target.profile_default_mode.clone(),
        crate::to_record_level(options.record_level),
        target.conn.ssh_security,
        target.conn.connect_timeout_secs,
        target.conn.retry_policy,
    )
    .await?;

    let interactive_commands = target
        .interactive
        .steps
        .iter()
        .map(|step| step.command.clone())
        .collect::<Vec<_>>();
    let result = client.execute_sequence(target.interactive.clone()).await?;
    let parse_options = InteractiveParseOptions {
        template_files: options.template_files.clone(),
        enabled: options.parse_enabled,
        device_profile: Some(target.conn.device_profile.clone()),
        filter_error_rules: !options.textfsm_strict_errors,
    };
    let parsed_steps =
        write_interactive_output(out, &result, &interactive_commands, &parse_options)?;
    crate::persist_auto_recording_history(
        &client,
        &target.conn,
        "interactive",
        &format!("template: {}", options.template_name),
        Some(target.effective_interactive_mode.as_str()),
        options.record_level,
    )?;
    if !result.success {
        return Err(anyhow::anyhow!("interactive command completed with errors"));
    }
    let parsed = parsed_steps
        .into_iter()
        .map(|step| {
            Ok(MultiShowParsedOutput {
                object: step.sheet_name.clone(),
                rows: add_multi_target_metadata(
                    &target.name,
                    &target.conn.device_profile,
                    &step.command,
                    step.parsed_output,
                )?,
            })
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(if parsed.is_empty() {
        None
    } else {
        Some(parsed)
    })
}

pub(crate) async fn run_upload(args: UploadArgs, opts: &crate::cli::GlobalOpts) -> Result<()> {
    let conn =
        crate::resolve_autodetect_connection(crate::resolve_effective_connection(opts)?).await?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let upload = build_upload_request(&args)?;

    let request = crate::manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.auth.clone(),
        conn.enable_password.clone(),
        handler,
        conn.output_encoding,
    );
    let context = crate::manager_execution_context_with_security(
        None,
        conn.ssh_security,
        conn.connect_timeout_secs,
    );

    let record_level = crate::to_record_level(args.record_level);
    let recorder = crate::config::session_recording::redacting_recorder(
        record_level,
        &conn.auth,
        conn.enable_password.as_deref(),
    );
    MANAGER
        .upload_file_with_recorder_and_context(request, upload, context, recorder.clone())
        .await?;

    let jsonl = recorder.to_jsonl()?;
    crate::write_recording_text_if_requested(args.record_file.as_ref(), &jsonl, args.record_level)?;
    crate::persist_auto_recording_history_jsonl(
        &jsonl,
        &conn,
        "sftp_upload",
        &format!(
            "{} -> {}",
            args.local_path.to_string_lossy(),
            args.remote_path
        ),
        None,
        args.record_level,
    )?;

    crate::maybe_save_connection_profile(opts, &conn)?;
    println!(
        "Uploaded '{}' to '{}'",
        args.local_path.to_string_lossy(),
        args.remote_path
    );
    Ok(())
}

struct InteractiveParseOptions {
    template_files: Vec<PathBuf>,
    enabled: bool,
    device_profile: Option<String>,
    filter_error_rules: bool,
}

struct InteractiveParsedOutput {
    command: String,
    sheet_name: String,
    parsed_output: serde_json::Value,
}

/// Writes the per-step interactive output into `out` (buffered so concurrent targets
/// never interleave on stdout) and returns the successfully parsed steps.
fn write_interactive_output(
    out: &mut String,
    result: &rneter::session::CommandFlowOutput,
    commands: &[String],
    parse_options: &InteractiveParseOptions,
) -> Result<Vec<InteractiveParsedOutput>> {
    let _ = writeln!(out, "interactive_success: {}", result.success);
    let mut parsed_steps = Vec::new();
    for (index, output) in result.outputs.iter().enumerate() {
        let _ = writeln!(
            out,
            "step {} success={} exit_code={}",
            index + 1,
            output.success,
            output
                .exit_code
                .map(|value| value.to_string())
                .unwrap_or_else(|| "-".to_string())
        );
        let _ = writeln!(out, "{}", output.content);
        let command = commands.get(index).map(String::as_str).unwrap_or("");
        let step_parse_options = textfsm::ParseOptions {
            template_file: textfsm_template_for_index(&parse_options.template_files, index),
            enabled: parse_options.enabled,
            device_profile: parse_options.device_profile.clone(),
            filter_error_rules: parse_options.filter_error_rules,
            ..Default::default()
        };
        let (parsed_output, parse_error) =
            textfsm::parse_command_output_optional(&output.content, command, &step_parse_options);
        if let Some(parsed_output) = parsed_output {
            let _ = writeln!(
                out,
                "Parsed Output:\n{}",
                textfsm::format_parsed_output_table(&parsed_output)
            );
            parsed_steps.push(InteractiveParsedOutput {
                command: command.to_string(),
                sheet_name: format!("{} {}", index + 1, command),
                parsed_output,
            });
        }
        if let Some(err) = parse_error {
            let _ = writeln!(out, "Parse Error: {}", err);
        }
        if index + 1 < result.outputs.len() {
            let _ = writeln!(out, "---");
        }
    }
    Ok(parsed_steps)
}

fn build_upload_request(args: &UploadArgs) -> Result<rneter::session::FileUploadRequest> {
    let local_path = args.local_path.to_string_lossy().to_string();
    if !args.local_path.is_file() {
        return Err(anyhow::anyhow!(
            "local upload file '{}' does not exist or is not a file",
            args.local_path.to_string_lossy()
        ));
    }
    let mut request = rneter::session::FileUploadRequest::new(local_path, args.remote_path.clone())
        .with_timeout_secs(args.timeout_secs)
        .with_progress_reporting(args.show_progress);
    if let Some(buffer_size) = args.buffer_size {
        request = request.with_buffer_size(buffer_size);
    }
    Ok(request)
}

const BUILTIN_FLOW_TEMPLATE_PREFIX: &str = "builtin:";
const BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY: &str = "cisco-like-copy";

fn normalize_builtin_interactive_template_name(raw: &str) -> String {
    raw.trim().to_ascii_lowercase().replace('_', "-")
}

fn parse_builtin_interactive_template_token(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if !trimmed
        .get(..BUILTIN_FLOW_TEMPLATE_PREFIX.len())
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case(BUILTIN_FLOW_TEMPLATE_PREFIX))
    {
        return None;
    }
    let suffix = trimmed
        .get(BUILTIN_FLOW_TEMPLATE_PREFIX.len()..)
        .unwrap_or("");
    let normalized = normalize_builtin_interactive_template_name(suffix);
    (!normalized.is_empty()).then_some(normalized)
}

fn load_builtin_interactive_template_form(name: &str) -> Result<InteractiveTemplate> {
    let normalized = normalize_builtin_interactive_template_name(name);
    match normalized.as_str() {
        BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY => {
            let mut template = cisco_like_copy_interactive_template()?;
            template.name = BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY.to_string();
            Ok(template)
        }
        _ => Err(anyhow::anyhow!(
            "builtin interactive command template '{}' not found",
            name.trim()
        )),
    }
}

fn load_interactive_template_form(name: &str) -> Result<InteractiveTemplate> {
    if let Some(builtin_name) = parse_builtin_interactive_template_token(name) {
        return load_builtin_interactive_template_form(&builtin_name);
    }
    let safe_name = safe_interactive_template_name(name)?;
    let stored = content_store::load_interactive_template(&safe_name)?
        .ok_or_else(|| anyhow::anyhow!("interactive command template '{}' not found", safe_name))?;
    parse_interactive_template(&stored.content, Some(&safe_name))
}

pub(crate) fn resolve_interactive_template_from_sources(
    template: Option<&str>,
    file: Option<&PathBuf>,
    context: &str,
    inline_name: &str,
    template_flag: &str,
    file_flag: &str,
) -> Result<InteractiveTemplate> {
    match (
        template.map(str::trim).filter(|value| !value.is_empty()),
        file,
    ) {
        (Some(name), None) => load_interactive_template_form(name),
        (None, Some(file)) => {
            let body = fs::read_to_string(file)?;
            parse_interactive_template(&body, Some(inline_name))
        }
        (Some(_), Some(_)) => Err(anyhow::anyhow!(
            "use either {template_flag} or {file_flag} for {context}, not both"
        )),
        (None, None) => Err(anyhow::anyhow!(
            "{context} requires {template_flag} <name> or {file_flag} <path>"
        )),
    }
}

fn resolve_interactive_template(args: &InteractiveArgs) -> Result<InteractiveTemplate> {
    let inline_name = args
        .file
        .as_ref()
        .and_then(|value| value.file_stem())
        .and_then(|value| value.to_str())
        .unwrap_or("inline_interactive");
    resolve_interactive_template_from_sources(
        args.template.as_deref(),
        args.file.as_ref(),
        "interactive command execution",
        inline_name,
        "--template",
        "--file",
    )
}

fn normalize_interactive_template_body_from_input(
    name: &str,
    file: Option<PathBuf>,
    content: Option<String>,
) -> Result<String> {
    let body = crate::cli::exec::read_text_body("interactive command template", file, content)?;
    normalize_interactive_template_body(name, &body)
}

fn safe_interactive_template_name(raw: &str) -> Result<String> {
    let normalized = raw.trim();
    if normalized.is_empty()
        || normalized.contains('/')
        || normalized.contains('\\')
        || normalized.contains("..")
        || !normalized
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
    {
        return Err(anyhow::anyhow!("invalid interactive command template name"));
    }
    Ok(normalized.to_string())
}
