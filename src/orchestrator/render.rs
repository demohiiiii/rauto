use super::targets as orchestrator_targets;
use super::{
    OrchestrationExecutionResult, OrchestrationInventory, OrchestrationPlan, StageStatus,
    StageStrategy, action_kind_name, action_summary, target_label,
};
use anyhow::Result;
use std::fmt::Write as _;
use std::path::PathBuf;

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
        "overview: fail_fast={} stages={} inventory_groups={}",
        plan.fail_fast,
        plan.stages.len(),
        inventory.groups.len()
    );
    let _ = writeln!(&mut out);

    for (stage_idx, stage) in plan.stages.iter().enumerate() {
        let targets = orchestrator_targets::resolve_stage_targets(stage, inventory)?;
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
                let _ = writeln!(&mut out, "  error: {}", error);
            }
        }
        let _ = writeln!(&mut out);
    }

    out
}
