use super::*;

use super::standard::{batch_show_concurrency, resolve_batch_target_names};
use crate::config::config_catalog;
use std::collections::VecDeque;
use tokio::task::JoinSet;

struct ResolvedConfigFetchTarget {
    name: String,
    conn: ResolvedConnection,
    fetch_command: config_catalog::ConfigFetchCommand,
    effective_mode: String,
}

/// Cloneable subset of [`ConfigBatchFetchRequest`] needed by each
/// concurrently executing fetch target.
#[derive(Clone)]
struct ConfigFetchTaskOptions {
    include_normalized: bool,
    record_level: Option<RecordLevel>,
}

pub async fn fetch_config(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ConfigFetchRequest>,
) -> Result<Json<ApiResponse<ConfigFetchResponse>>, ApiError> {
    let (task_ctx, task_guard) = begin_reported_task(
        &state,
        TaskOperation::Exec,
        req.task.task_id.clone(),
        TaskEventInput::new("started", "Starting config fetch")
            .with_stage("precheck")
            .with_progress(Some(0))
            .with_details(Some(json!({ "kind": &req.kind }))),
    );

    let result: Result<ConfigFetchResponse, ApiError> = state
        .run_until_shutdown(async {
            let target = resolve_config_fetch_connection_target(
                &state,
                req.target.connection,
                &req.kind,
                req.retry.as_ref(),
            )
            .await?;
            emit_task_event(
                &state,
                &task_ctx,
                TaskEventInput::new("progress", "Fetching device configuration")
                    .with_stage("command")
                    .with_progress(Some(40))
                    .with_details(Some(json!({
                        "kind": &req.kind,
                        "target": &target.name
                    }))),
            );
            let target = fetch_config_target(
                &target,
                &ConfigFetchTaskOptions {
                    include_normalized: req.include_normalized,
                    record_level: req.target.record_level,
                },
            )
            .await;
            let succeeded = target.error.is_none();
            Ok(ConfigFetchResponse {
                result_summary: task_result_with_counts(
                    build_result_summary(
                        TaskOperation::Exec,
                        if succeeded {
                            TaskResultOutcome::Success
                        } else {
                            TaskResultOutcome::Failed
                        },
                        if succeeded {
                            "Configuration fetched successfully"
                        } else {
                            "Configuration fetch command failed"
                        },
                    ),
                    result_counts(1, u64::from(succeeded), u64::from(!succeeded)),
                ),
                target,
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
            message_prefix: "Config fetch failed",
        },
        |state, task_ctx, response| {
            emit_task_event(
                state,
                task_ctx,
                TaskEventInput::new("completed", "Config fetch completed")
                    .with_stage("command")
                    .with_level(if response.target.error.is_none() {
                        "success"
                    } else {
                        "error"
                    })
                    .with_progress(Some(100))
                    .with_details(Some(json!({
                        "kind": response.target.kind,
                        "target": response.target.target,
                        "success": response.target.error.is_none()
                    }))),
            )
        },
        |response| {
            response
                .target
                .error
                .as_ref()
                .map(|_| "Config fetch command failed")
        },
    )
}

pub async fn fetch_config_batch(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ConfigBatchFetchRequest>,
) -> Result<Json<ApiResponse<ConfigBatchFetchResponse>>, ApiError> {
    let (task_ctx, task_guard) = begin_reported_task(
        &state,
        TaskOperation::Exec,
        req.task.task_id.clone(),
        TaskEventInput::new("started", "Starting batch config fetch")
            .with_stage("precheck")
            .with_progress(Some(0))
            .with_details(Some(json!({
                "kind": &req.kind,
                "targets": &req.targets,
                "groups": &req.groups,
                "labels": &req.labels
            }))),
    );

    let result: Result<ConfigBatchFetchResponse, ApiError> = state
        .run_until_shutdown(async {
            let target_names = resolve_batch_target_names(&req.targets, &req.groups, &req.labels)?;
            if target_names.is_empty() {
                return Err(ApiError::bad_request(
                    "batch config fetch resolved no saved connections",
                ));
            }

            let mut resolved_targets = Vec::with_capacity(target_names.len());
            let mut precheck_errors = Vec::new();
            for name in &target_names {
                match resolve_config_fetch_target(&state, name, &req.kind, req.retry.as_ref()).await
                {
                    Ok(target) => resolved_targets.push(target),
                    Err(err) => precheck_errors.push(format!("{name}: {}", err.message)),
                }
            }
            if !precheck_errors.is_empty() {
                return Err(ApiError::bad_request(format!(
                    "config fetch precheck failed for {} target(s):\n{}",
                    precheck_errors.len(),
                    precheck_errors.join("\n")
                )));
            }

            emit_task_event(
                &state,
                &task_ctx,
                TaskEventInput::new("progress", "Fetching device configurations")
                    .with_stage("command")
                    .with_progress(Some(40))
                    .with_details(Some(json!({
                        "kind": &req.kind,
                        "target_count": resolved_targets.len()
                    }))),
            );

            let options = ConfigFetchTaskOptions {
                include_normalized: req.include_normalized,
                record_level: req.record_level,
            };
            let total_targets = resolved_targets.len();
            let concurrency = batch_show_concurrency(req.max_parallel, total_targets);
            let mut pending: VecDeque<(usize, ResolvedConfigFetchTarget)> =
                resolved_targets.into_iter().enumerate().collect();
            let mut join_set = JoinSet::new();
            let mut slots: Vec<Option<ConfigFetchTargetResponse>> = std::iter::repeat_with(|| None)
                .take(total_targets)
                .collect();
            while !pending.is_empty() || !join_set.is_empty() {
                while join_set.len() < concurrency && !pending.is_empty() {
                    let (idx, target) = pending.pop_front().expect("pending config fetch target");
                    let options = options.clone();
                    join_set.spawn(async move {
                        let response = fetch_config_target(&target, &options).await;
                        (idx, response)
                    });
                }
                let Some(joined) = join_set.join_next().await else {
                    break;
                };
                let (idx, response) = joined.map_err(|e| {
                    ApiError::internal(format!("batch config fetch task failed: {}", e))
                })?;
                slots[idx] = Some(response);
            }
            let results: Vec<ConfigFetchTargetResponse> = slots.into_iter().flatten().collect();

            let total = results.len() as u64;
            let failed = results.iter().filter(|item| item.error.is_some()).count() as u64;
            let succeeded = total.saturating_sub(failed);
            let outcome = if failed == 0 {
                TaskResultOutcome::Success
            } else if succeeded > 0 {
                TaskResultOutcome::PartialSuccess
            } else {
                TaskResultOutcome::Failed
            };

            Ok(ConfigBatchFetchResponse {
                kind: req.kind.clone(),
                targets: target_names,
                result_summary: task_result_with_details(
                    task_result_with_counts(
                        build_result_summary(
                            TaskOperation::Exec,
                            outcome,
                            format!(
                                "Batch config fetch completed: {} succeeded, {} failed",
                                succeeded, failed
                            ),
                        ),
                        result_counts(total, succeeded, failed),
                    ),
                    json!({
                        "kind": &req.kind,
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
            message_prefix: "Batch config fetch failed",
        },
        |state, task_ctx, response| {
            emit_task_event(
                state,
                task_ctx,
                TaskEventInput::new("completed", "Batch config fetch completed")
                    .with_stage("command")
                    .with_level(if response.result_summary.success {
                        "success"
                    } else {
                        "warning"
                    })
                    .with_progress(Some(100))
                    .with_details(Some(json!({
                        "kind": response.kind,
                        "target_count": response.targets.len(),
                        "counts": response.result_summary.counts.as_ref()
                    }))),
            )
        },
        |_| None,
    )
}

async fn resolve_config_fetch_target(
    state: &Arc<AppState>,
    name: &str,
    kind: &str,
    retry: Option<&SessionRetryOptions>,
) -> Result<ResolvedConfigFetchTarget, ApiError> {
    let connection = ConnectionRequest {
        connection_name: Some(name.to_string()),
        ..Default::default()
    };
    resolve_config_fetch_connection_target(state, Some(connection), kind, retry).await
}

async fn resolve_config_fetch_connection_target(
    state: &Arc<AppState>,
    connection: Option<ConnectionRequest>,
    kind: &str,
    retry: Option<&SessionRetryOptions>,
) -> Result<ResolvedConfigFetchTarget, ApiError> {
    let conn = resolve_autodetect_connection(apply_session_retry_options(
        merge_connection_options(&state.defaults, connection)?,
        retry,
    )?)
    .await?;
    let fetch_command = config_catalog::resolve_config_command(&conn.device_profile, kind)
        .map_err(|err| ApiError::bad_request(err.to_string()))?;
    command_blacklist::ensure_command_allowed(&fetch_command.command, "config fetch")
        .map_err(|err| ApiError::bad_request(err.to_string()))?;
    let effective_mode =
        resolve_effective_mode(fetch_command.mode.as_deref(), &conn.device_profile)?;
    let name = conn
        .connection_name
        .clone()
        .unwrap_or_else(|| conn.host.clone());
    Ok(ResolvedConfigFetchTarget {
        name,
        conn,
        fetch_command,
        effective_mode,
    })
}

async fn fetch_config_target(
    target: &ResolvedConfigFetchTarget,
    options: &ConfigFetchTaskOptions,
) -> ConfigFetchTargetResponse {
    match fetch_config_target_inner(target, options).await {
        Ok(response) => response,
        Err(err) => ConfigFetchTargetResponse {
            target: target.name.clone(),
            host: target.conn.host.clone(),
            profile: target.conn.device_profile.clone(),
            kind: target.fetch_command.kind.clone(),
            command: target.fetch_command.command.clone(),
            fetched_at: Utc::now().to_rfc3339(),
            content: None,
            all: None,
            normalized_content: None,
            sha256: None,
            normalized_sha256: None,
            error: Some(err.message),
        },
    }
}

async fn fetch_config_target_inner(
    target: &ResolvedConfigFetchTarget,
    options: &ConfigFetchTaskOptions,
) -> Result<ConfigFetchTargetResponse, ApiError> {
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
            template_loader::default_profile_mode(&target.conn.device_profile)?,
            target.conn.ssh_security,
            target.conn.connect_timeout_secs,
            target.conn.retry_policy,
        )
        .await?
    };

    let output = client
        .execute_output(&target.fetch_command.command, Some(&target.effective_mode))
        .await?;
    let exit_code = output.exit_code;
    let success = output.success && exit_code.unwrap_or(0) == 0;
    persist_history_if_recorded(
        &target.conn,
        &client,
        "config_fetch",
        &target.fetch_command.command,
        Some(target.effective_mode.as_str()),
        options.record_level,
    );
    if !success {
        let error = match exit_code {
            Some(code) if code != 0 => format!(
                "config fetch command '{}' exited with code {}",
                target.fetch_command.command, code
            ),
            _ => format!(
                "config fetch command '{}' reported a device error",
                target.fetch_command.command
            ),
        };
        return Ok(ConfigFetchTargetResponse {
            target: target.name.clone(),
            host: target.conn.host.clone(),
            profile: target.conn.device_profile.clone(),
            kind: target.fetch_command.kind.clone(),
            command: target.fetch_command.command.clone(),
            fetched_at: Utc::now().to_rfc3339(),
            content: Some(output.content),
            all: Some(output.all),
            normalized_content: None,
            sha256: None,
            normalized_sha256: None,
            error: Some(error),
        });
    }
    let content = output.content;
    let all = output.all;
    let patterns = config_catalog::volatile_patterns(&target.conn.device_profile)
        .map_err(|err| ApiError::internal(err.to_string()))?;
    let normalized = config_catalog::normalize_config(&content, &patterns);
    Ok(ConfigFetchTargetResponse {
        target: target.name.clone(),
        host: target.conn.host.clone(),
        profile: target.conn.device_profile.clone(),
        kind: target.fetch_command.kind.clone(),
        command: target.fetch_command.command.clone(),
        fetched_at: Utc::now().to_rfc3339(),
        sha256: Some(config_catalog::sha256_hex(&content)),
        normalized_sha256: Some(config_catalog::sha256_hex(&normalized)),
        normalized_content: options.include_normalized.then_some(normalized),
        content: Some(content),
        all: Some(all),
        error: None,
    })
}
