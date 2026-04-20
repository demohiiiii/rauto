use crate::cli::{TxArgs, TxRunKind};
use crate::config::command_flow_template::{
    build_command_flow_runtime, resolve_command_flow_runtime_default_mode,
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
    let conn = crate::resolve_effective_connection(opts)?;
    let (tx_block, effective_mode) = match args.run_kind {
        TxRunKind::Commands => {
            if args.template.is_none() && args.commands.is_empty() {
                return Err(anyhow::anyhow!(
                    "tx requires at least one --command or a --template"
                ));
            }
            if args.flow_template.is_some()
                || args.flow_file.is_some()
                || args.flow_vars.is_some()
                || args.flow_vars_json.is_some()
                || args.rollback_flow_template.is_some()
                || args.rollback_flow_file.is_some()
                || args.rollback_flow_vars.is_some()
                || args.rollback_flow_vars_json.is_some()
            {
                return Err(anyhow::anyhow!(
                    "command-based tx does not accept --flow-* arguments"
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
        TxRunKind::CommandFlow => {
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
                    "command flow tx does not accept command/template rollback arguments"
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

            let flow_template = crate::cli_flow::resolve_command_flow_template_from_sources(
                args.flow_template.as_deref(),
                args.flow_file.as_ref(),
                "command flow tx execution",
                "inline_tx_flow",
                "--flow-template",
                "--flow-file",
            )?;
            let flow_runtime_default_mode = resolve_command_flow_runtime_default_mode(
                mode_override.as_deref(),
                flow_template.template.default_mode.as_deref(),
                &profile_default_mode,
            );
            let flow_effective_mode = flow_runtime_default_mode
                .clone()
                .or_else(|| {
                    flow_template
                        .template
                        .default_mode
                        .as_deref()
                        .map(str::trim)
                        .filter(|mode| !mode.is_empty())
                        .map(ToOwned::to_owned)
                })
                .unwrap_or_else(|| profile_default_mode.clone());
            let flow_vars =
                load_vars_json_input(args.flow_vars.as_ref(), args.flow_vars_json.as_deref())?;
            let flow_runtime_vars = crate::resolve_flow_runtime_vars(
                &flow_template.template,
                flow_vars,
                &conn,
                flow_template.current_connection_alias.as_deref(),
            )?;
            let mut flow = flow_template
                .template
                .to_command_flow(&build_command_flow_runtime(
                    flow_runtime_default_mode,
                    conn.connection_name.as_deref(),
                    &conn.host,
                    &conn.username,
                    &conn.device_profile,
                    flow_runtime_vars,
                ))?;
            if let Some(timeout_secs) = args.timeout_secs {
                for step in &mut flow.steps {
                    step.timeout = Some(timeout_secs);
                }
            }
            command_blacklist::ensure_commands_allowed(
                flow.steps.iter().map(|step| step.command.as_str()),
                "command flow",
            )?;
            if flow.steps.is_empty() {
                return Err(anyhow::anyhow!("command flow has no steps"));
            }

            let rollback_operation = match (
                args.rollback_flow_template.as_deref(),
                args.rollback_flow_file.as_ref(),
            ) {
                (None, None) => None,
                _ => {
                    let rollback_template =
                        crate::cli_flow::resolve_command_flow_template_from_sources(
                            args.rollback_flow_template.as_deref(),
                            args.rollback_flow_file.as_ref(),
                            "rollback command flow tx execution",
                            "inline_tx_rollback_flow",
                            "--rollback-flow-template",
                            "--rollback-flow-file",
                        )?;
                    let rollback_runtime_default_mode = resolve_command_flow_runtime_default_mode(
                        mode_override.as_deref(),
                        rollback_template.template.default_mode.as_deref(),
                        &profile_default_mode,
                    );
                    let rollback_vars = load_vars_json_input(
                        args.rollback_flow_vars.as_ref(),
                        args.rollback_flow_vars_json.as_deref(),
                    )?;
                    let rollback_runtime_vars = crate::resolve_flow_runtime_vars(
                        &rollback_template.template,
                        rollback_vars,
                        &conn,
                        rollback_template.current_connection_alias.as_deref(),
                    )?;
                    let mut rollback_flow =
                        rollback_template
                            .template
                            .to_command_flow(&build_command_flow_runtime(
                                rollback_runtime_default_mode,
                                conn.connection_name.as_deref(),
                                &conn.host,
                                &conn.username,
                                &conn.device_profile,
                                rollback_runtime_vars,
                            ))?;
                    if let Some(timeout_secs) = args.timeout_secs {
                        for step in &mut rollback_flow.steps {
                            step.timeout = Some(timeout_secs);
                        }
                    }
                    command_blacklist::ensure_commands_allowed(
                        rollback_flow.steps.iter().map(|step| step.command.as_str()),
                        "rollback command flow",
                    )?;
                    if rollback_flow.steps.is_empty() {
                        return Err(anyhow::anyhow!("rollback command flow has no steps"));
                    }
                    Some(SessionOperation::from(rollback_flow))
                }
            };

            let mut step = TxStep::new(SessionOperation::from(flow))
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
            (tx_block, flow_effective_mode)
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
        conn.password.clone(),
        conn.enable_password.clone(),
        handler,
    );
    let (_sender, recorder) = MANAGER
        .get_with_recording_level_and_context(
            request,
            crate::manager_execution_context_with_security(None, conn.ssh_security),
            crate::to_record_level(args.record_level),
        )
        .await?;
    let handler_for_tx = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let request = crate::manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
        conn.enable_password.clone(),
        handler_for_tx,
    );
    let tx_result = MANAGER
        .execute_tx_block_with_context(
            request,
            tx_block.clone(),
            crate::manager_execution_context_with_security(None, conn.ssh_security),
        )
        .await?;

    let jsonl = recorder.to_jsonl()?;
    crate::write_recording_text_if_requested(args.record_file.as_ref(), &jsonl)?;
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
