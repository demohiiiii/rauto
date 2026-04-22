use super::targets as orchestrator_targets;
use super::{
    OrchestrationAction, OrchestrationInventory, OrchestrationJob, OrchestrationPlan,
    TxBlockAction, TxWorkflowAction,
};
use anyhow::{Result, anyhow};

pub(super) fn validate_plan(
    plan: &OrchestrationPlan,
    inventory: &OrchestrationInventory,
) -> Result<()> {
    if plan.name.trim().is_empty() {
        return Err(anyhow!("orchestration plan name must not be empty"));
    }
    if plan.stages.is_empty() {
        return Err(anyhow!(
            "orchestration plan must contain at least one stage"
        ));
    }
    for group_name in inventory.groups.keys() {
        if group_name.trim().is_empty() {
            return Err(anyhow!("inventory group name must not be empty"));
        }
    }

    for (idx, stage) in plan.stages.iter().enumerate() {
        if stage.name.trim().is_empty() {
            return Err(anyhow!("stage {} name must not be empty", idx + 1));
        }
        if stage.jobs.is_empty() {
            return Err(anyhow!(
                "stage '{}' must contain at least one job",
                stage.name
            ));
        }
        if matches!(stage.strategy, super::StageStrategy::Parallel) && stage.max_parallel == Some(0)
        {
            return Err(anyhow!(
                "stage '{}' max_parallel must be greater than zero",
                stage.name
            ));
        }
        for (job_idx, job) in stage.jobs.iter().enumerate() {
            validate_job(stage.name.as_str(), job, job_idx, inventory)?;
        }
    }
    Ok(())
}

fn validate_job(
    stage_name: &str,
    job: &OrchestrationJob,
    job_idx: usize,
    inventory: &OrchestrationInventory,
) -> Result<()> {
    if job.target_groups.is_empty() && job.target_tags.is_empty() && job.targets.is_empty() {
        return Err(anyhow!(
            "stage '{}' job {} must contain at least one target, target_groups, or target_tags entry",
            stage_name,
            job_idx + 1
        ));
    }
    if matches!(job.strategy, super::StageStrategy::Parallel) && job.max_parallel == Some(0) {
        return Err(anyhow!(
            "stage '{}' job {} max_parallel must be greater than zero",
            stage_name,
            job_idx + 1
        ));
    }
    let resolved_targets = orchestrator_targets::resolve_job_targets(stage_name, job, inventory)?;
    if resolved_targets.is_empty() {
        return Err(anyhow!(
            "stage '{}' job {} resolved no targets",
            stage_name,
            job_idx + 1
        ));
    }
    let scope = format!("stage '{}' job {}", stage_name, job_idx + 1);
    match &job.action {
        OrchestrationAction::TxBlock(action) => validate_tx_block_action(&scope, action)?,
        OrchestrationAction::TxWorkflow(action) => validate_tx_workflow_action(&scope, action)?,
    }
    Ok(())
}

pub(super) fn validate_tx_block_action(scope: &str, action: &TxBlockAction) -> Result<()> {
    let has_template = action
        .template
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let has_tx_block_template_name = action
        .tx_block_template_name
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let has_tx_block_template_content = action
        .tx_block_template_content
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let has_tx_block_template_source = has_tx_block_template_name || has_tx_block_template_content;
    let has_flow_template_name = action
        .flow_template_name
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let has_flow_template_content = action
        .flow_template_content
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let has_flow_template_source = has_flow_template_name || has_flow_template_content;
    let has_commands = action.commands.iter().any(|s| !s.trim().is_empty());
    if has_tx_block_template_name && has_tx_block_template_content {
        return Err(anyhow!(
            "{} tx_block uses either tx_block_template_name or tx_block_template_content, not both",
            scope
        ));
    }
    if has_flow_template_name && has_flow_template_content {
        return Err(anyhow!(
            "{} tx_block uses either flow_template_name or flow_template_content, not both",
            scope
        ));
    }
    if has_tx_block_template_source && has_flow_template_source {
        return Err(anyhow!(
            "{} tx_block template source cannot be combined with flow template source",
            scope
        ));
    }
    if (has_tx_block_template_source || has_flow_template_source) && (has_template || has_commands)
    {
        return Err(anyhow!(
            "{} tx_block template/flow source cannot be combined with template/commands",
            scope
        ));
    }
    if !has_tx_block_template_source && !has_flow_template_source && !has_template && !has_commands
    {
        return Err(anyhow!(
            "{} tx_block requires tx_block_template_name/tx_block_template_content, flow_template_name/flow_template_content, or 'template'/non-empty 'commands'",
            scope
        ));
    }
    if action.rollback_trigger_step_index.is_some() && action.resource_rollback_command.is_none() {
        return Err(anyhow!(
            "{} rollback_trigger_step_index requires resource_rollback_command",
            scope
        ));
    }
    Ok(())
}

pub(super) fn validate_tx_workflow_action(scope: &str, action: &TxWorkflowAction) -> Result<()> {
    let has_file = action
        .workflow_file
        .as_ref()
        .is_some_and(|path| !path.as_os_str().is_empty());
    let has_inline = action.workflow.is_some();
    let has_template_name = action
        .workflow_template_name
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let has_template_content = action
        .workflow_template_content
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    if has_template_name && has_template_content {
        return Err(anyhow!(
            "{} tx_workflow uses either workflow_template_name or workflow_template_content, not both",
            scope
        ));
    }
    let source_count = [
        has_file,
        has_inline,
        has_template_name,
        has_template_content,
    ]
    .into_iter()
    .filter(|item| *item)
    .count();
    if source_count != 1 {
        return Err(anyhow!(
            "{} tx_workflow requires exactly one source: workflow_file/workflow/workflow_template_name/workflow_template_content",
            scope
        ));
    }
    Ok(())
}
