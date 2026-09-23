use super::*;

use super::standard::{batch_show_concurrency, resolve_batch_target_names};
use std::collections::VecDeque;
use tokio::task::JoinSet;

pub async fn execute_interactive(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteInteractiveRequest>,
) -> Result<Json<ApiResponse<ExecuteInteractiveResponse>>, ApiError> {
    let record_level = req.target.record_level;
    let conn = resolve_autodetect_connection(apply_session_retry_options(
        merge_connection_options(&state.defaults, req.target.connection)?,
        req.retry.as_ref(),
    )?)
    .await?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let profile_default_mode =
        template_loader::default_profile_mode_for_connection(&conn.device_profile, &conn.username)?;

    let template = load_interactive_template_from_input(
        req.template_name.as_deref(),
        req.builtin_template_name.as_deref(),
        req.content.as_deref(),
        "inline_interactive",
    )?;
    let runtime_vars = resolve_interactive_connection_vars(&template, req.vars, &conn)?;

    let runtime_default_mode = resolve_interactive_runtime_default_mode(
        None,
        template.operation.mode.as_deref(),
        &profile_default_mode,
    );
    let effective_interactive_mode = runtime_default_mode
        .clone()
        .or_else(|| {
            template
                .operation
                .mode
                .as_deref()
                .map(str::trim)
                .filter(|mode| !mode.is_empty())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| profile_default_mode.clone());

    let interactive = template
        .to_execution_sequence(&build_interactive_runtime(
            runtime_default_mode,
            runtime_vars,
        ))
        .map_err(ApiError::from)?;

    command_blacklist::ensure_commands_allowed(
        interactive
            .steps
            .iter()
            .map(|command| command.command.as_str()),
        "interactive command",
    )
    .map_err(|e| ApiError::bad_request(e.to_string()))?;
    if interactive.steps.is_empty() {
        return Err(ApiError::bad_request("interactive command has no steps"));
    }

    let interactive_commands = interactive
        .steps
        .iter()
        .map(|step| step.command.clone())
        .collect::<Vec<_>>();

    let client = if let Some(level) = to_record_level(record_level) {
        DeviceClient::connect_with_recording_and_retry(
            conn.host.clone(),
            conn.port,
            conn.username.clone(),
            conn.auth.clone(),
            conn.enable_password.clone(),
            handler,
            conn.output_encoding,
            profile_default_mode.clone(),
            level,
            conn.ssh_security,
            conn.connect_timeout_secs,
            conn.retry_policy,
        )
        .await?
    } else {
        DeviceClient::connect_with_retry(
            conn.host.clone(),
            conn.port,
            conn.username.clone(),
            conn.auth.clone(),
            conn.enable_password.clone(),
            handler,
            conn.output_encoding,
            profile_default_mode.clone(),
            conn.ssh_security,
            conn.connect_timeout_secs,
            conn.retry_policy,
        )
        .await?
    };

    let result = client.execute_sequence(interactive).await?;
    persist_history_if_recorded(
        &conn,
        &client,
        "interactive",
        &format!("template: {}", template.name),
        Some(effective_interactive_mode.as_str()),
        record_level,
    );

    let outputs: Vec<CommandResult> = result
        .outputs
        .into_iter()
        .enumerate()
        .map(|(index, output)| {
            let command = interactive_commands
                .get(index)
                .cloned()
                .unwrap_or_else(|| format!("step {}", index + 1));
            let (parsed_output, parse_error) = parse_textfsm_output_optional(
                &output.content,
                &command,
                WebTextfsmParseOptions {
                    template_file: req.textfsm_template.as_deref(),
                    enabled: req.parse_textfsm,
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

    let response = ExecuteInteractiveResponse {
        success: result.success,
        template_name: template.name.clone(),
        result_summary: task_result_with_details(
            task_result_with_recording(
                task_result_with_counts(
                    build_result_summary(
                        TaskOperation::Interactive,
                        if result.success {
                            TaskResultOutcome::Success
                        } else if succeeded > 0 {
                            TaskResultOutcome::PartialSuccess
                        } else {
                            TaskResultOutcome::Failed
                        },
                        if result.success {
                            "Interactive command completed successfully"
                        } else if succeeded > 0 {
                            "Interactive command finished with failed steps"
                        } else {
                            "Interactive command failed"
                        },
                    ),
                    result_counts(outputs.len() as u64, succeeded, failed),
                ),
                &recording_jsonl,
            ),
            json!({
                "template_name": template.name,
                "mode": effective_interactive_mode
            }),
        ),
        outputs,
        recording_jsonl,
    };
    let summary = response.result_summary.clone();
    Ok(Json(ApiResponse::completed(response, summary)))
}

struct ResolvedBatchInteractiveTarget {
    name: String,
    conn: ResolvedConnection,
    interactive: rneter::session::CommandFlow,
    interactive_commands: Vec<String>,
    profile_default_mode: String,
    effective_interactive_mode: String,
}

/// Cloneable subset of [`InteractiveBatchExecuteRequest`] needed by each
/// concurrently executing interactive target.
#[derive(Clone)]
struct BatchInteractiveOptions {
    template_name: String,
    textfsm_template: Option<String>,
    parse_textfsm: bool,
    textfsm_vendor: Option<String>,
    textfsm_strict_errors: bool,
    record_level: Option<RecordLevel>,
}

pub async fn execute_interactive_batch(
    State(state): State<Arc<AppState>>,
    Json(req): Json<InteractiveBatchExecuteRequest>,
) -> Result<Json<ApiResponse<InteractiveBatchExecuteResponse>>, ApiError> {
    let (task_ctx, task_guard) = begin_reported_task(
        &state,
        TaskOperation::Interactive,
        req.task.task_id.clone(),
        TaskEventInput::new("started", "Starting batch interactive command execution")
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

    let result: Result<InteractiveBatchExecuteResponse, ApiError> = state
        .run_until_shutdown(async {
            let template = load_interactive_template_from_input(
                req.template_name.as_deref(),
                req.builtin_template_name.as_deref(),
                req.content.as_deref(),
                "inline_interactive",
            )?;
            let target_names = resolve_batch_target_names(&req.targets, &req.groups, &req.labels)?;
            if target_names.is_empty() {
                return Err(ApiError::bad_request(
                    "batch interactive resolved no saved connections",
                ));
            }

            let mut resolved_targets = Vec::with_capacity(target_names.len());
            let mut precheck_errors = Vec::new();
            for name in &target_names {
                match resolve_batch_interactive_target(
                    &state,
                    name,
                    &template,
                    &req.vars,
                    req.retry.as_ref(),
                )
                .await
                {
                    Ok(target) => resolved_targets.push(target),
                    Err(err) => precheck_errors.push(format!("{name}: {}", err.message)),
                }
            }
            if !precheck_errors.is_empty() {
                return Err(ApiError::bad_request(format!(
                    "interactive precheck failed for {} target(s):\n{}",
                    precheck_errors.len(),
                    precheck_errors.join("\n")
                )));
            }

            emit_task_event(
                &state,
                &task_ctx,
                TaskEventInput::new("progress", "Executing batch interactive command")
                    .with_stage("command")
                    .with_progress(Some(40))
                    .with_details(Some(json!({
                        "template_name": template.name,
                        "target_count": resolved_targets.len()
                    }))),
            );

            let options = BatchInteractiveOptions {
                template_name: template.name.clone(),
                textfsm_template: req.textfsm_template.clone(),
                parse_textfsm: req.parse_textfsm,
                textfsm_vendor: req.textfsm_vendor.clone(),
                textfsm_strict_errors: req.textfsm_strict_errors,
                record_level: req.record_level,
            };
            let total_targets = resolved_targets.len();
            let concurrency = batch_show_concurrency(req.max_parallel, total_targets);
            let mut pending: VecDeque<(usize, ResolvedBatchInteractiveTarget)> =
                resolved_targets.into_iter().enumerate().collect();
            let mut join_set = JoinSet::new();
            let mut slots: Vec<Option<InteractiveBatchTargetResponse>> =
                std::iter::repeat_with(|| None)
                    .take(total_targets)
                    .collect();
            while !pending.is_empty() || !join_set.is_empty() {
                while join_set.len() < concurrency && !pending.is_empty() {
                    let (idx, target) = pending
                        .pop_front()
                        .expect("pending batch interactive target");
                    let options = options.clone();
                    join_set.spawn(async move {
                        let response = execute_batch_interactive_target(&target, &options).await;
                        (idx, response)
                    });
                }
                let Some(joined) = join_set.join_next().await else {
                    break;
                };
                let (idx, response) = joined.map_err(|e| {
                    ApiError::internal(format!("batch interactive task failed: {}", e))
                })?;
                slots[idx] = Some(response);
            }
            let results: Vec<InteractiveBatchTargetResponse> =
                slots.into_iter().flatten().collect();

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

            Ok(InteractiveBatchExecuteResponse {
                template_name: template.name.clone(),
                targets: target_names,
                result_summary: task_result_with_details(
                    task_result_with_counts(
                        build_result_summary(
                            TaskOperation::Interactive,
                            outcome,
                            format!(
                                "Batch interactive command completed: {} succeeded, {} failed",
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
            message_prefix: "Batch interactive command failed",
        },
        |state, task_ctx, response| {
            emit_task_event(
                state,
                task_ctx,
                TaskEventInput::new("completed", "Batch interactive command completed")
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

async fn resolve_batch_interactive_target(
    state: &Arc<AppState>,
    name: &str,
    template: &InteractiveTemplate,
    vars: &Value,
    retry: Option<&SessionRetryOptions>,
) -> Result<ResolvedBatchInteractiveTarget, ApiError> {
    let connection = ConnectionRequest {
        connection_name: Some(name.to_string()),
        ..Default::default()
    };
    let conn = resolve_autodetect_connection(apply_session_retry_options(
        merge_connection_options(&state.defaults, Some(connection))?,
        retry,
    )?)
    .await?;
    let profile_default_mode =
        template_loader::default_profile_mode_for_connection(&conn.device_profile, &conn.username)?;
    let runtime_vars = resolve_interactive_connection_vars(template, vars.clone(), &conn)?;
    let runtime_default_mode = resolve_interactive_runtime_default_mode(
        None,
        template.operation.mode.as_deref(),
        &profile_default_mode,
    );
    let effective_interactive_mode = runtime_default_mode
        .clone()
        .or_else(|| {
            template
                .operation
                .mode
                .as_deref()
                .map(str::trim)
                .filter(|mode| !mode.is_empty())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| profile_default_mode.clone());
    let interactive = template
        .to_execution_sequence(&build_interactive_runtime(
            runtime_default_mode,
            runtime_vars,
        ))
        .map_err(ApiError::from)?;
    command_blacklist::ensure_commands_allowed(
        interactive
            .steps
            .iter()
            .map(|command| command.command.as_str()),
        "batch interactive command",
    )
    .map_err(|e| ApiError::bad_request(e.to_string()))?;
    if interactive.steps.is_empty() {
        return Err(ApiError::bad_request("interactive command has no steps"));
    }
    let interactive_commands = interactive
        .steps
        .iter()
        .map(|step| step.command.clone())
        .collect::<Vec<_>>();
    Ok(ResolvedBatchInteractiveTarget {
        name: name.to_string(),
        conn,
        interactive,
        interactive_commands,
        profile_default_mode,
        effective_interactive_mode,
    })
}

async fn execute_batch_interactive_target(
    target: &ResolvedBatchInteractiveTarget,
    options: &BatchInteractiveOptions,
) -> InteractiveBatchTargetResponse {
    match execute_batch_interactive_target_inner(target, options).await {
        Ok(response) => response,
        Err(err) => InteractiveBatchTargetResponse {
            target: target.name.clone(),
            host: target.conn.host.clone(),
            profile: target.conn.device_profile.clone(),
            success: None,
            outputs: Vec::new(),
            error: Some(err.message),
        },
    }
}

async fn execute_batch_interactive_target_inner(
    target: &ResolvedBatchInteractiveTarget,
    options: &BatchInteractiveOptions,
) -> Result<InteractiveBatchTargetResponse, ApiError> {
    let handler = template_loader::load_device_profile_for_connection(
        &target.conn.device_profile,
        target.conn.linux_shell_flavor,
    )?;
    let client = if let Some(level) = to_record_level(options.record_level) {
        DeviceClient::connect_with_recording_and_retry(
            target.conn.host.clone(),
            target.conn.port,
            target.conn.username.clone(),
            target.conn.auth.clone(),
            target.conn.enable_password.clone(),
            handler,
            target.conn.output_encoding,
            target.profile_default_mode.clone(),
            level,
            target.conn.ssh_security,
            target.conn.connect_timeout_secs,
            target.conn.retry_policy,
        )
        .await?
    } else {
        DeviceClient::connect_with_retry(
            target.conn.host.clone(),
            target.conn.port,
            target.conn.username.clone(),
            target.conn.auth.clone(),
            target.conn.enable_password.clone(),
            handler,
            target.conn.output_encoding,
            target.profile_default_mode.clone(),
            target.conn.ssh_security,
            target.conn.connect_timeout_secs,
            target.conn.retry_policy,
        )
        .await?
    };

    let result = client.execute_sequence(target.interactive.clone()).await?;
    persist_history_if_recorded(
        &target.conn,
        &client,
        "interactive",
        &format!("template: {}", options.template_name),
        Some(target.effective_interactive_mode.as_str()),
        options.record_level,
    );

    let outputs: Vec<CommandResult> = result
        .outputs
        .into_iter()
        .enumerate()
        .map(|(index, output)| {
            let command = target
                .interactive_commands
                .get(index)
                .cloned()
                .unwrap_or_else(|| format!("step {}", index + 1));
            let (parsed_output, parse_error) = parse_textfsm_output_optional(
                &output.content,
                &command,
                WebTextfsmParseOptions {
                    template_file: options.textfsm_template.as_deref(),
                    enabled: options.parse_textfsm,
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

    Ok(InteractiveBatchTargetResponse {
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
) -> Result<Json<ApiResponse<ExecuteUploadResponse>>, ApiError> {
    let record_level = req.target.record_level;
    let local_path = crate::web::path_policy::resolve_upload_file(&req.local_path)?;
    let local_path_display = crate::web::path_policy::upload_file_label(&local_path);
    let conn = resolve_autodetect_connection(merge_connection_options(
        &state.defaults,
        req.target.connection,
    )?)
    .await?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
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
        conn.output_encoding,
    );
    let context =
        manager_execution_context_with_security(None, conn.ssh_security, conn.connect_timeout_secs);

    let recording_jsonl = if let Some(level) = to_record_level(record_level) {
        let recorder = crate::config::session_recording::redacting_recorder(
            level,
            &conn.auth,
            conn.enable_password.as_deref(),
        );
        MANAGER
            .upload_file_with_recorder_and_context(request, upload, context, recorder.clone())
            .await?;
        let jsonl_raw = recorder.to_jsonl().map_err(ApiError::from)?;
        let jsonl = normalize_recording_jsonl_for_web_level(record_level, &jsonl_raw);
        persist_history_jsonl(
            &conn,
            "sftp_upload",
            &format!("{} -> {}", local_path_display, req.remote_path.trim()),
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

    let local_path_str = local_path_display;
    let remote_path = req.remote_path.trim().to_string();
    let response = ExecuteUploadResponse {
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
    };
    let summary = response.result_summary.clone();
    Ok(Json(ApiResponse::completed(response, summary)))
}
