use crate::cli::{TxArgs, TxRunKind};
use crate::config::interactive_template::{
    build_interactive_runtime, resolve_interactive_runtime_default_mode,
};
use crate::config::{
    command_blacklist, content_store,
    template_connection_refs::enrich_context_with_connection_refs_from_template, template_loader,
};
use crate::template::renderer::Renderer;
use crate::tx_operation::build_command_tx_block;
use anyhow::Result;
use rneter::session::{
    MANAGER, RollbackPolicy, SessionOperation, TxBlock, TxOperationStepResult, TxStep,
};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

pub(crate) async fn run_tx_block(args: TxArgs, opts: &crate::cli::GlobalOpts) -> Result<()> {
    let conn =
        crate::resolve_autodetect_connection(crate::resolve_effective_connection(opts)?).await?;
    let (tx_block, effective_mode) = match args.run_kind {
        TxRunKind::Commands => {
            if args.template.is_none() && args.commands.is_empty() {
                return Err(anyhow::anyhow!(
                    "tx requires at least one --command or a --template"
                ));
            }
            if args.interactive_template.is_some()
                || args.interactive_file.is_some()
                || args.interactive_vars.is_some()
                || args.interactive_vars_json.is_some()
                || args.rollback_interactive_template.is_some()
                || args.rollback_interactive_file.is_some()
                || args.rollback_interactive_vars.is_some()
                || args.rollback_interactive_vars_json.is_some()
            {
                return Err(anyhow::anyhow!(
                    "command-based tx does not accept --interactive-* arguments"
                ));
            }
            if args.rollback_commands_file.is_some() && !args.rollback_commands.is_empty() {
                return Err(anyhow::anyhow!(
                    "use either --rollback-commands-file or repeated --rollback-command"
                ));
            }
            if args.rollback_commands_json.is_some()
                && (args.rollback_commands_file.is_some() || !args.rollback_commands.is_empty())
            {
                return Err(anyhow::anyhow!(
                    "use only one rollback command source: --rollback-commands-json, --rollback-commands-file, or repeated --rollback-command"
                ));
            }
            if !args.rollback_commands.is_empty() && args.resource_rollback_command.is_some() {
                return Err(anyhow::anyhow!(
                    "use either --rollback-command (per-step) or --resource-rollback-command (whole-resource)"
                ));
            }
            if args.rollback_trigger_step_index.is_some()
                && args.resource_rollback_command.is_none()
            {
                return Err(anyhow::anyhow!(
                    "--rollback-trigger-step-index requires --resource-rollback-command"
                ));
            }

            let commands = resolve_tx_commands(&args, &conn)?;
            let mode = match args
                .mode
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                Some(mode) => {
                    template_loader::resolve_profile_mode(&conn.device_profile, Some(mode))?
                }
                None => "Config".to_string(),
            };

            let mut rollback_commands = if let Some(path) = &args.rollback_commands_json {
                let raw = fs::read_to_string(path)?;
                let value: Value = serde_json::from_str(&raw)?;
                let array = value
                    .as_array()
                    .ok_or_else(|| anyhow::anyhow!("rollback JSON must be an array of strings"))?;
                array
                    .iter()
                    .map(|v| {
                        v.as_str()
                            .map(|s| s.trim().to_string())
                            .ok_or_else(|| anyhow::anyhow!("rollback JSON array must be strings"))
                    })
                    .collect::<Result<Vec<_>>>()?
            } else if let Some(path) = &args.rollback_commands_file {
                let text = fs::read_to_string(path)?;
                text.lines()
                    .map(|s| s.trim().to_string())
                    .collect::<Vec<_>>()
            } else {
                args.rollback_commands.clone()
            };
            while rollback_commands.len() > commands.len()
                && rollback_commands
                    .last()
                    .map(|s| s.trim().is_empty())
                    .unwrap_or(false)
            {
                rollback_commands.pop();
            }
            let tx_block = build_command_tx_block(
                args.name.clone(),
                &mode,
                &commands,
                &rollback_commands,
                args.timeout_secs,
                args.rollback_on_failure,
                args.resource_rollback_command.clone(),
                args.rollback_trigger_step_index,
                false,
            )?;
            (tx_block, mode)
        }
        TxRunKind::Interactive => {
            if args.template.is_some()
                || args.vars.is_some()
                || !args.commands.is_empty()
                || !args.rollback_commands.is_empty()
                || args.rollback_commands_file.is_some()
                || args.rollback_commands_json.is_some()
                || args.resource_rollback_command.is_some()
                || args.rollback_trigger_step_index.is_some()
            {
                return Err(anyhow::anyhow!(
                    "interactive command tx does not accept command/template rollback arguments"
                ));
            }

            let mode_override = args
                .mode
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|mode| template_loader::resolve_profile_mode(&conn.device_profile, Some(mode)))
                .transpose()?;
            let profile_default_mode = template_loader::default_profile_mode(&conn.device_profile)?;

            let interactive_template =
                crate::cli::interactive::resolve_interactive_template_from_sources(
                    args.interactive_template.as_deref(),
                    args.interactive_file.as_ref(),
                    "interactive command tx execution",
                    "inline_tx_interactive",
                    "--interactive-template",
                    "--interactive-file",
                )?;
            let interactive_runtime_default_mode = resolve_interactive_runtime_default_mode(
                mode_override.as_deref(),
                interactive_template.operation.mode.as_deref(),
                &profile_default_mode,
            );
            let interactive_effective_mode = interactive_runtime_default_mode
                .clone()
                .or_else(|| {
                    interactive_template
                        .operation
                        .mode
                        .as_deref()
                        .map(str::trim)
                        .filter(|mode| !mode.is_empty())
                        .map(ToOwned::to_owned)
                })
                .unwrap_or_else(|| profile_default_mode.clone());
            let interactive_vars = load_vars_json_input(
                args.interactive_vars.as_ref(),
                args.interactive_vars_json.as_deref(),
            )?;
            let interactive_runtime_vars = crate::resolve_interactive_connection_vars(
                &interactive_template,
                interactive_vars,
                &conn,
            )?;
            let mut interactive =
                interactive_template.to_execution_sequence(&build_interactive_runtime(
                    interactive_runtime_default_mode,
                    interactive_runtime_vars,
                ))?;
            if let Some(timeout_secs) = args.timeout_secs {
                for step in &mut interactive.steps {
                    step.timeout = Some(timeout_secs);
                }
            }
            command_blacklist::ensure_commands_allowed(
                interactive.steps.iter().map(|step| step.command.as_str()),
                "interactive command",
            )?;
            if interactive.steps.is_empty() {
                return Err(anyhow::anyhow!("interactive command has no steps"));
            }

            let rollback_operation = match (
                args.rollback_interactive_template.as_deref(),
                args.rollback_interactive_file.as_ref(),
            ) {
                (None, None) => None,
                _ => {
                    let rollback_template =
                        crate::cli::interactive::resolve_interactive_template_from_sources(
                            args.rollback_interactive_template.as_deref(),
                            args.rollback_interactive_file.as_ref(),
                            "rollback interactive command tx execution",
                            "inline_tx_rollback_sequence",
                            "--rollback-interactive-template",
                            "--rollback-interactive-file",
                        )?;
                    let rollback_runtime_default_mode = resolve_interactive_runtime_default_mode(
                        mode_override.as_deref(),
                        rollback_template.operation.mode.as_deref(),
                        &profile_default_mode,
                    );
                    let rollback_vars = load_vars_json_input(
                        args.rollback_interactive_vars.as_ref(),
                        args.rollback_interactive_vars_json.as_deref(),
                    )?;
                    let rollback_runtime_vars = crate::resolve_interactive_connection_vars(
                        &rollback_template,
                        rollback_vars,
                        &conn,
                    )?;
                    let mut rollback_sequence =
                        rollback_template.to_execution_sequence(&build_interactive_runtime(
                            rollback_runtime_default_mode,
                            rollback_runtime_vars,
                        ))?;
                    if let Some(timeout_secs) = args.timeout_secs {
                        for step in &mut rollback_sequence.steps {
                            step.timeout = Some(timeout_secs);
                        }
                    }
                    command_blacklist::ensure_commands_allowed(
                        rollback_sequence
                            .steps
                            .iter()
                            .map(|step| step.command.as_str()),
                        "rollback interactive command",
                    )?;
                    if rollback_sequence.steps.is_empty() {
                        return Err(anyhow::anyhow!("rollback interactive command has no steps"));
                    }
                    Some(SessionOperation::from(rollback_sequence))
                }
            };

            let mut step = TxStep::new(SessionOperation::from(interactive))
                .with_rollback_on_failure(args.rollback_on_failure);
            if let Some(rollback_operation) = rollback_operation {
                step = step.with_rollback(rollback_operation);
            }
            let tx_block = TxBlock {
                name: args.name.clone(),
                rollback_policy: RollbackPolicy::PerStep,
                steps: vec![step],
                fail_fast: true,
            };
            tx_block.validate()?;
            (tx_block, interactive_effective_mode)
        }
    };

    if args.dry_run {
        println!("{}", serde_json::to_string_pretty(&tx_block)?);
        return Ok(());
    }

    command_blacklist::ensure_tx_block_allowed(&tx_block, &format!("tx block '{}'", args.name))?;

    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let request = crate::manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.auth.clone(),
        conn.enable_password.clone(),
        handler,
        conn.output_encoding,
    );
    let record_level = crate::to_record_level(args.record_level);
    let recorder = crate::config::session_recording::redacting_recorder(
        record_level,
        &conn.auth,
        conn.enable_password.as_deref(),
    );
    let tx_result = MANAGER
        .execute_tx_block_with_recorder_and_context(
            request,
            tx_block.clone(),
            crate::manager_execution_context_with_security(
                None,
                conn.ssh_security,
                conn.connect_timeout_secs,
            ),
            recorder.clone(),
        )
        .await?;

    let jsonl = recorder.to_jsonl()?;
    crate::write_recording_text_if_requested(args.record_file.as_ref(), &jsonl, args.record_level)?;
    crate::persist_auto_recording_history_jsonl(
        &jsonl,
        &conn,
        "tx_block",
        &args.name,
        Some(&effective_mode),
        args.record_level,
    )?;

    if args.json {
        println!("{}", serde_json::to_string_pretty(&tx_result)?);
    } else {
        print_tx_result(&tx_result);
    }
    crate::maybe_save_connection_profile(opts, &conn)?;
    Ok(())
}

fn resolve_tx_commands(args: &TxArgs, conn: &crate::EffectiveConnection) -> Result<Vec<String>> {
    let mut commands = Vec::new();
    if let Some(template_name) = &args.template {
        let renderer = Renderer::new();
        let vars = load_vars_json(args.vars.as_ref())?;
        let vars = crate::resolve_runtime_vars_for_connection(vars, conn)?;
        let mut render_context = match vars {
            Value::Null => serde_json::json!({}),
            Value::Object(_) => vars,
            _ => return Err(anyhow::anyhow!("tx vars must be a JSON object")),
        };
        if let Some(stored) = content_store::load_command_template(template_name)? {
            enrich_context_with_connection_refs_from_template(
                &mut render_context,
                &stored.content,
            )?;
        }
        let rendered = renderer.render_file(template_name, render_context)?;
        commands.extend(
            rendered
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
        );
    }
    commands.extend(
        args.commands
            .iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
    );
    if commands.is_empty() {
        return Err(anyhow::anyhow!(
            "no executable commands resolved for tx block"
        ));
    }
    Ok(commands)
}

fn load_vars_json(path: Option<&PathBuf>) -> Result<serde_json::Value> {
    match path {
        Some(path) => {
            let content = fs::read_to_string(path)?;
            Ok(serde_json::from_str(&content)?)
        }
        None => Ok(serde_json::Value::Null),
    }
}

pub(crate) fn load_vars_json_input(
    path: Option<&PathBuf>,
    inline_json: Option<&str>,
) -> Result<serde_json::Value> {
    match (
        path,
        inline_json.map(str::trim).filter(|value| !value.is_empty()),
    ) {
        (Some(_), Some(_)) => Err(anyhow::anyhow!(
            "use either --vars or --vars-json, not both"
        )),
        (Some(path), None) => load_vars_json(Some(path)),
        (None, Some(raw)) => Ok(serde_json::from_str(raw)?),
        (None, None) => Ok(serde_json::Value::Null),
    }
}

fn print_tx_result(result: &rneter::session::TxResult) {
    println!("# tx_block: {}", result.block_name);
    println!("committed: {}", result.committed);
    println!("executed_steps: {}", result.executed_steps);
    println!(
        "rollback: attempted={} succeeded={} steps={}",
        result.rollback_attempted, result.rollback_succeeded, result.rollback_steps
    );
    if let Some(index) = result.failed_step {
        println!("failed_step: {}", index);
    }
    if let Some(reason) = &result.failure_reason {
        println!("failure_reason: {}", reason);
    }
    if !result.rollback_errors.is_empty() {
        println!("rollback_errors: {}", result.rollback_errors.join(" | "));
    }
    if let Some(summary) = &result.block_rollback_operation_summary {
        println!("block_rollback_operation_summary: {}", summary);
    }
    if !result.block_rollback_steps.is_empty() {
        println!("block_rollback_steps:");
        print_operation_step_results("  ", &result.block_rollback_steps);
    }
    if !result.step_results.is_empty() {
        println!("step_results:");
        for step in &result.step_results {
            println!(
                "  - step={} exec={:?} rollback={:?} mode={} operation={}",
                step.step_index,
                step.execution_state,
                step.rollback_state,
                step.mode,
                step.operation_summary
            );
            if let Some(reason) = &step.failure_reason {
                println!("    failure_reason: {}", reason);
            }
            if !step.forward_operation_steps.is_empty() {
                println!("    forward_operation_steps:");
                print_operation_step_results("      ", &step.forward_operation_steps);
            }
            if let Some(summary) = &step.rollback_operation_summary {
                println!("    rollback_operation: {}", summary);
            }
            if let Some(reason) = &step.rollback_reason {
                println!("    rollback_reason: {}", reason);
            }
            if !step.rollback_operation_steps.is_empty() {
                println!("    rollback_operation_steps:");
                print_operation_step_results("      ", &step.rollback_operation_steps);
            }
        }
    }
}

fn print_operation_step_results(prefix: &str, steps: &[TxOperationStepResult]) {
    for step in steps {
        println!(
            "{}- child_step={} success={} mode={} summary={}",
            prefix, step.step_index, step.success, step.mode, step.operation_summary
        );
        if let Some(exit_code) = step.exit_code {
            println!("{}  exit_code: {}", prefix, exit_code);
        }
        if let Some(prompt) = &step.prompt {
            println!("{}  prompt: {}", prefix, prompt);
        }
    }
}
