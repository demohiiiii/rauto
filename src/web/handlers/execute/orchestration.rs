use super::*;

pub async fn execute_orchestration(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteOrchestrationRequest>,
) -> Result<Json<ExecuteOrchestrationResponse>, ApiError> {
    let task_ctx = TaskReportContext::from_request(
        TaskOperation::Orchestrate,
        req.task.task_id.clone(),
        state.is_managed(),
    );
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting orchestration execution")
            .with_stage("orchestrate")
            .with_progress(Some(0)),
    );
    let result: Result<ExecuteOrchestrationResponse, ApiError> = state
        .run_until_shutdown(async {
            let connection_for_context =
                merge_connection_options(&state.defaults, req.target.connection.clone()).ok();
            let plan_source = load_json_template_from_input(
                req.plan_template_name.as_deref(),
                req.plan_template_content.as_deref(),
                &req.plan,
                |name| {
                    let safe_name = storage::safe_json_template_name(name)?;
                    let content = content_store::load_orchestration_template(&safe_name)
                        .map_err(ApiError::from)?
                        .map(|item| item.content);
                    Ok(content)
                },
                "orchestration template not found",
            )?;
            let renderer = Renderer::new();
            let resolved_plan_vars = resolve_runtime_vars_with_connection(
                req.plan_vars.clone(),
                connection_for_context.as_ref(),
            )?;
            let mut plan_context =
                build_json_template_context(resolved_plan_vars, connection_for_context.as_ref());
            if let Value::Object(map) = &mut plan_context {
                map.insert(
                    "defaults".to_string(),
                    json!({
                        "host": state.defaults.host.clone(),
                        "username": state.defaults.username.clone(),
                        "password": state.defaults.password.clone(),
                        "port": state.defaults.port,
                        "enable_password": state.defaults.enable_password.clone(),
                        "ssh_security": state.defaults.ssh_security,
                        "linux_shell_flavor": state.defaults.linux_shell_flavor,
                        "device_profile": state.defaults.device_profile.clone(),
                        "connection": state.defaults.connection.clone()
                    }),
                );
            }
            enrich_context_with_connection_refs_from_value(&mut plan_context, &plan_source)
                .map_err(ApiError::from)?;
            let rendered_plan =
                render_json_template_value(&plan_source, &mut plan_context, &renderer)?;
            let plan_root = req
                .base_dir
                .as_deref()
                .filter(|s| !s.trim().is_empty())
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("."));
            let (plan, inventory) = orchestrator::load_plan_from_value(rendered_plan, &plan_root)
                .map_err(ApiError::from)?;
            let plan_value = serde_json::to_value(&plan).map_err(ApiError::from)?;
            let inventory_value = serde_json::to_value(&inventory).map_err(ApiError::from)?;
            emit_task_event(
                &state,
                &task_ctx,
                TaskEventInput::new("progress", "Orchestration plan loaded")
                    .with_stage("orchestrate")
                    .with_progress(Some(15))
                    .with_details(Some(json!({
                        "plan_name": plan.name,
                        "stages": plan.stages.len()
                    }))),
            );

            if req.run.dry_run.unwrap_or(false) {
                return Ok(ExecuteOrchestrationResponse {
                    plan: plan_value,
                    inventory: inventory_value,
                    orchestration_result: None,
                    result_summary: task_result_with_details(
                        task_result_with_counts(
                            build_result_summary(
                                TaskOperation::Orchestrate,
                                TaskResultOutcome::DryRun,
                                "Orchestration plan loaded successfully (dry run)",
                            ),
                            result_counts(plan.stages.len() as u64, 0, 0),
                        ),
                        json!({
                            "plan_name": plan.name,
                            "base_dir": plan_root
                        }),
                    ),
                });
            }

            let event_state = state.clone();
            let event_ctx = task_ctx.clone();
            let event_hook: orchestrator::OrchestrationEventHook = Arc::new(move |event| {
                emit_task_event(
                    &event_state,
                    &event_ctx,
                    TaskEventInput {
                        event_type: event.event_type,
                        message: event.message,
                        level: event.level,
                        stage: event.stage,
                        progress: event.progress,
                        details: event.details,
                    },
                );
            });

            let orchestration_result = orchestrator::execute_loaded_plan_with_events(
                &plan,
                &inventory,
                &plan_root,
                &state.defaults,
                to_cli_record_level(req.target.record_level),
                Some(event_hook),
            )
            .await
            .map_err(ApiError::from)?;

            Ok(ExecuteOrchestrationResponse {
                plan: plan_value,
                inventory: inventory_value,
                orchestration_result: Some(
                    serde_json::to_value(&orchestration_result).map_err(ApiError::from)?,
                ),
                result_summary: task_result_with_details(
                    task_result_with_counts(
                        build_result_summary(
                            TaskOperation::Orchestrate,
                            if orchestration_result.success {
                                TaskResultOutcome::Success
                            } else {
                                TaskResultOutcome::Failed
                            },
                            if orchestration_result.success {
                                "Orchestration completed successfully"
                            } else {
                                "Orchestration finished with failure"
                            },
                        ),
                        result_counts_with_skipped(
                            orchestration_result.total_stages as u64,
                            orchestration_result
                                .stages
                                .iter()
                                .filter(|stage| {
                                    matches!(stage.status, orchestrator::StageStatus::Success)
                                })
                                .count() as u64,
                            orchestration_result
                                .stages
                                .iter()
                                .filter(|stage| {
                                    matches!(stage.status, orchestrator::StageStatus::Failed)
                                })
                                .count() as u64,
                            orchestration_result
                                .stages
                                .iter()
                                .filter(|stage| {
                                    matches!(stage.status, orchestrator::StageStatus::Skipped)
                                })
                                .count() as u64,
                        ),
                    ),
                    json!({
                        "plan_name": orchestration_result.plan_name,
                        "fail_fast": orchestration_result.fail_fast,
                        "executed_stages": orchestration_result.executed_stages
                    }),
                ),
            })
        })
        .await;
    drop(task_guard);
    match &result {
        Ok(response) => {
            let succeeded = response
                .orchestration_result
                .as_ref()
                .and_then(|value| value.get("success"))
                .and_then(Value::as_bool)
                .unwrap_or(true);
            let event = if succeeded {
                TaskEventInput::new("completed", "Orchestration completed")
                    .with_stage("orchestrate")
                    .with_level("success")
                    .with_progress(Some(100))
                    .with_details(serde_json::to_value(response).ok())
            } else {
                TaskEventInput::new("failed", "Orchestration finished with failure")
                    .with_stage("orchestrate")
                    .with_level("error")
                    .with_progress(Some(100))
                    .with_details(serde_json::to_value(response).ok())
            };
            emit_task_event(&state, &task_ctx, event);
        }
        Err(err) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("failed", format!("Orchestration failed: {}", err.message))
                .with_stage("orchestrate")
                .with_level("error"),
        ),
    }
    if let (Some(task_ctx_ref), Ok(response)) = (task_ctx.as_ref(), &result) {
        let succeeded = response
            .orchestration_result
            .as_ref()
            .and_then(|value| value.get("success"))
            .and_then(Value::as_bool)
            .unwrap_or(true);
        if !succeeded {
            let callback = build_failed_task_callback(
                &state,
                task_ctx_ref,
                "Orchestration finished with failure",
                Some(response),
            );
            spawn_prepared_task_callback(state, task_ctx, callback);
            return result.map(Json);
        }
    }
    spawn_task_callback(state, task_ctx, &result);
    result.map(Json)
}

pub async fn execute_orchestration_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteOrchestrationRequest>,
) -> Result<(StatusCode, Json<AsyncTaskAcceptedResponse>), ApiError> {
    let response = queue_orchestration_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(response)))
}
