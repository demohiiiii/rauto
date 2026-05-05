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

fn parse_record_level(raw: &str) -> Result<Option<RecordLevel>, Status> {
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
        enable_password: optional_string(connection.enable_password),
        enable_password_empty_enter: None,
        ssh_security: parse_ssh_security(&connection.ssh_security)?,
        linux_shell_flavor: parse_linux_shell_flavor(&connection.linux_shell_flavor)?,
        device_profile: optional_string(connection.device_profile),
        template_dir: None,
        enabled: true,
        labels: vec![],
        groups: vec![],
        vars: serde_json::json!({}),
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

pub(super) fn map_command_result(result: CommandResult) -> CommandExecutionResult {
    CommandExecutionResult {
        command: result.command,
        success: result.success,
        exit_code: result.exit_code,
        output: result.output,
        error: result.error,
    }
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
        enable_password: optional_string(connection.enable_password),
        enable_password_empty_enter: None,
        ssh_security: parse_ssh_security(&connection.ssh_security)?,
        linux_shell_flavor: parse_linux_shell_flavor(&connection.linux_shell_flavor)?,
        device_profile: optional_string(connection.device_profile),
        template_dir: None,
        enabled: true,
        labels: vec![],
        groups: vec![],
        vars: serde_json::json!({}),
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
    }
}
