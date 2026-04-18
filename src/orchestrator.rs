use crate::cli::{GlobalOpts, OrchestrateArgs, RecordLevelOpt};
use crate::config::command_blacklist;
use crate::config::command_flow_vars::{ConnectionParamContext, resolve_runtime_var_aliases};
use crate::config::content_store;
use crate::config::connection_store::load_connection;
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::ssh_security::SshSecurityProfile;
use crate::config::template_connection_refs::enrich_context_with_connection_refs_from_value;
use crate::config::template_loader;
use crate::config::template_loader::DEFAULT_DEVICE_PROFILE;
use crate::template::renderer::Renderer;
use crate::tx_operation::build_command_tx_block;
use crate::{
    EffectiveConnection, manager_connection_request, manager_execution_context_with_security,
    persist_auto_recording_history_jsonl, to_record_level,
};
use anyhow::{Context, Result, anyhow};
use chrono::Utc;
use rneter::session::{MANAGER, TxBlock, TxWorkflow};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{HashMap, VecDeque};
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;
use tokio::task::JoinSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationPlan {
    pub name: String,
    #[serde(default = "default_fail_fast")]
    pub fail_fast: bool,
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
    #[serde(default)]
    pub target_groups: Vec<String>,
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
    let inventory = load_inventory(&plan, &plan_root)?;
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

    let result = execute_plan(&plan, &inventory, &plan_root, opts, args.record_level, None).await?;

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
    let inventory = load_inventory(&plan, plan_root)?;
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
    execute_plan(plan, inventory, plan_root, opts, record_level, event_hook).await
}

fn validate_plan(plan: &OrchestrationPlan, inventory: &OrchestrationInventory) -> Result<()> {
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
        if stage.target_groups.is_empty() && stage.targets.is_empty() {
            return Err(anyhow!(
                "stage '{}' must contain at least one target or target_groups entry",
                stage.name
            ));
        }
        if matches!(stage.strategy, StageStrategy::Parallel) && stage.max_parallel == Some(0) {
            return Err(anyhow!(
                "stage '{}' max_parallel must be greater than zero",
                stage.name
            ));
        }
        let resolved_targets = resolve_stage_targets(stage, inventory)?;
        if resolved_targets.is_empty() {
            return Err(anyhow!("stage '{}' resolved no targets", stage.name));
        }
        match &stage.action {
            OrchestrationAction::TxBlock(action) => validate_tx_block_action(stage, action)?,
            OrchestrationAction::TxWorkflow(action) => validate_tx_workflow_action(stage, action)?,
        }
    }
    Ok(())
}

fn validate_tx_block_action(stage: &OrchestrationStage, action: &TxBlockAction) -> Result<()> {
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
    let has_commands = action.commands.iter().any(|s| !s.trim().is_empty());
    if has_tx_block_template_name && has_tx_block_template_content {
        return Err(anyhow!(
            "stage '{}' tx_block uses either tx_block_template_name or tx_block_template_content, not both",
            stage.name
        ));
    }
    if has_tx_block_template_source && (has_template || has_commands) {
        return Err(anyhow!(
            "stage '{}' tx_block template source cannot be combined with template/commands",
            stage.name
        ));
    }
    if !has_tx_block_template_source && !has_template && !has_commands {
        return Err(anyhow!(
            "stage '{}' tx_block requires tx_block_template_name/tx_block_template_content or 'template'/non-empty 'commands'",
            stage.name
        ));
    }
    if action.rollback_trigger_step_index.is_some() && action.resource_rollback_command.is_none() {
        return Err(anyhow!(
            "stage '{}' rollback_trigger_step_index requires resource_rollback_command",
            stage.name
        ));
    }
    Ok(())
}

fn validate_tx_workflow_action(
    stage: &OrchestrationStage,
    action: &TxWorkflowAction,
) -> Result<()> {
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
            "stage '{}' tx_workflow uses either workflow_template_name or workflow_template_content, not both",
            stage.name
        ));
    }
    let source_count = [has_file, has_inline, has_template_name, has_template_content]
        .into_iter()
        .filter(|item| *item)
        .count();
    if source_count != 1 {
        return Err(anyhow!(
            "stage '{}' tx_workflow requires exactly one source: workflow_file/workflow/workflow_template_name/workflow_template_content",
            stage.name
        ));
    }
    Ok(())
}

fn load_inventory(plan: &OrchestrationPlan, plan_root: &Path) -> Result<OrchestrationInventory> {
    let file_inventory = match &plan.inventory_file {
        Some(path) => {
            let resolved = if path.is_absolute() {
                path.clone()
            } else {
                plan_root.join(path)
            };
            let text = fs::read_to_string(&resolved).with_context(|| {
                format!(
                    "failed to read inventory file '{}'",
                    resolved.to_string_lossy()
                )
            })?;
            Some(
                serde_json::from_str::<OrchestrationInventory>(&text).with_context(|| {
                    format!(
                        "failed to parse inventory file '{}'",
                        resolved.to_string_lossy()
                    )
                })?,
            )
        }
        None => None,
    };

    let mut merged = file_inventory.unwrap_or_default();
    if let Some(inline) = &plan.inventory {
        merged.defaults = merge_target_defaults(&merged.defaults, &inline.defaults);
        for (group, value) in &inline.groups {
            merged.groups.insert(group.clone(), value.clone());
        }
    }
    Ok(merged)
}

fn merge_target_defaults(
    base: &OrchestrationTargetDefaults,
    overlay: &OrchestrationTargetDefaults,
) -> OrchestrationTargetDefaults {
    OrchestrationTargetDefaults {
        username: overlay.username.clone().or_else(|| base.username.clone()),
        password: overlay.password.clone().or_else(|| base.password.clone()),
        port: overlay.port.or(base.port),
        enable_password: overlay
            .enable_password
            .clone()
            .or_else(|| base.enable_password.clone()),
        ssh_security: overlay.ssh_security.or(base.ssh_security),
        linux_shell_flavor: overlay.linux_shell_flavor.or(base.linux_shell_flavor),
        device_profile: overlay
            .device_profile
            .clone()
            .or_else(|| base.device_profile.clone()),
        template_dir: overlay
            .template_dir
            .clone()
            .or_else(|| base.template_dir.clone()),
        vars: merge_values(&base.vars, &overlay.vars),
    }
}

fn inventory_group_spec(group: &InventoryGroup) -> InventoryGroupSpec {
    match group {
        InventoryGroup::Targets(targets) => InventoryGroupSpec {
            defaults: OrchestrationTargetDefaults::default(),
            targets: targets.clone(),
        },
        InventoryGroup::Detailed(spec) => spec.clone(),
    }
}

fn apply_target_defaults(
    defaults: &OrchestrationTargetDefaults,
    mut target: OrchestrationTarget,
) -> OrchestrationTarget {
    if target.username.is_none() {
        target.username = defaults.username.clone();
    }
    if target.password.is_none() {
        target.password = defaults.password.clone();
    }
    if target.port.is_none() {
        target.port = defaults.port;
    }
    if target.enable_password.is_none() {
        target.enable_password = defaults.enable_password.clone();
    }
    if target.ssh_security.is_none() {
        target.ssh_security = defaults.ssh_security;
    }
    if target.linux_shell_flavor.is_none() {
        target.linux_shell_flavor = defaults.linux_shell_flavor;
    }
    if target.device_profile.is_none() {
        target.device_profile = defaults.device_profile.clone();
    }
    if target.template_dir.is_none() {
        target.template_dir = defaults.template_dir.clone();
    }
    target.vars = merge_values(&defaults.vars, &target.vars);
    target
}

fn expand_targets_with_defaults(
    inputs: &[OrchestrationTargetInput],
    defaults: &OrchestrationTargetDefaults,
) -> Vec<OrchestrationTarget> {
    expand_targets(inputs)
        .into_iter()
        .map(|target| apply_target_defaults(defaults, target))
        .collect()
}

fn resolve_stage_targets(
    stage: &OrchestrationStage,
    inventory: &OrchestrationInventory,
) -> Result<Vec<OrchestrationTarget>> {
    let mut targets = Vec::new();
    for group_name in &stage.target_groups {
        let normalized = group_name.trim();
        if normalized.is_empty() {
            return Err(anyhow!(
                "stage '{}' has empty target_groups entry",
                stage.name
            ));
        }
        let group = inventory.groups.get(normalized).ok_or_else(|| {
            anyhow!(
                "stage '{}' references unknown inventory group '{}'",
                stage.name,
                normalized
            )
        })?;
        let group_spec = inventory_group_spec(group);
        let merged_defaults = merge_target_defaults(&inventory.defaults, &group_spec.defaults);
        targets.extend(expand_targets_with_defaults(
            &group_spec.targets,
            &merged_defaults,
        ));
    }
    targets.extend(expand_targets_with_defaults(
        &stage.targets,
        &inventory.defaults,
    ));
    Ok(targets)
}

async fn execute_plan(
    plan: &OrchestrationPlan,
    inventory: &OrchestrationInventory,
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<OrchestrationExecutionResult> {
    let mut stages = Vec::with_capacity(plan.stages.len());
    let mut failed = false;

    for (stage_idx, stage) in plan.stages.iter().enumerate() {
        if failed && plan.fail_fast {
            let targets = resolve_stage_targets(stage, inventory)?;
            emit_orchestration_event(
                &event_hook,
                OrchestrationRuntimeEvent {
                    event_type: "warning".to_string(),
                    message: format!("Skipping stage '{}' due to fail-fast", stage.name),
                    level: "warning".to_string(),
                    stage: Some("orchestrate".to_string()),
                    progress: task_progress(stage_idx, plan.stages.len()),
                    details: Some(serde_json::json!({
                        "plan_name": plan.name,
                        "stage_name": stage.name,
                        "reason": "fail_fast"
                    })),
                },
            );
            stages.push(build_skipped_stage(
                stage,
                stage.fail_fast.unwrap_or(plan.fail_fast),
                &targets,
            ));
            continue;
        }

        emit_orchestration_event(
            &event_hook,
            OrchestrationRuntimeEvent {
                event_type: "step_started".to_string(),
                message: format!("Stage '{}' started", stage.name),
                level: "info".to_string(),
                stage: Some("orchestrate".to_string()),
                progress: task_progress(stage_idx, plan.stages.len()),
                details: Some(serde_json::json!({
                    "plan_name": plan.name,
                    "stage_name": stage.name,
                    "strategy": stage.strategy,
                    "target_count": resolve_stage_targets(stage, inventory)?.len()
                })),
            },
        );
        let stage_result = execute_stage(
            plan,
            inventory,
            stage,
            plan_root,
            opts,
            record_level,
            event_hook.clone(),
        )
        .await?;
        emit_orchestration_event(
            &event_hook,
            OrchestrationRuntimeEvent {
                event_type: "step_completed".to_string(),
                message: format!("Stage '{}' finished", stage.name),
                level: if matches!(stage_result.status, StageStatus::Failed) {
                    "error".to_string()
                } else {
                    "success".to_string()
                },
                stage: Some("orchestrate".to_string()),
                progress: task_progress(stage_idx + 1, plan.stages.len()),
                details: Some(serde_json::json!({
                    "plan_name": plan.name,
                    "stage_name": stage.name,
                    "status": stage_result.status,
                    "targets_succeeded": stage_result.targets_succeeded,
                    "targets_failed": stage_result.targets_failed,
                    "targets_skipped": stage_result.targets_skipped
                })),
            },
        );
        if matches!(stage_result.status, StageStatus::Failed) {
            failed = true;
        }
        stages.push(stage_result);
    }

    let executed_stages = stages
        .iter()
        .filter(|stage| !matches!(stage.status, StageStatus::Skipped))
        .count();
    let success = !stages
        .iter()
        .any(|stage| matches!(stage.status, StageStatus::Failed));

    Ok(OrchestrationExecutionResult {
        plan_name: plan.name.clone(),
        success,
        fail_fast: plan.fail_fast,
        total_stages: plan.stages.len(),
        executed_stages,
        stages,
    })
}

async fn execute_stage(
    plan: &OrchestrationPlan,
    inventory: &OrchestrationInventory,
    stage: &OrchestrationStage,
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<StageExecutionResult> {
    let fail_fast = stage.fail_fast.unwrap_or(plan.fail_fast);
    let targets = resolve_stage_targets(stage, inventory)?;
    let results = match stage.strategy {
        StageStrategy::Serial => {
            execute_serial_stage(
                plan,
                stage,
                &targets,
                plan_root,
                opts,
                record_level,
                fail_fast,
                event_hook.clone(),
            )
            .await?
        }
        StageStrategy::Parallel => {
            execute_parallel_stage(
                plan,
                stage,
                &targets,
                plan_root,
                opts,
                record_level,
                fail_fast,
                event_hook.clone(),
            )
            .await?
        }
    };

    Ok(build_stage_result(stage, fail_fast, results))
}

#[allow(clippy::too_many_arguments)]
async fn execute_serial_stage(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    targets: &[OrchestrationTarget],
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    fail_fast: bool,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<Vec<TargetExecutionResult>> {
    let mut results = Vec::with_capacity(targets.len());
    for (idx, target) in targets.iter().enumerate() {
        let result = execute_target(
            plan,
            stage,
            target,
            idx,
            plan_root,
            opts,
            record_level,
            event_hook.clone(),
        )
        .await;
        let is_failed = matches!(result.status, TargetStatus::Failed);
        results.push(result);
        if is_failed && fail_fast {
            for (remaining_idx, remaining_target) in targets.iter().enumerate().skip(idx + 1) {
                results.push(build_skipped_target(remaining_target, remaining_idx));
            }
            break;
        }
    }
    Ok(results)
}

#[allow(clippy::too_many_arguments)]
async fn execute_parallel_stage(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    targets: &[OrchestrationTarget],
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    fail_fast: bool,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<Vec<TargetExecutionResult>> {
    let concurrency = stage
        .max_parallel
        .unwrap_or(4)
        .max(1)
        .min(targets.len().max(1));
    let mut pending: VecDeque<(usize, OrchestrationTarget)> =
        targets.iter().cloned().enumerate().collect();
    let mut join_set = JoinSet::new();
    let mut results: Vec<Option<TargetExecutionResult>> = std::iter::repeat_with(|| None)
        .take(targets.len())
        .collect();
    let plan_owned = plan.clone();
    let stage_owned = stage.clone();
    let opts_owned = opts.clone();
    let plan_root_owned = plan_root.to_path_buf();
    let mut stop_spawning = false;

    while !pending.is_empty() || !join_set.is_empty() {
        while !stop_spawning && join_set.len() < concurrency && !pending.is_empty() {
            let (idx, target) = pending.pop_front().expect("pending target");
            let plan_cloned = plan_owned.clone();
            let stage_cloned = stage_owned.clone();
            let opts_cloned = opts_owned.clone();
            let plan_root_cloned = plan_root_owned.clone();
            let event_hook_cloned = event_hook.clone();
            join_set.spawn(async move {
                let result = execute_target(
                    &plan_cloned,
                    &stage_cloned,
                    &target,
                    idx,
                    &plan_root_cloned,
                    &opts_cloned,
                    record_level,
                    event_hook_cloned,
                )
                .await;
                (idx, result)
            });
        }

        let Some(joined) = join_set.join_next().await else {
            break;
        };
        let (idx, result) = joined.map_err(|e| anyhow!("parallel stage task failed: {}", e))?;
        if matches!(result.status, TargetStatus::Failed) && fail_fast {
            stop_spawning = true;
        }
        results[idx] = Some(result);
    }

    for (idx, target) in pending {
        results[idx] = Some(build_skipped_target(&target, idx));
    }

    Ok(results
        .into_iter()
        .enumerate()
        .map(|(idx, item)| item.unwrap_or_else(|| build_skipped_target(&targets[idx], idx)))
        .collect())
}

#[allow(clippy::too_many_arguments)]
async fn execute_target(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    target: &OrchestrationTarget,
    idx: usize,
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    event_hook: Option<OrchestrationEventHook>,
) -> TargetExecutionResult {
    let label = target_label(target, idx);
    let started = Instant::now();
    emit_orchestration_event(
        &event_hook,
        OrchestrationRuntimeEvent {
            event_type: "step_started".to_string(),
            message: format!("Target '{}' started", label),
            level: "info".to_string(),
            stage: Some("orchestrate".to_string()),
            progress: None,
            details: Some(serde_json::json!({
                "plan_name": plan.name,
                "stage_name": stage.name,
                "target_label": label,
                "target_index": idx + 1,
                "connection_name": target.connection,
                "host": target.host
            })),
        },
    );

    let resolved = resolve_target_connection(opts, target);
    let conn = match resolved {
        Ok(conn) => conn,
        Err(e) => {
            emit_orchestration_event(
                &event_hook,
                OrchestrationRuntimeEvent {
                    event_type: "failed".to_string(),
                    message: format!("Target '{}' resolution failed", label),
                    level: "error".to_string(),
                    stage: Some("orchestrate".to_string()),
                    progress: None,
                    details: Some(serde_json::json!({
                        "plan_name": plan.name,
                        "stage_name": stage.name,
                        "target_label": label,
                        "error": e.to_string()
                    })),
                },
            );
            return TargetExecutionResult {
                label,
                connection_name: target.connection.clone(),
                host: target.host.clone(),
                status: TargetStatus::Failed,
                operation: action_kind_name(&stage.action).to_string(),
                duration_ms: started.elapsed().as_millis(),
                error: Some(e.to_string()),
                tx_result: None,
                workflow_result: None,
                recording_jsonl: None,
            };
        }
    };

    match execute_action(plan, stage, target, &conn, plan_root, record_level).await {
        Ok(outcome) => {
            let target_succeeded = outcome.success;
            emit_orchestration_event(
                &event_hook,
                OrchestrationRuntimeEvent {
                    event_type: if target_succeeded {
                        "step_completed".to_string()
                    } else {
                        "failed".to_string()
                    },
                    message: if target_succeeded {
                        format!("Target '{}' completed", label)
                    } else {
                        format!("Target '{}' finished with failure", label)
                    },
                    level: if target_succeeded {
                        "success".to_string()
                    } else {
                        "error".to_string()
                    },
                    stage: Some("orchestrate".to_string()),
                    progress: None,
                    details: Some(serde_json::json!({
                        "plan_name": plan.name,
                        "stage_name": stage.name,
                        "target_label": label,
                        "connection_name": conn.connection_name,
                        "host": conn.host,
                        "operation": outcome.operation,
                        "error": outcome.error
                    })),
                },
            );
            TargetExecutionResult {
                label,
                connection_name: conn.connection_name.clone(),
                host: Some(conn.host.clone()),
                status: if target_succeeded {
                    TargetStatus::Success
                } else {
                    TargetStatus::Failed
                },
                operation: outcome.operation,
                duration_ms: started.elapsed().as_millis(),
                error: outcome.error,
                tx_result: outcome.tx_result,
                workflow_result: outcome.workflow_result,
                recording_jsonl: outcome.recording_jsonl,
            }
        }
        Err(e) => {
            emit_orchestration_event(
                &event_hook,
                OrchestrationRuntimeEvent {
                    event_type: "failed".to_string(),
                    message: format!("Target '{}' failed", label),
                    level: "error".to_string(),
                    stage: Some("orchestrate".to_string()),
                    progress: None,
                    details: Some(serde_json::json!({
                        "plan_name": plan.name,
                        "stage_name": stage.name,
                        "target_label": label,
                        "connection_name": conn.connection_name,
                        "host": conn.host,
                        "error": e.to_string()
                    })),
                },
            );
            TargetExecutionResult {
                label,
                connection_name: conn.connection_name.clone(),
                host: Some(conn.host.clone()),
                status: TargetStatus::Failed,
                operation: action_kind_name(&stage.action).to_string(),
                duration_ms: started.elapsed().as_millis(),
                error: Some(e.to_string()),
                tx_result: None,
                workflow_result: None,
                recording_jsonl: None,
            }
        }
    }
}

fn emit_orchestration_event(
    hook: &Option<OrchestrationEventHook>,
    event: OrchestrationRuntimeEvent,
) {
    if let Some(hook) = hook {
        hook(event);
    }
}

fn task_progress(current: usize, total: usize) -> Option<u8> {
    if total == 0 {
        return None;
    }
    let pct = ((current as f64 / total as f64) * 100.0).round() as i64;
    Some(pct.clamp(0, 100) as u8)
}

async fn execute_action(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    target: &OrchestrationTarget,
    conn: &EffectiveConnection,
    plan_root: &Path,
    record_level: RecordLevelOpt,
) -> Result<ActionExecutionOutcome> {
    match &stage.action {
        OrchestrationAction::TxBlock(action) => {
            execute_tx_block_action(plan, stage, action, target, conn, record_level).await
        }
        OrchestrationAction::TxWorkflow(action) => {
            execute_tx_workflow_action(plan, stage, action, conn, plan_root, record_level).await
        }
    }
}

async fn execute_tx_block_action(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    action: &TxBlockAction,
    target: &OrchestrationTarget,
    conn: &EffectiveConnection,
    record_level: RecordLevelOpt,
) -> Result<ActionExecutionOutcome> {
    let (tx_block, mode, tx_block_name) =
        resolve_orchestration_tx_block(plan, stage, action, target, conn)?;

    command_blacklist::ensure_tx_block_allowed(
        &tx_block,
        &format!("orchestration tx block '{}'", tx_block_name),
    )?;

    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let request = manager_connection_request(
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
            manager_execution_context_with_security(None, conn.ssh_security),
            to_record_level(record_level),
        )
        .await?;
    let handler_for_tx = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let request = manager_connection_request(
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
            tx_block,
            manager_execution_context_with_security(None, conn.ssh_security),
        )
        .await?;
    let jsonl = recorder.to_jsonl()?;
    persist_auto_recording_history_jsonl(
        &jsonl,
        conn,
        "orchestrate_tx_block",
        &tx_block_name,
        Some(&mode),
        record_level,
    )?;
    let recording_jsonl = Some(jsonl);

    Ok(ActionExecutionOutcome {
        operation: format!("tx_block: {}", tx_block_name),
        success: tx_result.committed,
        error: if tx_result.committed {
            None
        } else {
            Some(format!(
                "tx block '{}' finished with failure",
                tx_block_name
            ))
        },
        tx_result: Some(serde_json::to_value(&tx_result)?),
        workflow_result: None,
        recording_jsonl,
    })
}

async fn execute_tx_workflow_action(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    action: &TxWorkflowAction,
    conn: &EffectiveConnection,
    plan_root: &Path,
    record_level: RecordLevelOpt,
) -> Result<ActionExecutionOutcome> {
    let workflow = load_workflow(action, plan_root, conn)?;
    let workflow_name = workflow.name.clone();
    let operation_name = format!("{}::{}::{}", plan.name, stage.name, workflow_name);
    command_blacklist::ensure_tx_workflow_allowed(
        &workflow,
        &format!("orchestration tx workflow '{}'", workflow_name),
    )?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let request = manager_connection_request(
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
            manager_execution_context_with_security(None, conn.ssh_security),
            to_record_level(record_level),
        )
        .await?;
    let handler_for_tx = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let request = manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
        conn.enable_password.clone(),
        handler_for_tx,
    );
    let workflow_result = MANAGER
        .execute_tx_workflow_with_context(
            request,
            workflow,
            manager_execution_context_with_security(None, conn.ssh_security),
        )
        .await?;
    let jsonl = recorder.to_jsonl()?;
    persist_auto_recording_history_jsonl(
        &jsonl,
        conn,
        "orchestrate_tx_workflow",
        &operation_name,
        None,
        record_level,
    )?;
    let recording_jsonl = Some(jsonl);

    Ok(ActionExecutionOutcome {
        operation: format!("tx_workflow: {}", workflow_name),
        success: workflow_result.committed,
        error: if workflow_result.committed {
            None
        } else {
            Some(format!(
                "tx workflow '{}' finished with failure",
                workflow_name
            ))
        },
        tx_result: None,
        workflow_result: Some(serde_json::to_value(&workflow_result)?),
        recording_jsonl,
    })
}

#[derive(Debug, serde::Deserialize)]
struct TxWorkflowBlockTemplateRefPayload {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    fail_fast: Option<bool>,
    #[serde(default)]
    tx_block_template_name: Option<String>,
    #[serde(default)]
    tx_block_template_content: Option<String>,
    #[serde(default)]
    tx_block_template_vars: Value,
}

fn resolve_orchestration_tx_block(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    action: &TxBlockAction,
    target: &OrchestrationTarget,
    conn: &EffectiveConnection,
) -> Result<(TxBlock, String, String)> {
    let has_block_template_name = action
        .tx_block_template_name
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let has_block_template_content = action
        .tx_block_template_content
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    if has_block_template_name || has_block_template_content {
        let mut tx_block = resolve_tx_block_from_template_source(
            action.tx_block_template_name.as_deref(),
            action.tx_block_template_content.as_deref(),
            action.tx_block_template_vars.clone(),
            conn,
        )?;
        if let Some(name) = action.name.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            tx_block.name = name.to_string();
        }
        tx_block.validate()?;
        let tx_block_name = if tx_block.name.trim().is_empty() {
            format!("{}::{}", plan.name, stage.name)
        } else {
            tx_block.name.clone()
        };
        let effective_mode = tx_block_primary_mode(&tx_block);
        return Ok((tx_block, effective_mode, tx_block_name));
    }

    let mode = action
        .mode
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("Config")
        .to_string();
    let merged_vars = merge_values(&action.vars, &target.vars);
    let merged_vars =
        resolve_runtime_var_aliases(merged_vars, Some(current_connection_param_context(conn)))?;
    let renderer = Renderer::new();
    let commands = resolve_block_commands(&renderer, action, merged_vars)?;
    let tx_block_name = action
        .name
        .clone()
        .unwrap_or_else(|| format!("{}::{}", plan.name, stage.name));

    let mut rollback_commands = action.rollback_commands.clone();
    while rollback_commands.len() > commands.len()
        && rollback_commands
            .last()
            .map(|s| s.trim().is_empty())
            .unwrap_or(false)
    {
        rollback_commands.pop();
    }

    let tx_block = build_command_tx_block(
        tx_block_name.clone(),
        &mode,
        &commands,
        &rollback_commands,
        action.timeout_secs,
        action.rollback_on_failure,
        action.resource_rollback_command.clone(),
        action.rollback_trigger_step_index,
        false,
    )?;
    Ok((tx_block, mode, tx_block_name))
}

fn resolve_block_commands(
    renderer: &Renderer,
    action: &TxBlockAction,
    vars: Value,
) -> Result<Vec<String>> {
    let mut commands = Vec::new();
    if let Some(template_name) = &action.template {
        let rendered = renderer.render_file(template_name, vars)?;
        commands.extend(
            rendered
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
        );
    }
    commands.extend(
        action
            .commands
            .iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
    );
    if commands.is_empty() {
        return Err(anyhow!("no executable commands resolved for tx_block"));
    }
    Ok(commands)
}

fn load_workflow(
    action: &TxWorkflowAction,
    plan_root: &Path,
    conn: &EffectiveConnection,
) -> Result<TxWorkflow> {
    let mut workflow_value = if let Some(name) = action
        .workflow_template_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let content = load_tx_workflow_template_content(name)?;
        let source: Value = serde_json::from_str(&content)
            .with_context(|| format!("failed to parse tx workflow template '{}'", name))?;
        render_json_template_source(&source, action.workflow_vars.clone(), conn)?
    } else if let Some(content) = action
        .workflow_template_content
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let source: Value = serde_json::from_str(content)
            .context("failed to parse workflow_template_content as JSON")?;
        render_json_template_source(&source, action.workflow_vars.clone(), conn)?
    } else if let Some(value) = &action.workflow {
        value.clone()
    } else {
        let path = action
            .workflow_file
            .as_ref()
            .ok_or_else(|| anyhow!("workflow_file is required"))?;
        let resolved = if path.is_absolute() {
            path.clone()
        } else {
            plan_root.join(path)
        };
        let text = fs::read_to_string(&resolved)
            .with_context(|| format!("failed to read workflow '{}'", resolved.to_string_lossy()))?;
        serde_json::from_str(&text)
            .with_context(|| format!("failed to parse workflow '{}'", resolved.to_string_lossy()))?
    };
    workflow_value = resolve_tx_workflow_blocks_from_templates(workflow_value, conn)?;
    serde_json::from_value(workflow_value).map_err(Into::into)
}

fn resolve_tx_workflow_blocks_from_templates(
    workflow: Value,
    conn: &EffectiveConnection,
) -> Result<Value> {
    let mut root = match workflow {
        Value::Object(map) => map,
        other => return Ok(other),
    };
    let blocks = root
        .get("blocks")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if blocks.is_empty() {
        return Ok(Value::Object(root));
    }

    let mut resolved_blocks = Vec::with_capacity(blocks.len());
    for block in blocks {
        let Some(block_obj) = block.as_object() else {
            resolved_blocks.push(block);
            continue;
        };
        let has_template_name = block_obj
            .get("tx_block_template_name")
            .and_then(Value::as_str)
            .map(str::trim)
            .is_some_and(|value| !value.is_empty());
        let has_template_content = block_obj
            .get("tx_block_template_content")
            .and_then(Value::as_str)
            .map(str::trim)
            .is_some_and(|value| !value.is_empty());
        if !has_template_name && !has_template_content {
            resolved_blocks.push(block);
            continue;
        }

        let block_ref: TxWorkflowBlockTemplateRefPayload =
            serde_json::from_value(Value::Object(block_obj.clone()))?;
        let mut tx_block = resolve_tx_block_from_template_source(
            block_ref.tx_block_template_name.as_deref(),
            block_ref.tx_block_template_content.as_deref(),
            block_ref.tx_block_template_vars,
            conn,
        )?;
        if let Some(name) = block_ref.name.filter(|value| !value.trim().is_empty()) {
            tx_block.name = name;
        }
        if let Some(fail_fast) = block_ref.fail_fast {
            tx_block.fail_fast = fail_fast;
        }
        tx_block.validate()?;
        resolved_blocks.push(serde_json::to_value(&tx_block)?);
    }

    root.insert("blocks".to_string(), Value::Array(resolved_blocks));
    Ok(Value::Object(root))
}

fn resolve_tx_block_from_template_source(
    template_name: Option<&str>,
    template_content: Option<&str>,
    template_vars: Value,
    conn: &EffectiveConnection,
) -> Result<TxBlock> {
    let source = load_tx_block_template_source_value(template_name, template_content)?;
    let rendered_value = render_json_template_source(&source, template_vars, conn)?;
    let tx_block: TxBlock = serde_json::from_value(rendered_value)?;
    Ok(tx_block)
}

fn load_tx_block_template_source_value(
    template_name: Option<&str>,
    template_content: Option<&str>,
) -> Result<Value> {
    match (
        template_name
            .map(str::trim)
            .filter(|value| !value.is_empty()),
        template_content
            .map(str::trim)
            .filter(|value| !value.is_empty()),
    ) {
        (Some(name), None) => {
            let content = load_tx_block_template_content(name)?;
            serde_json::from_str(&content)
                .with_context(|| format!("failed to parse tx block template '{}'", name))
        }
        (None, Some(content)) => {
            serde_json::from_str(content).context("failed to parse tx_block_template_content")
        }
        (Some(_), Some(_)) => Err(anyhow!(
            "use either tx_block_template_name or tx_block_template_content"
        )),
        (None, None) => Err(anyhow!(
            "tx block template source requires tx_block_template_name or tx_block_template_content"
        )),
    }
}

fn load_tx_block_template_content(name: &str) -> Result<String> {
    let safe_name = name.trim();
    if safe_name.is_empty() {
        return Err(anyhow!("tx block template name is required"));
    }
    content_store::load_tx_block_template(safe_name)?
        .map(|item| item.content)
        .ok_or_else(|| anyhow!("tx block template '{}' not found", safe_name))
}

fn load_tx_workflow_template_content(name: &str) -> Result<String> {
    let safe_name = name.trim();
    if safe_name.is_empty() {
        return Err(anyhow!("tx workflow template name is required"));
    }
    content_store::load_tx_workflow_template(safe_name)?
        .map(|item| item.content)
        .ok_or_else(|| anyhow!("tx workflow template '{}' not found", safe_name))
}

fn render_json_template_source(
    source: &Value,
    vars: Value,
    conn: &EffectiveConnection,
) -> Result<Value> {
    let resolved_vars = resolve_runtime_var_aliases(vars, Some(current_connection_param_context(conn)))?;
    let mut context = build_stage_json_template_context(resolved_vars, conn);
    enrich_context_with_connection_refs_from_value(&mut context, source)?;
    let renderer = Renderer::new();
    render_json_template_value(source, &mut context, &renderer)
}

fn build_stage_json_template_context(vars: Value, conn: &EffectiveConnection) -> Value {
    let vars_for_root = vars.clone();
    let mut root = serde_json::Map::new();
    root.insert("vars".to_string(), vars_for_root);
    root.insert(
        "now".to_string(),
        json!({
            "rfc3339": Utc::now().to_rfc3339(),
            "timestamp_ms": Utc::now().timestamp_millis()
        }),
    );
    let mut flattened = serde_json::Map::new();
    let mut connection = json!({
        "name": conn.connection_name,
        "host": conn.host,
        "username": conn.username,
        "password": conn.password,
        "port": conn.port,
        "enable_password": conn.enable_password,
        "ssh_security": conn.ssh_security,
        "linux_shell_flavor": conn.linux_shell_flavor,
        "device_profile": conn.device_profile,
        "vars": conn.vars
    });
    if let Some(name) = conn.connection_name.as_deref()
        && let Ok(saved) = load_connection(name)
    {
        connection["saved"] = json!({
            "enabled": saved.enabled,
            "labels": saved.labels,
            "groups": saved.groups,
            "vars": saved.vars
        });
    }
    root.insert("connection".to_string(), connection);

    if let Some(name) = conn.connection_name.as_deref()
        && !name.trim().is_empty()
    {
        flattened.insert("name".to_string(), Value::String(name.to_string()));
        flattened.insert(
            "connection_name".to_string(),
            Value::String(name.to_string()),
        );
    }
    flattened.insert("host".to_string(), Value::String(conn.host.clone()));
    flattened.insert("username".to_string(), Value::String(conn.username.clone()));
    flattened.insert("password".to_string(), Value::String(conn.password.clone()));
    flattened.insert("port".to_string(), Value::Number(conn.port.into()));
    if let Some(value) = conn.enable_password.clone() {
        flattened.insert("enable_password".to_string(), Value::String(value));
    }
    flattened.insert(
        "ssh_security".to_string(),
        Value::String(conn.ssh_security.to_string()),
    );
    if let Some(value) = conn.linux_shell_flavor {
        flattened.insert(
            "linux_shell_flavor".to_string(),
            Value::String(value.to_string()),
        );
    }
    flattened.insert(
        "device_profile".to_string(),
        Value::String(conn.device_profile.clone()),
    );
    if let Some(map) = conn.vars.as_object() {
        for (key, value) in map {
            flattened
                .entry(key.clone())
                .or_insert_with(|| value.clone());
        }
    }

    if let Some(map) = vars.as_object() {
        for (key, value) in map {
            flattened.insert(key.clone(), value.clone());
        }
    }
    for (key, value) in flattened {
        if matches!(key.as_str(), "vars" | "connection" | "now" | "defaults") {
            continue;
        }
        root.insert(key, value);
    }
    Value::Object(root)
}

fn render_json_template_value(
    input: &Value,
    context: &mut Value,
    renderer: &Renderer,
) -> Result<Value> {
    match input {
        Value::Object(map) => {
            let mut out = serde_json::Map::with_capacity(map.len());
            for (k, v) in map {
                out.insert(k.clone(), render_json_template_value(v, context, renderer)?);
            }
            Ok(Value::Object(out))
        }
        Value::Array(items) => {
            let mut out = Vec::with_capacity(items.len());
            for item in items {
                out.push(render_json_template_value(item, context, renderer)?);
            }
            Ok(Value::Array(out))
        }
        Value::String(text) => {
            if !text.contains("{{") && !text.contains("{%") {
                return Ok(Value::String(text.clone()));
            }
            let rendered = renderer.render_string(text, context.clone())?;
            let trimmed = rendered.trim();
            if trimmed.is_empty() {
                return Ok(Value::String(rendered));
            }
            if let Ok(parsed) = serde_json::from_str::<Value>(trimmed) {
                return Ok(parsed);
            }
            Ok(Value::String(rendered))
        }
        _ => Ok(input.clone()),
    }
}

fn tx_block_primary_mode(tx_block: &TxBlock) -> String {
    tx_block
        .steps
        .first()
        .and_then(|step| step.run.summary().ok())
        .map(|summary| summary.mode)
        .unwrap_or_else(|| "-".to_string())
}

fn expand_targets(inputs: &[OrchestrationTargetInput]) -> Vec<OrchestrationTarget> {
    inputs
        .iter()
        .map(|item| match item {
            OrchestrationTargetInput::ConnectionName(name) => OrchestrationTarget {
                connection: Some(name.clone()),
                ..OrchestrationTarget::default()
            },
            OrchestrationTargetInput::Detailed(target) => target.as_ref().clone(),
        })
        .collect()
}

fn resolve_target_connection(
    opts: &GlobalOpts,
    target: &OrchestrationTarget,
) -> Result<EffectiveConnection> {
    let saved = if let Some(name) = &target.connection {
        Some(load_connection(name)?)
    } else if let Some(name) = &opts.connection {
        Some(load_connection(name)?)
    } else {
        None
    };

    let host = target
        .host
        .clone()
        .or_else(|| opts.host.clone())
        .or_else(|| saved.as_ref().and_then(|s| s.host.clone()))
        .ok_or_else(|| anyhow!("host is required (target.connection or target.host)"))?;
    let username = target
        .username
        .clone()
        .or_else(|| opts.username.clone())
        .or_else(|| saved.as_ref().and_then(|s| s.username.clone()))
        .unwrap_or_else(|| "admin".to_string());
    let password = target
        .password
        .clone()
        .or_else(|| opts.password.clone())
        .or_else(|| saved.as_ref().and_then(|s| s.password.clone()))
        .or_else(|| std::env::var("RAUTO_PASSWORD").ok())
        .unwrap_or_default();
    let port = target
        .port
        .or(opts.port)
        .or_else(|| saved.as_ref().and_then(|s| s.port))
        .unwrap_or(22);
    let enable_password = target
        .enable_password
        .clone()
        .or_else(|| opts.enable_password.clone())
        .or_else(|| saved.as_ref().and_then(|s| s.enable_password.clone()));
    let device_profile = target
        .device_profile
        .clone()
        .or_else(|| opts.device_profile.clone())
        .or_else(|| saved.as_ref().and_then(|s| s.device_profile.clone()))
        .unwrap_or_else(|| DEFAULT_DEVICE_PROFILE.to_string());
    let ssh_security = target
        .ssh_security
        .or(opts.ssh_security)
        .or_else(|| saved.as_ref().and_then(|s| s.ssh_security))
        .unwrap_or_default();
    let linux_shell_flavor = target
        .linux_shell_flavor
        .or(opts.linux_shell_flavor)
        .or_else(|| saved.as_ref().and_then(|s| s.linux_shell_flavor));
    let template_dir = target
        .template_dir
        .as_ref()
        .map(PathBuf::from)
        .or_else(|| opts.template_dir.clone())
        .or_else(|| {
            saved
                .as_ref()
                .and_then(|s| s.template_dir.clone().map(PathBuf::from))
        });

    Ok(EffectiveConnection {
        connection_name: target
            .connection
            .clone()
            .or_else(|| opts.connection.clone()),
        host,
        username,
        password,
        port,
        enable_password,
        ssh_security,
        linux_shell_flavor,
        device_profile,
        vars: saved
            .as_ref()
            .map(|s| s.vars.clone())
            .unwrap_or_else(|| serde_json::json!({})),
        template_dir,
    })
}

fn current_connection_param_context(conn: &EffectiveConnection) -> ConnectionParamContext {
    ConnectionParamContext::new(
        conn.connection_name.as_deref(),
        Some(&conn.host),
        Some(&conn.username),
        Some(&conn.password),
        Some(conn.port),
        conn.enable_password.as_deref(),
        Some(conn.ssh_security),
        conn.linux_shell_flavor,
        Some(&conn.device_profile),
        &conn.vars,
    )
}

fn merge_values(base: &Value, overlay: &Value) -> Value {
    match (base, overlay) {
        (_, Value::Null) => base.clone(),
        (Value::Null, _) => overlay.clone(),
        (Value::Object(base_obj), Value::Object(overlay_obj)) => {
            let mut merged = base_obj.clone();
            for (key, value) in overlay_obj {
                let next = match merged.get(key) {
                    Some(existing) => merge_values(existing, value),
                    None => value.clone(),
                };
                merged.insert(key.clone(), next);
            }
            Value::Object(merged)
        }
        (_, _) => overlay.clone(),
    }
}

fn build_stage_result(
    stage: &OrchestrationStage,
    fail_fast: bool,
    results: Vec<TargetExecutionResult>,
) -> StageExecutionResult {
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
    } else if targets_skipped == targets_total {
        StageStatus::Skipped
    } else {
        StageStatus::Success
    };

    StageExecutionResult {
        name: stage.name.clone(),
        strategy: stage.strategy,
        status,
        fail_fast,
        action_kind: action_kind_name(&stage.action).to_string(),
        action_summary: action_summary(&stage.action),
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
    targets: &[OrchestrationTarget],
) -> StageExecutionResult {
    let results = targets
        .iter()
        .enumerate()
        .map(|(idx, target)| build_skipped_target(target, idx))
        .collect::<Vec<_>>();
    StageExecutionResult {
        name: stage.name.clone(),
        strategy: stage.strategy,
        status: StageStatus::Skipped,
        fail_fast,
        action_kind: action_kind_name(&stage.action).to_string(),
        action_summary: action_summary(&stage.action),
        targets_total: results.len(),
        targets_succeeded: 0,
        targets_failed: 0,
        targets_skipped: results.len(),
        results,
    }
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

fn render_plan(
    plan: &OrchestrationPlan,
    inventory: &OrchestrationInventory,
    source: Option<&PathBuf>,
) -> Result<String> {
    let mut out = String::new();
    let _ = writeln!(&mut out, "# orchestration_plan: {}", plan.name);
    if let Some(path) = source {
        let _ = writeln!(&mut out, "file: {}", path.to_string_lossy());
    }
    let _ = writeln!(
        &mut out,
        "overview: fail_fast={} stages={} inventory_groups={}",
        plan.fail_fast,
        plan.stages.len(),
        inventory.groups.len()
    );
    let _ = writeln!(&mut out);

    for (stage_idx, stage) in plan.stages.iter().enumerate() {
        let targets = resolve_stage_targets(stage, inventory)?;
        let _ = writeln!(
            &mut out,
            "[Stage {}/{}] {}",
            stage_idx + 1,
            plan.stages.len(),
            stage.name
        );
        let _ = writeln!(
            &mut out,
            "strategy={} fail_fast={} targets={} action={} ({})",
            match stage.strategy {
                StageStrategy::Serial => "serial",
                StageStrategy::Parallel => "parallel",
            },
            stage.fail_fast.unwrap_or(plan.fail_fast),
            targets.len(),
            action_kind_name(&stage.action),
            action_summary(&stage.action),
        );
        if let Some(max_parallel) = stage.max_parallel {
            let _ = writeln!(&mut out, "max_parallel={}", max_parallel);
        }
        if !stage.target_groups.is_empty() {
            let _ = writeln!(&mut out, "target_groups={}", stage.target_groups.join(", "));
        }
        for (idx, target) in targets.iter().enumerate() {
            let _ = writeln!(&mut out, "- {}", target_label(target, idx));
        }
        let _ = writeln!(&mut out);
    }

    Ok(out)
}

fn render_execution_result(result: &OrchestrationExecutionResult) -> String {
    let mut out = String::new();
    let _ = writeln!(&mut out, "# orchestration: {}", result.plan_name);
    let _ = writeln!(&mut out, "success: {}", result.success);
    let _ = writeln!(&mut out, "fail_fast: {}", result.fail_fast);
    let _ = writeln!(
        &mut out,
        "stages: executed={} total={}",
        result.executed_stages, result.total_stages
    );
    let _ = writeln!(&mut out);

    for stage in &result.stages {
        let _ = writeln!(
            &mut out,
            "[{}] {} strategy={:?} targets={} ok={} failed={} skipped={} action={}",
            match stage.status {
                StageStatus::Success => "SUCCESS",
                StageStatus::Failed => "FAILED",
                StageStatus::Skipped => "SKIPPED",
            },
            stage.name,
            stage.strategy,
            stage.targets_total,
            stage.targets_succeeded,
            stage.targets_failed,
            stage.targets_skipped,
            stage.action_kind,
        );
        let _ = writeln!(&mut out, "summary: {}", stage.action_summary);
        for target in &stage.results {
            let _ = writeln!(
                &mut out,
                "- [{}] {} host={} op={} duration_ms={}",
                match target.status {
                    TargetStatus::Success => "ok",
                    TargetStatus::Failed => "failed",
                    TargetStatus::Skipped => "skipped",
                },
                target.label,
                target.host.as_deref().unwrap_or("-"),
                target.operation,
                target.duration_ms,
            );
            if let Some(error) = &target.error {
                let _ = writeln!(&mut out, "  error: {}", error);
            }
        }
        let _ = writeln!(&mut out);
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn merge_values_recursively() {
        let base = json!({
            "device": {"name": "a", "region": "hz"},
            "vlan": 10
        });
        let overlay = json!({
            "device": {"name": "b"},
            "desc": "edge"
        });
        let merged = merge_values(&base, &overlay);
        assert_eq!(
            merged,
            json!({
                "device": {"name": "b", "region": "hz"},
                "vlan": 10,
                "desc": "edge"
            })
        );
    }

    #[test]
    fn plan_validation_rejects_empty_stage_targets() {
        let plan = OrchestrationPlan {
            name: "demo".to_string(),
            fail_fast: true,
            inventory_file: None,
            inventory: None,
            stages: vec![OrchestrationStage {
                name: "stage-1".to_string(),
                strategy: StageStrategy::Serial,
                max_parallel: None,
                fail_fast: None,
                target_groups: Vec::new(),
                targets: Vec::new(),
                action: OrchestrationAction::TxBlock(TxBlockAction {
                    name: None,
                    template: None,
                    tx_block_template_name: None,
                    tx_block_template_content: None,
                    tx_block_template_vars: Value::Null,
                    vars: Value::Null,
                    commands: vec!["show ver".to_string()],
                    rollback_commands: Vec::new(),
                    rollback_on_failure: false,
                    rollback_trigger_step_index: None,
                    mode: None,
                    timeout_secs: None,
                    resource_rollback_command: None,
                }),
            }],
        };

        assert!(validate_plan(&plan, &OrchestrationInventory::default()).is_err());
    }

    #[test]
    fn resolve_stage_targets_supports_inventory_groups_and_inline_targets() {
        let stage = OrchestrationStage {
            name: "access".to_string(),
            strategy: StageStrategy::Parallel,
            max_parallel: Some(5),
            fail_fast: None,
            target_groups: vec!["edge".to_string()],
            targets: vec![OrchestrationTargetInput::Detailed(Box::new(
                OrchestrationTarget {
                    name: Some("adhoc-sw".to_string()),
                    host: Some("10.0.0.99".to_string()),
                    ..OrchestrationTarget::default()
                },
            ))],
            action: OrchestrationAction::TxBlock(TxBlockAction {
                name: None,
                template: Some("configure_vlan.j2".to_string()),
                tx_block_template_name: None,
                tx_block_template_content: None,
                tx_block_template_vars: Value::Null,
                vars: Value::Null,
                commands: Vec::new(),
                rollback_commands: Vec::new(),
                rollback_on_failure: false,
                rollback_trigger_step_index: None,
                mode: None,
                timeout_secs: None,
                resource_rollback_command: None,
            }),
        };
        let inventory = OrchestrationInventory {
            defaults: OrchestrationTargetDefaults::default(),
            groups: HashMap::from([(
                "edge".to_string(),
                InventoryGroup::Targets(vec![
                    OrchestrationTargetInput::ConnectionName("sw-01".to_string()),
                    OrchestrationTargetInput::ConnectionName("sw-02".to_string()),
                ]),
            )]),
        };

        let targets = resolve_stage_targets(&stage, &inventory).expect("targets");
        let labels = targets
            .iter()
            .enumerate()
            .map(|(idx, target)| target_label(target, idx))
            .collect::<Vec<_>>();

        assert_eq!(labels, vec!["sw-01", "sw-02", "adhoc-sw"]);
    }

    #[test]
    fn resolve_stage_targets_merges_inventory_and_group_defaults() {
        let stage = OrchestrationStage {
            name: "access".to_string(),
            strategy: StageStrategy::Parallel,
            max_parallel: Some(5),
            fail_fast: None,
            target_groups: vec!["access".to_string()],
            targets: Vec::new(),
            action: OrchestrationAction::TxBlock(TxBlockAction {
                name: None,
                template: Some("configure_vlan.j2".to_string()),
                tx_block_template_name: None,
                tx_block_template_content: None,
                tx_block_template_vars: Value::Null,
                vars: Value::Null,
                commands: Vec::new(),
                rollback_commands: Vec::new(),
                rollback_on_failure: false,
                rollback_trigger_step_index: None,
                mode: None,
                timeout_secs: None,
                resource_rollback_command: None,
            }),
        };
        let inventory = OrchestrationInventory {
            defaults: OrchestrationTargetDefaults {
                username: Some("admin".to_string()),
                password: None,
                port: Some(22),
                enable_password: None,
                ssh_security: Some(SshSecurityProfile::Balanced),
                linux_shell_flavor: None,
                device_profile: Some("cisco".to_string()),
                template_dir: Some("/tmp/templates".to_string()),
                vars: json!({
                    "site": "hz",
                    "meta": {"env": "prod"}
                }),
            },
            groups: HashMap::from([(
                "access".to_string(),
                InventoryGroup::Detailed(InventoryGroupSpec {
                    defaults: OrchestrationTargetDefaults {
                        username: None,
                        password: None,
                        port: None,
                        enable_password: None,
                        ssh_security: Some(SshSecurityProfile::LegacyCompatible),
                        linux_shell_flavor: None,
                        device_profile: Some("huawei".to_string()),
                        template_dir: None,
                        vars: json!({
                            "meta": {"role": "access"},
                            "region": "east"
                        }),
                    },
                    targets: vec![OrchestrationTargetInput::Detailed(Box::new(
                        OrchestrationTarget {
                            connection: Some("sw-01".to_string()),
                            vars: json!({
                                "hostname": "sw-01",
                                "meta": {"rack": "r1"}
                            }),
                            ..OrchestrationTarget::default()
                        },
                    ))],
                }),
            )]),
        };

        let targets = resolve_stage_targets(&stage, &inventory).expect("targets");
        let target = targets.first().expect("one target");

        assert_eq!(target.connection.as_deref(), Some("sw-01"));
        assert_eq!(target.username.as_deref(), Some("admin"));
        assert_eq!(target.port, Some(22));
        assert_eq!(
            target.ssh_security,
            Some(SshSecurityProfile::LegacyCompatible)
        );
        assert_eq!(target.device_profile.as_deref(), Some("huawei"));
        assert_eq!(target.template_dir.as_deref(), Some("/tmp/templates"));
        assert_eq!(
            target.vars,
            json!({
                "site": "hz",
                "region": "east",
                "hostname": "sw-01",
                "meta": {
                    "env": "prod",
                    "role": "access",
                    "rack": "r1"
                }
            })
        );
    }

    #[test]
    fn validate_tx_block_action_rejects_mixed_template_sources() {
        let stage = OrchestrationStage {
            name: "stage-1".to_string(),
            strategy: StageStrategy::Serial,
            max_parallel: None,
            fail_fast: None,
            target_groups: vec!["edge".to_string()],
            targets: Vec::new(),
            action: OrchestrationAction::TxBlock(TxBlockAction {
                name: None,
                template: Some("cmd.j2".to_string()),
                tx_block_template_name: Some("saved-block".to_string()),
                tx_block_template_content: None,
                tx_block_template_vars: Value::Null,
                vars: Value::Null,
                commands: vec![],
                rollback_commands: vec![],
                rollback_on_failure: false,
                rollback_trigger_step_index: None,
                mode: None,
                timeout_secs: None,
                resource_rollback_command: None,
            }),
        };
        let action = match &stage.action {
            OrchestrationAction::TxBlock(action) => action,
            _ => unreachable!(),
        };
        assert!(validate_tx_block_action(&stage, action).is_err());
    }

    #[test]
    fn validate_tx_workflow_action_accepts_template_source() {
        let stage = OrchestrationStage {
            name: "stage-1".to_string(),
            strategy: StageStrategy::Serial,
            max_parallel: None,
            fail_fast: None,
            target_groups: vec!["edge".to_string()],
            targets: Vec::new(),
            action: OrchestrationAction::TxWorkflow(TxWorkflowAction {
                workflow_file: None,
                workflow: None,
                workflow_template_name: Some("linux-rollout".to_string()),
                workflow_template_content: None,
                workflow_vars: json!({"peer":"edge94"}),
            }),
        };
        let action = match &stage.action {
            OrchestrationAction::TxWorkflow(action) => action,
            _ => unreachable!(),
        };
        assert!(validate_tx_workflow_action(&stage, action).is_ok());
    }
}
