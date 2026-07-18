use super::targets as orchestrator_targets;
use super::{OrchestrationAction, OrchestrationJob, OrchestrationPlan, TxWorkflowAction};
use anyhow::{Result, anyhow};

pub(super) fn validate_plan(plan: &OrchestrationPlan) -> Result<()> {
    if plan.name.trim().is_empty() {
        return Err(anyhow!("orchestration plan name must not be empty"));
    }
    if plan.stages.is_empty() {
        return Err(anyhow!(
            "orchestration plan must contain at least one stage"
        ));
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
            validate_job(stage.name.as_str(), job, job_idx)?;
        }
    }
    Ok(())
}

fn validate_job(stage_name: &str, job: &OrchestrationJob, job_idx: usize) -> Result<()> {
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
    let resolved_targets = orchestrator_targets::resolve_job_targets(stage_name, job)?;
    if resolved_targets.is_empty() {
        return Err(anyhow!(
            "stage '{}' job {} resolved no targets",
            stage_name,
            job_idx + 1
        ));
    }
    let scope = format!("stage '{}' job {}", stage_name, job_idx + 1);
    match &job.action {
        OrchestrationAction::TxWorkflow(action) => validate_tx_workflow_action(&scope, action)?,
    }
    Ok(())
}

pub(super) fn validate_tx_workflow_action(scope: &str, action: &TxWorkflowAction) -> Result<()> {
    let has_inline = action.workflow.is_some();
    let has_template_name = action
        .workflow_template_name
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let source_count = [has_inline, has_template_name]
        .into_iter()
        .filter(|item| *item)
        .count();
    if source_count != 1 {
        return Err(anyhow!(
            "{} tx_workflow requires exactly one source: workflow/workflow_template_name",
            scope
        ));
    }
    if has_inline && !action.workflow_vars.is_null() {
        return Err(anyhow!(
            "{} workflow_vars is only valid with workflow_template_name",
            scope
        ));
    }
    Ok(())
}
