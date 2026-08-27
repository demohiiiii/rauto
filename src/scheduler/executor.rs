use crate::domain::scheduling::ScheduledAction;
use crate::domain::task::{TaskCallback, TaskOperation, TaskStatus, build_error_result_summary};
use crate::infrastructure::db::schedule_store::ClaimedScheduleRun;
use crate::infrastructure::db::task_store;
use crate::interfaces::api::models::{
    ApiResponse, ConfigBatchFetchRequest, ConnectionRequest, DryRunOptions,
    ExecuteOrchestrationRequest, ExecuteTxWorkflowRequest, ExecutionTargetOptions,
    ManagedTaskOptions,
};
use crate::web::handlers::{
    execute_scheduled_config_batch, execute_scheduled_orchestration, execute_scheduled_tx_workflow,
};
use crate::web::state::AppState;
use chrono::Utc;
use serde_json::Value;
use std::sync::Arc;
use std::time::{Duration, Instant};

pub async fn execute_claimed_run(
    state: Arc<AppState>,
    claimed: &ClaimedScheduleRun,
) -> Result<(), String> {
    let task_id = claimed
        .run
        .task_id
        .clone()
        .ok_or_else(|| "claimed schedule run is missing task_id".to_string())?;
    let operation = match &claimed.schedule.definition.action {
        ScheduledAction::Orchestrate { .. } => TaskOperation::Orchestrate,
        ScheduledAction::ConfigFetch { .. } => TaskOperation::Exec,
        ScheduledAction::TxWorkflow { .. } => TaskOperation::TxWorkflow,
    };
    task_store::save_task_accepted(&task_id, operation).map_err(|error| error.to_string())?;
    task_store::set_task_source(&task_id, "cron").map_err(|error| error.to_string())?;

    let started_at = Utc::now();
    let started_instant = Instant::now();
    let action = claimed.schedule.definition.action.clone();
    let execution_state = state.clone();
    let execution_task_id = task_id.clone();
    let execution = async move {
        match action {
            ScheduledAction::Orchestrate {
                template_name,
                vars,
            } => execute_scheduled_orchestration(
                execution_state,
                ExecuteOrchestrationRequest {
                    plan_template_name: Some(template_name),
                    plan_template_content: None,
                    plan_vars: vars,
                    plan: Value::Null,
                    base_dir: None,
                    run: DryRunOptions {
                        dry_run: Some(false),
                    },
                    target: ExecutionTargetOptions::default(),
                    task: ManagedTaskOptions {
                        task_id: Some(execution_task_id),
                    },
                },
            )
            .await
            .map_err(|error| error.message)
            .and_then(|response| scheduled_response_result(response.0)),
            ScheduledAction::ConfigFetch {
                connection_name,
                mut targets,
                groups,
                labels,
                kind,
            } => {
                if let Some(connection_name) = connection_name {
                    targets.push(connection_name);
                }
                execute_scheduled_config_batch(
                    execution_state,
                    ConfigBatchFetchRequest {
                        kind,
                        include_normalized: false,
                        targets,
                        groups,
                        labels,
                        max_parallel: None,
                        retry: None,
                        record_level: None,
                        task: ManagedTaskOptions {
                            task_id: Some(execution_task_id),
                        },
                    },
                )
                .await
                .map_err(|error| error.message)
                .and_then(|response| scheduled_response_result(response.0))
            }
            ScheduledAction::TxWorkflow {
                connection_name,
                template_name,
                vars,
            } => execute_scheduled_tx_workflow(
                execution_state,
                ExecuteTxWorkflowRequest {
                    workflow_template_name: Some(template_name),
                    workflow_template_content: None,
                    workflow_vars: vars,
                    workflow: Value::Null,
                    run: DryRunOptions {
                        dry_run: Some(false),
                    },
                    target: saved_connection_target(connection_name),
                    task: ManagedTaskOptions {
                        task_id: Some(execution_task_id),
                    },
                },
            )
            .await
            .map_err(|error| error.message)
            .and_then(|response| scheduled_response_result(response.0)),
        }
    };

    let timeout = Duration::from_secs(claimed.schedule.definition.max_runtime_seconds);
    let execution = tokio::time::timeout(timeout, execution).await;
    let failure = match execution {
        Ok(Ok(())) => return Ok(()),
        Ok(Err(error)) => error,
        Err(_) => format!(
            "scheduled task exceeded {} seconds",
            claimed.schedule.definition.max_runtime_seconds
        ),
    };

    let callback = TaskCallback {
        task_id,
        agent_name: "local".to_string(),
        status: TaskStatus::Failed,
        started_at: started_at.to_rfc3339(),
        completed_at: Utc::now().to_rfc3339(),
        execution_time_ms: started_instant.elapsed().as_millis() as u64,
        result_summary: Some(build_error_result_summary(operation, failure.clone())),
        result: None,
        error: Some(failure.clone()),
    };
    if let Err(error) = task_store::save_task_callback(&callback, operation) {
        return Err(format!("{failure}; failed to persist task result: {error}"));
    }
    Err(failure)
}

fn scheduled_response_result<T>(response: ApiResponse<T>) -> Result<(), String> {
    if response.success {
        return Ok(());
    }
    Err(response
        .error
        .map(|error| error.message)
        .unwrap_or_else(|| "scheduled task failed".to_string()))
}

fn saved_connection_target(connection_name: String) -> ExecutionTargetOptions {
    ExecutionTargetOptions {
        connection: Some(ConnectionRequest {
            connection_name: Some(connection_name),
            ..Default::default()
        }),
        record_level: None,
    }
}
