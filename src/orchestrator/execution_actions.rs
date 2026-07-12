use super::{
    ActionExecutionOutcome, CompensationExecutionResult, OrchestrationAction,
    OrchestrationEventHook, OrchestrationPlan, OrchestrationRuntimeEvent, OrchestrationTarget,
    RecordLevelOpt, TxBlockAction, TxWorkflowAction, template_resolver,
};
use crate::config::command_blacklist;
use crate::config::template_loader;
use crate::{
    EffectiveConnection, manager_connection_request, manager_execution_context_with_security,
    normalize_recording_jsonl_for_cli_level, persist_auto_recording_history_jsonl, to_record_level,
};
use anyhow::Result;
use rneter::session::{MANAGER, RollbackPolicy, SessionOperation, TxBlock, TxStep};
use std::path::Path;
use std::time::Instant;

pub(super) fn emit_orchestration_event(
    hook: &Option<OrchestrationEventHook>,
    event: OrchestrationRuntimeEvent,
) {
    if let Some(hook) = hook {
        hook(event);
    }
}

pub(super) fn task_progress(current: usize, total: usize) -> Option<u8> {
    if total == 0 {
        return None;
    }
    let pct = ((current as f64 / total as f64) * 100.0).round() as i64;
    Some(pct.clamp(0, 100) as u8)
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn execute_action(
    plan: &OrchestrationPlan,
    stage_name: &str,
    job_name: &str,
    action: &OrchestrationAction,
    target: &OrchestrationTarget,
    conn: &EffectiveConnection,
    plan_root: &Path,
    record_level: RecordLevelOpt,
) -> Result<ActionExecutionOutcome> {
    match action {
        OrchestrationAction::TxBlock(action) => {
            execute_tx_block_action(
                plan,
                stage_name,
                job_name,
                action,
                target,
                conn,
                record_level,
            )
            .await
        }
        OrchestrationAction::TxWorkflow(action) => {
            execute_tx_workflow_action(
                plan,
                stage_name,
                job_name,
                action,
                conn,
                plan_root,
                record_level,
            )
            .await
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn execute_compensation_action(
    scope: &str,
    plan: &OrchestrationPlan,
    stage_name: &str,
    job_name: &str,
    action: &OrchestrationAction,
    target: &OrchestrationTarget,
    conn: &EffectiveConnection,
    plan_root: &Path,
    record_level: RecordLevelOpt,
) -> Result<CompensationExecutionResult> {
    let started = Instant::now();
    let (rollback_block, source_operation) =
        build_compensation_block(plan, stage_name, job_name, action, target, conn, plan_root)?;
    if rollback_block.steps.is_empty() {
        return Ok(CompensationExecutionResult {
            scope: scope.to_string(),
            attempted: false,
            success: true,
            reason: Some("no rollback operations planned".to_string()),
            operation: Some(source_operation),
            duration_ms: started.elapsed().as_millis(),
            error: None,
            tx_result: None,
            recording_jsonl: None,
        });
    }

    command_blacklist::ensure_tx_block_allowed(
        &rollback_block,
        &format!("orchestration compensation '{}'", rollback_block.name),
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
            manager_execution_context_with_security(
                None,
                conn.ssh_security,
                conn.connect_timeout_secs,
            ),
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
    let rollback_name = rollback_block.name.clone();
    let tx_result = MANAGER
        .execute_tx_block_with_context(
            request,
            rollback_block,
            manager_execution_context_with_security(
                None,
                conn.ssh_security,
                conn.connect_timeout_secs,
            ),
        )
        .await?;
    let jsonl = normalize_recording_jsonl_for_cli_level(&recorder.to_jsonl()?, record_level);
    persist_auto_recording_history_jsonl(
        &jsonl,
        conn,
        "orchestrate_compensation",
        &rollback_name,
        None,
        record_level,
    )?;
    let success = tx_result.committed;
    Ok(CompensationExecutionResult {
        scope: scope.to_string(),
        attempted: true,
        success,
        reason: None,
        operation: Some(format!("compensation: {}", rollback_name)),
        duration_ms: started.elapsed().as_millis(),
        error: if success {
            None
        } else {
            Some(format!(
                "compensation '{}' finished with failure",
                rollback_name
            ))
        },
        tx_result: Some(serde_json::to_value(&tx_result)?),
        recording_jsonl: Some(jsonl),
    })
}

fn build_compensation_block(
    plan: &OrchestrationPlan,
    stage_name: &str,
    job_name: &str,
    action: &OrchestrationAction,
    target: &OrchestrationTarget,
    conn: &EffectiveConnection,
    plan_root: &Path,
) -> Result<(TxBlock, String)> {
    let (operations, source_operation) = match action {
        OrchestrationAction::TxBlock(action) => {
            let (tx_block, _mode, tx_block_name) =
                template_resolver::resolve_orchestration_tx_block(
                    plan, stage_name, job_name, action, target, conn,
                )?;
            let operations = rollback_operations_for_block(&tx_block)?;
            (operations, format!("tx_block: {}", tx_block_name))
        }
        OrchestrationAction::TxWorkflow(action) => {
            let workflow = template_resolver::load_workflow(action, plan_root, conn)?;
            let workflow_name = workflow.name.clone();
            let mut operations = Vec::new();
            for block in workflow.blocks.iter().rev() {
                operations.extend(rollback_operations_for_block(block)?);
            }
            (operations, format!("tx_workflow: {}", workflow_name))
        }
    };

    let steps = operations.into_iter().map(TxStep::new).collect::<Vec<_>>();
    let tx_block = TxBlock {
        name: format!("rollback::{}::{}", stage_name, job_name),
        rollback_policy: RollbackPolicy::None,
        steps,
        fail_fast: true,
    };
    if !tx_block.steps.is_empty() {
        tx_block.validate()?;
    }
    Ok((tx_block, source_operation))
}

fn rollback_operations_for_block(block: &TxBlock) -> Result<Vec<SessionOperation>> {
    let executed_step_indices = (0..block.steps.len()).collect::<Vec<_>>();
    Ok(block
        .plan_rollback(&executed_step_indices, None)?
        .into_iter()
        .map(|planned| planned.operation)
        .collect())
}

async fn execute_tx_block_action(
    plan: &OrchestrationPlan,
    stage_name: &str,
    job_name: &str,
    action: &TxBlockAction,
    target: &OrchestrationTarget,
    conn: &EffectiveConnection,
    record_level: RecordLevelOpt,
) -> Result<ActionExecutionOutcome> {
    let (tx_block, mode, tx_block_name) = template_resolver::resolve_orchestration_tx_block(
        plan, stage_name, job_name, action, target, conn,
    )?;

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
            manager_execution_context_with_security(
                None,
                conn.ssh_security,
                conn.connect_timeout_secs,
            ),
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
            manager_execution_context_with_security(
                None,
                conn.ssh_security,
                conn.connect_timeout_secs,
            ),
        )
        .await?;
    let jsonl = normalize_recording_jsonl_for_cli_level(&recorder.to_jsonl()?, record_level);
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
    stage_name: &str,
    job_name: &str,
    action: &TxWorkflowAction,
    conn: &EffectiveConnection,
    plan_root: &Path,
    record_level: RecordLevelOpt,
) -> Result<ActionExecutionOutcome> {
    let workflow = template_resolver::load_workflow(action, plan_root, conn)?;
    let workflow_name = workflow.name.clone();
    let operation_name = format!(
        "{}::{}::{}::{}",
        plan.name, stage_name, job_name, workflow_name
    );
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
            manager_execution_context_with_security(
                None,
                conn.ssh_security,
                conn.connect_timeout_secs,
            ),
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
            manager_execution_context_with_security(
                None,
                conn.ssh_security,
                conn.connect_timeout_secs,
            ),
        )
        .await?;
    let jsonl = normalize_recording_jsonl_for_cli_level(&recorder.to_jsonl()?, record_level);
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ssh_security::SshSecurityProfile;
    use crate::tx_operation::command;
    use serde_json::json;

    fn sample_plan() -> OrchestrationPlan {
        OrchestrationPlan {
            name: "plan-demo".to_string(),
            fail_fast: true,
            rollback_on_stage_failure: true,
            rollback_completed_stages_on_failure: false,
            inventory_file: None,
            inventory: None,
            stages: Vec::new(),
        }
    }

    fn sample_conn() -> EffectiveConnection {
        EffectiveConnection {
            connection_name: Some("edge-01".to_string()),
            host: "192.0.2.10".to_string(),
            username: "admin".to_string(),
            password: "secret".to_string(),
            port: 22,
            connect_timeout_secs: None,
            enable_password: None,
            ssh_security: SshSecurityProfile::Balanced,
            linux_shell_flavor: None,
            device_profile: "linux".to_string(),
            vars: json!({}),
            template_dir: None,
            force_autodetect: false,
        }
    }

    fn sample_target() -> OrchestrationTarget {
        OrchestrationTarget {
            connection: Some("edge-01".to_string()),
            host: Some("192.0.2.10".to_string()),
            ..OrchestrationTarget::default()
        }
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn compensation_noop_for_none_rollback_policy() {
        let action = OrchestrationAction::TxBlock(TxBlockAction {
            name: Some("noop".to_string()),
            template: None,
            tx_block_template_name: None,
            tx_block_template_content: Some(
                json!({
                    "name": "noop",
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
        });

        let result = execute_compensation_action(
            "stage_failure",
            &sample_plan(),
            "stage-a",
            "job-a",
            &action,
            &sample_target(),
            &sample_conn(),
            Path::new("."),
            RecordLevelOpt::KeyEventsOnly,
        )
        .await
        .expect("compensation action");

        assert!(!result.attempted);
        assert!(result.success);
        assert_eq!(
            result.reason.as_deref(),
            Some("no rollback operations planned")
        );
    }

    #[test]
    fn compensation_block_wraps_whole_resource_rollback_as_single_step() {
        let action = OrchestrationAction::TxBlock(TxBlockAction {
            name: Some("whole-resource".to_string()),
            template: None,
            tx_block_template_name: None,
            tx_block_template_content: Some(
                json!({
                    "name": "whole-resource",
                    "rollback_policy": {
                        "whole_resource": {
                            "rollback": {
                                "kind": "command",
                                "mode": "Config",
                                "command": "delete service web"
                            },
                            "trigger_step_index": 0
                        }
                    },
                    "steps": [
                        {
                            "run": {
                                "kind": "command",
                                "mode": "Config",
                                "command": "set service web"
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
        });

        let (compensation, source_operation) = build_compensation_block(
            &sample_plan(),
            "stage-a",
            "job-a",
            &action,
            &sample_target(),
            &sample_conn(),
            Path::new("."),
        )
        .expect("compensation block");

        assert_eq!(source_operation, "tx_block: whole-resource");
        assert!(matches!(compensation.rollback_policy, RollbackPolicy::None));
        assert_eq!(compensation.steps.len(), 1);
        let summary = compensation.steps[0]
            .run
            .summary()
            .expect("summary should be available");
        assert_eq!(summary.description, "delete service web");
    }

    #[test]
    fn compensation_block_keeps_per_step_rollback_in_reverse_order() {
        let block = TxBlock {
            name: "per-step".to_string(),
            rollback_policy: RollbackPolicy::PerStep,
            steps: vec![
                TxStep::new(command("Config", "set a", None))
                    .with_rollback(command("Config", "delete a", None)),
                TxStep::new(command("Config", "set b", None))
                    .with_rollback(command("Config", "delete b", None)),
            ],
            fail_fast: true,
        };

        let operations = rollback_operations_for_block(&block).expect("rollback plan");
        assert_eq!(operations.len(), 2);
        let first = operations[0].summary().expect("summary");
        let second = operations[1].summary().expect("summary");
        assert_eq!(first.description, "delete b");
        assert_eq!(second.description, "delete a");
    }

    #[test]
    fn workflow_compensation_reverses_blocks_before_step_rollbacks() {
        let workflow = json!({
            "name": "wf-demo",
            "blocks": [
                {
                    "name": "block-a",
                    "rollback_policy": "per_step",
                    "steps": [
                        {
                            "run": {
                                "kind": "command",
                                "mode": "Config",
                                "command": "set a1"
                            },
                            "rollback": {
                                "kind": "command",
                                "mode": "Config",
                                "command": "delete a1"
                            }
                        }
                    ],
                    "fail_fast": true
                },
                {
                    "name": "block-b",
                    "rollback_policy": {
                        "whole_resource": {
                            "rollback": {
                                "kind": "command",
                                "mode": "Config",
                                "command": "delete service b"
                            },
                            "trigger_step_index": 0
                        }
                    },
                    "steps": [
                        {
                            "run": {
                                "kind": "command",
                                "mode": "Config",
                                "command": "set service b"
                            }
                        }
                    ],
                    "fail_fast": true
                }
            ],
            "fail_fast": true
        });
        let action = OrchestrationAction::TxWorkflow(TxWorkflowAction {
            workflow_file: None,
            workflow: Some(workflow),
            workflow_template_name: None,
            workflow_template_content: None,
            workflow_vars: serde_json::Value::Null,
        });

        let (compensation, source_operation) = build_compensation_block(
            &sample_plan(),
            "stage-a",
            "job-a",
            &action,
            &sample_target(),
            &sample_conn(),
            Path::new("."),
        )
        .expect("workflow compensation block");

        assert_eq!(source_operation, "tx_workflow: wf-demo");
        assert_eq!(compensation.steps.len(), 2);
        let first = compensation.steps[0].run.summary().expect("summary");
        let second = compensation.steps[1].run.summary().expect("summary");
        assert_eq!(first.description, "delete service b");
        assert_eq!(second.description, "delete a1");
    }
}
