use super::*;

pub async fn render_template(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RenderRequest>,
) -> Result<Json<RenderResponse>, ApiError> {
    let incoming_connection = req.connection.clone();
    let resolved_conn = match merge_connection_options(&state.defaults, incoming_connection.clone())
    {
        Ok(conn) => Some(conn),
        Err(err) => {
            let fallback =
                resolve_render_connection_context_fallback(&state.defaults, incoming_connection);
            if fallback.is_none() {
                warn!("render template context fallback skipped: {:?}", err);
            }
            fallback
        }
    };
    let _ = req.template_dir.as_ref();
    let (_, masked_rendered) =
        render_commands_with_runtime_context(&req.template, req.vars, resolved_conn.as_ref())?;

    Ok(Json(RenderResponse {
        rendered_commands: masked_rendered,
    }))
}

pub async fn exec_command(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecRequest>,
) -> Result<Json<ExecResponse>, ApiError> {
    let task_ctx = TaskReportContext::from_request(
        TaskOperation::Exec,
        req.task.task_id.clone(),
        state.is_managed(),
    );
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting direct command execution")
            .with_stage("connect")
            .with_progress(Some(0))
            .with_details(Some(json!({
                "command": req.command,
                "mode": req.mode
            }))),
    );
    let result: Result<ExecResponse, ApiError> = async {
        let record_level = req.target.record_level;
        command_blacklist::ensure_command_allowed(&req.command, "direct execution")
            .map_err(|e| ApiError::bad_request(e.to_string()))?;
        let conn = resolve_autodetect_connection(merge_connection_options(
            &state.defaults,
            req.target.connection,
        )?)
        .await?;
        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Connecting to target device")
                .with_stage("connect")
                .with_progress(Some(10))
                .with_details(Some(json!({
                    "host": conn.host,
                    "connection_name": conn.connection_name
                }))),
        );
        let handler = template_loader::load_device_profile_for_connection(
            &conn.device_profile,
            conn.linux_shell_flavor,
        )?;
        let effective_mode = resolve_effective_mode(req.mode.as_deref(), &conn.device_profile)?;
        let client = if let Some(level) = to_record_level(record_level) {
            DeviceClient::connect_with_recording(
                conn.host.clone(),
                conn.port,
                conn.username.clone(),
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                template_loader::default_profile_mode(&conn.device_profile)?,
                level,
                conn.ssh_security,
            )
            .await?
        } else {
            DeviceClient::connect(
                conn.host.clone(),
                conn.port,
                conn.username.clone(),
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                template_loader::default_profile_mode(&conn.device_profile)?,
                conn.ssh_security,
            )
            .await?
        };

        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Executing command")
                .with_stage("command")
                .with_progress(Some(60))
                .with_details(Some(json!({
                    "command": req.command
                }))),
        );
        let output = client
            .execute_output(&req.command, Some(effective_mode.as_str()))
            .await?;
        let exit_code = output.exit_code;
        persist_history_if_recorded(
            &conn,
            &client,
            "exec",
            &req.command,
            Some(effective_mode.as_str()),
            record_level,
        );
        let recording_jsonl = client.recording_jsonl()?;
        Ok(ExecResponse {
            output: output.content,
            exit_code,
            result_summary: task_result_with_details(
                task_result_with_recording(
                    build_result_summary(
                        TaskOperation::Exec,
                        if exit_code.unwrap_or(0) == 0 {
                            TaskResultOutcome::Success
                        } else {
                            TaskResultOutcome::Failed
                        },
                        if exit_code.unwrap_or(0) == 0 {
                            "Command executed successfully"
                        } else {
                            "Command finished with a non-zero exit code"
                        },
                    ),
                    &recording_jsonl,
                ),
                json!({
                    "exit_code": exit_code,
                    "mode": effective_mode,
                    "command": req.command
                }),
            ),
            recording_jsonl,
        })
    }
    .await;
    drop(task_guard);
    match &result {
        Ok(response) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("completed", "Direct command execution completed")
                .with_stage("command")
                .with_level("success")
                .with_progress(Some(100))
                .with_details(Some(json!({
                    "exit_code": response.exit_code
                }))),
        ),
        Err(err) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new(
                "failed",
                format!("Direct command execution failed: {}", err.message),
            )
            .with_stage("command")
            .with_level("error"),
        ),
    }
    spawn_task_callback(state, task_ctx, &result);
    result.map(Json)
}

pub async fn exec_command_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecRequest>,
) -> Result<(StatusCode, Json<AsyncTaskAcceptedResponse>), ApiError> {
    let response = queue_exec_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(response)))
}

pub async fn execute_template(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTemplateRequest>,
) -> Result<Json<ExecuteTemplateResponse>, ApiError> {
    let task_ctx = TaskReportContext::from_request(
        TaskOperation::TemplateExecute,
        req.task.task_id.clone(),
        state.is_managed(),
    );
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting template execution")
            .with_stage("render")
            .with_progress(Some(0))
            .with_details(Some(json!({
                "template": req.template,
                "mode": req.mode
            }))),
    );
    let result: Result<ExecuteTemplateResponse, ApiError> = async {
        let record_level = req.target.record_level;
        let dry_run = req.run.dry_run.unwrap_or(false);
        let incoming_connection = req.target.connection.clone();
        let render_conn = if dry_run {
            merge_connection_options(&state.defaults, incoming_connection.clone()).ok()
        } else {
            Some(
                resolve_autodetect_connection(merge_connection_options(
                    &state.defaults,
                    incoming_connection.clone(),
                )?)
                .await?,
            )
        };
        let _ = req.template_dir.as_ref();
        let (rendered_commands, masked_rendered_commands) = render_commands_with_runtime_context(
            &req.template,
            req.vars,
            render_conn.as_ref(),
        )?;
        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Template rendered")
                .with_stage("render")
                .with_progress(Some(20))
                .with_details(Some(json!({
                    "template": req.template,
                    "rendered_command_count": rendered_commands.lines().filter(|line| !line.trim().is_empty()).count()
                }))),
        );

        if dry_run {
            let rendered_count = count_non_empty_lines(&rendered_commands);
            return Ok(ExecuteTemplateResponse {
                result_summary: task_result_with_details(
                    task_result_with_counts(
                        build_result_summary(
                            TaskOperation::TemplateExecute,
                            TaskResultOutcome::DryRun,
                            "Template rendered successfully (dry run)",
                        ),
                        result_counts(rendered_count, 0, 0),
                    ),
                    json!({
                        "template": req.template,
                        "mode": req.mode,
                        "rendered_command_count": rendered_count
                    }),
                ),
                rendered_commands: masked_rendered_commands,
                executed: Vec::new(),
                recording_jsonl: None,
            });
        }

        let lines: Vec<String> = rendered_commands
            .lines()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        command_blacklist::ensure_commands_allowed(
            lines.iter().map(String::as_str),
            "template execution",
        )
        .map_err(|e| ApiError::bad_request(e.to_string()))?;

        let conn = match render_conn {
            Some(conn) => conn,
            None => merge_connection_options(&state.defaults, incoming_connection)?,
        };
        let handler = template_loader::load_device_profile_for_connection(
            &conn.device_profile,
            conn.linux_shell_flavor,
        )?;
        let effective_mode = resolve_effective_mode(req.mode.as_deref(), &conn.device_profile)?;
        let client = if let Some(level) = to_record_level(record_level) {
            DeviceClient::connect_with_recording(
                conn.host.clone(),
                conn.port,
                conn.username.clone(),
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                template_loader::default_profile_mode(&conn.device_profile)?,
                level,
                conn.ssh_security,
            )
            .await?
        } else {
            DeviceClient::connect(
                conn.host.clone(),
                conn.port,
                conn.username.clone(),
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                template_loader::default_profile_mode(&conn.device_profile)?,
                conn.ssh_security,
            )
            .await?
        };

        let mut executed = Vec::with_capacity(lines.len());
        let total_commands = lines.len();
        for (idx, cmd) in lines.into_iter().enumerate() {
            emit_task_event(
                &state,
                &task_ctx,
                TaskEventInput::new(
                    "step_started",
                    format!("Executing command {}/{}", idx + 1, total_commands),
                )
                .with_stage("command")
                .with_progress(task_event_progress(idx + 1, total_commands))
                .with_details(Some(json!({
                    "command": cmd,
                    "index": idx + 1,
                    "total": total_commands
                }))),
            );
            match client.execute_output(&cmd, Some(effective_mode.as_str())).await {
                Ok(output) => {
                    emit_task_event(
                        &state,
                        &task_ctx,
                        TaskEventInput::new(
                            "step_completed",
                            format!("Command {}/{} completed", idx + 1, total_commands),
                        )
                        .with_stage("command")
                        .with_level("success")
                        .with_progress(task_event_progress(idx + 1, total_commands))
                        .with_details(Some(json!({
                            "command": cmd,
                            "index": idx + 1,
                            "total": total_commands,
                            "exit_code": output.exit_code
                        }))),
                    );
                    executed.push(CommandResult {
                        command: cmd,
                        success: true,
                        exit_code: output.exit_code,
                        output: Some(output.content),
                        error: None,
                    })
                }
                Err(e) => {
                    emit_task_event(
                        &state,
                        &task_ctx,
                        TaskEventInput::new(
                            "warning",
                            format!("Command {}/{} failed", idx + 1, total_commands),
                        )
                        .with_stage("command")
                        .with_level("warning")
                        .with_progress(task_event_progress(idx + 1, total_commands))
                        .with_details(Some(json!({
                            "command": cmd,
                            "index": idx + 1,
                            "total": total_commands,
                            "error": e.to_string()
                        }))),
                    );
                    executed.push(CommandResult {
                        command: cmd,
                        success: false,
                        exit_code: None,
                        output: None,
                        error: Some(e.to_string()),
                    })
                }
            }
        }

        persist_history_if_recorded(
            &conn,
            &client,
            "template_execute",
            &format!("template: {}", req.template),
            Some(effective_mode.as_str()),
            record_level,
        );

        let executed_count = executed.len() as u64;
        let succeeded = executed.iter().filter(|item| item.success).count() as u64;
        let failed = executed_count - succeeded;
        let recording_jsonl = client.recording_jsonl()?;
        Ok(ExecuteTemplateResponse {
            rendered_commands: masked_rendered_commands,
            executed,
            result_summary: task_result_with_details(
                task_result_with_recording(
                    task_result_with_counts(
                        build_result_summary(
                            TaskOperation::TemplateExecute,
                            if failed == 0 {
                                TaskResultOutcome::Success
                            } else if succeeded > 0 {
                                TaskResultOutcome::PartialSuccess
                            } else {
                                TaskResultOutcome::Failed
                            },
                            if failed == 0 {
                                "Template execution completed successfully"
                            } else if succeeded > 0 {
                                "Template execution completed with failed commands"
                            } else {
                                "Template execution failed for all commands"
                            },
                        ),
                        result_counts(executed_count, succeeded, failed),
                    ),
                    &recording_jsonl,
                ),
                json!({
                    "template": req.template,
                    "mode": effective_mode
                }),
            ),
            recording_jsonl,
        })
    }
    .await;
    drop(task_guard);
    match &result {
        Ok(response) => {
            let failed_commands = response.executed.iter().filter(|cmd| !cmd.success).count();
            let event = if failed_commands == 0 {
                TaskEventInput::new("completed", "Template execution completed")
                    .with_stage("command")
                    .with_level("success")
                    .with_progress(Some(100))
            } else {
                TaskEventInput::new(
                    "completed",
                    format!(
                        "Template execution completed with {} failed command(s)",
                        failed_commands
                    ),
                )
                .with_stage("command")
                .with_level("warning")
                .with_progress(Some(100))
            };
            emit_task_event(&state, &task_ctx, event);
        }
        Err(err) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new(
                "failed",
                format!("Template execution failed: {}", err.message),
            )
            .with_stage("render")
            .with_level("error"),
        ),
    }
    spawn_task_callback(state, task_ctx, &result);
    result.map(Json)
}

pub async fn execute_template_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTemplateRequest>,
) -> Result<(StatusCode, Json<AsyncTaskAcceptedResponse>), ApiError> {
    let response = queue_template_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(response)))
}
