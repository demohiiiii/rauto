use anyhow::{Result, anyhow};
use rneter::session::{
    Command, CommandBlockKind, CommandDynamicParams, CommandInteraction, RollbackPolicy,
    SessionOperation, TxBlock, TxStep,
};

pub fn command(
    mode: impl Into<String>,
    command: impl Into<String>,
    timeout_secs: Option<u64>,
) -> Command {
    Command {
        mode: mode.into(),
        command: command.into(),
        timeout: timeout_secs,
        dyn_params: CommandDynamicParams::default(),
        interaction: CommandInteraction::default(),
    }
}

pub fn command_tx_step(
    mode: &str,
    command_text: impl Into<String>,
    timeout_secs: Option<u64>,
    rollback_command: Option<String>,
    rollback_on_failure: bool,
) -> TxStep {
    let mut step = TxStep::new(command(mode.to_string(), command_text, timeout_secs));
    if let Some(rollback_command) = rollback_command.filter(|value| !value.trim().is_empty()) {
        step = step.with_rollback(command(mode.to_string(), rollback_command, timeout_secs));
    }
    step.with_rollback_on_failure(rollback_on_failure)
}

pub fn whole_resource_rollback_policy(
    mode: &str,
    rollback_command: impl Into<String>,
    timeout_secs: Option<u64>,
    trigger_step_index: usize,
) -> RollbackPolicy {
    RollbackPolicy::WholeResource {
        rollback: Box::new(SessionOperation::from(command(
            mode.to_string(),
            rollback_command,
            timeout_secs,
        ))),
        trigger_step_index,
    }
}

pub fn build_command_tx_block(
    name: impl Into<String>,
    mode: &str,
    commands: &[String],
    rollback_commands: &[String],
    timeout_secs: Option<u64>,
    rollback_on_failure: bool,
    resource_rollback_command: Option<String>,
    rollback_trigger_step_index: Option<usize>,
) -> Result<TxBlock> {
    let name = name.into();
    let whole_resource_rollback = resource_rollback_command
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let has_per_step_rollbacks = rollback_commands.iter().any(|value| !value.trim().is_empty());

    if has_per_step_rollbacks && whole_resource_rollback.is_some() {
        return Err(anyhow!(
            "use either per-step rollback commands or resource_rollback_command"
        ));
    }
    if rollback_trigger_step_index.is_some() && whole_resource_rollback.is_none() {
        return Err(anyhow!(
            "rollback_trigger_step_index requires resource_rollback_command"
        ));
    }
    if rollback_commands.len() > commands.len() {
        return Err(anyhow!(
            "rollback_commands length must not exceed commands length"
        ));
    }

    let mut padded_rollbacks = rollback_commands.to_vec();
    while padded_rollbacks.len() < commands.len() {
        padded_rollbacks.push(String::new());
    }

    let steps = commands
        .iter()
        .enumerate()
        .map(|(idx, command_text)| {
            command_tx_step(
                mode,
                command_text.clone(),
                timeout_secs,
                if padded_rollbacks[idx].trim().is_empty() {
                    None
                } else {
                    Some(padded_rollbacks[idx].clone())
                },
                rollback_on_failure,
            )
        })
        .collect::<Vec<_>>();

    let rollback_policy = if let Some(rollback) = whole_resource_rollback {
        whole_resource_rollback_policy(
            mode,
            rollback,
            timeout_secs,
            rollback_trigger_step_index.unwrap_or(0),
        )
    } else if has_per_step_rollbacks {
        RollbackPolicy::PerStep
    } else {
        RollbackPolicy::None
    };

    let tx_block = TxBlock {
        name,
        kind: CommandBlockKind::Config,
        rollback_policy,
        steps,
        fail_fast: true,
    };
    tx_block.validate()?;
    Ok(tx_block)
}

pub fn operation_commands(operation: &SessionOperation) -> Result<Vec<String>> {
    Ok(operation
        .to_command_flow()?
        .steps
        .into_iter()
        .map(|step| step.command)
        .collect())
}

pub fn command_timeout_secs(operation: &SessionOperation) -> Option<u64> {
    match operation {
        SessionOperation::Command(command) => command.timeout,
        _ => None,
    }
}
