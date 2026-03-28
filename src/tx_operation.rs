use anyhow::Result;
use rneter::session::{
    Command, CommandDynamicParams, CommandInteraction, SessionOperation, TxStep,
};
#[cfg(test)]
use rneter::session::RollbackPolicy;

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

#[cfg(test)]
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
