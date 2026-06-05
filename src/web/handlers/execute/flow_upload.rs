use super::*;

pub async fn execute_command_flow(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteCommandFlowRequest>,
) -> Result<Json<ExecuteCommandFlowResponse>, ApiError> {
    let record_level = req.target.record_level;
    let conn = resolve_autodetect_connection(merge_connection_options(
        &state.defaults,
        req.target.connection,
    )?)
    .await?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let profile_default_mode = template_loader::default_profile_mode(&conn.device_profile)?;

    let parsed_template = load_command_flow_template_from_input(
        req.template_name.as_deref(),
        req.builtin_template_name.as_deref(),
        req.content.as_deref(),
        "inline_flow",
    )?;
    let runtime_vars = resolve_flow_runtime_vars(
        &parsed_template.template,
        req.vars,
        &conn,
        parsed_template.current_connection_alias.as_deref(),
    )?;

    let runtime_default_mode = resolve_command_flow_runtime_default_mode(
        None,
        parsed_template.template.default_mode.as_deref(),
        &profile_default_mode,
    );
    let effective_flow_mode = runtime_default_mode
        .clone()
        .or_else(|| {
            parsed_template
                .template
                .default_mode
                .as_deref()
                .map(str::trim)
                .filter(|mode| !mode.is_empty())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| profile_default_mode.clone());

    let flow = parsed_template
        .template
        .to_command_flow(&build_command_flow_runtime(
            runtime_default_mode,
            conn.connection_name.as_deref(),
            &conn.host,
            &conn.username,
            &conn.device_profile,
            runtime_vars,
        ))
        .map_err(ApiError::from)?;

    command_blacklist::ensure_commands_allowed(
        flow.steps.iter().map(|command| command.command.as_str()),
        "command flow",
    )
    .map_err(|e| ApiError::bad_request(e.to_string()))?;
    if flow.steps.is_empty() {
        return Err(ApiError::bad_request("command flow has no steps"));
    }

    let flow_commands = flow
        .steps
        .iter()
        .map(|step| step.command.clone())
        .collect::<Vec<_>>();

    let client = if let Some(level) = to_record_level(record_level) {
        DeviceClient::connect_with_recording(
            conn.host.clone(),
            conn.port,
            conn.username.clone(),
            conn.password.clone(),
            conn.enable_password.clone(),
            handler,
            profile_default_mode.clone(),
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
            profile_default_mode.clone(),
            conn.ssh_security,
        )
        .await?
    };

    let result = client.execute_command_flow(flow).await?;
    persist_history_if_recorded(
        &conn,
        &client,
        "command_flow",
        &format!("template: {}", parsed_template.template.name),
        Some(effective_flow_mode.as_str()),
        record_level,
    );

    let outputs: Vec<CommandResult> = result
        .outputs
        .into_iter()
        .enumerate()
        .map(|(index, output)| {
            let command = flow_commands
                .get(index)
                .cloned()
                .unwrap_or_else(|| format!("step {}", index + 1));
            let (parsed_output, parse_error) = parse_textfsm_output_optional(
                &output.content,
                &command,
                WebTextfsmParseOptions {
                    template_file: req.textfsm_template.as_deref(),
                    enabled: req.parse_textfsm,
                    platform: req.textfsm_platform.as_deref(),
                    device_profile: Some(conn.device_profile.as_str()),
                    vendor: req.textfsm_vendor.as_deref(),
                    filter_error_rules: !req.textfsm_strict_errors,
                    ..Default::default()
                },
            );
            CommandResult {
                command,
                success: output.success,
                exit_code: output.exit_code,
                output: Some(output.content),
                error: None,
                parsed_output,
                parse_error,
            }
        })
        .collect();

    let succeeded = outputs.iter().filter(|item| item.success).count() as u64;
    let failed = outputs.len() as u64 - succeeded;
    let recording_jsonl = client.recording_jsonl()?;

    Ok(Json(ExecuteCommandFlowResponse {
        success: result.success,
        template_name: parsed_template.template.name.clone(),
        result_summary: task_result_with_details(
            task_result_with_recording(
                task_result_with_counts(
                    build_result_summary(
                        TaskOperation::CommandFlow,
                        if result.success {
                            TaskResultOutcome::Success
                        } else if succeeded > 0 {
                            TaskResultOutcome::PartialSuccess
                        } else {
                            TaskResultOutcome::Failed
                        },
                        if result.success {
                            "Command flow completed successfully"
                        } else if succeeded > 0 {
                            "Command flow finished with failed steps"
                        } else {
                            "Command flow failed"
                        },
                    ),
                    result_counts(outputs.len() as u64, succeeded, failed),
                ),
                &recording_jsonl,
            ),
            json!({
                "template_name": parsed_template.template.name,
                "mode": effective_flow_mode
            }),
        ),
        outputs,
        recording_jsonl,
    }))
}

pub async fn execute_upload(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteUploadRequest>,
) -> Result<Json<ExecuteUploadResponse>, ApiError> {
    let record_level = req.target.record_level;
    let conn = resolve_autodetect_connection(merge_connection_options(
        &state.defaults,
        req.target.connection,
    )?)
    .await?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let local_path = PathBuf::from(req.local_path.trim());
    if !local_path.is_file() {
        return Err(ApiError::bad_request(format!(
            "local upload file '{}' does not exist or is not a file",
            local_path.to_string_lossy()
        )));
    }

    let mut upload = rneter::session::FileUploadRequest::new(
        local_path.to_string_lossy().to_string(),
        req.remote_path.trim().to_string(),
    )
    .with_timeout_secs(req.timeout_secs.unwrap_or(300))
    .with_progress_reporting(req.show_progress);
    if let Some(buffer_size) = req.buffer_size {
        if buffer_size == 0 {
            return Err(ApiError::bad_request(
                "buffer_size must be greater than 0 when provided",
            ));
        }
        upload = upload.with_buffer_size(buffer_size);
    }

    let request = manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
        conn.enable_password.clone(),
        handler,
    );
    let context = manager_execution_context_with_security(None, conn.ssh_security);

    let recording_jsonl = if let Some(level) = to_record_level(record_level) {
        let (_sender, recorder) = MANAGER
            .get_with_recording_level_and_context(request, context.clone(), level)
            .await?;
        let handler_for_upload = template_loader::load_device_profile_for_connection(
            &conn.device_profile,
            conn.linux_shell_flavor,
        )?;
        let request = manager_connection_request(
            conn.username.clone(),
            conn.host.clone(),
            conn.port,
            conn.password.clone(),
            conn.enable_password.clone(),
            handler_for_upload,
        );
        MANAGER
            .upload_file_with_context(request, upload, context)
            .await?;
        let jsonl_raw = recorder.to_jsonl().map_err(ApiError::from)?;
        let jsonl = normalize_recording_jsonl_for_web_level(record_level, &jsonl_raw);
        persist_history_jsonl(
            &conn,
            "sftp_upload",
            &format!(
                "{} -> {}",
                local_path.to_string_lossy(),
                req.remote_path.trim()
            ),
            None,
            record_level,
            &jsonl,
        );
        Some(jsonl)
    } else {
        MANAGER
            .upload_file_with_context(request, upload, context)
            .await?;
        None
    };

    let local_path_str = local_path.to_string_lossy().to_string();
    let remote_path = req.remote_path.trim().to_string();
    Ok(Json(ExecuteUploadResponse {
        ok: true,
        local_path: local_path_str.clone(),
        remote_path: remote_path.clone(),
        result_summary: task_result_with_details(
            task_result_with_recording(
                build_result_summary(
                    TaskOperation::Upload,
                    TaskResultOutcome::Success,
                    "File uploaded successfully",
                ),
                &recording_jsonl,
            ),
            json!({
                "local_path": local_path_str,
                "remote_path": remote_path
            }),
        ),
        recording_jsonl,
    }))
}
