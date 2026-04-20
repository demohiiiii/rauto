use super::execution_actions::{emit_orchestration_event, execute_action, task_progress};
use super::targets as orchestrator_targets;
use super::{
    OrchestrationEventHook, OrchestrationExecutionResult, OrchestrationInventory,
    OrchestrationPlan, OrchestrationRuntimeEvent, OrchestrationStage, OrchestrationTarget,
    RecordLevelOpt, StageExecutionResult, StageStrategy, TargetExecutionResult, TargetStatus,
    action_kind_name, build_skipped_stage, build_skipped_target, build_stage_result, target_label,
};
use crate::cli::GlobalOpts;
use anyhow::{Result, anyhow};
use serde_json::json;
use std::collections::VecDeque;
use std::path::Path;
use std::time::Instant;
use tokio::task::JoinSet;

pub(super) async fn execute_plan(
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
            let targets = orchestrator_targets::resolve_stage_targets(stage, inventory)?;
            emit_orchestration_event(
                &event_hook,
                OrchestrationRuntimeEvent {
                    event_type: "warning".to_string(),
                    message: format!("Skipping stage '{}' due to fail-fast", stage.name),
                    level: "warning".to_string(),
                    stage: Some("orchestrate".to_string()),
                    progress: task_progress(stage_idx, plan.stages.len()),
                    details: Some(json!({
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
                details: Some(json!({
                    "plan_name": plan.name,
                    "stage_name": stage.name,
                    "stage_strategy": format!("{:?}", stage.strategy).to_lowercase(),
                    "target_count": orchestrator_targets::resolve_stage_targets(stage, inventory)?.len()
                })),
            },
        );

        let stage_result = execute_stage(
            plan,
            stage,
            inventory,
            plan_root,
            opts,
            record_level,
            event_hook.clone(),
        )
        .await?;
        let stage_failed = matches!(stage_result.status, super::StageStatus::Failed);
        if stage_failed && plan.fail_fast {
            failed = true;
        }
        emit_orchestration_event(
            &event_hook,
            OrchestrationRuntimeEvent {
                event_type: if stage_failed {
                    "failed".to_string()
                } else {
                    "step_completed".to_string()
                },
                message: if stage_failed {
                    format!("Stage '{}' failed", stage.name)
                } else {
                    format!("Stage '{}' completed", stage.name)
                },
                level: if stage_failed {
                    "error".to_string()
                } else {
                    "success".to_string()
                },
                stage: Some("orchestrate".to_string()),
                progress: task_progress(stage_idx + 1, plan.stages.len()),
                details: Some(json!({
                    "plan_name": plan.name,
                    "stage_name": stage.name,
                    "targets_total": stage_result.targets_total,
                    "targets_failed": stage_result.targets_failed,
                    "targets_succeeded": stage_result.targets_succeeded
                })),
            },
        );
        stages.push(stage_result);
    }

    let executed_stages = stages.len();
    let success = stages
        .iter()
        .all(|stage| !matches!(stage.status, super::StageStatus::Failed));

    emit_orchestration_event(
        &event_hook,
        OrchestrationRuntimeEvent {
            event_type: if success {
                "completed".to_string()
            } else {
                "failed".to_string()
            },
            message: if success {
                format!("Orchestration '{}' completed", plan.name)
            } else {
                format!("Orchestration '{}' finished with failures", plan.name)
            },
            level: if success {
                "success".to_string()
            } else {
                "error".to_string()
            },
            stage: Some("orchestrate".to_string()),
            progress: Some(100),
            details: Some(json!({
                "plan_name": plan.name,
                "executed_stages": executed_stages,
                "total_stages": plan.stages.len(),
                "success": success
            })),
        },
    );

    Ok(OrchestrationExecutionResult {
        plan_name: plan.name.clone(),
        success,
        fail_fast: plan.fail_fast,
        total_stages: plan.stages.len(),
        executed_stages,
        stages,
    })
}

#[allow(clippy::too_many_arguments)]
async fn execute_stage(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    inventory: &OrchestrationInventory,
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<StageExecutionResult> {
    let fail_fast = stage.fail_fast.unwrap_or(plan.fail_fast);
    let targets = orchestrator_targets::resolve_stage_targets(stage, inventory)?;
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
            details: Some(json!({
                "plan_name": plan.name,
                "stage_name": stage.name,
                "target_label": label,
                "target_index": idx + 1,
                "connection_name": target.connection,
                "host": target.host
            })),
        },
    );

    let resolved = orchestrator_targets::resolve_target_connection(opts, target);
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
                    details: Some(json!({
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
                    details: Some(json!({
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
                    details: Some(json!({
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
