#![forbid(unsafe_code)]

//! Orchestration domain crate.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::error::Error;
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationPlan {
    pub name: String,
    #[serde(default = "default_fail_fast")]
    pub fail_fast: bool,
    #[serde(default)]
    pub rollback_on_stage_failure: bool,
    #[serde(default)]
    pub rollback_completed_stages_on_failure: bool,
    #[serde(default)]
    pub stages: Vec<OrchestrationStage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationStage {
    pub name: String,
    pub strategy: StageStrategy,
    pub max_parallel: Option<usize>,
    pub fail_fast: Option<bool>,
    pub jobs: Vec<OrchestrationJob>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationJob {
    pub name: Option<String>,
    pub strategy: StageStrategy,
    pub max_parallel: Option<usize>,
    pub fail_fast: Option<bool>,
    #[serde(default)]
    pub target_groups: Vec<String>,
    #[serde(default)]
    pub target_tags: Vec<String>,
    #[serde(default)]
    pub targets: Vec<String>,
    pub action: OrchestrationAction,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StageStrategy {
    Serial,
    Parallel,
}

#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum OrchestrationAction {
    TxWorkflow(TxWorkflowAction),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TxWorkflowAction {
    #[serde(default)]
    pub workflow: Option<Value>,
    #[serde(default)]
    pub workflow_template_name: Option<String>,
    #[serde(default)]
    pub workflow_vars: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrchestrationExecutionResult {
    pub plan_name: String,
    pub success: bool,
    pub fail_fast: bool,
    pub total_stages: usize,
    pub executed_stages: usize,
    pub stages: Vec<StageExecutionResult>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StageExecutionResult {
    pub name: String,
    pub strategy: StageStrategy,
    pub status: StageStatus,
    pub fail_fast: bool,
    pub jobs_total: usize,
    pub jobs_succeeded: usize,
    pub jobs_failed: usize,
    pub jobs_skipped: usize,
    pub jobs: Vec<JobExecutionResult>,
}

#[derive(Debug, Clone, Serialize)]
pub struct JobExecutionResult {
    pub name: String,
    pub strategy: StageStrategy,
    pub status: StageStatus,
    pub fail_fast: bool,
    pub action_kind: String,
    pub action_summary: String,
    pub targets_total: usize,
    pub targets_succeeded: usize,
    pub targets_failed: usize,
    pub targets_skipped: usize,
    pub results: Vec<TargetExecutionResult>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StageStatus {
    Success,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize)]
pub struct TargetExecutionResult {
    pub label: String,
    pub connection_name: Option<String>,
    pub host: Option<String>,
    pub status: TargetStatus,
    pub operation: String,
    pub duration_ms: u128,
    pub error: Option<String>,
    pub tx_result: Option<Value>,
    pub workflow_result: Option<Value>,
    pub recording_jsonl: Option<String>,
    pub compensation: Option<CompensationExecutionResult>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompensationExecutionResult {
    pub scope: String,
    pub attempted: bool,
    pub success: bool,
    pub reason: Option<String>,
    pub operation: Option<String>,
    pub duration_ms: u128,
    pub error: Option<String>,
    pub tx_result: Option<Value>,
    pub recording_jsonl: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TargetStatus {
    Success,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrchestrationRuntimeEvent {
    pub event_type: String,
    pub message: String,
    pub level: String,
    pub stage: Option<String>,
    pub progress: Option<u8>,
    pub details: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OrchestrationRuleError {
    EmptyPlanName,
    EmptyStages,
    EmptyStageName { index: usize },
    EmptyStageJobs { stage: String },
    InvalidStageParallelism { stage: String },
    EmptyJobTargets { stage: String, job_index: usize },
    InvalidJobParallelism { stage: String, job_index: usize },
    InvalidWorkflowSource { scope: String },
    InlineWorkflowVars { scope: String },
}

impl fmt::Display for OrchestrationRuleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyPlanName => f.write_str("orchestration plan name must not be empty"),
            Self::EmptyStages => f.write_str("orchestration plan must contain at least one stage"),
            Self::EmptyStageName { index } => {
                write!(f, "stage {} name must not be empty", index + 1)
            }
            Self::EmptyStageJobs { stage } => {
                write!(f, "stage '{}' must contain at least one job", stage)
            }
            Self::InvalidStageParallelism { stage } => write!(
                f,
                "stage '{}' max_parallel must be greater than zero",
                stage
            ),
            Self::EmptyJobTargets { stage, job_index } => write!(
                f,
                "stage '{}' job {} must contain at least one target, target_groups, or target_tags entry",
                stage,
                job_index + 1
            ),
            Self::InvalidJobParallelism { stage, job_index } => write!(
                f,
                "stage '{}' job {} max_parallel must be greater than zero",
                stage,
                job_index + 1
            ),
            Self::InvalidWorkflowSource { scope } => write!(
                f,
                "{} tx_workflow requires exactly one source: workflow/workflow_template_name",
                scope
            ),
            Self::InlineWorkflowVars { scope } => write!(
                f,
                "{} workflow_vars is only valid with workflow_template_name",
                scope
            ),
        }
    }
}

impl Error for OrchestrationRuleError {}

pub fn validate_plan(plan: &OrchestrationPlan) -> Result<(), OrchestrationRuleError> {
    if plan.name.trim().is_empty() {
        return Err(OrchestrationRuleError::EmptyPlanName);
    }
    if plan.stages.is_empty() {
        return Err(OrchestrationRuleError::EmptyStages);
    }
    for (stage_index, stage) in plan.stages.iter().enumerate() {
        if stage.name.trim().is_empty() {
            return Err(OrchestrationRuleError::EmptyStageName { index: stage_index });
        }
        if stage.jobs.is_empty() {
            return Err(OrchestrationRuleError::EmptyStageJobs {
                stage: stage.name.clone(),
            });
        }
        if matches!(stage.strategy, StageStrategy::Parallel) && stage.max_parallel == Some(0) {
            return Err(OrchestrationRuleError::InvalidStageParallelism {
                stage: stage.name.clone(),
            });
        }
        for (job_index, job) in stage.jobs.iter().enumerate() {
            validate_job(&stage.name, job, job_index)?;
        }
    }
    Ok(())
}

fn validate_job(
    stage: &str,
    job: &OrchestrationJob,
    job_index: usize,
) -> Result<(), OrchestrationRuleError> {
    if job.target_groups.is_empty() && job.target_tags.is_empty() && job.targets.is_empty() {
        return Err(OrchestrationRuleError::EmptyJobTargets {
            stage: stage.to_string(),
            job_index,
        });
    }
    if matches!(job.strategy, StageStrategy::Parallel) && job.max_parallel == Some(0) {
        return Err(OrchestrationRuleError::InvalidJobParallelism {
            stage: stage.to_string(),
            job_index,
        });
    }
    let scope = format!("stage '{}' job {}", stage, job_index + 1);
    match &job.action {
        OrchestrationAction::TxWorkflow(action) => validate_tx_workflow_action(&scope, action),
    }
}

pub fn validate_tx_workflow_action(
    scope: &str,
    action: &TxWorkflowAction,
) -> Result<(), OrchestrationRuleError> {
    let has_inline = action.workflow.is_some();
    let has_template_name = action
        .workflow_template_name
        .as_deref()
        .is_some_and(|name| !name.trim().is_empty());
    if usize::from(has_inline) + usize::from(has_template_name) != 1 {
        return Err(OrchestrationRuleError::InvalidWorkflowSource {
            scope: scope.to_string(),
        });
    }
    if has_inline && !action.workflow_vars.is_null() {
        return Err(OrchestrationRuleError::InlineWorkflowVars {
            scope: scope.to_string(),
        });
    }
    Ok(())
}

pub fn build_stage_result(
    stage: &OrchestrationStage,
    fail_fast: bool,
    jobs: Vec<JobExecutionResult>,
) -> StageExecutionResult {
    let jobs_total = jobs.len();
    let jobs_succeeded = jobs
        .iter()
        .filter(|item| matches!(item.status, StageStatus::Success))
        .count();
    let jobs_failed = jobs
        .iter()
        .filter(|item| matches!(item.status, StageStatus::Failed))
        .count();
    let jobs_skipped = jobs
        .iter()
        .filter(|item| matches!(item.status, StageStatus::Skipped))
        .count();
    let status = if jobs_failed > 0 {
        StageStatus::Failed
    } else if jobs_total > 0 && jobs_skipped == jobs_total {
        StageStatus::Skipped
    } else {
        StageStatus::Success
    };

    StageExecutionResult {
        name: stage.name.clone(),
        strategy: stage.strategy,
        status,
        fail_fast,
        jobs_total,
        jobs_succeeded,
        jobs_failed,
        jobs_skipped,
        jobs,
    }
}

pub fn build_job_result(
    job: &OrchestrationJob,
    index: usize,
    fail_fast: bool,
    results: Vec<TargetExecutionResult>,
) -> JobExecutionResult {
    let targets_total = results.len();
    let targets_succeeded = results
        .iter()
        .filter(|item| matches!(item.status, TargetStatus::Success))
        .count();
    let targets_failed = results
        .iter()
        .filter(|item| matches!(item.status, TargetStatus::Failed))
        .count();
    let targets_skipped = results
        .iter()
        .filter(|item| matches!(item.status, TargetStatus::Skipped))
        .count();
    let status = if targets_failed > 0 {
        StageStatus::Failed
    } else if targets_total > 0 && targets_skipped == targets_total {
        StageStatus::Skipped
    } else {
        StageStatus::Success
    };

    JobExecutionResult {
        name: job_name(job, index),
        strategy: job.strategy,
        status,
        fail_fast,
        action_kind: action_kind_name(&job.action).to_string(),
        action_summary: action_summary(&job.action),
        targets_total,
        targets_succeeded,
        targets_failed,
        targets_skipped,
        results,
    }
}

pub fn job_name(job: &OrchestrationJob, index: usize) -> String {
    job.name
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| format!("job-{}", index + 1))
}

pub fn action_kind_name(action: &OrchestrationAction) -> &'static str {
    match action {
        OrchestrationAction::TxWorkflow(_) => "tx_workflow",
    }
}

pub fn action_summary(action: &OrchestrationAction) -> String {
    match action {
        OrchestrationAction::TxWorkflow(spec) => {
            if let Some(name) = spec
                .workflow_template_name
                .as_deref()
                .filter(|name| !name.trim().is_empty())
            {
                format!("workflow_template={}", name)
            } else if let Some(name) = spec
                .workflow
                .as_ref()
                .and_then(|workflow| workflow.get("name"))
                .and_then(Value::as_str)
                .filter(|name| !name.trim().is_empty())
            {
                format!("workflow={}", name)
            } else {
                "inline workflow".to_string()
            }
        }
    }
}

fn default_fail_fast() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn action() -> OrchestrationAction {
        OrchestrationAction::TxWorkflow(TxWorkflowAction {
            workflow: Some(json!({"name": "deploy", "blocks": []})),
            workflow_template_name: None,
            workflow_vars: Value::Null,
        })
    }

    fn plan() -> OrchestrationPlan {
        OrchestrationPlan {
            name: "release".to_string(),
            fail_fast: true,
            rollback_on_stage_failure: false,
            rollback_completed_stages_on_failure: false,
            stages: vec![OrchestrationStage {
                name: "edge".to_string(),
                strategy: StageStrategy::Serial,
                max_parallel: None,
                fail_fast: None,
                jobs: vec![OrchestrationJob {
                    name: None,
                    strategy: StageStrategy::Serial,
                    max_parallel: None,
                    fail_fast: None,
                    target_groups: Vec::new(),
                    target_tags: Vec::new(),
                    targets: vec!["edge-01".to_string()],
                    action: action(),
                }],
            }],
        }
    }

    #[test]
    fn valid_plan_passes_domain_validation() {
        validate_plan(&plan()).expect("valid plan");
    }

    #[test]
    fn parallel_limits_must_be_positive() {
        let mut plan = plan();
        plan.stages[0].strategy = StageStrategy::Parallel;
        plan.stages[0].max_parallel = Some(0);

        assert!(matches!(
            validate_plan(&plan),
            Err(OrchestrationRuleError::InvalidStageParallelism { .. })
        ));
    }

    #[test]
    fn workflow_source_is_exclusive() {
        let mut plan = plan();
        let OrchestrationAction::TxWorkflow(action) = &mut plan.stages[0].jobs[0].action;
        action.workflow_template_name = Some("saved".to_string());

        assert!(matches!(
            validate_plan(&plan),
            Err(OrchestrationRuleError::InvalidWorkflowSource { .. })
        ));
    }
}
