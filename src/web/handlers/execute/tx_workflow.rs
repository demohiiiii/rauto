use super::*;

pub async fn execute_tx_workflow(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxWorkflowRequest>,
) -> Result<Json<ExecuteTxWorkflowResponse>, ApiError> {
    let task_ctx = TaskReportContext::from_request(
        TaskOperation::TxWorkflow,
        req.task.task_id.clone(),
        state.is_managed(),
    );
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting tx workflow execution")
            .with_stage("workflow")
            .with_progress(Some(0)),
    );
    let result: Result<ExecuteTxWorkflowResponse, ApiError> = async {
        let record_level = req.target.record_level;
        let requested_record_level = to_record_level(record_level);
        let live_record_level = if task_ctx.is_some() {
            requested_record_level.or(Some(SessionRecordLevel::KeyEventsOnly))
        } else {
            requested_record_level
        };
        let connection_for_context =
            merge_connection_options(&state.defaults, req.target.connection.clone()).ok();
        let workflow_source = load_json_template_from_input(
            req.workflow_template_name.as_deref(),
            req.workflow_template_content.as_deref(),
            &req.workflow,
            |name| {
                let safe_name = storage::safe_json_template_name(name)?;
                let content = content_store::load_tx_workflow_template(&safe_name)
                    .map_err(ApiError::from)?
                    .map(|item| item.content);
                Ok(content)
            },
            "tx workflow template not found",
        )?;
        let renderer = Renderer::new();
        let resolved_workflow_vars = resolve_runtime_vars_with_connection(
            req.workflow_vars.clone(),
            connection_for_context.as_ref(),
        )?;
        let mut workflow_context =
            build_json_template_context(resolved_workflow_vars, connection_for_context.as_ref());
        enrich_context_with_connection_refs_from_value(&mut workflow_context, &workflow_source)
            .map_err(ApiError::from)?;
        let workflow_value =
            render_json_template_value(&workflow_source, &mut workflow_context, &renderer)?;
        let workflow_value = resolve_tx_workflow_blocks_from_templates(
            workflow_value,
            connection_for_context.as_ref(),
        )?;
        let workflow: rneter::session::TxWorkflow =
            serde_json::from_value(workflow_value.clone()).map_err(ApiError::from)?;
        let workflow_response_value = serde_json::to_value(&workflow).map_err(ApiError::from)?;
        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Workflow loaded")
                .with_stage("workflow")
                .with_progress(Some(15))
                .with_details(Some(json!({
                    "workflow_name": workflow.name,
                    "blocks": workflow.blocks.len()
                }))),
        );

        if req.run.dry_run.unwrap_or(false) {
            return Ok(ExecuteTxWorkflowResponse {
                workflow: workflow_response_value,
                tx_workflow_result: None,
                recording_jsonl: None,
                result_summary: task_result_with_details(
                    build_result_summary(
                        TaskOperation::TxWorkflow,
                        TaskResultOutcome::DryRun,
                        "Tx workflow built successfully (dry run)",
                    ),
                    json!({
                        "workflow_name": workflow.name,
                        "total_blocks": workflow.blocks.len()
                    }),
                ),
            });
        }

        command_blacklist::ensure_tx_workflow_allowed(
            &workflow,
            &format!("tx workflow '{}'", workflow.name),
        )
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

        let conn = if let Some(conn) = connection_for_context {
            conn
        } else {
            merge_connection_options(&state.defaults, req.target.connection.clone())?
        };
        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Executing workflow")
                .with_stage("workflow")
                .with_progress(Some(60))
                .with_details(Some(json!({
                    "workflow_name": workflow.name,
                    "host": conn.host,
                    "connection_name": conn.connection_name
                }))),
        );
        let handler = template_loader::load_device_profile_for_connection(
            &conn.device_profile,
            conn.linux_shell_flavor,
        )?;
        let (workflow_result, recording_jsonl) = if let Some(level) = live_record_level {
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
                build_tx_workflow_recording_plan(&workflow),
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
                .execute_tx_workflow_with_context(
                    request,
                    workflow.clone(),
                    manager_execution_context_with_security(None, conn.ssh_security),
                )
                .await;
            let expected_entries = recorder.entries().map_err(ApiError::from)?.len();
            if let Some(forwarder) = forwarder {
                forwarder.finish(expected_entries).await;
            }
            let result = execution_result?;
            let jsonl = if requested_record_level.is_some() {
                let jsonl = recorder.to_jsonl().map_err(ApiError::from)?;
                if let Err(e) = history_store::save_recording(
                    HistoryBinding {
                        connection_name: conn.connection_name.as_deref(),
                        host: &conn.host,
                        port: conn.port,
                        username: &conn.username,
                        device_profile: &conn.device_profile,
                    },
                    "tx_workflow",
                    &workflow.name,
                    None,
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
                .execute_tx_workflow_with_context(
                    request,
                    workflow.clone(),
                    manager_execution_context_with_security(None, conn.ssh_security),
                )
                .await?;
            (result, None)
        };

        let succeeded_blocks = workflow_result
            .block_results
            .iter()
            .filter(|item| item.committed)
            .count() as u64;
        let failed_blocks = workflow_result.block_results.len() as u64 - succeeded_blocks;
        let recording_available = recording_jsonl.is_some();
        Ok(ExecuteTxWorkflowResponse {
            workflow: workflow_response_value,
            tx_workflow_result: Some(
                serde_json::to_value(&workflow_result).map_err(ApiError::from)?,
            ),
            recording_jsonl,
            result_summary: task_result_with_details(
                {
                    let mut summary = task_result_with_counts(
                        build_result_summary(
                            TaskOperation::TxWorkflow,
                            if workflow_result.committed {
                                TaskResultOutcome::Success
                            } else if succeeded_blocks > 0 {
                                TaskResultOutcome::PartialSuccess
                            } else {
                                TaskResultOutcome::Failed
                            },
                            if workflow_result.committed {
                                "Tx workflow committed successfully"
                            } else if succeeded_blocks > 0 {
                                "Tx workflow finished with failed blocks"
                            } else {
                                "Tx workflow failed"
                            },
                        ),
                        result_counts(
                            workflow_result.block_results.len() as u64,
                            succeeded_blocks,
                            failed_blocks,
                        ),
                    );
                    summary.recording_available = Some(recording_available);
                    summary
                },
                json!({
                    "workflow_name": workflow_result.workflow_name,
                    "committed": workflow_result.committed,
                    "rollback_attempted": workflow_result.rollback_attempted,
                    "rollback_succeeded": workflow_result.rollback_succeeded,
                    "failed_block": workflow_result.failed_block
                }),
            ),
        })
    }
    .await;
    drop(task_guard);
    match &result {
        Ok(response) if task_ctx.is_some() => {
            if let Some(workflow_result) = &response.tx_workflow_result {
                if let Some(blocks) = workflow_result
                    .get("block_results")
                    .and_then(Value::as_array)
                {
                    let total_blocks = blocks.len().max(1);
                    for (idx, block) in blocks.iter().enumerate() {
                        let block_name = block
                            .get("block_name")
                            .and_then(Value::as_str)
                            .unwrap_or("block");
                        let committed = block
                            .get("committed")
                            .and_then(Value::as_bool)
                            .unwrap_or(true);
                        emit_task_event(
                            &state,
                            &task_ctx,
                            TaskEventInput::new(
                                "step_completed",
                                format!("Workflow block {} completed", block_name),
                            )
                            .with_stage("workflow")
                            .with_level(if committed { "success" } else { "error" })
                            .with_progress(task_event_progress(idx + 1, total_blocks))
                            .with_details(Some(block.clone())),
                        );
                    }
                }
                let committed = workflow_result
                    .get("committed")
                    .and_then(Value::as_bool)
                    .unwrap_or(true);
                emit_task_event(
                    &state,
                    &task_ctx,
                    TaskEventInput::new(
                        if committed { "completed" } else { "failed" },
                        if committed {
                            "Tx workflow completed"
                        } else {
                            "Tx workflow finished with failure"
                        },
                    )
                    .with_stage("workflow")
                    .with_level(if committed { "success" } else { "error" })
                    .with_progress(Some(100))
                    .with_details(serde_json::to_value(response).ok()),
                );
            }
        }
        Ok(_) => {}
        Err(err) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("failed", format!("Tx workflow failed: {}", err.message))
                .with_stage("workflow")
                .with_level("error"),
        ),
    }
    if let (Some(task_ctx_ref), Ok(response)) = (task_ctx.as_ref(), &result) {
        let committed = response
            .tx_workflow_result
            .as_ref()
            .and_then(|value| value.get("committed"))
            .and_then(Value::as_bool)
            .unwrap_or(true);
        if !committed {
            let callback = build_failed_task_callback(
                &state,
                task_ctx_ref,
                "Tx workflow finished with failure",
                Some(response),
            );
            spawn_prepared_task_callback(state, task_ctx, callback);
            return result.map(Json);
        }
    }
    spawn_task_callback(state, task_ctx, &result);
    result.map(Json)
}

pub async fn execute_tx_workflow_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxWorkflowRequest>,
) -> Result<(StatusCode, Json<AsyncTaskAcceptedResponse>), ApiError> {
    let response = queue_tx_workflow_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(response)))
}
