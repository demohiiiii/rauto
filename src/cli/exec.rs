use crate::cli::{ExecArgs, ReplayArgs, TemplateArgs, TemplateCommands};
use crate::config::{command_blacklist, content_store, template_loader};
use crate::device::DeviceClient;
use crate::template::renderer::Renderer;
use anyhow::Result;
use rneter::session::{SessionEvent, SessionRecorder, SessionReplayer};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tracing::info;

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

    let conn = crate::resolve_effective_connection(opts)?;
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
        conn.password.clone(),
        conn.enable_password.clone(),
        handler,
        default_mode.clone(),
        crate::to_record_level(args.record_level),
        conn.ssh_security,
    )
    .await?;

    crate::maybe_save_connection_profile(opts, &conn)?;

    info!("Executing {} commands...", lines.len());
    for command in lines {
        print!("Executing '{}' ... ", command);
        match client.execute(&command, None).await {
            Ok(output) => println!("Success\nOutput:\n{}", output),
            Err(error) => println!("Failed: {}", error),
        }
    }
    crate::write_recording_if_requested(args.record_file.as_ref(), &client)?;
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
    let conn = crate::resolve_effective_connection(opts)?;
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
        conn.password.clone(),
        conn.enable_password.clone(),
        handler,
        default_mode.clone(),
        crate::to_record_level(args.record_level),
        conn.ssh_security,
    )
    .await?;

    crate::maybe_save_connection_profile(opts, &conn)?;

    info!("Executing command: {}", args.command);
    let output = client.execute(&args.command, Some(&effective_mode)).await?;
    crate::write_recording_if_requested(args.record_file.as_ref(), &client)?;
    crate::persist_auto_recording_history(
        &client,
        &conn,
        "exec",
        &args.command,
        Some(effective_mode.as_str()),
        args.record_level,
    )?;
    println!("{}", output);
    Ok(())
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

pub(crate) fn run_replay(args: ReplayArgs) -> Result<()> {
    let jsonl = fs::read_to_string(&args.record_file)?;
    let mut replayer = SessionReplayer::from_jsonl(&jsonl)?;

    if let Some(ctx) = replayer.initial_context() {
        println!(
            "# context: device={} prompt={} fsm_prompt={}",
            ctx.device_addr, ctx.prompt, ctx.fsm_prompt
        );
    }

    if args.list {
        let recorder = SessionRecorder::from_jsonl(&jsonl)?;
        let entries = recorder.entries()?;
        let mut index = 0usize;
        for entry in entries {
            if let SessionEvent::CommandOutput {
                command,
                mode,
                success,
                exit_code,
                ..
            } = entry.event
            {
                index += 1;
                if let Some(exit_code) = exit_code {
                    println!(
                        "{}. mode={} success={} exit_code={} command={}",
                        index, mode, success, exit_code, command
                    );
                } else {
                    println!(
                        "{}. mode={} success={} command={}",
                        index, mode, success, command
                    );
                }
            }
        }
        if index == 0 {
            println!("-");
        }
    }

    if let Some(command) = args.command {
        let output = if let Some(mode) = args.mode.as_deref() {
            replayer.replay_next_in_mode(&command, mode)?
        } else {
            replayer.replay_next(&command)?
        };
        println!("{}", output.content);
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
