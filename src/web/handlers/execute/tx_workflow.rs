use super::*;

pub async fn execute_tx_workflow(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxWorkflowRequest>,
) -> Result<Json<ApiResponse<ExecuteTxWorkflowResponse>>, ApiError> {
    Box::pin(execute_tx_workflow_request(state, req, false)).await
}

pub(crate) async fn execute_scheduled_tx_workflow(
    state: Arc<AppState>,
    req: ExecuteTxWorkflowRequest,
) -> Result<Json<ApiResponse<ExecuteTxWorkflowResponse>>, ApiError> {
    Box::pin(execute_tx_workflow_request(state, req, true)).await
}

async fn execute_tx_workflow_request(
    state: Arc<AppState>,
    req: ExecuteTxWorkflowRequest,
    force_tracking: bool,
) -> Result<Json<ApiResponse<ExecuteTxWorkflowResponse>>, ApiError> {
    let (task_ctx, task_guard) = begin_reported_task_with_tracking(
        &state,
        TaskOperation::TxWorkflow,
        req.task.task_id.clone(),
        TaskEventInput::new("started", "Starting tx workflow execution")
            .with_stage("workflow")
            .with_progress(Some(0)),
        force_tracking || state.is_managed(),
    );
    let result: Result<ExecuteTxWorkflowResponse, ApiError> = state
        .run_until_shutdown(async {
            let record_level = req.target.record_level;
            let dry_run = req.run.dry_run.unwrap_or(false);
            let connection_for_context = if dry_run {
                merge_connection_options(&state.defaults, req.target.connection.clone()).ok()
            } else {
                Some(
                    resolve_autodetect_connection(merge_connection_options(
                        &state.defaults,
                        req.target.connection.clone(),
                    )?)
                    .await?,
                )
            };
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
            let mut workflow_context = build_json_template_context(
                resolved_workflow_vars,
                connection_for_context.as_ref(),
            );
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
            let workflow_response_value =
                serde_json::to_value(&workflow).map_err(ApiError::from)?;
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

            if dry_run {
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
            let (workflow_result, recording_jsonl) = run_recorded_manager_execution(
                &state,
                &task_ctx,
                &conn,
                record_level,
                build_tx_workflow_recording_plan(&workflow),
                RecordedHistory {
                    kind: "tx_workflow",
                    name: &workflow.name,
                    mode: None,
                },
                async |request, context, recorder| {
                    match recorder {
                        Some(recorder) => {
                            MANAGER
                                .execute_tx_workflow_with_recorder_and_context(
                                    request,
                                    workflow.clone(),
                                    context,
                                    recorder,
                                )
                                .await
                        }
                        None => {
                            MANAGER
                                .execute_tx_workflow_with_context(
                                    request,
                                    workflow.clone(),
                                    context,
                                )
                                .await
                        }
                    }
                    .map_err(ApiError::from)
                },
            )
            .await?;

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
        })
        .await;
    finish_reported_task(
        state,
        task_ctx,
        task_guard,
        result,
        TaskFailureEvent {
            stage: "workflow",
            message_prefix: "Tx workflow failed",
        },
        |state, task_ctx, response| {
            if task_ctx.is_some()
                && let Some(workflow_result) = &response.tx_workflow_result
            {
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
                            state,
                            task_ctx,
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
                    state,
                    task_ctx,
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
        },
        |response| {
            let committed = response
                .tx_workflow_result
                .as_ref()
                .and_then(|value| value.get("committed"))
                .and_then(Value::as_bool)
                .unwrap_or(true);
            (!committed).then_some("Tx workflow finished with failure")
        },
    )
}

pub async fn execute_tx_workflow_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxWorkflowRequest>,
) -> Result<(StatusCode, Json<ApiResponse<AsyncTaskAcceptedResponse>>), ApiError> {
    let response = queue_tx_workflow_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(ApiResponse::accepted(response))))
}
