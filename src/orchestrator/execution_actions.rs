use super::{
    ActionExecutionOutcome, OrchestrationAction, OrchestrationEventHook, OrchestrationPlan,
    OrchestrationRuntimeEvent, OrchestrationTarget, RecordLevelOpt, TxBlockAction,
    TxWorkflowAction, template_resolver,
};
use crate::config::command_blacklist;
use crate::config::template_loader;
use crate::{
    EffectiveConnection, manager_connection_request, manager_execution_context_with_security,
    normalize_recording_jsonl_for_cli_level, persist_auto_recording_history_jsonl, to_record_level,
};
use anyhow::Result;
use rneter::session::MANAGER;
use std::path::Path;

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
