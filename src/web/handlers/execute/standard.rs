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
        let (parsed_output, parse_error) = parse_textfsm_output_optional(
            &output.content,
            &req.command,
            WebTextfsmParseOptions {
                template_file: req.textfsm_template.as_deref(),
                enabled: req.parse_textfsm,
                platform: req.textfsm_platform.as_deref(),
                device_profile: Some(conn.device_profile.as_str()),
                vendor: req.textfsm_vendor.as_deref(),
                ..Default::default()
            },
        );
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
            parsed_output,
            parse_error,
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

#[derive(Debug, serde::Deserialize)]
pub struct ShowObjectsQuery {
    #[serde(default)]
    pub device_profile: Option<String>,
    #[serde(default)]
    pub textfsm_platform: Option<String>,
}

pub async fn list_show_objects(
    Query(query): Query<ShowObjectsQuery>,
) -> Result<Json<ShowObjectsResponse>, ApiError> {
    let platform = show_catalog::platform_for_show(
        query.device_profile.as_deref().unwrap_or_default(),
        query.textfsm_platform.as_deref(),
    );
    let objects = if let Some(platform) = platform.as_deref() {
        show_catalog::list_show_commands_for_profile(
            query.device_profile.as_deref(),
            Some(platform),
        )
        .map_err(ApiError::from)?
        .into_iter()
        .map(|item| ShowObjectEntry {
            object: item.object,
            command: item.command,
            mode: item.mode,
            textfsm_mapping_command: item.textfsm_mapping_command,
            source: show_command_source_label(item.source).to_string(),
            textfsm_template_name: item.textfsm_template_name,
        })
        .collect()
    } else if query
        .device_profile
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some()
    {
        show_catalog::list_show_commands_for_profile(query.device_profile.as_deref(), None)
            .map_err(ApiError::from)?
            .into_iter()
            .map(|item| ShowObjectEntry {
                object: item.object,
                command: item.command,
                mode: item.mode,
                textfsm_mapping_command: item.textfsm_mapping_command,
                source: show_command_source_label(item.source).to_string(),
                textfsm_template_name: item.textfsm_template_name,
            })
            .collect()
    } else {
        show_catalog::list_all_show_objects()
            .into_iter()
            .map(|object| ShowObjectEntry {
                object,
                command: String::new(),
                mode: None,
                textfsm_mapping_command: None,
                source: "builtin".to_string(),
                textfsm_template_name: None,
            })
            .collect()
    };
    Ok(Json(ShowObjectsResponse { platform, objects }))
}

pub async fn execute_show(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ShowExecuteRequest>,
) -> Result<Json<ShowExecuteResponse>, ApiError> {
    let task_ctx = TaskReportContext::from_request(
        TaskOperation::Exec,
        req.task.task_id.clone(),
        state.is_managed(),
    );
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting show object execution")
            .with_stage("connect")
            .with_progress(Some(0))
            .with_details(Some(json!({
                "object": req.object,
                "mode": req.mode
            }))),
    );

    let result: Result<ShowExecuteResponse, ApiError> = async {
        let record_level = req.target.record_level;
        let conn = resolve_autodetect_connection(merge_connection_options(
            &state.defaults,
            req.target.connection,
        )?)
        .await?;
        let platform =
            show_catalog::platform_for_show(&conn.device_profile, req.textfsm_platform.as_deref());
        let show = show_catalog::resolve_show_command(
            &req.object,
            platform.as_deref(),
            &conn.device_profile,
        )
        .map_err(|err| ApiError::bad_request(err.to_string()))?;
        command_blacklist::ensure_command_allowed(&show.command, "show execution")
            .map_err(|err| ApiError::bad_request(err.to_string()))?;

        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Connecting to target device")
                .with_stage("connect")
                .with_progress(Some(10))
                .with_details(Some(json!({
                    "host": conn.host,
                    "connection_name": conn.connection_name,
                    "object": show.object,
                    "command": show.command
                }))),
        );
        let handler = template_loader::load_device_profile_for_connection(
            &conn.device_profile,
            conn.linux_shell_flavor,
        )?;
        let requested_mode = req.mode.as_deref().or(show.mode.as_deref());
        let effective_mode = resolve_effective_mode(requested_mode, &conn.device_profile)?;
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
            TaskEventInput::new("progress", "Executing show command")
                .with_stage("command")
                .with_progress(Some(60))
                .with_details(Some(json!({
                    "object": show.object,
                    "command": show.command,
                    "mode": effective_mode.as_str()
                }))),
        );
        let output = client
            .execute_output(&show.command, Some(effective_mode.as_str()))
            .await?;
        let exit_code = output.exit_code;
        let should_parse = !req.no_parse && exit_code.unwrap_or(0) == 0;
        let textfsm_template_content = show
            .textfsm_template_name
            .as_deref()
            .map(|name| {
                custom_textfsm_store::load_template(name)
                    .map_err(ApiError::from)?
                    .ok_or_else(|| {
                        ApiError::bad_request(format!("TextFSM template '{}' not found", name))
                    })
            })
            .transpose()?
            .map(|template| template.content);
        let (parsed_output, parse_error) = parse_textfsm_output_optional(
            &output.content,
            &show.command,
            WebTextfsmParseOptions {
                template_content: textfsm_template_content.as_deref(),
                enabled: should_parse,
                platform: platform.as_deref(),
                device_profile: Some(conn.device_profile.as_str()),
                ..Default::default()
            },
        );
        persist_history_if_recorded(
            &conn,
            &client,
            "show",
            &show.command,
            Some(effective_mode.as_str()),
            record_level,
        );
        let recording_jsonl = client.recording_jsonl()?;
        let object = show.object.clone();
        let command = show.command.clone();
        let source = show_command_source_label(show.source).to_string();
        let textfsm_mapping_command = show.textfsm_mapping_command.clone();
        let textfsm_template_name = show.textfsm_template_name.clone();
        Ok(ShowExecuteResponse {
            object,
            platform: platform.unwrap_or_default(),
            command: command.clone(),
            mode: effective_mode.clone(),
            source,
            textfsm_mapping_command,
            textfsm_template_name,
            output: output.content,
            exit_code,
            parsed_output,
            parse_error,
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
                            "Show command executed successfully"
                        } else {
                            "Show command finished with a non-zero exit code"
                        },
                    ),
                    &recording_jsonl,
                ),
                json!({
                    "exit_code": exit_code,
                    "mode": effective_mode,
                    "object": req.object,
                    "command": command
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
            TaskEventInput::new("completed", "Show object execution completed")
                .with_stage("command")
                .with_level("success")
                .with_progress(Some(100))
                .with_details(Some(json!({
                    "exit_code": response.exit_code,
                    "object": response.object,
                    "command": response.command
                }))),
        ),
        Err(err) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new(
                "failed",
                format!("Show object execution failed: {}", err.message),
            )
            .with_stage("command")
            .with_level("error"),
        ),
    }
    spawn_task_callback(state, task_ctx, &result);
    result.map(Json)
}

struct ResolvedBatchShowTarget {
    name: String,
    conn: ResolvedConnection,
    platform: Option<String>,
    show: show_catalog::ShowCommand,
    effective_mode: String,
}

pub async fn execute_show_batch(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ShowBatchExecuteRequest>,
) -> Result<Json<ShowBatchExecuteResponse>, ApiError> {
    let task_ctx = TaskReportContext::from_request(
        TaskOperation::Exec,
        req.task.task_id.clone(),
        state.is_managed(),
    );
    let task_guard = state.acquire_task_guard(task_ctx.is_some());
    emit_task_event(
        &state,
        &task_ctx,
        TaskEventInput::new("started", "Starting batch show object execution")
            .with_stage("precheck")
            .with_progress(Some(0))
            .with_details(Some(json!({
                "object": &req.object,
                "objects": &req.objects,
                "targets": &req.targets,
                "groups": &req.groups,
                "labels": &req.labels
            }))),
    );

    let result: Result<ShowBatchExecuteResponse, ApiError> = async {
        let objects = resolve_batch_show_objects(&req)?;
        let target_names = resolve_batch_show_target_names(&req)?;
        if target_names.is_empty() {
            return Err(ApiError::bad_request(
                "batch show resolved no saved connections",
            ));
        }

        let mut resolved_targets = Vec::with_capacity(target_names.len());
        let mut precheck_errors = Vec::new();
        for name in &target_names {
            for object in &objects {
                match resolve_batch_show_target(&state, name, &req, object).await {
                    Ok(target) => resolved_targets.push(target),
                    Err(err) => precheck_errors.push(format!("{name}/{object}: {}", err.message)),
                }
            }
        }
        if !precheck_errors.is_empty() {
            return Err(ApiError::bad_request(format!(
                "show object precheck failed for {} target(s):\n{}",
                precheck_errors.len(),
                precheck_errors.join("\n")
            )));
        }

        emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("progress", "Executing batch show commands")
                .with_stage("command")
                .with_progress(Some(40))
                .with_details(Some(json!({
                    "objects": &objects,
                    "target_count": resolved_targets.len()
                }))),
        );

        let record_level = req.record_level;
        let mut results = Vec::with_capacity(resolved_targets.len());
        for target in resolved_targets {
            results.push(execute_batch_show_target(&target, req.no_parse, record_level).await);
        }

        let total = results.len() as u64;
        let failed = results
            .iter()
            .filter(|item| item.error.is_some() || item.exit_code.unwrap_or(0) != 0)
            .count() as u64;
        let succeeded = total.saturating_sub(failed);
        let outcome = if failed == 0 {
            TaskResultOutcome::Success
        } else if succeeded > 0 {
            TaskResultOutcome::PartialSuccess
        } else {
            TaskResultOutcome::Failed
        };

        Ok(ShowBatchExecuteResponse {
            object: objects.join(", "),
            targets: target_names,
            result_summary: task_result_with_details(
                task_result_with_counts(
                    build_result_summary(
                        TaskOperation::Exec,
                        outcome,
                        format!(
                            "Batch show completed: {} succeeded, {} failed",
                            succeeded, failed
                        ),
                    ),
                    result_counts(total, succeeded, failed),
                ),
                json!({
                    "objects": &objects,
                    "total": total,
                    "succeeded": succeeded,
                    "failed": failed
                }),
            ),
            results,
        })
    }
    .await;

    drop(task_guard);
    match &result {
        Ok(response) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new("completed", "Batch show object execution completed")
                .with_stage("command")
                .with_level(if response.result_summary.success {
                    "success"
                } else {
                    "warning"
                })
                .with_progress(Some(100))
                .with_details(Some(json!({
                    "object": response.object,
                    "target_count": response.targets.len(),
                    "counts": response.result_summary.counts.as_ref()
                }))),
        ),
        Err(err) => emit_task_event(
            &state,
            &task_ctx,
            TaskEventInput::new(
                "failed",
                format!("Batch show object execution failed: {}", err.message),
            )
            .with_stage("precheck")
            .with_level("error"),
        ),
    }
    spawn_task_callback(state, task_ctx, &result);
    result.map(Json)
}

fn resolve_batch_show_target_names(req: &ShowBatchExecuteRequest) -> Result<Vec<String>, ApiError> {
    let mut names = BTreeSet::new();
    for target in &req.targets {
        let trimmed = target.trim();
        if !trimmed.is_empty() {
            names.insert(
                connection_store::safe_connection_name(trimmed)
                    .map_err(|err| ApiError::bad_request(err.to_string()))?,
            );
        }
    }
    for connection in
        connection_store::list_connections_by_groups_any(&req.groups).map_err(ApiError::from)?
    {
        names.insert(connection);
    }
    for connection in
        connection_store::list_connections_by_labels_any(&req.labels).map_err(ApiError::from)?
    {
        names.insert(connection);
    }
    Ok(names.into_iter().collect())
}

fn resolve_batch_show_objects(req: &ShowBatchExecuteRequest) -> Result<Vec<String>, ApiError> {
    let mut objects = BTreeSet::new();
    let single = req.object.trim();
    if !single.is_empty() {
        objects.insert(single.to_string());
    }
    for object in &req.objects {
        let trimmed = object.trim();
        if !trimmed.is_empty() {
            objects.insert(trimmed.to_string());
        }
    }
    if objects.is_empty() {
        return Err(ApiError::bad_request("show object is required"));
    }
    Ok(objects.into_iter().collect())
}

async fn resolve_batch_show_target(
    state: &Arc<AppState>,
    name: &str,
    req: &ShowBatchExecuteRequest,
    object: &str,
) -> Result<ResolvedBatchShowTarget, ApiError> {
    let connection = ConnectionRequest {
        connection_name: Some(name.to_string()),
        ..Default::default()
    };
    let conn =
        resolve_autodetect_connection(merge_connection_options(&state.defaults, Some(connection))?)
            .await?;
    let platform =
        show_catalog::platform_for_show(&conn.device_profile, req.textfsm_platform.as_deref());
    let show =
        show_catalog::resolve_show_command(object, platform.as_deref(), &conn.device_profile)
            .map_err(|err| ApiError::bad_request(err.to_string()))?;
    command_blacklist::ensure_command_allowed(&show.command, "batch show execution")
        .map_err(|err| ApiError::bad_request(err.to_string()))?;
    let requested_mode = req.mode.as_deref().or(show.mode.as_deref());
    let effective_mode = resolve_effective_mode(requested_mode, &conn.device_profile)?;
    Ok(ResolvedBatchShowTarget {
        name: name.to_string(),
        conn,
        platform,
        show,
        effective_mode,
    })
}

async fn execute_batch_show_target(
    target: &ResolvedBatchShowTarget,
    no_parse: bool,
    record_level: Option<RecordLevel>,
) -> ShowBatchTargetResponse {
    match execute_batch_show_target_inner(target, no_parse, record_level).await {
        Ok(response) => response,
        Err(err) => ShowBatchTargetResponse {
            target: target.name.clone(),
            host: target.conn.host.clone(),
            profile: target.conn.device_profile.clone(),
            object: target.show.object.clone(),
            platform: target.platform.clone().unwrap_or_default(),
            command: target.show.command.clone(),
            mode: target.effective_mode.clone(),
            source: show_command_source_label(target.show.source).to_string(),
            textfsm_mapping_command: target.show.textfsm_mapping_command.clone(),
            textfsm_template_name: target.show.textfsm_template_name.clone(),
            output: None,
            exit_code: None,
            parsed_output: None,
            parse_error: None,
            error: Some(err.message),
        },
    }
}

async fn execute_batch_show_target_inner(
    target: &ResolvedBatchShowTarget,
    no_parse: bool,
    record_level: Option<RecordLevel>,
) -> Result<ShowBatchTargetResponse, ApiError> {
    let handler = template_loader::load_device_profile_for_connection(
        &target.conn.device_profile,
        target.conn.linux_shell_flavor,
    )?;
    let client = if let Some(level) = to_record_level(record_level) {
        DeviceClient::connect_with_recording(
            target.conn.host.clone(),
            target.conn.port,
            target.conn.username.clone(),
            target.conn.password.clone(),
            target.conn.enable_password.clone(),
            handler,
            template_loader::default_profile_mode(&target.conn.device_profile)?,
            level,
            target.conn.ssh_security,
        )
        .await?
    } else {
        DeviceClient::connect(
            target.conn.host.clone(),
            target.conn.port,
            target.conn.username.clone(),
            target.conn.password.clone(),
            target.conn.enable_password.clone(),
            handler,
            template_loader::default_profile_mode(&target.conn.device_profile)?,
            target.conn.ssh_security,
        )
        .await?
    };

    let output = client
        .execute_output(&target.show.command, Some(target.effective_mode.as_str()))
        .await?;
    let exit_code = output.exit_code;
    let should_parse = !no_parse && exit_code.unwrap_or(0) == 0;
    let textfsm_template_content = target
        .show
        .textfsm_template_name
        .as_deref()
        .map(|name| {
            custom_textfsm_store::load_template(name)
                .map_err(ApiError::from)?
                .ok_or_else(|| {
                    ApiError::bad_request(format!("TextFSM template '{}' not found", name))
                })
        })
        .transpose()?
        .map(|template| template.content);
    let (parsed_output, parse_error) = parse_textfsm_output_optional(
        &output.content,
        &target.show.command,
        WebTextfsmParseOptions {
            template_content: textfsm_template_content.as_deref(),
            enabled: should_parse,
            platform: target.platform.as_deref(),
            device_profile: Some(target.conn.device_profile.as_str()),
            ..Default::default()
        },
    );
    persist_history_if_recorded(
        &target.conn,
        &client,
        "show",
        &target.show.command,
        Some(target.effective_mode.as_str()),
        record_level,
    );

    Ok(ShowBatchTargetResponse {
        target: target.name.clone(),
        host: target.conn.host.clone(),
        profile: target.conn.device_profile.clone(),
        object: target.show.object.clone(),
        platform: target.platform.clone().unwrap_or_default(),
        command: target.show.command.clone(),
        mode: target.effective_mode.clone(),
        source: show_command_source_label(target.show.source).to_string(),
        textfsm_mapping_command: target.show.textfsm_mapping_command.clone(),
        textfsm_template_name: target.show.textfsm_template_name.clone(),
        output: Some(output.content),
        exit_code,
        parsed_output,
        parse_error,
        error: None,
    })
}

fn show_command_source_label(source: show_catalog::ShowCommandSource) -> &'static str {
    match source {
        show_catalog::ShowCommandSource::Builtin => "builtin",
        show_catalog::ShowCommandSource::Custom => "custom",
    }
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
                    let (parsed_output, parse_error) = parse_textfsm_output_optional(
                        &output.content,
                        &cmd,
                        WebTextfsmParseOptions {
                            template_file: req.textfsm_template.as_deref(),
                            enabled: req.parse_textfsm,
                            platform: req.textfsm_platform.as_deref(),
                            device_profile: Some(conn.device_profile.as_str()),
                            vendor: req.textfsm_vendor.as_deref(),
                            ..Default::default()
                        },
                    );
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
                        parsed_output,
                        parse_error,
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
                        parsed_output: None,
                        parse_error: None,
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
