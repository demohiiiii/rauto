use crate::cli::{GlobalOpts, JsonTemplateCommands, RecordLevelOpt};
use crate::config::content_store;
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::ssh_security::SshSecurityProfile;
use crate::domain::orchestration::{
    action_kind_name, action_summary, build_job_result, build_stage_result, job_name,
};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;
use std::sync::Arc;

mod execution;
mod execution_actions;
mod preview;
mod render;
mod targets;
mod template_resolver;
mod validation;
pub(crate) use self::preview::preview_plan_commands;
pub(crate) use self::validation::validate_plan;
pub use crate::domain::orchestration::{
    CompensationExecutionResult, JobExecutionResult, OrchestrationAction,
    OrchestrationExecutionResult, OrchestrationJob, OrchestrationPlan, OrchestrationRuntimeEvent,
    OrchestrationStage, StageExecutionResult, StageStatus, StageStrategy, TargetExecutionResult,
    TargetStatus, TxWorkflowAction,
};
pub(crate) use render::{render_execution_result, render_plan};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OrchestrationTarget {
    pub name: Option<String>,
    pub connection: Option<String>,
    #[serde(default)]
    pub credential_id: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub ssh_security: Option<SshSecurityProfile>,
    pub linux_shell_flavor: Option<LinuxShellFlavor>,
    pub device_profile: Option<String>,
    #[serde(default)]
    pub vars: Value,
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

pub type OrchestrationEventHook = Arc<dyn Fn(OrchestrationRuntimeEvent) + Send + Sync>;

pub fn run_orchestration_template_command(cmd: JsonTemplateCommands) -> Result<()> {
    match cmd {
        JsonTemplateCommands::List => {
            let items = content_store::list_orchestration_templates()?;
            if items.is_empty() {
                println!("-");
            } else {
                for item in items {
                    println!("- {}", item.name);
                }
            }
        }
        JsonTemplateCommands::Show { name } => {
            let safe_name = crate::cli::json_templates::safe_json_template_name(&name)?;
            let stored =
                content_store::load_orchestration_template(&safe_name)?.ok_or_else(|| {
                    anyhow::anyhow!("orchestration template '{}' not found", safe_name)
                })?;
            println!("{}", stored.content);
        }
        JsonTemplateCommands::Create {
            name,
            file,
            content,
        } => {
            let safe_name = crate::cli::json_templates::safe_json_template_name(&name)?;
            let body = crate::cli::json_templates::read_json_template_body(
                crate::cli::json_templates::JsonTemplateKind::Orchestration,
                file,
                content,
            )?;
            let created = content_store::create_orchestration_template(&safe_name, &body)?;
            if !created {
                return Err(anyhow::anyhow!(
                    "orchestration template '{}' already exists",
                    safe_name
                ));
            }
            println!("Created orchestration template '{}'", safe_name);
        }
        JsonTemplateCommands::Update {
            name,
            file,
            content,
        } => {
            let safe_name = crate::cli::json_templates::safe_json_template_name(&name)?;
            let body = crate::cli::json_templates::read_json_template_body(
                crate::cli::json_templates::JsonTemplateKind::Orchestration,
                file,
                content,
            )?;
            let updated = content_store::update_orchestration_template(&safe_name, &body)?;
            if !updated {
                return Err(anyhow::anyhow!(
                    "orchestration template '{}' not found",
                    safe_name
                ));
            }
            println!("Updated orchestration template '{}'", safe_name);
        }
        JsonTemplateCommands::Delete { name } => {
            let safe_name = crate::cli::json_templates::safe_json_template_name(&name)?;
            let deleted = content_store::delete_orchestration_template(&safe_name)?;
            if !deleted {
                return Err(anyhow::anyhow!(
                    "orchestration template '{}' not found",
                    safe_name
                ));
            }
            println!("Deleted orchestration template '{}'", safe_name);
        }
    }
    Ok(())
}

pub async fn execute_loaded_plan_with_events(
    plan: &OrchestrationPlan,
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<OrchestrationExecutionResult> {
    execution::execute_plan(plan, plan_root, opts, record_level, event_hook).await
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

#[cfg(test)]
mod tests;
