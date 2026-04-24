use super::targets as orchestrator_targets;
use super::{
    OrchestrationExecutionResult, OrchestrationInventory, OrchestrationPlan, StageStatus,
    StageStrategy, action_kind_name, action_summary, job_name, target_label,
};
use anyhow::Result;
use std::fmt::Write as _;
use std::path::PathBuf;

fn strategy_name(strategy: StageStrategy) -> &'static str {
    match strategy {
        StageStrategy::Serial => "serial",
        StageStrategy::Parallel => "parallel",
    }
}

fn stage_status_name(status: StageStatus) -> &'static str {
    match status {
        StageStatus::Success => "SUCCESS",
        StageStatus::Failed => "FAILED",
        StageStatus::Skipped => "SKIPPED",
    }
}

pub(super) fn render_plan(
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
        "overview: fail_fast={} rollback_on_stage_failure={} rollback_completed_stages_on_failure={} stages={} inventory_groups={}",
        plan.fail_fast,
        plan.rollback_on_stage_failure,
        plan.rollback_completed_stages_on_failure,
        plan.stages.len(),
        inventory.groups.len()
    );
    let _ = writeln!(&mut out);

    for (stage_idx, stage) in plan.stages.iter().enumerate() {
        let _ = writeln!(
            &mut out,
            "[Stage {}/{}] {}",
            stage_idx + 1,
            plan.stages.len(),
            stage.name
        );
        let _ = writeln!(
            &mut out,
            "strategy={} fail_fast={} jobs={}",
            strategy_name(stage.strategy),
            stage.fail_fast.unwrap_or(false),
            stage.jobs.len()
        );
        if let Some(max_parallel) = stage.max_parallel {
            let _ = writeln!(&mut out, "max_parallel={}", max_parallel);
        }
        for (job_idx, job) in stage.jobs.iter().enumerate() {
            let targets =
                orchestrator_targets::resolve_job_targets(stage.name.as_str(), job, inventory)?;
            let _ = writeln!(
                &mut out,
                "  [Job {}/{}] {}",
                job_idx + 1,
                stage.jobs.len(),
                job_name(job, job_idx)
            );
            let _ = writeln!(
                &mut out,
                "  strategy={} fail_fast={} targets={} action={} ({})",
                strategy_name(job.strategy),
                job.fail_fast.unwrap_or(true),
                targets.len(),
                action_kind_name(&job.action),
                action_summary(&job.action),
            );
            if let Some(max_parallel) = job.max_parallel {
                let _ = writeln!(&mut out, "  max_parallel={}", max_parallel);
            }
            if !job.target_groups.is_empty() {
                let _ = writeln!(&mut out, "  target_groups={}", job.target_groups.join(", "));
            }
            if !job.target_tags.is_empty() {
                let _ = writeln!(&mut out, "  target_tags={}", job.target_tags.join(", "));
            }
            for (target_idx, target) in targets.iter().enumerate() {
                let _ = writeln!(&mut out, "  - {}", target_label(target, target_idx));
            }
        }
        let _ = writeln!(&mut out);
    }

    Ok(out)
}

pub(super) fn render_execution_result(result: &OrchestrationExecutionResult) -> String {
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
            "[{}] {} strategy={} jobs={} ok={} failed={} skipped={}",
            stage_status_name(stage.status),
            stage.name,
            strategy_name(stage.strategy),
            stage.jobs_total,
            stage.jobs_succeeded,
            stage.jobs_failed,
            stage.jobs_skipped,
        );
        for job in &stage.jobs {
            let _ = writeln!(
                &mut out,
                "  [{}] {} strategy={} targets={} ok={} failed={} skipped={} action={}",
                stage_status_name(job.status),
                job.name,
                strategy_name(job.strategy),
                job.targets_total,
                job.targets_succeeded,
                job.targets_failed,
                job.targets_skipped,
                job.action_kind,
            );
            let _ = writeln!(&mut out, "  summary: {}", job.action_summary);
            for target in &job.results {
                let _ = writeln!(
                    &mut out,
                    "  - [{}] {} host={} op={} duration_ms={}",
                    match target.status {
                        super::TargetStatus::Success => "ok",
                        super::TargetStatus::Failed => "failed",
                        super::TargetStatus::Skipped => "skipped",
                    },
                    target.label,
                    target.host.as_deref().unwrap_or("-"),
                    target.operation,
                    target.duration_ms,
                );
                if let Some(error) = &target.error {
                    let _ = writeln!(&mut out, "    error: {}", error);
                }
                if let Some(compensation) = &target.compensation {
                    let _ = writeln!(
                        &mut out,
                        "    compensation: scope={} attempted={} success={} duration_ms={}",
                        compensation.scope,
                        compensation.attempted,
                        compensation.success,
                        compensation.duration_ms
                    );
                    if let Some(reason) = &compensation.reason {
                        let _ = writeln!(&mut out, "    compensation_reason: {}", reason);
                    }
                    if let Some(error) = &compensation.error {
                        let _ = writeln!(&mut out, "    compensation_error: {}", error);
                    }
                }
            }
        }
        let _ = writeln!(&mut out);
    }

    out
}
