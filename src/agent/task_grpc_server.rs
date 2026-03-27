use crate::agent_task_grpc::rauto::agent::v1::agent_task_service_server::{
    AgentTaskService, AgentTaskServiceServer,
};
use crate::agent_task_grpc::rauto::agent::v1::{
    AcceptedTaskResponse, AgentInfoRequest, AgentInfoResponse, AgentStatusRequest,
    AgentStatusResponse, BuiltinProfileMeta, CommandExecutionResult,
    CommandFlowTemplateDetail as GrpcCommandFlowTemplateDetail,
    CommandFlowTemplateMeta as GrpcCommandFlowTemplateMeta,
    CommandFlowTemplateVarField as GrpcCommandFlowTemplateVarField, ConnectionMeta, ConnectionRef,
    CustomProfileMeta, DeleteCommandFlowTemplateRequest, DeleteCommandFlowTemplateResponse,
    DeviceProbeResult, ExecuteCommandFlowRequest as GrpcExecuteCommandFlowRequest,
    ExecuteCommandFlowResponse, ExecuteCommandRequest, ExecuteCommandResponse,
    ExecuteOrchestrationRequest as GrpcExecuteOrchestrationRequest,
    ExecuteTemplateRequest as GrpcExecuteTemplateRequest, ExecuteTemplateResponse,
    ExecuteTxBlockRequest as GrpcExecuteTxBlockRequest, ExecuteTxBlockResponse,
    ExecuteTxWorkflowRequest as GrpcExecuteTxWorkflowRequest,
    ExecuteUploadRequest as GrpcExecuteUploadRequest, ExecuteUploadResponse,
    GetCommandFlowTemplateRequest, ListCommandFlowTemplatesRequest,
    ListCommandFlowTemplatesResponse, ListConnectionsRequest, ListConnectionsResponse,
    ListDeviceProfilesRequest, ListDeviceProfilesResponse, ListProfileModesRequest,
    ListProfileModesResponse, ListTemplatesRequest, ListTemplatesResponse, ProbeDevicesRequest,
    ProbeDevicesResponse, SystemInfo, TemplateMeta, TestConnectionRequest, TestConnectionResponse,
    UpsertCommandFlowTemplateRequest, UpsertConnectionRequest as GrpcUpsertConnectionRequest,
    UpsertConnectionResponse,
};
use crate::config::ssh_security::SshSecurityProfile;
use crate::config::template_loader;
use crate::config::{connection_store, content_store};
use crate::web::agent_handlers::{agent_info, agent_status, probe_devices};
use crate::web::error::ApiError;
use crate::web::handlers::{
    create_command_flow_template as create_command_flow_template_handler,
    delete_command_flow_template as delete_command_flow_template_handler,
    exec_command as exec_command_handler, execute_command_flow as execute_command_flow_handler,
    execute_template as execute_template_handler, execute_tx_block as execute_tx_block_handler,
    execute_upload as execute_upload_handler,
    get_command_flow_template as get_command_flow_template_handler,
    list_command_flow_templates as list_command_flow_templates_handler,
    list_templates as list_templates_handler, profiles_overview as profiles_overview_handler,
    queue_orchestration_async_task, queue_tx_block_async_task, queue_tx_workflow_async_task,
    test_connection as test_connection_handler,
    update_command_flow_template as update_command_flow_template_handler,
    upsert_connection as upsert_connection_handler,
};
use crate::web::models::{
    CommandFlowTemplateDetail as WebCommandFlowTemplateDetail,
    CommandFlowTemplateMeta as WebCommandFlowTemplateMeta, CommandResult, ConnectionRequest,
    ConnectionTestRequest, CreateCommandFlowTemplateRequest, ExecRequest,
    ExecuteCommandFlowRequest as WebExecuteCommandFlowRequest,
    ExecuteOrchestrationRequest as WebExecuteOrchestrationRequest,
    ExecuteTemplateRequest as WebExecuteTemplateRequest,
    ExecuteTxBlockRequest as WebExecuteTxBlockRequest,
    ExecuteTxWorkflowRequest as WebExecuteTxWorkflowRequest,
    ExecuteUploadRequest as WebExecuteUploadRequest, RecordLevel, UpdateCommandFlowTemplateRequest,
    UpsertConnectionRequest as WebUpsertConnectionRequest,
};
use crate::web::state::AppState;
use crate::web::storage;
use axum::{Json, Router, extract::State};
use serde_json::Value;
use std::sync::Arc;
use tonic::metadata::MetadataMap;
use tonic::service::Routes;
use tonic::{Request, Response, Status};

#[derive(Clone)]
struct AgentTaskGrpcService {
    state: Arc<AppState>,
}

impl AgentTaskGrpcService {
    fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    fn validate_auth(&self, metadata: &MetadataMap) -> Result<(), Status> {
        let Some(expected_token) = self
            .state
            .api_token
            .as_deref()
            .map(str::trim)
            .filter(|token| !token.is_empty())
        else {
            return Ok(());
        };

        let bearer_token = metadata
            .get("authorization")
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .strip_prefix("Bearer ")
            .map(str::trim)
            .unwrap_or_default();
        let api_key = metadata
            .get("x-api-key")
            .and_then(|value| value.to_str().ok())
            .map(str::trim)
            .unwrap_or_default();

        if bearer_token == expected_token || api_key == expected_token {
            Ok(())
        } else {
            Err(Status::unauthenticated(
                "invalid or missing API token for gRPC request",
            ))
        }
    }
}

pub fn build_agent_task_grpc_router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Routes::new(AgentTaskServiceServer::new(AgentTaskGrpcService::new(
        state.clone(),
    )))
    .into_axum_router()
    .with_state(())
}

fn api_error_to_status(err: ApiError) -> Status {
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

fn optional_string(raw: String) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn parse_json_value(raw: &str, field_name: &str, default: Value) -> Result<Value, Status> {
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
        "off" => Ok(Some(RecordLevel::Off)),
        "key-events-only" => Ok(Some(RecordLevel::KeyEventsOnly)),
        "full" => Ok(Some(RecordLevel::Full)),
        value => Err(Status::invalid_argument(format!(
            "unsupported record_level '{}'",
            value
        ))),
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
        ssh_security: parse_ssh_security(&connection.ssh_security)?,
        device_profile: optional_string(connection.device_profile),
        template_dir: None,
    }))
}

fn map_async_response(
    response: crate::web::models::AsyncTaskAcceptedResponse,
) -> AcceptedTaskResponse {
    AcceptedTaskResponse {
        accepted: response.accepted,
        task_id: response.task_id,
        operation: response.operation,
        status: response.status,
    }
}

fn map_command_result(result: CommandResult) -> CommandExecutionResult {
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

fn map_command_flow_template_meta(meta: WebCommandFlowTemplateMeta) -> GrpcCommandFlowTemplateMeta {
    GrpcCommandFlowTemplateMeta {
        name: meta.name,
        path: meta.path,
    }
}

fn map_command_flow_template_detail(
    detail: WebCommandFlowTemplateDetail,
) -> Result<GrpcCommandFlowTemplateDetail, Status> {
    Ok(GrpcCommandFlowTemplateDetail {
        name: detail.name,
        path: detail.path,
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

fn connection_ref_to_request(connection: ConnectionRef) -> Result<ConnectionRequest, Status> {
    Ok(ConnectionRequest {
        connection_name: optional_string(connection.connection_name),
        host: optional_string(connection.host),
        username: optional_string(connection.username),
        password: optional_string(connection.password),
        port: connection.port.map(|value| value as u16),
        enable_password: optional_string(connection.enable_password),
        ssh_security: parse_ssh_security(&connection.ssh_security)?,
        device_profile: optional_string(connection.device_profile),
        template_dir: None,
    })
}

fn sanitize_connection_ref(name: String, connection: ConnectionRequest) -> ConnectionRef {
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
        device_profile: connection
            .device_profile
            .unwrap_or_else(|| template_loader::DEFAULT_DEVICE_PROFILE.to_string()),
    }
}

#[tonic::async_trait]
impl AgentTaskService for AgentTaskGrpcService {
    async fn get_agent_info(
        &self,
        _request: Request<AgentInfoRequest>,
    ) -> Result<Response<AgentInfoResponse>, Status> {
        let Json(response) = agent_info(State(self.state.clone()))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(AgentInfoResponse {
            name: response.name,
            version: response.version,
            capabilities: response.capabilities,
            uptime_seconds: response.uptime_seconds,
            connections_count: response.connections_count,
            templates_count: response.templates_count,
            custom_profiles_count: response.custom_profiles_count,
            managed: response.managed,
        }))
    }

    async fn get_agent_status(
        &self,
        request: Request<AgentStatusRequest>,
    ) -> Result<Response<AgentStatusResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let Json(response) = agent_status(State(self.state.clone()))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(AgentStatusResponse {
            status: response.status,
            active_sessions: response.active_sessions,
            running_tasks: response.running_tasks,
            last_heartbeat_at: response.last_heartbeat_at.unwrap_or_default(),
            registered_at: response.registered_at.unwrap_or_default(),
            system: Some(SystemInfo {
                os: response.system.os,
                arch: response.system.arch,
                hostname: response.system.hostname,
            }),
        }))
    }

    async fn probe_devices(
        &self,
        request: Request<ProbeDevicesRequest>,
    ) -> Result<Response<ProbeDevicesResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = probe_devices(Json(crate::web::models::DeviceProbeRequest {
            connections: req.connections,
            timeout_secs: if req.timeout_secs == 0 {
                10
            } else {
                req.timeout_secs
            },
        }))
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(ProbeDevicesResponse {
            results: response
                .results
                .into_iter()
                .map(|item| DeviceProbeResult {
                    name: item.name,
                    host: item.host,
                    port: item.port.into(),
                    device_profile: item.device_profile,
                    reachable: item.reachable,
                    latency_ms: item.latency_ms,
                    error: item.error.unwrap_or_default(),
                })
                .collect(),
            total: response.total,
            reachable_count: response.reachable_count,
            unreachable_count: response.unreachable_count,
        }))
    }

    async fn list_connections(
        &self,
        request: Request<ListConnectionsRequest>,
    ) -> Result<Response<ListConnectionsResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let _ = request.into_inner();

        let names = connection_store::list_connections().map_err(|err| {
            Status::internal(format!("failed to list saved connections: {}", err))
        })?;
        let mut connections = Vec::new();
        for name in names {
            let loaded = match connection_store::load_connection_raw(&name) {
                Ok(value) => value,
                Err(err) => {
                    tracing::warn!(
                        "skipping saved connection '{}' in gRPC list_connections because it could not be loaded: {}",
                        name,
                        err
                    );
                    continue;
                }
            };
            let has_password = connection_store::has_saved_password(&loaded);
            connections.push(ConnectionMeta {
                name,
                host: loaded.host.unwrap_or_default(),
                port: loaded.port.unwrap_or(22).into(),
                device_profile: loaded
                    .device_profile
                    .unwrap_or_else(|| template_loader::DEFAULT_DEVICE_PROFILE.to_string()),
                has_password,
            });
        }

        Ok(Response::new(ListConnectionsResponse { connections }))
    }

    async fn upsert_connection(
        &self,
        request: Request<GrpcUpsertConnectionRequest>,
    ) -> Result<Response<UpsertConnectionResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let name = req.name.trim();
        if name.is_empty() {
            return Err(Status::invalid_argument("connection name is required"));
        }
        let connection = req
            .connection
            .ok_or_else(|| Status::invalid_argument("connection is required"))?;
        let Json(response) = upsert_connection_handler(
            State(self.state.clone()),
            axum::extract::Path(name.to_string()),
            Json(WebUpsertConnectionRequest {
                connection: connection_ref_to_request(connection)?,
                save_password: req.save_password,
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(UpsertConnectionResponse {
            name: response.name.clone(),
            path: response.path,
            has_password: response.has_password,
            connection: Some(sanitize_connection_ref(response.name, response.connection)),
        }))
    }

    async fn test_connection(
        &self,
        request: Request<TestConnectionRequest>,
    ) -> Result<Response<TestConnectionResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let connection = req.connection.map(connection_ref_to_request).transpose()?;
        let Json(response) = test_connection_handler(
            State(self.state.clone()),
            Json(ConnectionTestRequest { connection }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(TestConnectionResponse {
            ok: response.ok,
            host: response.host,
            port: u32::from(response.port),
            username: response.username,
            ssh_security: response.ssh_security.to_string(),
            device_profile: response.device_profile,
        }))
    }

    async fn list_templates(
        &self,
        request: Request<ListTemplatesRequest>,
    ) -> Result<Response<ListTemplatesResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let _ = request.into_inner();
        let Json(response) = list_templates_handler(State(self.state.clone()))
            .await
            .map_err(api_error_to_status)?;

        Ok(Response::new(ListTemplatesResponse {
            templates: response
                .into_iter()
                .map(|item| TemplateMeta {
                    name: item.name,
                    path: item.path,
                })
                .collect(),
        }))
    }

    async fn list_command_flow_templates(
        &self,
        request: Request<ListCommandFlowTemplatesRequest>,
    ) -> Result<Response<ListCommandFlowTemplatesResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let _ = request.into_inner();
        let Json(response) = list_command_flow_templates_handler(State(self.state.clone()))
            .await
            .map_err(api_error_to_status)?;

        Ok(Response::new(ListCommandFlowTemplatesResponse {
            templates: response
                .into_iter()
                .map(map_command_flow_template_meta)
                .collect(),
        }))
    }

    async fn get_command_flow_template(
        &self,
        request: Request<GetCommandFlowTemplateRequest>,
    ) -> Result<Response<GrpcCommandFlowTemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = get_command_flow_template_handler(
            State(self.state.clone()),
            axum::extract::Path(req.name),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_command_flow_template_detail(response)?))
    }

    async fn upsert_command_flow_template(
        &self,
        request: Request<UpsertCommandFlowTemplateRequest>,
    ) -> Result<Response<GrpcCommandFlowTemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let exists = content_store::load_command_flow_template(req.name.trim())
            .map_err(|err| {
                Status::internal(format!("failed to load command flow template: {}", err))
            })?
            .is_some();

        let Json(response) = if exists {
            update_command_flow_template_handler(
                State(self.state.clone()),
                axum::extract::Path(req.name),
                Json(UpdateCommandFlowTemplateRequest {
                    content: req.content,
                }),
            )
            .await
        } else {
            create_command_flow_template_handler(
                State(self.state.clone()),
                Json(CreateCommandFlowTemplateRequest {
                    name: req.name,
                    content: req.content,
                }),
            )
            .await
        }
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_command_flow_template_detail(response)?))
    }

    async fn delete_command_flow_template(
        &self,
        request: Request<DeleteCommandFlowTemplateRequest>,
    ) -> Result<Response<DeleteCommandFlowTemplateResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = delete_command_flow_template_handler(
            State(self.state.clone()),
            axum::extract::Path(req.name),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(DeleteCommandFlowTemplateResponse {
            ok: response
                .get("ok")
                .and_then(|value| value.as_bool())
                .unwrap_or(true),
        }))
    }

    async fn list_device_profiles(
        &self,
        request: Request<ListDeviceProfilesRequest>,
    ) -> Result<Response<ListDeviceProfilesResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let _ = request.into_inner();
        let Json(response) = profiles_overview_handler(State(self.state.clone()))
            .await
            .map_err(api_error_to_status)?;
        let all = storage::builtin_profiles()
            .into_iter()
            .map(|item| item.name)
            .chain(response.custom.iter().map(|item| item.name.clone()))
            .collect();

        Ok(Response::new(ListDeviceProfilesResponse {
            builtins: response
                .builtins
                .into_iter()
                .map(|item| BuiltinProfileMeta {
                    name: item.name,
                    aliases: item.aliases,
                    summary: item.summary,
                })
                .collect(),
            custom: response
                .custom
                .into_iter()
                .map(|item| CustomProfileMeta {
                    name: item.name,
                    path: item.path,
                })
                .collect(),
            all,
        }))
    }

    async fn list_profile_modes(
        &self,
        request: Request<ListProfileModesRequest>,
    ) -> Result<Response<ListProfileModesResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let profile_name = req.name.trim();
        if profile_name.is_empty() {
            return Err(Status::invalid_argument("profile name is required"));
        }

        let modes = template_loader::list_profile_modes(profile_name)
            .map_err(|err| Status::invalid_argument(err.to_string()))?;
        let default_mode = template_loader::default_profile_mode(profile_name)
            .map_err(|err| Status::invalid_argument(err.to_string()))?;

        Ok(Response::new(ListProfileModesResponse {
            name: profile_name.to_string(),
            default_mode,
            modes,
        }))
    }

    async fn execute_command(
        &self,
        request: Request<ExecuteCommandRequest>,
    ) -> Result<Response<ExecuteCommandResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = exec_command_handler(
            State(self.state.clone()),
            Json(ExecRequest {
                command: req.command,
                mode: optional_string(req.mode),
                connection: map_connection_ref(req.connection)?,
                record_level: parse_record_level(&req.record_level)?,
                task_id: optional_string(req.task_id),
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(ExecuteCommandResponse {
            output: response.output,
            exit_code: response.exit_code,
            recording_jsonl: response.recording_jsonl,
        }))
    }

    async fn execute_template(
        &self,
        request: Request<GrpcExecuteTemplateRequest>,
    ) -> Result<Response<ExecuteTemplateResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = execute_template_handler(
            State(self.state.clone()),
            Json(WebExecuteTemplateRequest {
                template: req.template,
                vars: parse_json_value(&req.vars_json, "vars_json", Value::Null)?,
                mode: optional_string(req.mode),
                dry_run: Some(req.dry_run),
                template_dir: None,
                connection: map_connection_ref(req.connection)?,
                record_level: parse_record_level(&req.record_level)?,
                task_id: optional_string(req.task_id),
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(ExecuteTemplateResponse {
            rendered_commands: response.rendered_commands,
            executed: response
                .executed
                .into_iter()
                .map(map_command_result)
                .collect(),
            recording_jsonl: response.recording_jsonl,
        }))
    }

    async fn execute_command_flow(
        &self,
        request: Request<GrpcExecuteCommandFlowRequest>,
    ) -> Result<Response<ExecuteCommandFlowResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = execute_command_flow_handler(
            State(self.state.clone()),
            Json(WebExecuteCommandFlowRequest {
                template_name: req.template_name.and_then(optional_string),
                content: req.content.and_then(optional_string),
                vars: parse_json_value(
                    req.vars_json.as_deref().unwrap_or_default(),
                    "vars_json",
                    Value::Null,
                )?,
                connection: map_connection_ref(req.connection)?,
                record_level: parse_record_level(&req.record_level)?,
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(ExecuteCommandFlowResponse {
            success: response.success,
            template_name: response.template_name,
            outputs: response
                .outputs
                .into_iter()
                .map(map_command_result)
                .collect(),
            recording_jsonl: response.recording_jsonl,
        }))
    }

    async fn execute_upload(
        &self,
        request: Request<GrpcExecuteUploadRequest>,
    ) -> Result<Response<ExecuteUploadResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = execute_upload_handler(
            State(self.state.clone()),
            Json(WebExecuteUploadRequest {
                local_path: req.local_path,
                remote_path: req.remote_path,
                timeout_secs: req.timeout_secs,
                buffer_size: req.buffer_size.map(|value| value as usize),
                show_progress: req.show_progress,
                connection: map_connection_ref(req.connection)?,
                record_level: parse_record_level(&req.record_level)?,
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(ExecuteUploadResponse {
            ok: response.ok,
            local_path: response.local_path,
            remote_path: response.remote_path,
            recording_jsonl: response.recording_jsonl,
        }))
    }

    async fn execute_tx_block(
        &self,
        request: Request<GrpcExecuteTxBlockRequest>,
    ) -> Result<Response<ExecuteTxBlockResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = execute_tx_block_handler(
            State(self.state.clone()),
            Json(WebExecuteTxBlockRequest {
                name: optional_string(req.name),
                template: optional_string(req.template),
                vars: parse_json_value(&req.vars_json, "vars_json", Value::Null)?,
                commands: req.commands,
                rollback_commands: req.rollback_commands,
                rollback_on_failure: Some(req.rollback_on_failure),
                rollback_trigger_step_index: req
                    .rollback_trigger_step_index
                    .map(|value| value as usize),
                mode: optional_string(req.mode),
                timeout_secs: req.timeout_secs,
                resource_rollback_command: optional_string(req.resource_rollback_command),
                template_profile: optional_string(req.template_profile),
                dry_run: Some(req.dry_run),
                connection: map_connection_ref(req.connection)?,
                record_level: parse_record_level(&req.record_level)?,
                task_id: optional_string(req.task_id),
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(ExecuteTxBlockResponse {
            tx_block_json: serde_json::to_string(&response.tx_block).map_err(|err| {
                Status::internal(format!("failed to serialize tx_block: {}", err))
            })?,
            tx_result_json: response
                .tx_result
                .map(|value| serde_json::to_string(&value))
                .transpose()
                .map_err(|err| {
                    Status::internal(format!("failed to serialize tx_result: {}", err))
                })?,
            recording_jsonl: response.recording_jsonl,
        }))
    }

    async fn execute_tx_block_async(
        &self,
        request: Request<GrpcExecuteTxBlockRequest>,
    ) -> Result<Response<AcceptedTaskResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let response = queue_tx_block_async_task(
            self.state.clone(),
            WebExecuteTxBlockRequest {
                name: optional_string(req.name),
                template: optional_string(req.template),
                vars: parse_json_value(&req.vars_json, "vars_json", Value::Null)?,
                commands: req.commands,
                rollback_commands: req.rollback_commands,
                rollback_on_failure: Some(req.rollback_on_failure),
                rollback_trigger_step_index: req
                    .rollback_trigger_step_index
                    .map(|value| value as usize),
                mode: optional_string(req.mode),
                timeout_secs: req.timeout_secs,
                resource_rollback_command: optional_string(req.resource_rollback_command),
                template_profile: optional_string(req.template_profile),
                dry_run: Some(req.dry_run),
                connection: map_connection_ref(req.connection)?,
                record_level: parse_record_level(&req.record_level)?,
                task_id: optional_string(req.task_id),
            },
        )
        .map_err(api_error_to_status)?;
        Ok(Response::new(map_async_response(response)))
    }

    async fn execute_tx_workflow_async(
        &self,
        request: Request<GrpcExecuteTxWorkflowRequest>,
    ) -> Result<Response<AcceptedTaskResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let response = queue_tx_workflow_async_task(
            self.state.clone(),
            WebExecuteTxWorkflowRequest {
                workflow: parse_json_value(&req.workflow_json, "workflow_json", Value::Null)?,
                dry_run: Some(req.dry_run),
                connection: map_connection_ref(req.connection)?,
                record_level: parse_record_level(&req.record_level)?,
                task_id: optional_string(req.task_id),
            },
        )
        .map_err(api_error_to_status)?;
        Ok(Response::new(map_async_response(response)))
    }

    async fn execute_orchestration_async(
        &self,
        request: Request<GrpcExecuteOrchestrationRequest>,
    ) -> Result<Response<AcceptedTaskResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let response = queue_orchestration_async_task(
            self.state.clone(),
            WebExecuteOrchestrationRequest {
                plan: parse_json_value(&req.plan_json, "plan_json", Value::Null)?,
                base_dir: optional_string(req.base_dir),
                dry_run: Some(req.dry_run),
                record_level: parse_record_level(&req.record_level)?,
                task_id: optional_string(req.task_id),
            },
        )
        .map_err(api_error_to_status)?;
        Ok(Response::new(map_async_response(response)))
    }
}
