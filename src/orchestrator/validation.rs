use super::OrchestrationPlan;
#[cfg(test)]
use super::TxWorkflowAction;
use super::targets as orchestrator_targets;
use anyhow::{Result, anyhow};

pub(super) fn validate_plan(plan: &OrchestrationPlan) -> Result<()> {
    crate::domain::orchestration::validate_plan(plan)?;
    for stage in &plan.stages {
        for (job_idx, job) in stage.jobs.iter().enumerate() {
            let resolved_targets = orchestrator_targets::resolve_job_targets(&stage.name, job)?;
            if resolved_targets.is_empty() {
                return Err(anyhow!(
                    "stage '{}' job {} resolved no targets",
                    stage.name,
                    job_idx + 1
                ));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
pub(super) fn validate_tx_workflow_action(scope: &str, action: &TxWorkflowAction) -> Result<()> {
    crate::domain::orchestration::validate_tx_workflow_action(scope, action).map_err(Into::into)
}
