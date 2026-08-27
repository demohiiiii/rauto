use super::*;

use std::collections::VecDeque;
use tokio::task::JoinSet;

/// Default number of devices a batch show request executes concurrently when
/// the request does not specify `max_parallel`. Matches the orchestrator's
/// default stage concurrency.
const DEFAULT_BATCH_SHOW_PARALLEL: usize = 4;

pub(super) fn batch_show_concurrency(max_parallel: Option<usize>, total_targets: usize) -> usize {
    max_parallel
        .unwrap_or(DEFAULT_BATCH_SHOW_PARALLEL)
        .max(1)
        .min(total_targets.max(1))
}

struct CommandResultsAggregate {
    output: String,
    exit_code: Option<i32>,
    succeeded: u64,
    failed: u64,
}

fn aggregate_command_results(outputs: &[CommandResult]) -> CommandResultsAggregate {
    let succeeded = outputs.iter().filter(|output| output.success).count() as u64;
    let failed = outputs.len() as u64 - succeeded;
    let exit_code = if outputs.len() == 1 {
        outputs[0].exit_code
    } else if failed == 0 {
        Some(0)
    } else {
        outputs
            .iter()
            .find(|output| !output.success)
            .and_then(|output| output.exit_code)
            .or(Some(1))
    };
    CommandResultsAggregate {
        output: outputs
            .iter()
            .filter_map(|output| output.output.as_deref())
            .collect::<Vec<_>>()
            .join("\n"),
        exit_code,
        succeeded,
        failed,
    }
}

fn rendered_template_command(
    mode: String,
    content: String,
    multiline_mode: MultilineMode,
) -> Command {
    Command {
        mode,
        command: content,
        multiline_mode,
        timeout: Some(60),
        dyn_params: CommandDynamicParams::default(),
        interaction: CommandInteraction::default(),
    }
}

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
    let (_, masked_rendered) = render_commands_with_runtime_context(
        req.template.as_deref(),
        req.template_content.as_deref(),
        req.vars,
        resolved_conn.as_ref(),
    )?;

    Ok(Json(RenderResponse {
        rendered_commands: masked_rendered,
    }))
}

pub async fn exec_command(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecRequest>,
) -> Result<Json<ApiResponse<ExecResponse>>, ApiError> {
    let (task_ctx, task_guard) = begin_reported_task(
        &state,
        TaskOperation::Exec,
        req.task.task_id.clone(),
        TaskEventInput::new("started", "Starting direct command execution")
            .with_stage("connect")
            .with_progress(Some(0))
            .with_details(Some(json!({
                "command": req.command,
                "mode": req.mode
            }))),
    );
    let result: Result<ExecResponse, ApiError> = state
        .run_until_shutdown(async {
            let record_level = req.target.record_level;
            let conn = resolve_autodetect_connection(apply_session_retry_options(
                merge_connection_options(&state.defaults, req.target.connection)?,
                req.retry.as_ref(),
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
            let command = Command {
                mode: effective_mode.clone(),
                command: req.command.clone(),
                multiline_mode: req.multiline_mode,
                timeout: Some(60),
                dyn_params: CommandDynamicParams::default(),
                interaction: CommandInteraction::default(),
            };
            let concrete_flow = command
                .clone()
                .into_flow()
                .map_err(|error| ApiError::bad_request(error.to_string()))?;
            command_blacklist::ensure_commands_allowed(
                concrete_flow.steps.iter().map(|step| step.command.as_str()),
                "direct execution",
            )
            .map_err(|error| ApiError::bad_request(error.to_string()))?;
            let client = if let Some(level) = to_record_level(record_level) {
                DeviceClient::connect_with_recording_and_retry(
                    conn.host.clone(),
                    conn.port,
                    conn.username.clone(),
                    conn.auth.clone(),
                    conn.enable_password.clone(),
                    handler,
                    conn.output_encoding,
                    template_loader::default_profile_mode(&conn.device_profile)?,
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
                    template_loader::default_profile_mode(&conn.device_profile)?,
                    conn.ssh_security,
                    conn.connect_timeout_secs,
                    conn.retry_policy,
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
            let concrete_commands = concrete_flow.steps.clone();
            let flow_output = client.execute_multiline_command_structured(command).await?;
            let mut outputs = Vec::with_capacity(flow_output.outputs.len());
            for (command, output) in concrete_commands.into_iter().zip(flow_output.outputs) {
                let (parsed_output, parse_error) = parse_textfsm_output_optional(
                    &output.content,
                    &command.command,
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
                outputs.push(CommandResult {
                    command: command.command,
                    success: output.success,
                    exit_code: output.exit_code,
                    output: Some(output.content),
                    all: Some(output.all),
                    error: None,
                    parsed_output,
                    parse_error,
                });
            }
            let aggregate = aggregate_command_results(&outputs);
            let (parsed_output, parse_error) = parse_textfsm_output_optional(
                &aggregate.output,
                &req.command,
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
                output: aggregate.output,
                exit_code: aggregate.exit_code,
                outputs,
                parsed_output,
                parse_error,
                result_summary: task_result_with_details(
                    task_result_with_recording(
                        task_result_with_counts(
                            build_result_summary(
                                TaskOperation::Exec,
                                if aggregate.failed == 0 {
                                    TaskResultOutcome::Success
                                } else if aggregate.succeeded > 0 {
                                    TaskResultOutcome::PartialSuccess
                                } else {
                                    TaskResultOutcome::Failed
                                },
                                if aggregate.failed == 0 {
                                    "Command executed successfully"
                                } else if aggregate.succeeded > 0 {
                                    "Command execution completed with failed lines"
                                } else {
                                    "Command execution failed"
                                },
                            ),
                            result_counts(
                                aggregate.succeeded + aggregate.failed,
                                aggregate.succeeded,
                                aggregate.failed,
                            ),
                        ),
                        &recording_jsonl,
                    ),
                    json!({
                        "exit_code": aggregate.exit_code,
                        "mode": effective_mode,
                        "command": req.command,
                        "multiline_mode": req.multiline_mode
                    }),
                ),
                recording_jsonl,
            })
        })
        .await;
    finish_reported_task(
        state,
        task_ctx,
        task_guard,
        result,
        TaskFailureEvent {
            stage: "command",
            message_prefix: "Direct command execution failed",
        },
        |state, task_ctx, response| {
            emit_task_event(
                state,
                task_ctx,
                TaskEventInput::new("completed", "Direct command execution completed")
                    .with_stage("command")
                    .with_level("success")
                    .with_progress(Some(100))
                    .with_details(Some(json!({
                        "exit_code": response.exit_code
                    }))),
            )
        },
        |_| None,
    )
}

pub async fn exec_command_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecRequest>,
) -> Result<(StatusCode, Json<ApiResponse<AsyncTaskAcceptedResponse>>), ApiError> {
    let response = queue_exec_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(ApiResponse::accepted(response))))
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
) -> Result<Json<ApiResponse<ShowExecuteResponse>>, ApiError> {
    let (task_ctx, task_guard) = begin_reported_task(
        &state,
        TaskOperation::Exec,
        req.task.task_id.clone(),
        TaskEventInput::new("started", "Starting show object execution")
            .with_stage("connect")
            .with_progress(Some(0))
            .with_details(Some(json!({
                "object": req.object,
                "mode": req.mode
            }))),
    );

    let result: Result<ShowExecuteResponse, ApiError> = state
        .run_until_shutdown(async {
            let record_level = req.target.record_level;
            let conn = resolve_autodetect_connection(apply_session_retry_options(
                merge_connection_options(&state.defaults, req.target.connection)?,
                req.retry.as_ref(),
            )?)
            .await?;
            let platform = show_catalog::platform_for_show(
                &conn.device_profile,
                req.textfsm_platform.as_deref(),
            );
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
                DeviceClient::connect_with_recording_and_retry(
                    conn.host.clone(),
                    conn.port,
                    conn.username.clone(),
                    conn.auth.clone(),
                    conn.enable_password.clone(),
                    handler,
                    conn.output_encoding,
                    template_loader::default_profile_mode(&conn.device_profile)?,
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
                    template_loader::default_profile_mode(&conn.device_profile)?,
                    conn.ssh_security,
                    conn.connect_timeout_secs,
                    conn.retry_policy,
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
            let success = output.success && exit_code.unwrap_or(0) == 0;
            let should_parse = !req.no_parse && success;
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
                    filter_error_rules: !req.textfsm_strict_errors,
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
                all: output.all,
                success,
                exit_code,
                parsed_output,
                parse_error,
                result_summary: task_result_with_details(
                    task_result_with_recording(
                        build_result_summary(
                            TaskOperation::Exec,
                            if success {
                                TaskResultOutcome::Success
                            } else {
                                TaskResultOutcome::Failed
                            },
                            if success {
                                "Show command executed successfully"
                            } else {
                                "Show command reported failure"
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
        })
        .await;
    finish_reported_task(
        state,
        task_ctx,
        task_guard,
        result,
        TaskFailureEvent {
            stage: "command",
            message_prefix: "Show object execution failed",
        },
        |state, task_ctx, response| {
            emit_task_event(
                state,
                task_ctx,
                TaskEventInput::new("completed", "Show object execution completed")
                    .with_stage("command")
                    .with_level(if response.success { "success" } else { "error" })
                    .with_progress(Some(100))
                    .with_details(Some(json!({
                        "exit_code": response.exit_code,
                        "object": response.object,
                        "command": response.command
                    }))),
            )
        },
        |response| (!response.success).then_some("Show command finished with failure"),
    )
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
) -> Result<Json<ApiResponse<ShowBatchExecuteResponse>>, ApiError> {
    let (task_ctx, task_guard) = begin_reported_task(
        &state,
        TaskOperation::Exec,
        req.task.task_id.clone(),
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

    let result: Result<ShowBatchExecuteResponse, ApiError> = state
        .run_until_shutdown(async {
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
                        Err(err) => {
                            precheck_errors.push(format!("{name}/{object}: {}", err.message))
                        }
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
            let no_parse = req.no_parse;
            let filter_error_rules = !req.textfsm_strict_errors;
            let total_targets = resolved_targets.len();
            let concurrency = batch_show_concurrency(req.max_parallel, total_targets);
            let mut pending: VecDeque<(usize, ResolvedBatchShowTarget)> =
                resolved_targets.into_iter().enumerate().collect();
            let mut join_set = JoinSet::new();
            let mut slots: Vec<Option<ShowBatchTargetResponse>> = std::iter::repeat_with(|| None)
                .take(total_targets)
                .collect();
            while !pending.is_empty() || !join_set.is_empty() {
                while join_set.len() < concurrency && !pending.is_empty() {
                    let (idx, target) = pending.pop_front().expect("pending batch show target");
                    join_set.spawn(async move {
                        let response = execute_batch_show_target(
                            &target,
                            no_parse,
                            record_level,
                            filter_error_rules,
                        )
                        .await;
                        (idx, response)
                    });
                }
                let Some(joined) = join_set.join_next().await else {
                    break;
                };
                let (idx, response) = joined
                    .map_err(|e| ApiError::internal(format!("batch show task failed: {}", e)))?;
                slots[idx] = Some(response);
            }
            let results: Vec<ShowBatchTargetResponse> = slots.into_iter().flatten().collect();

            let total = results.len() as u64;
            let failed = results
                .iter()
                .filter(|item| {
                    item.error.is_some() || !item.success || item.exit_code.unwrap_or(0) != 0
                })
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
        })
        .await;

    finish_reported_task(
        state,
        task_ctx,
        task_guard,
        result,
        TaskFailureEvent {
            stage: "precheck",
            message_prefix: "Batch show object execution failed",
        },
        |state, task_ctx, response| {
            emit_task_event(
                state,
                task_ctx,
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
            )
        },
        |_| None,
    )
}

fn resolve_batch_show_target_names(req: &ShowBatchExecuteRequest) -> Result<Vec<String>, ApiError> {
    resolve_batch_target_names(&req.targets, &req.groups, &req.labels)
}

pub(crate) fn resolve_batch_target_names(
    targets: &[String],
    groups: &[String],
    labels: &[String],
) -> Result<Vec<String>, ApiError> {
    let mut names = BTreeSet::new();
    for target in targets {
        let trimmed = target.trim();
        if !trimmed.is_empty() {
            names.insert(
                connection_store::safe_connection_name(trimmed)
                    .map_err(|err| ApiError::bad_request(err.to_string()))?,
            );
        }
    }
    for connection in
        connection_store::list_connections_by_groups_any(groups).map_err(ApiError::from)?
    {
        names.insert(connection);
    }
    for connection in
        connection_store::list_connections_by_labels_any(labels).map_err(ApiError::from)?
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
    let conn = resolve_autodetect_connection(apply_session_retry_options(
        merge_connection_options(&state.defaults, Some(connection))?,
        req.retry.as_ref(),
    )?)
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
    filter_error_rules: bool,
) -> ShowBatchTargetResponse {
    match execute_batch_show_target_inner(target, no_parse, record_level, filter_error_rules).await
    {
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
            all: None,
            success: false,
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
    filter_error_rules: bool,
) -> Result<ShowBatchTargetResponse, ApiError> {
    let handler = template_loader::load_device_profile_for_connection(
        &target.conn.device_profile,
        target.conn.linux_shell_flavor,
    )?;
    let client = if let Some(level) = to_record_level(record_level) {
        DeviceClient::connect_with_recording_and_retry(
            target.conn.host.clone(),
            target.conn.port,
            target.conn.username.clone(),
            target.conn.auth.clone(),
            target.conn.enable_password.clone(),
            handler,
            target.conn.output_encoding,
            template_loader::default_profile_mode(&target.conn.device_profile)?,
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
            template_loader::default_profile_mode(&target.conn.device_profile)?,
            target.conn.ssh_security,
            target.conn.connect_timeout_secs,
            target.conn.retry_policy,
        )
        .await?
    };

    let output = client
        .execute_output(&target.show.command, Some(target.effective_mode.as_str()))
        .await?;
    let exit_code = output.exit_code;
    let success = output.success && exit_code.unwrap_or(0) == 0;
    let should_parse = !no_parse && success;
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
            filter_error_rules,
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
        all: Some(output.all),
        success,
        exit_code,
        parsed_output,
        parse_error,
        error: None,
    })
}

struct ResolvedBatchExecTarget {
    name: String,
    conn: ResolvedConnection,
    effective_mode: String,
}

/// Cloneable subset of [`ExecBatchExecuteRequest`] needed by each
/// concurrently executing batch exec target.
#[derive(Clone)]
struct BatchExecOptions {
    command: String,
    multiline_mode: MultilineMode,
    textfsm_template: Option<String>,
    parse_textfsm: bool,
    textfsm_platform: Option<String>,
    textfsm_vendor: Option<String>,
    textfsm_strict_errors: bool,
    record_level: Option<RecordLevel>,
}

pub async fn execute_exec_batch(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecBatchExecuteRequest>,
) -> Result<Json<ApiResponse<ExecBatchExecuteResponse>>, ApiError> {
    let (task_ctx, task_guard) = begin_reported_task(
        &state,
        TaskOperation::Exec,
        req.task.task_id.clone(),
        TaskEventInput::new("started", "Starting batch command execution")
            .with_stage("precheck")
            .with_progress(Some(0))
            .with_details(Some(json!({
                "command": &req.command,
                "targets": &req.targets,
                "groups": &req.groups,
                "labels": &req.labels
            }))),
    );

    let result: Result<ExecBatchExecuteResponse, ApiError> = state
        .run_until_shutdown(async {
            if req.command.trim().is_empty() {
                return Err(ApiError::bad_request("command is required"));
            }
            let target_names = resolve_batch_target_names(&req.targets, &req.groups, &req.labels)?;
            if target_names.is_empty() {
                return Err(ApiError::bad_request(
                    "batch exec resolved no saved connections",
                ));
            }

            let mut resolved_targets = Vec::with_capacity(target_names.len());
            let mut precheck_errors = Vec::new();
            for name in &target_names {
                match resolve_batch_exec_target(&state, name, &req).await {
                    Ok(target) => resolved_targets.push(target),
                    Err(err) => precheck_errors.push(format!("{name}: {}", err.message)),
                }
            }
            if !precheck_errors.is_empty() {
                return Err(ApiError::bad_request(format!(
                    "exec precheck failed for {} target(s):\n{}",
                    precheck_errors.len(),
                    precheck_errors.join("\n")
                )));
            }

            emit_task_event(
                &state,
                &task_ctx,
                TaskEventInput::new("progress", "Executing batch command")
                    .with_stage("command")
                    .with_progress(Some(40))
                    .with_details(Some(json!({
                        "command": &req.command,
                        "target_count": resolved_targets.len()
                    }))),
            );

            let options = BatchExecOptions {
                command: req.command.clone(),
                multiline_mode: req.multiline_mode,
                textfsm_template: req.textfsm_template.clone(),
                parse_textfsm: req.parse_textfsm,
                textfsm_platform: req.textfsm_platform.clone(),
                textfsm_vendor: req.textfsm_vendor.clone(),
                textfsm_strict_errors: req.textfsm_strict_errors,
                record_level: req.record_level,
            };
            let total_targets = resolved_targets.len();
            let concurrency = batch_show_concurrency(req.max_parallel, total_targets);
            let mut pending: VecDeque<(usize, ResolvedBatchExecTarget)> =
                resolved_targets.into_iter().enumerate().collect();
            let mut join_set = JoinSet::new();
            let mut slots: Vec<Option<ExecBatchTargetResponse>> = std::iter::repeat_with(|| None)
                .take(total_targets)
                .collect();
            while !pending.is_empty() || !join_set.is_empty() {
                while join_set.len() < concurrency && !pending.is_empty() {
                    let (idx, target) = pending.pop_front().expect("pending batch exec target");
                    let options = options.clone();
                    join_set.spawn(async move {
                        let response = execute_batch_exec_target(&target, &options).await;
                        (idx, response)
                    });
                }
                let Some(joined) = join_set.join_next().await else {
                    break;
                };
                let (idx, response) = joined
                    .map_err(|e| ApiError::internal(format!("batch exec task failed: {}", e)))?;
                slots[idx] = Some(response);
            }
            let results: Vec<ExecBatchTargetResponse> = slots.into_iter().flatten().collect();

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

            Ok(ExecBatchExecuteResponse {
                command: req.command.clone(),
                targets: target_names,
                result_summary: task_result_with_details(
                    task_result_with_counts(
                        build_result_summary(
                            TaskOperation::Exec,
                            outcome,
                            format!(
                                "Batch exec completed: {} succeeded, {} failed",
                                succeeded, failed
                            ),
                        ),
                        result_counts(total, succeeded, failed),
                    ),
                    json!({
                        "command": &req.command,
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
            message_prefix: "Batch command execution failed",
        },
        |state, task_ctx, response| {
            emit_task_event(
                state,
                task_ctx,
                TaskEventInput::new("completed", "Batch command execution completed")
                    .with_stage("command")
                    .with_level(if response.result_summary.success {
                        "success"
                    } else {
                        "warning"
                    })
                    .with_progress(Some(100))
                    .with_details(Some(json!({
                        "command": response.command,
                        "target_count": response.targets.len(),
                        "counts": response.result_summary.counts.as_ref()
                    }))),
            )
        },
        |_| None,
    )
}

async fn resolve_batch_exec_target(
    state: &Arc<AppState>,
    name: &str,
    req: &ExecBatchExecuteRequest,
) -> Result<ResolvedBatchExecTarget, ApiError> {
    let connection = ConnectionRequest {
        connection_name: Some(name.to_string()),
        ..Default::default()
    };
    let conn = resolve_autodetect_connection(apply_session_retry_options(
        merge_connection_options(&state.defaults, Some(connection))?,
        req.retry.as_ref(),
    )?)
    .await?;
    let effective_mode = resolve_effective_mode(req.mode.as_deref(), &conn.device_profile)?;
    let command = Command {
        mode: effective_mode.clone(),
        command: req.command.clone(),
        multiline_mode: req.multiline_mode,
        timeout: Some(60),
        dyn_params: CommandDynamicParams::default(),
        interaction: CommandInteraction::default(),
    };
    let concrete_flow = command
        .into_flow()
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    command_blacklist::ensure_commands_allowed(
        concrete_flow.steps.iter().map(|step| step.command.as_str()),
        "batch exec execution",
    )
    .map_err(|error| ApiError::bad_request(error.to_string()))?;
    Ok(ResolvedBatchExecTarget {
        name: name.to_string(),
        conn,
        effective_mode,
    })
}

async fn execute_batch_exec_target(
    target: &ResolvedBatchExecTarget,
    options: &BatchExecOptions,
) -> ExecBatchTargetResponse {
    match execute_batch_exec_target_inner(target, options).await {
        Ok(response) => response,
        Err(err) => ExecBatchTargetResponse {
            target: target.name.clone(),
            host: target.conn.host.clone(),
            profile: target.conn.device_profile.clone(),
            command: options.command.clone(),
            mode: target.effective_mode.clone(),
            output: None,
            exit_code: None,
            parsed_output: None,
            parse_error: None,
            error: Some(err.message),
        },
    }
}

async fn execute_batch_exec_target_inner(
    target: &ResolvedBatchExecTarget,
    options: &BatchExecOptions,
) -> Result<ExecBatchTargetResponse, ApiError> {
    let handler = template_loader::load_device_profile_for_connection(
        &target.conn.device_profile,
        target.conn.linux_shell_flavor,
    )?;
    let command = Command {
        mode: target.effective_mode.clone(),
        command: options.command.clone(),
        multiline_mode: options.multiline_mode,
        timeout: Some(60),
        dyn_params: CommandDynamicParams::default(),
        interaction: CommandInteraction::default(),
    };
    let concrete_flow = command
        .clone()
        .into_flow()
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    let client = if let Some(level) = to_record_level(options.record_level) {
        DeviceClient::connect_with_recording_and_retry(
            target.conn.host.clone(),
            target.conn.port,
            target.conn.username.clone(),
            target.conn.auth.clone(),
            target.conn.enable_password.clone(),
            handler,
            target.conn.output_encoding,
            template_loader::default_profile_mode(&target.conn.device_profile)?,
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
            template_loader::default_profile_mode(&target.conn.device_profile)?,
            target.conn.ssh_security,
            target.conn.connect_timeout_secs,
            target.conn.retry_policy,
        )
        .await?
    };

    let concrete_commands = concrete_flow.steps.clone();
    let flow_output = client.execute_multiline_command_structured(command).await?;
    let outputs: Vec<CommandResult> = concrete_commands
        .into_iter()
        .zip(flow_output.outputs)
        .map(|(command, output)| CommandResult {
            command: command.command,
            success: output.success,
            exit_code: output.exit_code,
            output: Some(output.content),
            all: Some(output.all),
            error: None,
            parsed_output: None,
            parse_error: None,
        })
        .collect();
    let aggregate = aggregate_command_results(&outputs);
    let (parsed_output, parse_error) = parse_textfsm_output_optional(
        &aggregate.output,
        &options.command,
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
    persist_history_if_recorded(
        &target.conn,
        &client,
        "exec",
        &options.command,
        Some(target.effective_mode.as_str()),
        options.record_level,
    );
    Ok(ExecBatchTargetResponse {
        target: target.name.clone(),
        host: target.conn.host.clone(),
        profile: target.conn.device_profile.clone(),
        command: options.command.clone(),
        mode: target.effective_mode.clone(),
        output: Some(aggregate.output),
        exit_code: aggregate.exit_code,
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
) -> Result<Json<ApiResponse<ExecuteTemplateResponse>>, ApiError> {
    let template_source = req
        .template
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("inline")
        .to_string();
    let (task_ctx, task_guard) = begin_reported_task(
        &state,
        TaskOperation::TemplateExecute,
        req.task.task_id.clone(),
        TaskEventInput::new("started", "Starting template execution")
            .with_stage("render")
            .with_progress(Some(0))
            .with_details(Some(json!({
                "template": template_source.as_str(),
                "mode": req.mode
            }))),
    );
    let result: Result<ExecuteTemplateResponse, ApiError> = state
        .run_until_shutdown(async {
            let record_level = req.target.record_level;
            let dry_run = req.run.dry_run.unwrap_or(false);
            let incoming_connection = req.target.connection.clone();
            let render_conn = if dry_run {
                merge_connection_options(&state.defaults, incoming_connection.clone()).ok()
            } else {
                Some(
                    resolve_autodetect_connection(apply_session_retry_options(
                        merge_connection_options(&state.defaults, incoming_connection.clone())?,
                        req.retry.as_ref(),
                    )?)
                    .await?,
                )
            };
            let _ = req.template_dir.as_ref();
            let (rendered_commands, masked_rendered_commands) =
                render_commands_with_runtime_context(
                    req.template.as_deref(),
                    req.template_content.as_deref(),
                    req.vars,
                    render_conn.as_ref(),
                )?;
            let preview_flow = rendered_template_command(
                req.mode.clone().unwrap_or_default(),
                rendered_commands.clone(),
                req.multiline_mode,
            )
            .into_flow()
            .map_err(|error| ApiError::bad_request(error.to_string()))?;
            let rendered_count = preview_flow.steps.len() as u64;
            emit_task_event(
                &state,
                &task_ctx,
                TaskEventInput::new("progress", "Template rendered")
                    .with_stage("render")
                    .with_progress(Some(20))
                    .with_details(Some(json!({
                        "template": template_source.as_str(),
                        "rendered_command_count": rendered_count,
                        "multiline_mode": req.multiline_mode
                    }))),
            );

            if dry_run {
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
                            "template": template_source.as_str(),
                            "mode": req.mode,
                            "rendered_command_count": rendered_count,
                            "multiline_mode": req.multiline_mode
                        }),
                    ),
                    rendered_commands: masked_rendered_commands,
                    executed: Vec::new(),
                    recording_jsonl: None,
                });
            }

            command_blacklist::ensure_commands_allowed(
                preview_flow.steps.iter().map(|step| step.command.as_str()),
                "template execution",
            )
            .map_err(|e| ApiError::bad_request(e.to_string()))?;

            let conn = match render_conn {
                Some(conn) => conn,
                None => apply_session_retry_options(
                    merge_connection_options(&state.defaults, incoming_connection)?,
                    req.retry.as_ref(),
                )?,
            };
            let handler = template_loader::load_device_profile_for_connection(
                &conn.device_profile,
                conn.linux_shell_flavor,
            )?;
            let effective_mode = resolve_effective_mode(req.mode.as_deref(), &conn.device_profile)?;
            let client = if let Some(level) = to_record_level(record_level) {
                DeviceClient::connect_with_recording_and_retry(
                    conn.host.clone(),
                    conn.port,
                    conn.username.clone(),
                    conn.auth.clone(),
                    conn.enable_password.clone(),
                    handler,
                    conn.output_encoding,
                    template_loader::default_profile_mode(&conn.device_profile)?,
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
                    template_loader::default_profile_mode(&conn.device_profile)?,
                    conn.ssh_security,
                    conn.connect_timeout_secs,
                    conn.retry_policy,
                )
                .await?
            };

            let command = rendered_template_command(
                effective_mode.clone(),
                rendered_commands.clone(),
                req.multiline_mode,
            );
            let concrete_commands = command
                .clone()
                .into_flow()
                .map_err(|error| ApiError::bad_request(error.to_string()))?
                .steps;
            let total_commands = concrete_commands.len();
            emit_task_event(
                &state,
                &task_ctx,
                TaskEventInput::new("progress", "Executing rendered commands")
                    .with_stage("command")
                    .with_progress(Some(60))
                    .with_details(Some(json!({
                        "total": total_commands,
                        "multiline_mode": req.multiline_mode
                    }))),
            );
            let flow_output = client.execute_multiline_command_structured(command).await?;
            let mut executed = Vec::with_capacity(flow_output.outputs.len());
            for (idx, (command, output)) in concrete_commands
                .into_iter()
                .zip(flow_output.outputs)
                .enumerate()
            {
                let (parsed_output, parse_error) = parse_textfsm_output_optional(
                    &output.content,
                    &command.command,
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
                emit_task_event(
                    &state,
                    &task_ctx,
                    TaskEventInput::new(
                        if output.success {
                            "step_completed"
                        } else {
                            "warning"
                        },
                        format!(
                            "Command {}/{} {}",
                            idx + 1,
                            total_commands,
                            if output.success {
                                "completed"
                            } else {
                                "failed"
                            }
                        ),
                    )
                    .with_stage("command")
                    .with_level(if output.success { "success" } else { "warning" })
                    .with_progress(task_event_progress(idx + 1, total_commands))
                    .with_details(Some(json!({
                        "command": command.command,
                        "index": idx + 1,
                        "total": total_commands,
                        "exit_code": output.exit_code
                    }))),
                );
                executed.push(CommandResult {
                    command: command.command,
                    success: output.success,
                    exit_code: output.exit_code,
                    output: Some(output.content),
                    all: Some(output.all),
                    error: None,
                    parsed_output,
                    parse_error,
                });
            }

            persist_history_if_recorded(
                &conn,
                &client,
                "template_execute",
                &format!("template: {}", template_source),
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
                        "template": template_source.as_str(),
                        "mode": effective_mode
                    }),
                ),
                recording_jsonl,
            })
        })
        .await;
    finish_reported_task(
        state,
        task_ctx,
        task_guard,
        result,
        TaskFailureEvent {
            stage: "render",
            message_prefix: "Template execution failed",
        },
        |state, task_ctx, response| {
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
            emit_task_event(state, task_ctx, event);
        },
        |_| None,
    )
}

pub async fn execute_template_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTemplateRequest>,
) -> Result<(StatusCode, Json<ApiResponse<AsyncTaskAcceptedResponse>>), ApiError> {
    let response = queue_template_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(ApiResponse::accepted(response))))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command_result(
        command: &str,
        success: bool,
        exit_code: Option<i32>,
        output: &str,
    ) -> CommandResult {
        CommandResult {
            command: command.to_string(),
            success,
            exit_code,
            output: Some(output.to_string()),
            all: Some(output.to_string()),
            error: None,
            parsed_output: None,
            parse_error: None,
        }
    }

    #[test]
    fn multiline_exec_response_aggregates_child_outputs() {
        let outputs = vec![
            command_result("show version", true, Some(0), "v1"),
            command_result("show inventory", true, Some(0), "inv"),
        ];

        let aggregate = aggregate_command_results(&outputs);

        assert_eq!(aggregate.output, "v1\ninv");
        assert_eq!(aggregate.exit_code, Some(0));
        assert_eq!(aggregate.succeeded, 2);
        assert_eq!(aggregate.failed, 0);
    }

    #[test]
    fn multiline_exec_response_reports_mixed_failure() {
        let outputs = vec![
            command_result("show version", true, Some(0), "v1"),
            command_result("show inventory", false, Some(7), "denied"),
        ];

        let aggregate = aggregate_command_results(&outputs);

        assert_eq!(aggregate.output, "v1\ndenied");
        assert_eq!(aggregate.exit_code, Some(7));
        assert_eq!(aggregate.succeeded, 1);
        assert_eq!(aggregate.failed, 1);
    }

    #[test]
    fn rendered_template_command_preserves_multiline_mode() {
        let command = rendered_template_command(
            "Config".to_string(),
            "interface Gi0/1\nno shutdown".to_string(),
            rneter::session::MultilineMode::Whole,
        );
        assert_eq!(
            command.multiline_mode,
            rneter::session::MultilineMode::Whole
        );
        assert_eq!(
            command.into_flow().expect("whole command flow").steps.len(),
            1
        );
    }

    #[test]
    fn rendered_template_split_lines_is_fail_fast() {
        let flow = rendered_template_command(
            "Config".to_string(),
            "interface Gi0/1\nno shutdown".to_string(),
            rneter::session::MultilineMode::SplitLines,
        )
        .into_flow()
        .expect("split command flow");
        assert_eq!(flow.steps.len(), 2);
        assert!(flow.stop_on_error);
    }

    #[test]
    fn inline_command_template_renders_without_template_lookup() {
        let (rendered, masked) =
            render_commands_with_runtime_context(None, Some("show version"), json!({}), None)
                .expect("inline command template");

        assert_eq!(rendered, "show version");
        assert_eq!(masked, "show version");
    }

    #[test]
    fn command_template_source_must_be_unambiguous() {
        let error = render_commands_with_runtime_context(
            Some("saved-template"),
            Some("show version"),
            json!({}),
            None,
        )
        .expect_err("ambiguous template source");

        assert!(
            error
                .message
                .contains("either template or template_content")
        );
    }

    #[test]
    fn batch_show_concurrency_clamps_to_valid_range() {
        assert_eq!(batch_show_concurrency(None, 10), 4);
        assert_eq!(batch_show_concurrency(None, 2), 2);
        assert_eq!(batch_show_concurrency(Some(0), 10), 1);
        assert_eq!(batch_show_concurrency(Some(8), 3), 3);
        assert_eq!(batch_show_concurrency(Some(2), 10), 2);
        assert_eq!(batch_show_concurrency(Some(5), 0), 1);
    }

    #[test]
    fn batch_show_request_accepts_and_defaults_max_parallel() {
        let legacy: ShowBatchExecuteRequest = serde_json::from_value(serde_json::json!({
            "object": "interfaces",
            "targets": ["edge-1"]
        }))
        .expect("request without max_parallel should deserialize");
        assert_eq!(legacy.max_parallel, None);

        let tuned: ShowBatchExecuteRequest = serde_json::from_value(serde_json::json!({
            "object": "interfaces",
            "targets": ["edge-1"],
            "max_parallel": 8
        }))
        .expect("request with max_parallel should deserialize");
        assert_eq!(tuned.max_parallel, Some(8));
    }
}
