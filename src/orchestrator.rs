use crate::cli::{GlobalOpts, OrchestrateArgs, RecordLevelOpt};
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::ssh_security::SshSecurityProfile;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

mod execution;
mod execution_actions;
mod render;
mod targets;
mod template_resolver;
mod validation;
use self::targets as orchestrator_targets;
use self::validation::validate_plan;
use render::{render_execution_result, render_plan};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationPlan {
    pub name: String,
    #[serde(default = "default_fail_fast")]
    pub fail_fast: bool,
    #[serde(default)]
    pub rollback_on_stage_failure: bool,
    #[serde(default)]
    pub rollback_completed_stages_on_failure: bool,
    pub inventory_file: Option<PathBuf>,
    #[serde(default)]
    pub inventory: Option<OrchestrationInventory>,
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
    pub targets: Vec<OrchestrationTargetInput>,
    pub action: OrchestrationAction,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OrchestrationInventory {
    #[serde(default)]
    pub defaults: OrchestrationTargetDefaults,
    #[serde(default)]
    pub groups: HashMap<String, InventoryGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum InventoryGroup {
    Targets(Vec<OrchestrationTargetInput>),
    Detailed(InventoryGroupSpec),
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct InventoryGroupSpec {
    #[serde(default)]
    pub defaults: OrchestrationTargetDefaults,
    #[serde(default)]
    pub targets: Vec<OrchestrationTargetInput>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OrchestrationTargetDefaults {
    pub username: Option<String>,
    pub password: Option<String>,
    pub port: Option<u16>,
    pub enable_password: Option<String>,
    pub ssh_security: Option<SshSecurityProfile>,
    pub linux_shell_flavor: Option<LinuxShellFlavor>,
    pub device_profile: Option<String>,
    pub template_dir: Option<String>,
    #[serde(default)]
    pub vars: Value,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StageStrategy {
    Serial,
    Parallel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OrchestrationTargetInput {
    ConnectionName(String),
    Detailed(Box<OrchestrationTarget>),
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OrchestrationTarget {
    pub name: Option<String>,
    pub connection: Option<String>,
    pub host: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub port: Option<u16>,
    pub enable_password: Option<String>,
    pub ssh_security: Option<SshSecurityProfile>,
    pub linux_shell_flavor: Option<LinuxShellFlavor>,
    pub device_profile: Option<String>,
    pub template_dir: Option<String>,
    #[serde(default)]
    pub vars: Value,
}

#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum OrchestrationAction {
    TxBlock(TxBlockAction),
    TxWorkflow(TxWorkflowAction),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxBlockAction {
    pub name: Option<String>,
    pub template: Option<String>,
    #[serde(default)]
    pub tx_block_template_name: Option<String>,
    #[serde(default)]
    pub tx_block_template_content: Option<String>,
    #[serde(default)]
    pub tx_block_template_vars: Value,
    #[serde(default)]
    pub flow_template_name: Option<String>,
    #[serde(default)]
    pub flow_template_content: Option<String>,
    #[serde(default)]
    pub flow_vars: Value,
    #[serde(default)]
    pub vars: Value,
    #[serde(default)]
    pub commands: Vec<String>,
    #[serde(default)]
    pub rollback_commands: Vec<String>,
    #[serde(default)]
    pub rollback_on_failure: bool,
    pub rollback_trigger_step_index: Option<usize>,
    pub mode: Option<String>,
    pub timeout_secs: Option<u64>,
    pub resource_rollback_command: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxWorkflowAction {
    pub workflow_file: Option<PathBuf>,
    #[serde(default)]
    pub workflow: Option<Value>,
    #[serde(default)]
    pub workflow_template_name: Option<String>,
    #[serde(default)]
    pub workflow_template_content: Option<String>,
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

#[derive(Debug, Clone)]
struct ActionExecutionOutcome {
    operation: String,
    success: bool,
    error: Option<String>,
    tx_result: Option<Value>,
    workflow_result: Option<Value>,
    recording_jsonl: Option<String>,
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

pub type OrchestrationEventHook = Arc<dyn Fn(OrchestrationRuntimeEvent) + Send + Sync>;

fn default_fail_fast() -> bool {
    true
}

pub async fn run(args: OrchestrateArgs, opts: &GlobalOpts) -> Result<()> {
    let plan_text = fs::read_to_string(&args.plan_file).with_context(|| {
        format!(
            "failed to read orchestration plan '{}'",
            args.plan_file.to_string_lossy()
        )
    })?;
    let plan: OrchestrationPlan = serde_json::from_str(&plan_text)
        .with_context(|| format!("failed to parse '{}'", args.plan_file.to_string_lossy()))?;
    let plan_root = args
        .plan_file
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let inventory = orchestrator_targets::load_inventory(&plan, &plan_root)?;
    validate_plan(&plan, &inventory)?;

    if args.view {
        println!("{}", render_plan(&plan, &inventory, Some(&args.plan_file))?);
        return Ok(());
    }

    if args.dry_run {
        if args.json {
            println!("{}", serde_json::to_string_pretty(&plan)?);
        } else {
            println!("{}", render_plan(&plan, &inventory, Some(&args.plan_file))?);
        }
        return Ok(());
    }

    let result =
        execution::execute_plan(&plan, &inventory, &plan_root, opts, args.record_level, None)
            .await?;

    if args.json {
        println!("{}", serde_json::to_string_pretty(&result)?);
    } else {
        println!("{}", render_execution_result(&result));
    }

    Ok(())
}

pub fn load_plan_from_value(
    plan_value: Value,
    plan_root: &Path,
) -> Result<(OrchestrationPlan, OrchestrationInventory)> {
    let plan: OrchestrationPlan = serde_json::from_value(plan_value)?;
    let inventory = orchestrator_targets::load_inventory(&plan, plan_root)?;
    validate_plan(&plan, &inventory)?;
    Ok((plan, inventory))
}

#[allow(dead_code)]
pub async fn execute_loaded_plan(
    plan: &OrchestrationPlan,
    inventory: &OrchestrationInventory,
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
) -> Result<OrchestrationExecutionResult> {
    execute_loaded_plan_with_events(plan, inventory, plan_root, opts, record_level, None).await
}

pub async fn execute_loaded_plan_with_events(
    plan: &OrchestrationPlan,
    inventory: &OrchestrationInventory,
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<OrchestrationExecutionResult> {
    execution::execute_plan(plan, inventory, plan_root, opts, record_level, event_hook).await
}

fn build_stage_result(
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

fn build_job_result(
    job: &OrchestrationJob,
    idx: usize,
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
        name: job_name(job, idx),
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

fn build_skipped_stage(
    stage: &OrchestrationStage,
    fail_fast: bool,
    jobs: Vec<JobExecutionResult>,
) -> StageExecutionResult {
    let mut stage_result = build_stage_result(stage, fail_fast, jobs);
    stage_result.status = StageStatus::Skipped;
    stage_result
}

fn build_skipped_job(
    job: &OrchestrationJob,
    idx: usize,
    fail_fast: bool,
    targets: &[OrchestrationTarget],
) -> JobExecutionResult {
    let results = targets
        .iter()
        .enumerate()
        .map(|(target_idx, target)| build_skipped_target(target, target_idx))
        .collect::<Vec<_>>();
    let mut job_result = build_job_result(job, idx, fail_fast, results);
    job_result.status = StageStatus::Skipped;
    job_result
}

fn build_skipped_target(target: &OrchestrationTarget, idx: usize) -> TargetExecutionResult {
    TargetExecutionResult {
        label: target_label(target, idx),
        connection_name: target.connection.clone(),
        host: target.host.clone(),
        status: TargetStatus::Skipped,
        operation: "skipped".to_string(),
        duration_ms: 0,
        error: Some("skipped due to fail_fast".to_string()),
        tx_result: None,
        workflow_result: None,
        recording_jsonl: None,
        compensation: None,
    }
}

fn target_label(target: &OrchestrationTarget, idx: usize) -> String {
    target
        .name
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(str::to_string)
        .or_else(|| target.connection.clone())
        .or_else(|| target.host.clone())
        .unwrap_or_else(|| format!("target-{}", idx + 1))
}

fn job_name(job: &OrchestrationJob, idx: usize) -> String {
    job.name
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| format!("job-{}", idx + 1))
}

fn action_kind_name(action: &OrchestrationAction) -> &'static str {
    match action {
        OrchestrationAction::TxBlock(_) => "tx_block",
        OrchestrationAction::TxWorkflow(_) => "tx_workflow",
    }
}

fn action_summary(action: &OrchestrationAction) -> String {
    match action {
        OrchestrationAction::TxBlock(spec) => {
            let mut parts = Vec::new();
            if let Some(name) = spec
                .tx_block_template_name
                .as_deref()
                .filter(|name| !name.trim().is_empty())
            {
                parts.push(format!("tx_block_template={}", name));
            } else if spec
                .tx_block_template_content
                .as_deref()
                .is_some_and(|content| !content.trim().is_empty())
            {
                parts.push("tx_block_template_content=inline".to_string());
            }
            if let Some(name) = spec
                .flow_template_name
                .as_deref()
                .filter(|name| !name.trim().is_empty())
            {
                parts.push(format!("flow_template={}", name));
            } else if spec
                .flow_template_content
                .as_deref()
                .is_some_and(|content| !content.trim().is_empty())
            {
                parts.push("flow_template_content=inline".to_string());
            }
            if let Some(template) = &spec.template {
                parts.push(format!("template={}", template));
            }
            if !spec.commands.is_empty() {
                parts.push(format!("commands={}", spec.commands.len()));
            }
            if let Some(mode) = &spec.mode {
                parts.push(format!("mode={}", mode));
            }
            if parts.is_empty() {
                "tx block".to_string()
            } else {
                parts.join(", ")
            }
        }
        OrchestrationAction::TxWorkflow(spec) => {
            if let Some(name) = spec
                .workflow_template_name
                .as_deref()
                .filter(|name| !name.trim().is_empty())
            {
                format!("workflow_template={}", name)
            } else if spec
                .workflow_template_content
                .as_deref()
                .is_some_and(|content| !content.trim().is_empty())
            {
                "workflow_template_content=inline".to_string()
            } else if let Some(path) = &spec.workflow_file {
                format!("workflow_file={}", path.to_string_lossy())
            } else {
                "inline workflow".to_string()
            }
        }
    }
}

#[cfg(test)]
mod tests;
