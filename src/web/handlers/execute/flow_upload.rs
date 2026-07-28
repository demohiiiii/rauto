use super::*;

use super::standard::{batch_show_concurrency, resolve_batch_target_names};
use std::collections::VecDeque;
use tokio::task::JoinSet;

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

    let template = load_command_flow_template_from_input(
        req.template_name.as_deref(),
        req.builtin_template_name.as_deref(),
        req.content.as_deref(),
        "inline_flow",
    )?;
    let runtime_vars = resolve_flow_runtime_vars(&template, req.vars, &conn)?;

    let runtime_default_mode = resolve_command_flow_runtime_default_mode(
        None,
        template.default_mode.as_deref(),
        &profile_default_mode,
    );
    let effective_flow_mode = runtime_default_mode
        .clone()
        .or_else(|| {
            template
                .default_mode
                .as_deref()
                .map(str::trim)
                .filter(|mode| !mode.is_empty())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| profile_default_mode.clone());

    let flow = template
        .to_command_flow(&build_command_flow_runtime(
            runtime_default_mode,
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
            conn.auth.clone(),
            conn.enable_password.clone(),
            handler,
            profile_default_mode.clone(),
            level,
            conn.ssh_security,
            conn.connect_timeout_secs,
        )
        .await?
    } else {
        DeviceClient::connect(
            conn.host.clone(),
            conn.port,
            conn.username.clone(),
            conn.auth.clone(),
            conn.enable_password.clone(),
            handler,
            profile_default_mode.clone(),
            conn.ssh_security,
            conn.connect_timeout_secs,
        )
        .await?
    };

    let result = client.execute_command_flow(flow).await?;
    persist_history_if_recorded(
        &conn,
        &client,
        "command_flow",
        &format!("template: {}", template.name),
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
                all: Some(output.all),
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
        template_name: template.name.clone(),
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
                "template_name": template.name,
                "mode": effective_flow_mode
            }),
        ),
        outputs,
        recording_jsonl,
    }))
}

struct ResolvedBatchFlowTarget {
    name: String,
    conn: ResolvedConnection,
    flow: rneter::session::CommandFlow,
    flow_commands: Vec<String>,
    profile_default_mode: String,
    effective_flow_mode: String,
}

/// Cloneable subset of [`FlowBatchExecuteRequest`] needed by each
/// concurrently executing flow target.
#[derive(Clone)]
struct BatchFlowOptions {
    template_name: String,
    textfsm_template: Option<String>,
    parse_textfsm: bool,
    textfsm_platform: Option<String>,
    textfsm_vendor: Option<String>,
    textfsm_strict_errors: bool,
    record_level: Option<RecordLevel>,
}

pub async fn execute_flow_batch(
    State(state): State<Arc<AppState>>,
    Json(req): Json<FlowBatchExecuteRequest>,
) -> Result<Json<FlowBatchExecuteResponse>, ApiError> {
    let (task_ctx, task_guard) = begin_reported_task(
        &state,
        TaskOperation::CommandFlow,
        req.task.task_id.clone(),
        TaskEventInput::new("started", "Starting batch command flow execution")
            .with_stage("precheck")
            .with_progress(Some(0))
            .with_details(Some(json!({
                "template_name": &req.template_name,
                "builtin_template_name": &req.builtin_template_name,
                "targets": &req.targets,
                "groups": &req.groups,
                "labels": &req.labels
            }))),
    );

    let result: Result<FlowBatchExecuteResponse, ApiError> = state
        .run_until_shutdown(async {
            let template = load_command_flow_template_from_input(
                req.template_name.as_deref(),
                req.builtin_template_name.as_deref(),
                req.content.as_deref(),
                "inline_flow",
            )?;
            let target_names = resolve_batch_target_names(&req.targets, &req.groups, &req.labels)?;
            if target_names.is_empty() {
                return Err(ApiError::bad_request(
                    "batch flow resolved no saved connections",
                ));
            }

            let mut resolved_targets = Vec::with_capacity(target_names.len());
            let mut precheck_errors = Vec::new();
            for name in &target_names {
                match resolve_batch_flow_target(&state, name, &template, &req.vars).await {
                    Ok(target) => resolved_targets.push(target),
                    Err(err) => precheck_errors.push(format!("{name}: {}", err.message)),
                }
            }
            if !precheck_errors.is_empty() {
                return Err(ApiError::bad_request(format!(
                    "flow precheck failed for {} target(s):\n{}",
                    precheck_errors.len(),
                    precheck_errors.join("\n")
                )));
            }

            emit_task_event(
                &state,
                &task_ctx,
                TaskEventInput::new("progress", "Executing batch command flow")
                    .with_stage("command")
                    .with_progress(Some(40))
                    .with_details(Some(json!({
                        "template_name": template.name,
                        "target_count": resolved_targets.len()
                    }))),
            );

            let options = BatchFlowOptions {
                template_name: template.name.clone(),
                textfsm_template: req.textfsm_template.clone(),
                parse_textfsm: req.parse_textfsm,
                textfsm_platform: req.textfsm_platform.clone(),
                textfsm_vendor: req.textfsm_vendor.clone(),
                textfsm_strict_errors: req.textfsm_strict_errors,
                record_level: req.record_level,
            };
            let total_targets = resolved_targets.len();
            let concurrency = batch_show_concurrency(req.max_parallel, total_targets);
            let mut pending: VecDeque<(usize, ResolvedBatchFlowTarget)> =
                resolved_targets.into_iter().enumerate().collect();
            let mut join_set = JoinSet::new();
            let mut slots: Vec<Option<FlowBatchTargetResponse>> = std::iter::repeat_with(|| None)
                .take(total_targets)
                .collect();
            while !pending.is_empty() || !join_set.is_empty() {
                while join_set.len() < concurrency && !pending.is_empty() {
                    let (idx, target) = pending.pop_front().expect("pending batch flow target");
                    let options = options.clone();
                    join_set.spawn(async move {
                        let response = execute_batch_flow_target(&target, &options).await;
                        (idx, response)
                    });
                }
                let Some(joined) = join_set.join_next().await else {
                    break;
                };
                let (idx, response) = joined
                    .map_err(|e| ApiError::internal(format!("batch flow task failed: {}", e)))?;
                slots[idx] = Some(response);
            }
            let results: Vec<FlowBatchTargetResponse> = slots.into_iter().flatten().collect();

            let total = results.len() as u64;
            let failed = results
                .iter()
                .filter(|item| item.error.is_some() || item.success == Some(false))
                .count() as u64;
            let succeeded = total.saturating_sub(failed);
            let outcome = if failed == 0 {
                TaskResultOutcome::Success
            } else if succeeded > 0 {
                TaskResultOutcome::PartialSuccess
            } else {
                TaskResultOutcome::Failed
            };

            Ok(FlowBatchExecuteResponse {
                template_name: template.name.clone(),
                targets: target_names,
                result_summary: task_result_with_details(
                    task_result_with_counts(
                        build_result_summary(
                            TaskOperation::CommandFlow,
                            outcome,
                            format!(
                                "Batch command flow completed: {} succeeded, {} failed",
                                succeeded, failed
                            ),
                        ),
                        result_counts(total, succeeded, failed),
                    ),
                    json!({
                        "template_name": template.name,
                        "total": total,
                        "succeeded": succeeded,
                        "failed": failed
                    }),
                ),
                results,
            })
        })
        .await;

    finish_reported_task(
        state,
        task_ctx,
        task_guard,
        result,
        TaskFailureEvent {
            stage: "precheck",
            message_prefix: "Batch command flow failed",
        },
        |state, task_ctx, response| {
            emit_task_event(
                state,
                task_ctx,
                TaskEventInput::new("completed", "Batch command flow completed")
                    .with_stage("command")
                    .with_level(if response.result_summary.success {
                        "success"
                    } else {
                        "warning"
                    })
                    .with_progress(Some(100))
                    .with_details(Some(json!({
                        "template_name": response.template_name,
                        "target_count": response.targets.len(),
                        "counts": response.result_summary.counts.as_ref()
                    }))),
            )
        },
        |_| None,
    )
}

async fn resolve_batch_flow_target(
    state: &Arc<AppState>,
    name: &str,
    template: &CommandFlowTemplate,
    vars: &Value,
) -> Result<ResolvedBatchFlowTarget, ApiError> {
    let connection = ConnectionRequest {
        connection_name: Some(name.to_string()),
        ..Default::default()
    };
    let conn =
        resolve_autodetect_connection(merge_connection_options(&state.defaults, Some(connection))?)
            .await?;
    let profile_default_mode = template_loader::default_profile_mode(&conn.device_profile)?;
    let runtime_vars = resolve_flow_runtime_vars(template, vars.clone(), &conn)?;
    let runtime_default_mode = resolve_command_flow_runtime_default_mode(
        None,
        template.default_mode.as_deref(),
        &profile_default_mode,
    );
    let effective_flow_mode = runtime_default_mode
        .clone()
        .or_else(|| {
            template
                .default_mode
                .as_deref()
                .map(str::trim)
                .filter(|mode| !mode.is_empty())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| profile_default_mode.clone());
    let flow = template
        .to_command_flow(&build_command_flow_runtime(
            runtime_default_mode,
            runtime_vars,
        ))
        .map_err(ApiError::from)?;
    command_blacklist::ensure_commands_allowed(
        flow.steps.iter().map(|command| command.command.as_str()),
        "batch command flow",
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
    Ok(ResolvedBatchFlowTarget {
        name: name.to_string(),
        conn,
        flow,
        flow_commands,
        profile_default_mode,
        effective_flow_mode,
    })
}

async fn execute_batch_flow_target(
    target: &ResolvedBatchFlowTarget,
    options: &BatchFlowOptions,
) -> FlowBatchTargetResponse {
    match execute_batch_flow_target_inner(target, options).await {
        Ok(response) => response,
        Err(err) => FlowBatchTargetResponse {
            target: target.name.clone(),
            host: target.conn.host.clone(),
            profile: target.conn.device_profile.clone(),
            success: None,
            outputs: Vec::new(),
            error: Some(err.message),
        },
    }
}

async fn execute_batch_flow_target_inner(
    target: &ResolvedBatchFlowTarget,
    options: &BatchFlowOptions,
) -> Result<FlowBatchTargetResponse, ApiError> {
    let handler = template_loader::load_device_profile_for_connection(
        &target.conn.device_profile,
        target.conn.linux_shell_flavor,
    )?;
    let client = if let Some(level) = to_record_level(options.record_level) {
        DeviceClient::connect_with_recording(
            target.conn.host.clone(),
            target.conn.port,
            target.conn.username.clone(),
            target.conn.auth.clone(),
            target.conn.enable_password.clone(),
            handler,
            target.profile_default_mode.clone(),
            level,
            target.conn.ssh_security,
            target.conn.connect_timeout_secs,
        )
        .await?
    } else {
        DeviceClient::connect(
            target.conn.host.clone(),
            target.conn.port,
            target.conn.username.clone(),
            target.conn.auth.clone(),
            target.conn.enable_password.clone(),
            handler,
            target.profile_default_mode.clone(),
            target.conn.ssh_security,
            target.conn.connect_timeout_secs,
        )
        .await?
    };

    let result = client.execute_command_flow(target.flow.clone()).await?;
    persist_history_if_recorded(
        &target.conn,
        &client,
        "command_flow",
        &format!("template: {}", options.template_name),
        Some(target.effective_flow_mode.as_str()),
        options.record_level,
    );

    let outputs: Vec<CommandResult> = result
        .outputs
        .into_iter()
        .enumerate()
        .map(|(index, output)| {
            let command = target
                .flow_commands
                .get(index)
                .cloned()
                .unwrap_or_else(|| format!("step {}", index + 1));
            let (parsed_output, parse_error) = parse_textfsm_output_optional(
                &output.content,
                &command,
                WebTextfsmParseOptions {
                    template_file: options.textfsm_template.as_deref(),
                    enabled: options.parse_textfsm,
                    platform: options.textfsm_platform.as_deref(),
                    device_profile: Some(target.conn.device_profile.as_str()),
                    vendor: options.textfsm_vendor.as_deref(),
                    filter_error_rules: !options.textfsm_strict_errors,
                    ..Default::default()
                },
            );
            CommandResult {
                command,
                success: output.success,
                exit_code: output.exit_code,
                output: Some(output.content),
                all: Some(output.all),
                error: None,
                parsed_output,
                parse_error,
            }
        })
        .collect();

    Ok(FlowBatchTargetResponse {
        target: target.name.clone(),
        host: target.conn.host.clone(),
        profile: target.conn.device_profile.clone(),
        success: Some(result.success),
        outputs,
        error: None,
    })
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
        conn.auth.clone(),
        conn.enable_password.clone(),
        handler,
    );
    let context =
        manager_execution_context_with_security(None, conn.ssh_security, conn.connect_timeout_secs);

    let recording_jsonl = if let Some(level) = to_record_level(record_level) {
        let recorder = crate::config::session_recording::redacting_recorder(
            level,
            &conn.auth,
            conn.enable_password.as_deref(),
        );
        let (_sender, recorder) = MANAGER
            .get_with_recorder_and_context(request, context.clone(), recorder)
            .await?;
        let handler_for_upload = template_loader::load_device_profile_for_connection(
            &conn.device_profile,
            conn.linux_shell_flavor,
        )?;
        let request = manager_connection_request(
            conn.username.clone(),
            conn.host.clone(),
            conn.port,
            conn.auth.clone(),
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
