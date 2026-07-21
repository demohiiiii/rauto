use super::*;

pub(super) fn api_error_to_status(err: ApiError) -> Status {
    match err.status {
        axum::http::StatusCode::BAD_REQUEST => Status::invalid_argument(err.message),
        axum::http::StatusCode::UNAUTHORIZED => Status::unauthenticated(err.message),
        axum::http::StatusCode::FORBIDDEN => Status::permission_denied(err.message),
        axum::http::StatusCode::NOT_FOUND => Status::not_found(err.message),
        axum::http::StatusCode::CONFLICT => Status::already_exists(err.message),
        axum::http::StatusCode::TOO_MANY_REQUESTS => Status::resource_exhausted(err.message),
        _ => Status::internal(err.message),
    }
}

pub(super) fn optional_string(raw: String) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

pub(super) fn parse_json_value(
    raw: &str,
    field_name: &str,
    default: Value,
) -> Result<Value, Status> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(default);
    }
    serde_json::from_str(trimmed)
        .map_err(|err| Status::invalid_argument(format!("invalid {} JSON: {}", field_name, err)))
}

pub(super) fn parse_record_level(raw: &str) -> Result<Option<RecordLevel>, Status> {
    match raw.trim() {
        "" => Ok(None),
        "key-events-only" => Ok(Some(RecordLevel::KeyEventsOnly)),
        "full" => Ok(Some(RecordLevel::Full)),
        value => Err(Status::invalid_argument(format!(
            "unsupported record_level '{}'",
            value
        ))),
    }
}

pub(super) fn parse_multiline_mode(raw: &str) -> Result<MultilineMode, Status> {
    match raw.trim() {
        "" | "split_lines" => Ok(MultilineMode::SplitLines),
        "whole" => Ok(MultilineMode::Whole),
        value => Err(Status::invalid_argument(format!(
            "unsupported multiline_mode '{}'",
            value
        ))),
    }
}

pub(super) fn map_execution_target_options(
    connection: Option<ConnectionRef>,
    record_level: &str,
) -> Result<ExecutionTargetOptions, Status> {
    Ok(ExecutionTargetOptions {
        connection: map_connection_ref(connection)?,
        record_level: parse_record_level(record_level)?,
    })
}

pub(super) fn map_managed_task_options(task_id: String) -> ManagedTaskOptions {
    ManagedTaskOptions {
        task_id: optional_string(task_id),
    }
}

fn parse_ssh_security(raw: &str) -> Result<Option<SshSecurityProfile>, Status> {
    match raw.trim() {
        "" => Ok(None),
        "secure" => Ok(Some(SshSecurityProfile::Secure)),
        "balanced" => Ok(Some(SshSecurityProfile::Balanced)),
        "legacy-compatible" => Ok(Some(SshSecurityProfile::LegacyCompatible)),
        value => Err(Status::invalid_argument(format!(
            "unsupported ssh_security '{}'",
            value
        ))),
    }
}

fn parse_linux_shell_flavor(raw: &str) -> Result<Option<LinuxShellFlavor>, Status> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    trimmed.parse::<LinuxShellFlavor>().map(Some).map_err(|_| {
        Status::invalid_argument(format!("unsupported linux_shell_flavor '{}'", trimmed))
    })
}

fn map_connection_ref(
    connection: Option<ConnectionRef>,
) -> Result<Option<ConnectionRequest>, Status> {
    let Some(connection) = connection else {
        return Ok(None);
    };
    Ok(Some(ConnectionRequest {
        connection_name: optional_string(connection.connection_name),
        host: optional_string(connection.host),
        username: optional_string(connection.username),
        password: optional_string(connection.password),
        port: connection.port.map(|value| value as u16),
        connect_timeout_secs: None,
        device_model: optional_string(connection.device_model),
        software_version: optional_string(connection.software_version),
        enable_password: optional_string(connection.enable_password),
        enable_password_empty_enter: connection.enable_password_empty_enter,
        ssh_security: parse_ssh_security(&connection.ssh_security)?,
        linux_shell_flavor: parse_linux_shell_flavor(&connection.linux_shell_flavor)?,
        device_profile: optional_string(connection.device_profile),
        template_dir: optional_string(connection.template_dir),
        enabled: connection.enabled.unwrap_or(true),
        labels: connection.labels,
        groups: connection.groups,
        vars: parse_json_value(
            &connection.vars_json,
            "connection.vars_json",
            serde_json::json!({}),
        )?,
    }))
}

pub(super) fn map_async_response(
    response: crate::web::models::AsyncTaskAcceptedResponse,
) -> AcceptedTaskResponse {
    AcceptedTaskResponse {
        accepted: response.accepted,
        task_id: response.task_id,
        operation: response.operation.to_string(),
        status: response.status.to_string(),
    }
}

pub(super) fn map_execute_tx_block_request(
    req: GrpcExecuteTxBlockRequest,
) -> Result<WebExecuteTxBlockRequest, Status> {
    Ok(WebExecuteTxBlockRequest {
        tx_block_template_name: optional_string(req.tx_block_template_name),
        tx_block_template_content: optional_string(req.tx_block_template_content),
        tx_block_template_vars: parse_json_value(
            &req.tx_block_template_vars_json,
            "tx_block_template_vars_json",
            Value::Null,
        )?,
        tx_block: parse_json_value(&req.tx_block_json, "tx_block_json", Value::Null)?,
        run: DryRunOptions {
            dry_run: Some(req.dry_run),
        },
        target: map_execution_target_options(req.connection, &req.record_level)?,
        task: map_managed_task_options(req.task_id),
    })
}

pub(super) fn map_execute_tx_workflow_request(
    req: GrpcExecuteTxWorkflowRequest,
) -> Result<WebExecuteTxWorkflowRequest, Status> {
    Ok(WebExecuteTxWorkflowRequest {
        workflow_template_name: optional_string(req.workflow_template_name),
        workflow_template_content: optional_string(req.workflow_template_content),
        workflow_vars: parse_json_value(
            &req.workflow_vars_json,
            "workflow_vars_json",
            Value::Null,
        )?,
        workflow: parse_json_value(&req.workflow_json, "workflow_json", Value::Null)?,
        run: DryRunOptions {
            dry_run: Some(req.dry_run),
        },
        target: map_execution_target_options(req.connection, &req.record_level)?,
        task: map_managed_task_options(req.task_id),
    })
}

pub(super) fn map_execute_orchestration_request(
    req: GrpcExecuteOrchestrationRequest,
) -> Result<WebExecuteOrchestrationRequest, Status> {
    Ok(WebExecuteOrchestrationRequest {
        plan_template_name: optional_string(req.plan_template_name),
        plan_template_content: optional_string(req.plan_template_content),
        plan_vars: parse_json_value(&req.plan_vars_json, "plan_vars_json", Value::Null)?,
        plan: parse_json_value(&req.plan_json, "plan_json", Value::Null)?,
        base_dir: optional_string(req.base_dir),
        run: DryRunOptions {
            dry_run: Some(req.dry_run),
        },
        target: map_execution_target_options(req.connection, &req.record_level)?,
        task: map_managed_task_options(req.task_id),
    })
}

pub(super) fn map_command_result(result: CommandResult) -> CommandExecutionResult {
    CommandExecutionResult {
        command: result.command,
        success: result.success,
        exit_code: result.exit_code,
        output: result.output,
        error: result.error,
        parsed_output_json: serialize_json_option(result.parsed_output, "parsed_output")
            .ok()
            .flatten(),
        parse_error: result.parse_error,
    }
}

pub(super) fn json_response<T: serde::Serialize>(value: T) -> Result<JsonResponse, Status> {
    Ok(JsonResponse {
        json: serde_json::to_string(&value)
            .map_err(|err| Status::internal(format!("failed to serialize JSON response: {err}")))?,
    })
}

pub(super) fn serialize_json_option(
    value: Option<Value>,
    field_name: &str,
) -> Result<Option<String>, Status> {
    value
        .map(|item| {
            serde_json::to_string(&item)
                .map_err(|err| Status::internal(format!("failed to serialize {field_name}: {err}")))
        })
        .transpose()
}

pub(super) fn serialize_json(value: &Value, field_name: &str) -> Result<String, Status> {
    serde_json::to_string(value)
        .map_err(|err| Status::internal(format!("failed to serialize {field_name}: {err}")))
}

pub(super) fn map_show_object_entry(entry: crate::web::models::ShowObjectEntry) -> ShowObjectEntry {
    ShowObjectEntry {
        object: entry.object,
        command: entry.command,
        mode: entry.mode,
        textfsm_mapping_command: entry.textfsm_mapping_command,
        source: entry.source,
        textfsm_template_name: entry.textfsm_template_name,
    }
}

pub(super) fn map_execute_show_response(
    response: crate::web::models::ShowExecuteResponse,
) -> Result<ExecuteShowResponse, Status> {
    Ok(ExecuteShowResponse {
        object: response.object,
        platform: response.platform,
        command: response.command,
        mode: response.mode,
        source: response.source,
        textfsm_mapping_command: response.textfsm_mapping_command,
        textfsm_template_name: response.textfsm_template_name,
        output: response.output,
        exit_code: response.exit_code,
        parsed_output_json: serialize_json_option(response.parsed_output, "parsed_output")?,
        parse_error: response.parse_error,
        recording_jsonl: response.recording_jsonl,
        result_summary_json: Some(serde_json::to_string(&response.result_summary).map_err(
            |err| Status::internal(format!("failed to serialize result_summary: {}", err)),
        )?),
    })
}

pub(super) fn map_execute_show_batch_response(
    response: crate::web::models::ShowBatchExecuteResponse,
) -> Result<ExecuteShowBatchResponse, Status> {
    Ok(ExecuteShowBatchResponse {
        object: response.object,
        targets: response.targets,
        results_json: serde_json::to_string(&response.results)
            .map_err(|err| Status::internal(format!("failed to serialize show results: {err}")))?,
        result_summary_json: Some(serde_json::to_string(&response.result_summary).map_err(
            |err| Status::internal(format!("failed to serialize result_summary: {}", err)),
        )?),
    })
}

pub(super) fn map_execute_tx_workflow_response(
    response: crate::web::models::ExecuteTxWorkflowResponse,
) -> Result<ExecuteTxWorkflowResponse, Status> {
    Ok(ExecuteTxWorkflowResponse {
        workflow_json: serialize_json(&response.workflow, "workflow")?,
        tx_workflow_result_json: serialize_json_option(
            response.tx_workflow_result,
            "tx_workflow_result",
        )?,
        recording_jsonl: response.recording_jsonl,
        result_summary_json: Some(serde_json::to_string(&response.result_summary).map_err(
            |err| Status::internal(format!("failed to serialize result_summary: {}", err)),
        )?),
    })
}

pub(super) fn map_execute_orchestration_response(
    response: crate::web::models::ExecuteOrchestrationResponse,
) -> Result<ExecuteOrchestrationResponse, Status> {
    Ok(ExecuteOrchestrationResponse {
        plan_json: serialize_json(&response.plan, "plan")?,
        orchestration_result_json: serialize_json_option(
            response.orchestration_result,
            "orchestration_result",
        )?,
        result_summary_json: Some(serde_json::to_string(&response.result_summary).map_err(
            |err| Status::internal(format!("failed to serialize result_summary: {}", err)),
        )?),
    })
}

fn encode_json_value(value: Option<Value>) -> Result<Option<String>, Status> {
    value
        .map(|item| {
            serde_json::to_string(&item).map_err(|err| {
                Status::internal(format!(
                    "failed to serialize command flow template value: {}",
                    err
                ))
            })
        })
        .transpose()
}

pub(super) fn map_command_flow_template_meta(
    meta: WebCommandFlowTemplateMeta,
) -> GrpcCommandFlowTemplateMeta {
    GrpcCommandFlowTemplateMeta {
        name: meta.name,
        kind: meta.kind,
        source: meta.source,
        content_type: meta.content_type,
        size_bytes: meta.size_bytes,
        created_at_ms: meta.created_at_ms,
        updated_at_ms: meta.updated_at_ms,
    }
}

pub(super) fn map_template_meta(meta: WebTemplateMeta) -> TemplateMeta {
    TemplateMeta {
        name: meta.name,
        kind: meta.kind,
        source: meta.source,
        content_type: meta.content_type,
        size_bytes: meta.size_bytes,
        created_at_ms: meta.created_at_ms,
        updated_at_ms: meta.updated_at_ms,
    }
}

pub(super) fn map_template_detail(detail: WebTemplateDetail) -> TemplateDetail {
    TemplateDetail {
        name: detail.name,
        content: detail.content,
    }
}

pub(super) fn map_command_flow_template_detail(
    detail: WebCommandFlowTemplateDetail,
) -> Result<GrpcCommandFlowTemplateDetail, Status> {
    Ok(GrpcCommandFlowTemplateDetail {
        name: detail.name,
        content: detail.content,
        vars_schema: detail
            .vars_schema
            .into_iter()
            .map(|field| {
                Ok(GrpcCommandFlowTemplateVarField {
                    name: field.name,
                    label: field.label,
                    description: field.description,
                    kind: field.kind,
                    required: field.required,
                    allow_empty: field.allow_empty,
                    placeholder: field.placeholder,
                    options: field.options,
                    default_json: encode_json_value(field.default_value)?,
                })
            })
            .collect::<Result<Vec<_>, Status>>()?,
    })
}

pub(super) fn connection_ref_to_request(
    connection: ConnectionRef,
) -> Result<ConnectionRequest, Status> {
    Ok(ConnectionRequest {
        connection_name: optional_string(connection.connection_name),
        host: optional_string(connection.host),
        username: optional_string(connection.username),
        password: optional_string(connection.password),
        port: connection.port.map(|value| value as u16),
        connect_timeout_secs: None,
        device_model: optional_string(connection.device_model),
        software_version: optional_string(connection.software_version),
        enable_password: optional_string(connection.enable_password),
        enable_password_empty_enter: connection.enable_password_empty_enter,
        ssh_security: parse_ssh_security(&connection.ssh_security)?,
        linux_shell_flavor: parse_linux_shell_flavor(&connection.linux_shell_flavor)?,
        device_profile: optional_string(connection.device_profile),
        template_dir: optional_string(connection.template_dir),
        enabled: connection.enabled.unwrap_or(true),
        labels: connection.labels,
        groups: connection.groups,
        vars: parse_json_value(
            &connection.vars_json,
            "connection.vars_json",
            serde_json::json!({}),
        )?,
    })
}

pub(super) fn sanitize_connection_ref(
    name: String,
    connection: ConnectionRequest,
) -> ConnectionRef {
    ConnectionRef {
        connection_name: name,
        host: connection.host.unwrap_or_default(),
        username: connection.username.unwrap_or_default(),
        password: String::new(),
        port: connection.port.map(u32::from),
        enable_password: String::new(),
        enable_password_empty_enter: connection.enable_password_empty_enter,
        ssh_security: connection
            .ssh_security
            .map(|value| value.to_string())
            .unwrap_or_default(),
        linux_shell_flavor: connection
            .linux_shell_flavor
            .map(|value| value.to_string())
            .unwrap_or_default(),
        device_profile: connection
            .device_profile
            .unwrap_or_else(|| template_loader::DEFAULT_DEVICE_PROFILE.to_string()),
        device_model: connection.device_model.unwrap_or_default(),
        software_version: connection.software_version.unwrap_or_default(),
        template_dir: connection.template_dir.unwrap_or_default(),
        enabled: Some(connection.enabled),
        labels: connection.labels,
        groups: connection.groups,
        vars_json: serde_json::to_string(&connection.vars).unwrap_or_else(|_| "{}".to_string()),
    }
}
