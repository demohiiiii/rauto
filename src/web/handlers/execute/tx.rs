use super::*;

pub async fn execute_tx_block(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxBlockRequest>,
) -> Result<Json<ApiResponse<ExecuteTxBlockResponse>>, ApiError> {
    let req = resolve_tx_block_request_from_template(req, &state.defaults)?;
    let (task_ctx, task_guard) = begin_reported_task(
        &state,
        TaskOperation::TxBlock,
        req.task.task_id.clone(),
        TaskEventInput::new("started", "Starting tx block execution")
            .with_stage("tx_block")
            .with_progress(Some(0)),
    );
    let result: Result<ExecuteTxBlockResponse, ApiError> = state
        .run_until_shutdown(async {
            let record_level = req.target.record_level;
            let dry_run = req.run.dry_run.unwrap_or(false);
            let conn = merge_connection_options(&state.defaults, req.target.connection.clone())?;
            let conn = if dry_run {
                conn
            } else {
                resolve_autodetect_connection(conn).await?
            };
            let (tx_block, effective_mode, block_name) =
                build_tx_block_from_request(req, Some(&conn))?;
            let tx_block_value = serde_json::to_value(&tx_block).map_err(ApiError::from)?;
            emit_task_event(
                &state,
                &task_ctx,
                TaskEventInput::new("progress", "Tx block built")
                    .with_stage("tx_block")
                    .with_progress(Some(20))
                    .with_details(Some(json!({
                        "name": block_name,
                        "steps": tx_block.steps.len()
                    }))),
            );
            if dry_run {
                return Ok(ExecuteTxBlockResponse {
                    tx_block: tx_block_value,
                    tx_result: None,
                    recording_jsonl: None,
                    result_summary: task_result_with_details(
                        task_result_with_counts(
                            build_result_summary(
                                TaskOperation::TxBlock,
                                TaskResultOutcome::DryRun,
                                "Tx block built successfully (dry run)",
                            ),
                            result_counts(tx_block.steps.len() as u64, 0, 0),
                        ),
                        json!({
                            "name": block_name,
                            "mode": effective_mode
                        }),
                    ),
                });
            }

            command_blacklist::ensure_tx_block_allowed(
                &tx_block,
                &format!("tx block '{}'", block_name),
            )
            .map_err(|e| ApiError::bad_request(e.to_string()))?;
            emit_task_event(
                &state,
                &task_ctx,
                TaskEventInput::new("progress", "Executing tx block")
                    .with_stage("tx_block")
                    .with_progress(Some(60))
                    .with_details(Some(json!({
                        "name": block_name,
                        "host": conn.host,
                        "connection_name": conn.connection_name
                    }))),
            );
            let (tx_result, recording_jsonl) = run_recorded_manager_execution(
                &state,
                &task_ctx,
                &conn,
                record_level,
                RecordingEventPlan::TxBlock {
                    total_steps: tx_block.steps.len(),
                },
                RecordedHistory {
                    kind: "tx_block",
                    name: &block_name,
                    mode: Some(&effective_mode),
                },
                async |request, context| {
                    MANAGER
                        .execute_tx_block_with_context(request, tx_block.clone(), context)
                        .await
                        .map_err(ApiError::from)
                },
            )
            .await?;

            let tx_result_value = serde_json::to_value(&tx_result).map_err(ApiError::from)?;
            if task_ctx.is_some() && tx_result.rollback_attempted {
                emit_task_event(
                    &state,
                    &task_ctx,
                    TaskEventInput::new("warning", "Tx block performed rollback")
                        .with_stage("tx_block")
                        .with_level(if tx_result.rollback_succeeded {
                            "warning"
                        } else {
                            "error"
                        })
                        .with_details(Some(json!({
                            "name": block_name,
                            "rollback_succeeded": tx_result.rollback_succeeded,
                            "rollback_steps": tx_result.rollback_steps,
                            "rollback_errors": tx_result.rollback_errors
                        }))),
                );
            }

            let recording_available = recording_jsonl.is_some();
            Ok(ExecuteTxBlockResponse {
                tx_block: tx_block_value,
                tx_result: Some(tx_result_value),
                recording_jsonl,
                result_summary: task_result_with_details(
                    {
                        let mut summary = task_result_with_counts(
                            build_result_summary(
                                TaskOperation::TxBlock,
                                if tx_result.committed {
                                    TaskResultOutcome::Success
                                } else {
                                    TaskResultOutcome::Failed
                                },
                                if tx_result.committed {
                                    "Tx block committed successfully"
                                } else {
                                    "Tx block finished with failure"
                                },
                            ),
                            result_counts(
                                tx_block.steps.len() as u64,
                                tx_result.executed_steps as u64,
                                if tx_result.committed { 0 } else { 1 },
                            ),
                        );
                        summary.recording_available = Some(recording_available);
                        summary
                    },
                    json!({
                        "name": block_name,
                        "mode": effective_mode,
                        "committed": tx_result.committed,
                        "rollback_attempted": tx_result.rollback_attempted,
                        "rollback_succeeded": tx_result.rollback_succeeded,
                        "failed_step": tx_result.failed_step
                    }),
                ),
            })
        })
        .await;
    finish_reported_task(
        state,
        task_ctx,
        task_guard,
        result,
        TaskFailureEvent {
            stage: "tx_block",
            message_prefix: "Tx block failed",
        },
        |state, task_ctx, response| {
            if task_ctx.is_some() {
                let committed = response
                    .tx_result
                    .as_ref()
                    .and_then(|value| value.get("committed"))
                    .and_then(Value::as_bool)
                    .unwrap_or(true);
                let response_details = serde_json::to_value(response).ok();
                let input = if committed {
                    TaskEventInput::new("completed", "Tx block completed")
                        .with_stage("tx_block")
                        .with_level("success")
                        .with_progress(Some(100))
                        .with_details(response_details)
                } else {
                    TaskEventInput::new("failed", "Tx block execution finished with failure")
                        .with_stage("tx_block")
                        .with_level("error")
                        .with_progress(Some(100))
                        .with_details(response_details)
                };
                emit_task_event(state, task_ctx, input);
            }
        },
        |response| {
            let committed = response
                .tx_result
                .as_ref()
                .and_then(|value| value.get("committed"))
                .and_then(Value::as_bool)
                .unwrap_or(true);
            (!committed).then_some("Tx block execution finished with failure")
        },
    )
}

pub async fn execute_tx_block_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxBlockRequest>,
) -> Result<(StatusCode, Json<ApiResponse<AsyncTaskAcceptedResponse>>), ApiError> {
    let response = queue_tx_block_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(ApiResponse::accepted(response))))
}
