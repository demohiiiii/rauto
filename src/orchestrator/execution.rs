use super::execution_actions::{
    emit_orchestration_event, execute_action, execute_compensation_action, task_progress,
};
use super::targets as orchestrator_targets;
use super::{
    JobExecutionResult, OrchestrationEventHook, OrchestrationExecutionResult,
    OrchestrationInventory, OrchestrationJob, OrchestrationPlan, OrchestrationRuntimeEvent,
    OrchestrationStage, OrchestrationTarget, RecordLevelOpt, StageExecutionResult, StageStatus,
    StageStrategy, TargetExecutionResult, TargetStatus, action_kind_name, build_job_result,
    build_skipped_job, build_skipped_stage, build_skipped_target, build_stage_result, job_name,
    target_label,
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
        let stage_fail_fast = stage.fail_fast.unwrap_or(false);
        if failed && (plan.fail_fast || plan.rollback_completed_stages_on_failure) {
            let skip_reason = if plan.rollback_completed_stages_on_failure {
                "completed_stage_rollback"
            } else {
                "fail_fast"
            };
            let skipped_jobs = build_skipped_stage_jobs(stage, inventory)?;
            emit_orchestration_event(
                &event_hook,
                OrchestrationRuntimeEvent {
                    event_type: "warning".to_string(),
                    message: format!("Skipping stage '{}' due to {}", stage.name, skip_reason),
                    level: "warning".to_string(),
                    stage: Some("orchestrate".to_string()),
                    progress: task_progress(stage_idx, plan.stages.len()),
                    details: Some(json!({
                        "plan_name": plan.name,
                        "stage_name": stage.name,
                        "reason": skip_reason
                    })),
                },
            );
            stages.push(build_skipped_stage(stage, stage_fail_fast, skipped_jobs));
            continue;
        }

        let stage_target_count = count_stage_targets(stage, inventory)?;
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
                    "stage_index": stage_idx + 1,
                    "stage_strategy": format!("{:?}", stage.strategy).to_lowercase(),
                    "job_count": stage.jobs.len(),
                    "target_count": stage_target_count
                })),
            },
        );

        let mut stage_result = execute_stage(
            plan,
            stage,
            stage_idx,
            inventory,
            plan_root,
            opts,
            record_level,
            event_hook.clone(),
        )
        .await?;
        let stage_failed = matches!(stage_result.status, StageStatus::Failed);
        if stage_failed
            && (plan.rollback_on_stage_failure || plan.rollback_completed_stages_on_failure)
        {
            compensate_stage(
                "stage_failure",
                plan,
                stage,
                stage_idx,
                &mut stage_result,
                inventory,
                plan_root,
                opts,
                record_level,
                event_hook.clone(),
            )
            .await?;
        }
        if stage_failed && plan.rollback_completed_stages_on_failure {
            compensate_completed_stages(
                plan,
                &mut stages,
                inventory,
                plan_root,
                opts,
                record_level,
                event_hook.clone(),
            )
            .await?;
        }
        if stage_failed && (plan.fail_fast || plan.rollback_completed_stages_on_failure) {
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
                    "jobs_total": stage_result.jobs_total,
                    "jobs_failed": stage_result.jobs_failed,
                    "jobs_succeeded": stage_result.jobs_succeeded,
                    "jobs_skipped": stage_result.jobs_skipped,
                    "targets_total": stage_result.jobs.iter().map(|job| job.targets_total).sum::<usize>(),
                    "targets_failed": stage_result.jobs.iter().map(|job| job.targets_failed).sum::<usize>(),
                    "targets_succeeded": stage_result.jobs.iter().map(|job| job.targets_succeeded).sum::<usize>()
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
async fn compensate_completed_stages(
    plan: &OrchestrationPlan,
    stages: &mut [StageExecutionResult],
    inventory: &OrchestrationInventory,
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<()> {
    for (stage_idx, stage_result) in stages.iter_mut().enumerate().rev() {
        let Some(stage) = plan.stages.get(stage_idx) else {
            continue;
        };
        compensate_stage(
            "completed_stage_failure",
            plan,
            stage,
            stage_idx,
            stage_result,
            inventory,
            plan_root,
            opts,
            record_level,
            event_hook.clone(),
        )
        .await?;
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn compensate_stage(
    scope: &str,
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    stage_idx: usize,
    stage_result: &mut StageExecutionResult,
    inventory: &OrchestrationInventory,
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<()> {
    emit_orchestration_event(
        &event_hook,
        OrchestrationRuntimeEvent {
            event_type: "warning".to_string(),
            message: format!("Stage '{}' compensation started ({})", stage.name, scope),
            level: "warning".to_string(),
            stage: Some("orchestrate".to_string()),
            progress: task_progress(stage_idx + 1, plan.stages.len()),
            details: Some(json!({
                "plan_name": plan.name,
                "stage_name": stage.name,
                "stage_index": stage_idx + 1,
                "rollback_scope": scope
            })),
        },
    );

    for (job_idx, job_result) in stage_result.jobs.iter_mut().enumerate() {
        let Some(job) = stage.jobs.get(job_idx) else {
            continue;
        };
        let targets =
            orchestrator_targets::resolve_job_targets(stage.name.as_str(), job, inventory)?;
        for (target_idx, target_result) in job_result.results.iter_mut().enumerate() {
            if !matches!(target_result.status, TargetStatus::Success)
                || target_result.compensation.is_some()
            {
                continue;
            }
            let Some(target) = targets.get(target_idx) else {
                continue;
            };
            let label = target_result.label.clone();
            emit_orchestration_event(
                &event_hook,
                OrchestrationRuntimeEvent {
                    event_type: "warning".to_string(),
                    message: format!("Target '{}' compensation started", label),
                    level: "warning".to_string(),
                    stage: Some("orchestrate".to_string()),
                    progress: None,
                    details: Some(json!({
                        "plan_name": plan.name,
                        "stage_name": stage.name,
                        "stage_index": stage_idx + 1,
                        "job_name": job_result.name,
                        "job_index": job_idx + 1,
                        "target_label": label,
                        "target_index": target_idx + 1,
                        "rollback_scope": scope
                    })),
                },
            );

            let compensation = match orchestrator_targets::resolve_target_connection(opts, target) {
                Ok(conn) => match crate::resolve_autodetect_connection(conn).await {
                    Ok(conn) => match execute_compensation_action(
                        scope,
                        plan,
                        stage.name.as_str(),
                        job_result.name.as_str(),
                        &job.action,
                        target,
                        &conn,
                        plan_root,
                        record_level,
                    )
                    .await
                    {
                        Ok(result) => result,
                        Err(e) => super::CompensationExecutionResult {
                            scope: scope.to_string(),
                            attempted: true,
                            success: false,
                            reason: None,
                            operation: Some(format!("compensation: {}", job_result.name)),
                            duration_ms: 0,
                            error: Some(e.to_string()),
                            tx_result: None,
                            recording_jsonl: None,
                        },
                    },
                    Err(e) => super::CompensationExecutionResult {
                        scope: scope.to_string(),
                        attempted: false,
                        success: false,
                        reason: Some("target connection autodetect failed".to_string()),
                        operation: Some(format!("compensation: {}", job_result.name)),
                        duration_ms: 0,
                        error: Some(e.to_string()),
                        tx_result: None,
                        recording_jsonl: None,
                    },
                },
                Err(e) => super::CompensationExecutionResult {
                    scope: scope.to_string(),
                    attempted: false,
                    success: false,
                    reason: Some("target connection resolution failed".to_string()),
                    operation: Some(format!("compensation: {}", job_result.name)),
                    duration_ms: 0,
                    error: Some(e.to_string()),
                    tx_result: None,
                    recording_jsonl: None,
                },
            };

            emit_orchestration_event(
                &event_hook,
                OrchestrationRuntimeEvent {
                    event_type: if compensation.success {
                        "step_completed".to_string()
                    } else {
                        "failed".to_string()
                    },
                    message: if compensation.success {
                        format!("Target '{}' compensation completed", label)
                    } else {
                        format!("Target '{}' compensation failed", label)
                    },
                    level: if compensation.success {
                        "success".to_string()
                    } else {
                        "error".to_string()
                    },
                    stage: Some("orchestrate".to_string()),
                    progress: None,
                    details: Some(json!({
                        "plan_name": plan.name,
                        "stage_name": stage.name,
                        "stage_index": stage_idx + 1,
                        "job_name": job_result.name,
                        "job_index": job_idx + 1,
                        "target_label": label,
                        "target_index": target_idx + 1,
                        "rollback_scope": scope,
                        "attempted": compensation.attempted,
                        "success": compensation.success,
                        "reason": compensation.reason.as_ref(),
                        "error": compensation.error.as_ref()
                    })),
                },
            );
            target_result.compensation = Some(compensation);
        }
    }
    Ok(())
}

fn count_stage_targets(
    stage: &OrchestrationStage,
    inventory: &OrchestrationInventory,
) -> Result<usize> {
    let mut total = 0usize;
    for job in &stage.jobs {
        total +=
            orchestrator_targets::resolve_job_targets(stage.name.as_str(), job, inventory)?.len();
    }
    Ok(total)
}

fn build_skipped_stage_jobs(
    stage: &OrchestrationStage,
    inventory: &OrchestrationInventory,
) -> Result<Vec<JobExecutionResult>> {
    let mut jobs = Vec::with_capacity(stage.jobs.len());
    for (job_idx, job) in stage.jobs.iter().enumerate() {
        let targets =
            orchestrator_targets::resolve_job_targets(stage.name.as_str(), job, inventory)?;
        jobs.push(build_skipped_job(
            job,
            job_idx,
            job.fail_fast.unwrap_or(true),
            &targets,
        ));
    }
    Ok(jobs)
}

#[allow(clippy::too_many_arguments)]
async fn execute_stage(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    stage_idx: usize,
    inventory: &OrchestrationInventory,
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<StageExecutionResult> {
    let stage_fail_fast = stage.fail_fast.unwrap_or(false);
    let jobs = match stage.strategy {
        StageStrategy::Serial => {
            execute_serial_stage_jobs(
                plan,
                stage,
                stage_idx,
                inventory,
                plan_root,
                opts,
                record_level,
                stage_fail_fast,
                event_hook.clone(),
            )
            .await?
        }
        StageStrategy::Parallel => {
            execute_parallel_stage_jobs(
                plan,
                stage,
                stage_idx,
                inventory,
                plan_root,
                opts,
                record_level,
                stage_fail_fast,
                event_hook.clone(),
            )
            .await?
        }
    };

    Ok(build_stage_result(stage, stage_fail_fast, jobs))
}

#[allow(clippy::too_many_arguments)]
async fn execute_serial_stage_jobs(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    stage_idx: usize,
    inventory: &OrchestrationInventory,
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    stage_fail_fast: bool,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<Vec<JobExecutionResult>> {
    let mut jobs = Vec::with_capacity(stage.jobs.len());
    for (job_idx, job) in stage.jobs.iter().enumerate() {
        let job_result = execute_job(
            plan,
            stage,
            stage_idx,
            job,
            job_idx,
            inventory,
            plan_root,
            opts,
            record_level,
            event_hook.clone(),
        )
        .await?;
        let is_failed = matches!(job_result.status, super::StageStatus::Failed);
        jobs.push(job_result);
        if is_failed && stage_fail_fast {
            for (remaining_idx, remaining_job) in stage.jobs.iter().enumerate().skip(job_idx + 1) {
                let targets = orchestrator_targets::resolve_job_targets(
                    stage.name.as_str(),
                    remaining_job,
                    inventory,
                )?;
                jobs.push(build_skipped_job(
                    remaining_job,
                    remaining_idx,
                    remaining_job.fail_fast.unwrap_or(true),
                    &targets,
                ));
            }
            break;
        }
    }
    Ok(jobs)
}

#[allow(clippy::too_many_arguments)]
async fn execute_parallel_stage_jobs(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    stage_idx: usize,
    inventory: &OrchestrationInventory,
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    stage_fail_fast: bool,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<Vec<JobExecutionResult>> {
    let concurrency = stage
        .max_parallel
        .unwrap_or(4)
        .max(1)
        .min(stage.jobs.len().max(1));
    let mut pending: VecDeque<(usize, OrchestrationJob)> =
        stage.jobs.iter().cloned().enumerate().collect();
    let mut join_set = JoinSet::new();
    let mut results: Vec<Option<JobExecutionResult>> = std::iter::repeat_with(|| None)
        .take(stage.jobs.len())
        .collect();
    let plan_owned = plan.clone();
    let stage_owned = stage.clone();
    let inventory_owned = inventory.clone();
    let opts_owned = opts.clone();
    let plan_root_owned = plan_root.to_path_buf();
    let mut stop_spawning = false;

    while !pending.is_empty() || !join_set.is_empty() {
        while !stop_spawning && join_set.len() < concurrency && !pending.is_empty() {
            let (job_idx, job) = pending.pop_front().expect("pending job");
            let plan_cloned = plan_owned.clone();
            let stage_cloned = stage_owned.clone();
            let inventory_cloned = inventory_owned.clone();
            let opts_cloned = opts_owned.clone();
            let plan_root_cloned = plan_root_owned.clone();
            let event_hook_cloned = event_hook.clone();
            join_set.spawn(async move {
                let result = execute_job(
                    &plan_cloned,
                    &stage_cloned,
                    stage_idx,
                    &job,
                    job_idx,
                    &inventory_cloned,
                    &plan_root_cloned,
                    &opts_cloned,
                    record_level,
                    event_hook_cloned,
                )
                .await;
                (job_idx, result)
            });
        }

        let Some(joined) = join_set.join_next().await else {
            break;
        };
        let (job_idx, result) = joined.map_err(|e| anyhow!("parallel stage task failed: {}", e))?;
        let job_result = result?;
        if matches!(job_result.status, super::StageStatus::Failed) && stage_fail_fast {
            stop_spawning = true;
        }
        results[job_idx] = Some(job_result);
    }

    for (job_idx, job) in pending {
        let targets =
            orchestrator_targets::resolve_job_targets(stage.name.as_str(), &job, inventory)?;
        results[job_idx] = Some(build_skipped_job(
            &job,
            job_idx,
            job.fail_fast.unwrap_or(true),
            &targets,
        ));
    }

    Ok(results
        .into_iter()
        .enumerate()
        .map(|(job_idx, item)| {
            item.unwrap_or_else(|| {
                let job = &stage.jobs[job_idx];
                build_job_result(job, job_idx, job.fail_fast.unwrap_or(true), Vec::new())
            })
        })
        .collect())
}

#[allow(clippy::too_many_arguments)]
async fn execute_job(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    stage_idx: usize,
    job: &OrchestrationJob,
    job_idx: usize,
    inventory: &OrchestrationInventory,
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<JobExecutionResult> {
    let job_fail_fast = job.fail_fast.unwrap_or(true);
    let targets = orchestrator_targets::resolve_job_targets(stage.name.as_str(), job, inventory)?;
    let job_display_name = job_name(job, job_idx);

    emit_orchestration_event(
        &event_hook,
        OrchestrationRuntimeEvent {
            event_type: "step_started".to_string(),
            message: format!("Job '{}' started", job_display_name),
            level: "info".to_string(),
            stage: Some("orchestrate".to_string()),
            progress: None,
            details: Some(json!({
                "plan_name": plan.name,
                "stage_name": stage.name,
                "stage_index": stage_idx + 1,
                "job_name": job_display_name,
                "job_index": job_idx + 1,
                "job_strategy": format!("{:?}", job.strategy).to_lowercase(),
                "target_count": targets.len()
            })),
        },
    );

    let results = match job.strategy {
        StageStrategy::Serial => {
            execute_serial_job_targets(
                plan,
                stage,
                job,
                job_idx,
                &targets,
                plan_root,
                opts,
                record_level,
                job_fail_fast,
                event_hook.clone(),
            )
            .await?
        }
        StageStrategy::Parallel => {
            execute_parallel_job_targets(
                plan,
                stage,
                job,
                job_idx,
                &targets,
                plan_root,
                opts,
                record_level,
                job_fail_fast,
                event_hook.clone(),
            )
            .await?
        }
    };

    let job_result = build_job_result(job, job_idx, job_fail_fast, results);
    let job_failed = matches!(job_result.status, super::StageStatus::Failed);
    emit_orchestration_event(
        &event_hook,
        OrchestrationRuntimeEvent {
            event_type: if job_failed {
                "failed".to_string()
            } else {
                "step_completed".to_string()
            },
            message: if job_failed {
                format!("Job '{}' failed", job_result.name)
            } else {
                format!("Job '{}' completed", job_result.name)
            },
            level: if job_failed {
                "error".to_string()
            } else {
                "success".to_string()
            },
            stage: Some("orchestrate".to_string()),
            progress: None,
            details: Some(json!({
                "plan_name": plan.name,
                "stage_name": stage.name,
                "stage_index": stage_idx + 1,
                "job_name": job_result.name,
                "job_index": job_idx + 1,
                "targets_total": job_result.targets_total,
                "targets_failed": job_result.targets_failed,
                "targets_succeeded": job_result.targets_succeeded,
                "targets_skipped": job_result.targets_skipped
            })),
        },
    );
    Ok(job_result)
}

#[allow(clippy::too_many_arguments)]
async fn execute_serial_job_targets(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    job: &OrchestrationJob,
    job_idx: usize,
    targets: &[OrchestrationTarget],
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    fail_fast: bool,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<Vec<TargetExecutionResult>> {
    let mut results = Vec::with_capacity(targets.len());
    for (target_idx, target) in targets.iter().enumerate() {
        let result = execute_target(
            plan,
            stage,
            job,
            job_idx,
            target,
            target_idx,
            plan_root,
            opts,
            record_level,
            event_hook.clone(),
        )
        .await;
        let is_failed = matches!(result.status, TargetStatus::Failed);
        results.push(result);
        if is_failed && fail_fast {
            for (remaining_idx, remaining_target) in targets.iter().enumerate().skip(target_idx + 1)
            {
                results.push(build_skipped_target(remaining_target, remaining_idx));
            }
            break;
        }
    }
    Ok(results)
}

#[allow(clippy::too_many_arguments)]
async fn execute_parallel_job_targets(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    job: &OrchestrationJob,
    job_idx: usize,
    targets: &[OrchestrationTarget],
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    fail_fast: bool,
    event_hook: Option<OrchestrationEventHook>,
) -> Result<Vec<TargetExecutionResult>> {
    let concurrency = job
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
    let job_owned = job.clone();
    let opts_owned = opts.clone();
    let plan_root_owned = plan_root.to_path_buf();
    let mut stop_spawning = false;

    while !pending.is_empty() || !join_set.is_empty() {
        while !stop_spawning && join_set.len() < concurrency && !pending.is_empty() {
            let (target_idx, target) = pending.pop_front().expect("pending target");
            let plan_cloned = plan_owned.clone();
            let stage_cloned = stage_owned.clone();
            let job_cloned = job_owned.clone();
            let opts_cloned = opts_owned.clone();
            let plan_root_cloned = plan_root_owned.clone();
            let event_hook_cloned = event_hook.clone();
            join_set.spawn(async move {
                let result = execute_target(
                    &plan_cloned,
                    &stage_cloned,
                    &job_cloned,
                    job_idx,
                    &target,
                    target_idx,
                    &plan_root_cloned,
                    &opts_cloned,
                    record_level,
                    event_hook_cloned,
                )
                .await;
                (target_idx, result)
            });
        }

        let Some(joined) = join_set.join_next().await else {
            break;
        };
        let (target_idx, result) =
            joined.map_err(|e| anyhow!("parallel stage task failed: {}", e))?;
        if matches!(result.status, TargetStatus::Failed) && fail_fast {
            stop_spawning = true;
        }
        results[target_idx] = Some(result);
    }

    for (target_idx, target) in pending {
        results[target_idx] = Some(build_skipped_target(&target, target_idx));
    }

    Ok(results
        .into_iter()
        .enumerate()
        .map(|(target_idx, item)| {
            item.unwrap_or_else(|| build_skipped_target(&targets[target_idx], target_idx))
        })
        .collect())
}

#[allow(clippy::too_many_arguments)]
async fn execute_target(
    plan: &OrchestrationPlan,
    stage: &OrchestrationStage,
    job: &OrchestrationJob,
    job_idx: usize,
    target: &OrchestrationTarget,
    target_idx: usize,
    plan_root: &Path,
    opts: &GlobalOpts,
    record_level: RecordLevelOpt,
    event_hook: Option<OrchestrationEventHook>,
) -> TargetExecutionResult {
    let label = target_label(target, target_idx);
    let job_display_name = job_name(job, job_idx);
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
                "job_name": job_display_name,
                "job_index": job_idx + 1,
                "target_label": label,
                "target_index": target_idx + 1,
                "connection_name": target.connection,
                "host": target.host
            })),
        },
    );

    let resolved = match orchestrator_targets::resolve_target_connection(opts, target) {
        Ok(conn) => crate::resolve_autodetect_connection(conn).await,
        Err(e) => Err(e),
    };
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
                        "job_name": job_display_name,
                        "job_index": job_idx + 1,
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
                operation: action_kind_name(&job.action).to_string(),
                duration_ms: started.elapsed().as_millis(),
                error: Some(e.to_string()),
                tx_result: None,
                workflow_result: None,
                recording_jsonl: None,
                compensation: None,
            };
        }
    };

    match execute_action(
        plan,
        stage.name.as_str(),
        job_display_name.as_str(),
        &job.action,
        target,
        &conn,
        plan_root,
        record_level,
    )
    .await
    {
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
                        "job_name": job_display_name,
                        "job_index": job_idx + 1,
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
                compensation: None,
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
                        "job_name": job_display_name,
                        "job_index": job_idx + 1,
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
                operation: action_kind_name(&job.action).to_string(),
                duration_ms: started.elapsed().as_millis(),
                error: Some(e.to_string()),
                tx_result: None,
                workflow_result: None,
                recording_jsonl: None,
                compensation: None,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ssh_security::SshSecurityProfile;
    use serde_json::json;

    fn sample_opts() -> GlobalOpts {
        GlobalOpts {
            host: None,
            username: None,
            password: None,
            port: None,
            enable_password: None,
            ssh_security: None,
            linux_shell_flavor: None,
            device_profile: None,
            template_dir: None,
            connection: None,
            save_connection: None,
            save_password: false,
        }
    }

    fn none_rollback_action(name: &str) -> super::super::OrchestrationAction {
        super::super::OrchestrationAction::TxBlock(super::super::TxBlockAction {
            name: Some(name.to_string()),
            template: None,
            tx_block_template_name: None,
            tx_block_template_content: Some(
                json!({
                    "name": name,
                    "rollback_policy": "none",
                    "steps": [
                        {
                            "run": {
                                "kind": "command",
                                "mode": "User",
                                "command": "echo hello"
                            }
                        }
                    ],
                    "fail_fast": true
                })
                .to_string(),
            ),
            tx_block_template_vars: serde_json::Value::Null,
            flow_template_name: None,
            flow_template_content: None,
            flow_vars: serde_json::Value::Null,
            vars: serde_json::Value::Null,
            commands: Vec::new(),
            rollback_commands: Vec::new(),
            rollback_on_failure: false,
            rollback_trigger_step_index: None,
            mode: None,
            timeout_secs: None,
            resource_rollback_command: None,
        })
    }

    fn sample_target(name: &str, host: &str) -> OrchestrationTarget {
        OrchestrationTarget {
            name: Some(name.to_string()),
            connection: None,
            host: Some(host.to_string()),
            username: Some("admin".to_string()),
            password: Some("secret".to_string()),
            port: Some(22),
            enable_password: None,
            ssh_security: Some(SshSecurityProfile::Balanced),
            linux_shell_flavor: None,
            device_profile: Some("linux".to_string()),
            template_dir: None,
            vars: json!({}),
        }
    }

    fn sample_job(name: &str, targets: Vec<OrchestrationTarget>) -> OrchestrationJob {
        OrchestrationJob {
            name: Some(name.to_string()),
            strategy: StageStrategy::Serial,
            max_parallel: None,
            fail_fast: Some(true),
            target_groups: Vec::new(),
            target_tags: Vec::new(),
            targets: targets
                .into_iter()
                .map(|target| super::super::OrchestrationTargetInput::Detailed(Box::new(target)))
                .collect(),
            action: none_rollback_action(name),
        }
    }

    fn sample_stage(name: &str, job: OrchestrationJob) -> OrchestrationStage {
        OrchestrationStage {
            name: name.to_string(),
            strategy: StageStrategy::Serial,
            max_parallel: None,
            fail_fast: Some(true),
            jobs: vec![job],
        }
    }

    fn sample_plan(stages: Vec<OrchestrationStage>) -> OrchestrationPlan {
        OrchestrationPlan {
            name: "plan-demo".to_string(),
            fail_fast: true,
            rollback_on_stage_failure: true,
            rollback_completed_stages_on_failure: true,
            inventory_file: None,
            inventory: None,
            stages,
        }
    }

    fn success_target_result(label: &str, host: &str) -> TargetExecutionResult {
        TargetExecutionResult {
            label: label.to_string(),
            connection_name: None,
            host: Some(host.to_string()),
            status: TargetStatus::Success,
            operation: "tx_block: demo".to_string(),
            duration_ms: 12,
            error: None,
            tx_result: Some(json!({"committed": true})),
            workflow_result: None,
            recording_jsonl: None,
            compensation: None,
        }
    }

    fn failed_target_result(label: &str, host: &str) -> TargetExecutionResult {
        TargetExecutionResult {
            label: label.to_string(),
            connection_name: None,
            host: Some(host.to_string()),
            status: TargetStatus::Failed,
            operation: "tx_block: demo".to_string(),
            duration_ms: 12,
            error: Some("failed".to_string()),
            tx_result: Some(json!({"committed": false})),
            workflow_result: None,
            recording_jsonl: None,
            compensation: None,
        }
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn compensate_stage_only_marks_successful_targets() {
        let inventory = OrchestrationInventory::default();
        let stage = sample_stage(
            "stage-a",
            sample_job(
                "job-a",
                vec![
                    sample_target("edge-a", "192.0.2.10"),
                    sample_target("edge-b", "192.0.2.11"),
                ],
            ),
        );
        let plan = sample_plan(vec![stage.clone()]);
        let mut stage_result = StageExecutionResult {
            name: stage.name.clone(),
            strategy: stage.strategy,
            status: StageStatus::Failed,
            fail_fast: true,
            jobs_total: 1,
            jobs_succeeded: 0,
            jobs_failed: 1,
            jobs_skipped: 0,
            jobs: vec![JobExecutionResult {
                name: "job-a".to_string(),
                strategy: StageStrategy::Serial,
                status: StageStatus::Failed,
                fail_fast: true,
                action_kind: "tx_block".to_string(),
                action_summary: "tx block".to_string(),
                targets_total: 2,
                targets_succeeded: 1,
                targets_failed: 1,
                targets_skipped: 0,
                results: vec![
                    success_target_result("edge-a", "192.0.2.10"),
                    failed_target_result("edge-b", "192.0.2.11"),
                ],
            }],
        };

        compensate_stage(
            "stage_failure",
            &plan,
            &stage,
            0,
            &mut stage_result,
            &inventory,
            Path::new("."),
            &sample_opts(),
            RecordLevelOpt::KeyEventsOnly,
            None,
        )
        .await
        .expect("stage compensation");

        let first = &stage_result.jobs[0].results[0];
        let second = &stage_result.jobs[0].results[1];
        assert!(first.compensation.is_some());
        assert_eq!(
            first
                .compensation
                .as_ref()
                .and_then(|item| item.reason.as_deref()),
            Some("no rollback operations planned")
        );
        assert!(second.compensation.is_none());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn compensate_completed_stages_marks_previous_success_targets_once() {
        let stage_a = sample_stage(
            "stage-a",
            sample_job("job-a", vec![sample_target("edge-a", "192.0.2.10")]),
        );
        let stage_b = sample_stage(
            "stage-b",
            sample_job("job-b", vec![sample_target("edge-b", "192.0.2.11")]),
        );
        let plan = sample_plan(vec![stage_a.clone(), stage_b.clone()]);
        let mut stages = vec![
            StageExecutionResult {
                name: stage_a.name.clone(),
                strategy: stage_a.strategy,
                status: StageStatus::Success,
                fail_fast: true,
                jobs_total: 1,
                jobs_succeeded: 1,
                jobs_failed: 0,
                jobs_skipped: 0,
                jobs: vec![JobExecutionResult {
                    name: "job-a".to_string(),
                    strategy: StageStrategy::Serial,
                    status: StageStatus::Success,
                    fail_fast: true,
                    action_kind: "tx_block".to_string(),
                    action_summary: "tx block".to_string(),
                    targets_total: 1,
                    targets_succeeded: 1,
                    targets_failed: 0,
                    targets_skipped: 0,
                    results: vec![success_target_result("edge-a", "192.0.2.10")],
                }],
            },
            StageExecutionResult {
                name: stage_b.name.clone(),
                strategy: stage_b.strategy,
                status: StageStatus::Failed,
                fail_fast: true,
                jobs_total: 1,
                jobs_succeeded: 0,
                jobs_failed: 1,
                jobs_skipped: 0,
                jobs: vec![JobExecutionResult {
                    name: "job-b".to_string(),
                    strategy: StageStrategy::Serial,
                    status: StageStatus::Failed,
                    fail_fast: true,
                    action_kind: "tx_block".to_string(),
                    action_summary: "tx block".to_string(),
                    targets_total: 1,
                    targets_succeeded: 1,
                    targets_failed: 0,
                    targets_skipped: 0,
                    results: vec![TargetExecutionResult {
                        compensation: Some(super::super::CompensationExecutionResult {
                            scope: "stage_failure".to_string(),
                            attempted: false,
                            success: true,
                            reason: Some("already compensated".to_string()),
                            operation: Some("compensation: job-b".to_string()),
                            duration_ms: 0,
                            error: None,
                            tx_result: None,
                            recording_jsonl: None,
                        }),
                        ..success_target_result("edge-b", "192.0.2.11")
                    }],
                }],
            },
        ];

        compensate_completed_stages(
            &plan,
            &mut stages,
            &OrchestrationInventory::default(),
            Path::new("."),
            &sample_opts(),
            RecordLevelOpt::KeyEventsOnly,
            None,
        )
        .await
        .expect("completed stage compensation");

        let previous = &stages[0].jobs[0].results[0];
        let current = &stages[1].jobs[0].results[0];
        assert_eq!(
            previous
                .compensation
                .as_ref()
                .map(|item| item.scope.as_str()),
            Some("completed_stage_failure")
        );
        assert_eq!(
            current
                .compensation
                .as_ref()
                .and_then(|item| item.reason.as_deref()),
            Some("already compensated")
        );
    }
}
