use super::*;

pub(super) fn require_managed_async_task(
    operation: TaskOperation,
    task_id: Option<String>,
    managed: bool,
) -> Result<String, ApiError> {
    if !managed {
        return Err(ApiError::bad_request(format!(
            "{} async endpoint requires agent mode",
            operation
        )));
    }
    task_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| {
            ApiError::bad_request(format!("{} async endpoint requires task_id", operation))
        })
}

fn build_async_task_accepted_response(
    task_id: String,
    operation: TaskOperation,
) -> AsyncTaskAcceptedResponse {
    if let Err(err) = task_store::save_task_accepted(&task_id, operation) {
        warn!("failed to persist accepted task {}: {}", task_id, err);
    }
    AsyncTaskAcceptedResponse {
        accepted: true,
        task_id,
        operation,
        status: TaskStatus::Queued,
    }
}

struct AsyncTaskFailureSpec {
    task_id: String,
    operation_name: String,
    started_at: chrono::DateTime<Utc>,
    started_instant: Instant,
    failure_message: String,
    details: Value,
    fallback_reason: String,
}

async fn report_async_task_failure(state: Arc<AppState>, spec: AsyncTaskFailureSpec) {
    let Some(registrar) = state.registrar() else {
        return;
    };

    let AsyncTaskFailureSpec {
        task_id,
        operation_name,
        started_at,
        started_instant,
        failure_message,
        details,
        fallback_reason,
    } = spec;

    let agent_name = current_agent_name(&state);
    let event = TaskEvent {
        task_id: task_id.clone(),
        agent_name: agent_name.clone(),
        event_type: TaskEventType::Failed,
        message: failure_message.clone(),
        level: TaskEventLevel::Error,
        stage: Some(operation_name.to_string()),
        progress: Some(100),
        details: Some(details),
        occurred_at: Utc::now().to_rfc3339(),
    };
    registrar.report_task_event_best_effort(event).await;

    let callback = TaskCallback {
        task_id: task_id.clone(),
        agent_name,
        status: TaskStatus::Failed,
        started_at: started_at.to_rfc3339(),
        completed_at: Utc::now().to_rfc3339(),
        execution_time_ms: started_instant.elapsed().as_millis() as u64,
        result_summary: Some(build_error_result_summary(
            task_name_to_operation(&operation_name),
            failure_message.clone(),
        )),
        result: None,
        error: Some(failure_message),
    };

    if let Err(err) = registrar.send_task_callback(&callback).await {
        warn!("fallback task callback failed: {}", err);
        registrar
            .report_async_error_best_effort(
                AsyncErrorReportInput::new("task_callback_failed", err.to_string())
                    .with_task_id(Some(task_id))
                    .with_operation(Some(operation_name))
                    .with_target_url(Some(registrar.task_callback_report_target()))
                    .with_http_method(Some(registrar.report_transport_method_name().to_string()))
                    .with_details(Some(json!({
                        "task_status": callback.status,
                        "started_at": callback.started_at,
                        "completed_at": callback.completed_at,
                        "execution_time_ms": callback.execution_time_ms,
                        "fallback_reason": fallback_reason
                    }))),
            )
            .await;
    }
}

fn spawn_supervised_async_task<F>(state: Arc<AppState>, task_id: String, operation: &str, task: F)
where
    F: Future<Output = Result<(), ApiError>> + Send + 'static,
{
    let operation_name = operation.to_string();
    let accepted_at = Utc::now();
    let accepted_instant = Instant::now();
    tokio::spawn(async move {
        let worker = tokio::spawn(task);
        match worker.await {
            Ok(Ok(())) => {}
            Ok(Err(err)) => {
                warn!(
                    "background {} task returned error after handler execution: {}",
                    operation_name, err.message
                );
                let api_error_message = err.message;
                report_async_task_failure(
                    state.clone(),
                    AsyncTaskFailureSpec {
                        task_id: task_id.clone(),
                        operation_name: operation_name.clone(),
                        started_at: accepted_at,
                        started_instant: accepted_instant,
                        failure_message: api_error_message.clone(),
                        details: json!({
                            "failure_type": "task_error",
                            "operation": operation_name.clone(),
                            "api_error": api_error_message
                        }),
                        fallback_reason: api_error_message,
                    },
                )
                .await;
            }
            Err(join_err) => {
                let failure_message = if join_err.is_panic() {
                    format!("Background {} task panicked", operation_name)
                } else if join_err.is_cancelled() {
                    format!("Background {} task was cancelled", operation_name)
                } else {
                    format!("Background {} task terminated unexpectedly", operation_name)
                };
                warn!("{} for task_id={}", failure_message, task_id);
                report_async_task_failure(
                    state,
                    AsyncTaskFailureSpec {
                        task_id,
                        operation_name,
                        started_at: accepted_at,
                        started_instant: accepted_instant,
                        failure_message,
                        details: json!({
                            "failure_type": "join_error",
                            "join_error": join_err.to_string(),
                            "panic": join_err.is_panic(),
                            "cancelled": join_err.is_cancelled()
                        }),
                        fallback_reason: join_err.to_string(),
                    },
                )
                .await;
            }
        }
    });
}

pub(super) fn queue_exec_async_task(
    state: Arc<AppState>,
    req: ExecRequest,
) -> Result<AsyncTaskAcceptedResponse, ApiError> {
    let task_id = require_managed_async_task(
        TaskOperation::Exec,
        req.task.task_id.clone(),
        state.is_managed(),
    )?;
    let background_state = state.clone();
    spawn_supervised_async_task(
        background_state.clone(),
        task_id.clone(),
        "exec",
        async move {
            exec_command(State(background_state), Json(req))
                .await
                .map(|_| ())
        },
    );
    Ok(build_async_task_accepted_response(
        task_id,
        TaskOperation::Exec,
    ))
}

pub(super) fn queue_template_async_task(
    state: Arc<AppState>,
    req: ExecuteTemplateRequest,
) -> Result<AsyncTaskAcceptedResponse, ApiError> {
    let task_id = require_managed_async_task(
        TaskOperation::TemplateExecute,
        req.task.task_id.clone(),
        state.is_managed(),
    )?;
    let background_state = state.clone();
    spawn_supervised_async_task(
        background_state.clone(),
        task_id.clone(),
        "template_execute",
        async move {
            execute_template(State(background_state), Json(req))
                .await
                .map(|_| ())
        },
    );
    Ok(build_async_task_accepted_response(
        task_id,
        TaskOperation::TemplateExecute,
    ))
}

pub(crate) fn queue_tx_block_async_task(
    state: Arc<AppState>,
    req: ExecuteTxBlockRequest,
) -> Result<AsyncTaskAcceptedResponse, ApiError> {
    let task_id = require_managed_async_task(
        TaskOperation::TxBlock,
        req.task.task_id.clone(),
        state.is_managed(),
    )?;
    let background_state = state.clone();
    spawn_supervised_async_task(
        background_state.clone(),
        task_id.clone(),
        "tx_block",
        async move {
            execute_tx_block(State(background_state), Json(req))
                .await
                .map(|_| ())
        },
    );
    Ok(build_async_task_accepted_response(
        task_id,
        TaskOperation::TxBlock,
    ))
}

pub(crate) fn queue_tx_workflow_async_task(
    state: Arc<AppState>,
    req: ExecuteTxWorkflowRequest,
) -> Result<AsyncTaskAcceptedResponse, ApiError> {
    let task_id = require_managed_async_task(
        TaskOperation::TxWorkflow,
        req.task.task_id.clone(),
        state.is_managed(),
    )?;
    let background_state = state.clone();
    spawn_supervised_async_task(
        background_state.clone(),
        task_id.clone(),
        "tx_workflow",
        async move {
            execute_tx_workflow(State(background_state), Json(req))
                .await
                .map(|_| ())
        },
    );
    Ok(build_async_task_accepted_response(
        task_id,
        TaskOperation::TxWorkflow,
    ))
}

pub(crate) fn queue_orchestration_async_task(
    state: Arc<AppState>,
    req: ExecuteOrchestrationRequest,
) -> Result<AsyncTaskAcceptedResponse, ApiError> {
    let task_id = require_managed_async_task(
        TaskOperation::Orchestrate,
        req.task.task_id.clone(),
        state.is_managed(),
    )?;
    let background_state = state.clone();
    spawn_supervised_async_task(
        background_state.clone(),
        task_id.clone(),
        "orchestrate",
        async move {
            execute_orchestration(State(background_state), Json(req))
                .await
                .map(|_| ())
        },
    );
    Ok(build_async_task_accepted_response(
        task_id,
        TaskOperation::Orchestrate,
    ))
}

fn build_task_callback<T: Serialize>(
    state: &Arc<AppState>,
    task_ctx: &TaskReportContext,
    result: &Result<T, ApiError>,
) -> TaskCallback {
    match result {
        Ok(value) => {
            let result_json = serde_json::to_value(value).ok();
            callback_from_result_envelope(
                state,
                TaskResultEnvelope {
                    task_id: task_ctx.task_id.clone(),
                    operation: task_ctx.operation,
                    status: TaskStatus::Success,
                    started_at: task_ctx.started_at.to_rfc3339(),
                    completed_at: Utc::now().to_rfc3339(),
                    execution_time_ms: task_ctx.started_instant.elapsed().as_millis() as u64,
                    result_summary: extract_result_summary(value).unwrap_or_else(|| {
                        build_error_result_summary(
                            task_ctx.operation,
                            "missing result_summary in successful task response",
                        )
                    }),
                    result: result_json,
                    error: None,
                },
            )
        }
        Err(err) => callback_from_result_envelope(
            state,
            TaskResultEnvelope {
                task_id: task_ctx.task_id.clone(),
                operation: task_ctx.operation,
                status: TaskStatus::Failed,
                started_at: task_ctx.started_at.to_rfc3339(),
                completed_at: Utc::now().to_rfc3339(),
                execution_time_ms: task_ctx.started_instant.elapsed().as_millis() as u64,
                result_summary: build_error_result_summary(task_ctx.operation, err.message.clone()),
                result: None,
                error: Some(err.message.clone()),
            },
        ),
    }
}

fn callback_from_result_envelope(
    state: &Arc<AppState>,
    envelope: TaskResultEnvelope,
) -> TaskCallback {
    TaskCallback {
        task_id: envelope.task_id,
        agent_name: current_agent_name(state),
        status: envelope.status,
        started_at: envelope.started_at,
        completed_at: envelope.completed_at,
        execution_time_ms: envelope.execution_time_ms,
        result_summary: Some(envelope.result_summary),
        result: envelope.result,
        error: envelope.error,
    }
}

pub(super) fn build_failed_task_callback<T: Serialize>(
    state: &Arc<AppState>,
    task_ctx: &TaskReportContext,
    message: impl Into<String>,
    result: Option<&T>,
) -> TaskCallback {
    let error_message = message.into();
    callback_from_result_envelope(
        state,
        TaskResultEnvelope {
            task_id: task_ctx.task_id.clone(),
            operation: task_ctx.operation,
            status: TaskStatus::Failed,
            started_at: task_ctx.started_at.to_rfc3339(),
            completed_at: Utc::now().to_rfc3339(),
            execution_time_ms: task_ctx.started_instant.elapsed().as_millis() as u64,
            result_summary: result.and_then(extract_result_summary).unwrap_or_else(|| {
                build_error_result_summary(task_ctx.operation, error_message.clone())
            }),
            result: result.and_then(|value| serde_json::to_value(value).ok()),
            error: Some(error_message),
        },
    )
}

pub(super) fn spawn_prepared_task_callback(
    state: Arc<AppState>,
    task_ctx: Option<TaskReportContext>,
    callback: TaskCallback,
) {
    let Some(task_ctx) = task_ctx else {
        return;
    };

    let registrar = state.registrar();
    tokio::spawn(async move {
        if let Err(err) = task_store::save_task_callback(&callback, task_ctx.operation) {
            warn!(
                "failed to persist task callback {}: {}",
                task_ctx.task_id, err
            );
        }
        let Some(registrar) = registrar else {
            return;
        };
        let send_result = registrar.send_task_callback(&callback).await;
        if let Err(err) = send_result {
            warn!("task callback failed: {}", err);
            if let Some(registrar) = state.registrar() {
                let target_url = registrar.task_callback_report_target();
                let transport_method = registrar.report_transport_method_name().to_string();
                registrar
                    .report_async_error_best_effort(
                        AsyncErrorReportInput::new("task_callback_failed", err.to_string())
                            .with_task_id(Some(task_ctx.task_id.clone()))
                            .with_operation(Some(task_ctx.operation.to_string()))
                            .with_target_url(Some(target_url))
                            .with_http_method(Some(transport_method))
                            .with_details(Some(json!({
                                "task_status": callback.status,
                                "started_at": callback.started_at,
                                "completed_at": callback.completed_at,
                                "execution_time_ms": callback.execution_time_ms
                            }))),
                    )
                    .await;
            }
        }
    });
}

pub(super) fn spawn_task_callback<T: Serialize>(
    state: Arc<AppState>,
    task_ctx: Option<TaskReportContext>,
    result: &Result<T, ApiError>,
) {
    let Some(task_ctx_ref) = task_ctx.as_ref() else {
        return;
    };
    let callback = build_task_callback(&state, task_ctx_ref, result);
    spawn_prepared_task_callback(state, task_ctx, callback);
}
