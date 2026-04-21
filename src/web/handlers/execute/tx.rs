use super::*;

pub async fn execute_tx_block(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxBlockRequest>,
) -> Result<Json<ExecuteTxBlockResponse>, ApiError> {
    let req = resolve_tx_block_request_from_template(req, &state.defaults)?;
    let task_ctx = TaskReportContext::from_request(
        TaskOperation::TxBlock,
        req.task.task_id.clone(),
        state.is_managed(),
    );
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting tx block execution")
            .with_stage("tx_block")
            .with_progress(Some(0)),
    );
    let result: Result<ExecuteTxBlockResponse, ApiError> = async {
        let conn = merge_connection_options(&state.defaults, req.target.connection.clone())?;
        let record_level = req.target.record_level;
        let requested_record_level = to_record_level(record_level);
        let live_record_level = if task_ctx.is_some() {
            requested_record_level.or(Some(SessionRecordLevel::KeyEventsOnly))
        } else {
            requested_record_level
        };
        let dry_run = req.run.dry_run.unwrap_or(false);
        let (tx_block, effective_mode, block_name) = build_tx_block_from_request(req, Some(&conn))?;
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
        let handler = template_loader::load_device_profile_for_connection(
            &conn.device_profile,
            conn.linux_shell_flavor,
        )?;
        let (tx_result, recording_jsonl) = if let Some(level) = live_record_level {
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
                    level,
                )
                .await?;
            let forwarder = spawn_recording_event_forwarder(
                &state,
                &task_ctx,
                &recorder,
                RecordingEventPlan::TxBlock {
                    total_steps: tx_block.steps.len(),
                },
            );
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
            let execution_result = MANAGER
                .execute_tx_block_with_context(
                    request,
                    tx_block.clone(),
                    manager_execution_context_with_security(None, conn.ssh_security),
                )
                .await;
            let expected_entries = recorder.entries().map_err(ApiError::from)?.len();
            if let Some(forwarder) = forwarder {
                forwarder.finish(expected_entries).await;
            }
            let result = execution_result?;
            let jsonl = if requested_record_level.is_some() {
                let jsonl_raw = recorder.to_jsonl().map_err(ApiError::from)?;
                let jsonl = normalize_recording_jsonl_for_web_level(record_level, &jsonl_raw);
                if let Err(e) = history_store::save_recording(
                    HistoryBinding {
                        connection_name: conn.connection_name.as_deref(),
                        host: &conn.host,
                        port: conn.port,
                        username: &conn.username,
                        device_profile: &conn.device_profile,
                    },
                    "tx_block",
                    &block_name,
                    Some(&effective_mode),
                    record_level_name(record_level),
                    &jsonl,
                ) {
                    warn!("failed to persist execution history: {}", e);
                }
                Some(jsonl)
            } else {
                None
            };
            (result, jsonl)
        } else {
            let request = manager_connection_request(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
            );
            let result = MANAGER
                .execute_tx_block_with_context(
                    request,
                    tx_block.clone(),
                    manager_execution_context_with_security(None, conn.ssh_security),
                )
                .await?;
            (result, None)
        };

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
    }
    .await;
    drop(task_guard);
    match &result {
        Ok(response) if task_ctx.is_some() => {
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
            emit_task_event(&state, &task_ctx, input);
        }
        Ok(_) => {}
        Err(err) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("failed", format!("Tx block failed: {}", err.message))
                .with_stage("tx_block")
                .with_level("error"),
        ),
    }
    if let (Some(task_ctx_ref), Ok(response)) = (task_ctx.as_ref(), &result) {
        let committed = response
            .tx_result
            .as_ref()
            .and_then(|value| value.get("committed"))
            .and_then(Value::as_bool)
            .unwrap_or(true);
        if !committed {
            let callback = build_failed_task_callback(
                &state,
                task_ctx_ref,
                "Tx block execution finished with failure",
                Some(response),
            );
            spawn_prepared_task_callback(state, task_ctx, callback);
            return result.map(Json);
        }
    }
    spawn_task_callback(state, task_ctx, &result);
    result.map(Json)
}

pub async fn execute_tx_block_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxBlockRequest>,
) -> Result<(StatusCode, Json<AsyncTaskAcceptedResponse>), ApiError> {
    let response = queue_tx_block_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(response)))
}
