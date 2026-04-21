use crate::cli::{CommandFlowArgs, CommandFlowTemplateCommands, UploadArgs};
use crate::config::command_flow_template::{
    ParsedCommandFlowTemplate, build_command_flow_runtime, normalize_command_flow_template_body,
    parse_command_flow_template_with_extensions, resolve_command_flow_runtime_default_mode,
};
use crate::config::{command_blacklist, content_store, template_loader};
use crate::device::DeviceClient;
use anyhow::Result;
use rneter::session::MANAGER;
use std::fs;
use std::path::PathBuf;

pub(crate) fn run_command_flow_template_command(cmd: CommandFlowTemplateCommands) -> Result<()> {
    match cmd {
        CommandFlowTemplateCommands::List => {
            let names = content_store::list_command_flow_template_names()?;
            if names.is_empty() {
                println!("-");
            } else {
                for name in names {
                    println!("- {}", name);
                }
            }
        }
        CommandFlowTemplateCommands::Show { name } => {
            let safe_name = safe_command_flow_template_name(&name)?;
            let stored =
                content_store::load_command_flow_template(&safe_name)?.ok_or_else(|| {
                    anyhow::anyhow!("command flow template '{}' not found", safe_name)
                })?;
            println!("{}", stored.content);
        }
        CommandFlowTemplateCommands::Create {
            name,
            file,
            content,
        } => {
            let safe_name = safe_command_flow_template_name(&name)?;
            let body = normalize_command_flow_template_body_from_input(&safe_name, file, content)?;
            let created = content_store::create_command_flow_template(&safe_name, &body)?;
            if !created {
                return Err(anyhow::anyhow!(
                    "command flow template '{}' already exists",
                    safe_name
                ));
            }
            println!("Created command flow template '{}'", safe_name);
        }
        CommandFlowTemplateCommands::Update {
            name,
            file,
            content,
        } => {
            let safe_name = safe_command_flow_template_name(&name)?;
            let body = normalize_command_flow_template_body_from_input(&safe_name, file, content)?;
            let updated = content_store::update_command_flow_template(&safe_name, &body)?;
            if !updated {
                return Err(anyhow::anyhow!(
                    "command flow template '{}' not found",
                    safe_name
                ));
            }
            println!("Updated command flow template '{}'", safe_name);
        }
        CommandFlowTemplateCommands::Delete { name } => {
            let safe_name = safe_command_flow_template_name(&name)?;
            let deleted = content_store::delete_command_flow_template(&safe_name)?;
            if !deleted {
                return Err(anyhow::anyhow!(
                    "command flow template '{}' not found",
                    safe_name
                ));
            }
            println!("Deleted command flow template '{}'", safe_name);
        }
    }
    Ok(())
}

pub(crate) async fn run_command_flow(
    args: CommandFlowArgs,
    opts: &crate::cli::GlobalOpts,
) -> Result<()> {
    let parsed_template = resolve_command_flow_template(&args)?;
    let template = &parsed_template.template;
    let vars =
        crate::cli_tx_block::load_vars_json_input(args.vars.as_ref(), args.vars_json.as_deref())?;
    let conn = crate::resolve_effective_connection(opts)?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let profile_default_mode = template_loader::default_profile_mode(&conn.device_profile)?;
    let runtime_vars = crate::resolve_flow_runtime_vars(
        template,
        vars,
        &conn,
        parsed_template.current_connection_alias.as_deref(),
    )?;
    let runtime_default_mode = resolve_command_flow_runtime_default_mode(
        None,
        template.default_mode.as_deref(),
        &profile_default_mode,
    );
    let effective_flow_mode = runtime_default_mode
        .clone()
        .or_else(|| {
            template
                .default_mode
                .as_deref()
                .map(str::trim)
                .filter(|mode| !mode.is_empty())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| profile_default_mode.clone());

    let flow = template.to_command_flow(&build_command_flow_runtime(
        runtime_default_mode,
        conn.connection_name.as_deref(),
        &conn.host,
        &conn.username,
        &conn.device_profile,
        runtime_vars,
    ))?;

    command_blacklist::ensure_commands_allowed(
        flow.steps.iter().map(|command| command.command.as_str()),
        "command flow",
    )?;
    if flow.steps.is_empty() {
        return Err(anyhow::anyhow!("command flow has no steps"));
    }

    let client = DeviceClient::connect_with_recording(
        conn.host.clone(),
        conn.port,
        conn.username.clone(),
        conn.password.clone(),
        conn.enable_password.clone(),
        handler,
        profile_default_mode.clone(),
        crate::to_record_level(args.record_level),
        conn.ssh_security,
    )
    .await?;

    crate::maybe_save_connection_profile(opts, &conn)?;

    let result = client.execute_command_flow(flow).await?;
    print_command_flow_output(&result);
    crate::write_recording_if_requested(args.record_file.as_ref(), &client, args.record_level)?;
    crate::persist_auto_recording_history(
        &client,
        &conn,
        "command_flow",
        &format!("template: {}", template.name),
        Some(effective_flow_mode.as_str()),
        args.record_level,
    )?;

    if !result.success {
        return Err(anyhow::anyhow!("command flow completed with errors"));
    }
    Ok(())
}

pub(crate) async fn run_upload(args: UploadArgs, opts: &crate::cli::GlobalOpts) -> Result<()> {
    let conn = crate::resolve_effective_connection(opts)?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let upload = build_upload_request(&args)?;

    let request = crate::manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
        conn.enable_password.clone(),
        handler,
    );
    let context = crate::manager_execution_context_with_security(None, conn.ssh_security);

    let (_sender, recorder) = MANAGER
        .get_with_recording_level_and_context(
            request,
            context.clone(),
            crate::to_record_level(args.record_level),
        )
        .await?;
    let handler_for_upload = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let request = crate::manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
        conn.enable_password.clone(),
        handler_for_upload,
    );
    MANAGER
        .upload_file_with_context(request, upload, context)
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

fn print_command_flow_output(result: &rneter::session::CommandFlowOutput) {
    println!("flow_success: {}", result.success);
    for (index, output) in result.outputs.iter().enumerate() {
        println!(
            "step {} success={} exit_code={}",
            index + 1,
            output.success,
            output
                .exit_code
                .map(|value| value.to_string())
                .unwrap_or_else(|| "-".to_string())
        );
        println!("{}", output.content);
        if index + 1 < result.outputs.len() {
            println!("---");
        }
    }
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

fn normalize_builtin_command_flow_template_name(raw: &str) -> String {
    raw.trim().to_ascii_lowercase().replace('_', "-")
}

fn parse_builtin_command_flow_template_token(raw: &str) -> Option<String> {
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
    let normalized = normalize_builtin_command_flow_template_name(suffix);
    (!normalized.is_empty()).then_some(normalized)
}

fn load_builtin_command_flow_template_form(name: &str) -> Result<ParsedCommandFlowTemplate> {
    let normalized = normalize_builtin_command_flow_template_name(name);
    match normalized.as_str() {
        BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY => {
            let mut template = rneter::templates::cisco_like_copy_template();
            template.name = BUILTIN_FLOW_TEMPLATE_CISCO_LIKE_COPY.to_string();
            Ok(ParsedCommandFlowTemplate {
                template,
                current_connection_alias: None,
            })
        }
        _ => Err(anyhow::anyhow!(
            "builtin command flow template '{}' not found",
            name.trim()
        )),
    }
}

fn load_command_flow_template_form(name: &str) -> Result<ParsedCommandFlowTemplate> {
    if let Some(builtin_name) = parse_builtin_command_flow_template_token(name) {
        return load_builtin_command_flow_template_form(&builtin_name);
    }
    let safe_name = safe_command_flow_template_name(name)?;
    let stored = content_store::load_command_flow_template(&safe_name)?
        .ok_or_else(|| anyhow::anyhow!("command flow template '{}' not found", safe_name))?;
    parse_command_flow_template_with_extensions(&stored.content, Some(&safe_name))
}

pub(crate) fn resolve_command_flow_template_from_sources(
    template: Option<&str>,
    file: Option<&PathBuf>,
    context: &str,
    inline_name: &str,
    template_flag: &str,
    file_flag: &str,
) -> Result<ParsedCommandFlowTemplate> {
    match (
        template.map(str::trim).filter(|value| !value.is_empty()),
        file,
    ) {
        (Some(name), None) => load_command_flow_template_form(name),
        (None, Some(file)) => {
            let body = fs::read_to_string(file)?;
            parse_command_flow_template_with_extensions(&body, Some(inline_name))
        }
        (Some(_), Some(_)) => Err(anyhow::anyhow!(
            "use either {template_flag} or {file_flag} for {context}, not both"
        )),
        (None, None) => Err(anyhow::anyhow!(
            "{context} requires {template_flag} <name> or {file_flag} <path>"
        )),
    }
}

fn resolve_command_flow_template(args: &CommandFlowArgs) -> Result<ParsedCommandFlowTemplate> {
    let inline_name = args
        .file
        .as_ref()
        .and_then(|value| value.file_stem())
        .and_then(|value| value.to_str())
        .unwrap_or("inline_flow");
    resolve_command_flow_template_from_sources(
        args.template.as_deref(),
        args.file.as_ref(),
        "command flow execution",
        inline_name,
        "--template",
        "--file",
    )
}

fn normalize_command_flow_template_body_from_input(
    name: &str,
    file: Option<PathBuf>,
    content: Option<String>,
) -> Result<String> {
    let body = crate::cli_exec::read_text_body("command flow template", file, content)?;
    normalize_command_flow_template_body(name, &body)
}

fn safe_command_flow_template_name(raw: &str) -> Result<String> {
    let normalized = raw.trim();
    if normalized.is_empty()
        || normalized.contains('/')
        || normalized.contains('\\')
        || normalized.contains("..")
        || !normalized
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
    {
        return Err(anyhow::anyhow!("invalid command flow template name"));
    }
    Ok(normalized.to_string())
}
