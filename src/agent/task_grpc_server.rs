use crate::agent_task_grpc::rauto::agent::v1::agent_task_service_server::{
    AgentTaskService, AgentTaskServiceServer,
};
use crate::agent_task_grpc::rauto::agent::v1::{
    AcceptedTaskResponse, AgentInfoRequest, AgentInfoResponse, AgentStatusRequest,
    AgentStatusResponse, BuiltinProfileMeta, CommandExecutionResult,
    CommandFlowTemplateDetail as GrpcCommandFlowTemplateDetail,
    CommandFlowTemplateMeta as GrpcCommandFlowTemplateMeta,
    CommandFlowTemplateVarField as GrpcCommandFlowTemplateVarField, ConnectionMeta, ConnectionRef,
    CreateTemplateRequest as GrpcCreateTemplateRequest, CustomProfileMeta,
    DeleteCommandFlowTemplateRequest, DeleteCommandFlowTemplateResponse, DeviceProbeResult,
    ExecuteCommandFlowRequest as GrpcExecuteCommandFlowRequest, ExecuteCommandFlowResponse,
    ExecuteCommandRequest, ExecuteCommandResponse,
    ExecuteOrchestrationRequest as GrpcExecuteOrchestrationRequest,
    ExecuteTemplateRequest as GrpcExecuteTemplateRequest, ExecuteTemplateResponse,
    ExecuteTxBlockRequest as GrpcExecuteTxBlockRequest, ExecuteTxBlockResponse,
    ExecuteTxWorkflowRequest as GrpcExecuteTxWorkflowRequest,
    ExecuteUploadRequest as GrpcExecuteUploadRequest, ExecuteUploadResponse,
    GetCommandFlowTemplateRequest, GetTemplateRequest, ListCommandFlowTemplatesRequest,
    ListCommandFlowTemplatesResponse, ListConnectionsRequest, ListConnectionsResponse,
    ListDeviceProfilesRequest, ListDeviceProfilesResponse, ListOrchestrationTemplatesRequest,
    ListProfileModesRequest, ListProfileModesResponse, ListTemplatesRequest, ListTemplatesResponse,
    ListTxBlockTemplatesRequest, ListTxWorkflowTemplatesRequest, ProbeDevicesRequest,
    ProbeDevicesResponse, SystemInfo, TemplateDetail, TemplateMeta, TestConnectionRequest,
    TestConnectionResponse, UpsertCommandFlowTemplateRequest,
    UpsertConnectionRequest as GrpcUpsertConnectionRequest, UpsertConnectionResponse,
};
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::ssh_security::SshSecurityProfile;
use crate::config::template_loader;
use crate::config::{connection_store, content_store};
use crate::web::agent_handlers::{agent_info, agent_status, probe_devices};
use crate::web::error::ApiError;
use crate::web::handlers::{
    create_command_flow_template as create_command_flow_template_handler,
    create_orchestration_template as create_orchestration_template_handler,
    create_template as create_template_handler,
    create_tx_block_template as create_tx_block_template_handler,
    create_tx_workflow_template as create_tx_workflow_template_handler,
    delete_command_flow_template as delete_command_flow_template_handler,
    exec_command as exec_command_handler, execute_command_flow as execute_command_flow_handler,
    execute_template as execute_template_handler, execute_tx_block as execute_tx_block_handler,
    execute_upload as execute_upload_handler,
    get_command_flow_template as get_command_flow_template_handler,
    get_orchestration_template as get_orchestration_template_handler,
    get_template as get_template_handler, get_tx_block_template as get_tx_block_template_handler,
    get_tx_workflow_template as get_tx_workflow_template_handler,
    list_command_flow_templates as list_command_flow_templates_handler,
    list_orchestration_templates as list_orchestration_templates_handler,
    list_templates as list_templates_handler,
    list_tx_block_templates as list_tx_block_templates_handler,
    list_tx_workflow_templates as list_tx_workflow_templates_handler,
    profiles_overview as profiles_overview_handler, queue_orchestration_async_task,
    queue_tx_block_async_task, queue_tx_workflow_async_task,
    test_connection as test_connection_handler,
    update_command_flow_template as update_command_flow_template_handler,
    upsert_connection as upsert_connection_handler,
};
use crate::web::models::{
    CommandFlowTemplateDetail as WebCommandFlowTemplateDetail,
    CommandFlowTemplateMeta as WebCommandFlowTemplateMeta, CommandResult, ConnectionRequest,
    ConnectionTestRequest, CreateCommandFlowTemplateRequest, CreateTemplateRequest, DryRunOptions,
    ExecRequest, ExecuteCommandFlowRequest as WebExecuteCommandFlowRequest,
    ExecuteOrchestrationRequest as WebExecuteOrchestrationRequest,
    ExecuteTemplateRequest as WebExecuteTemplateRequest,
    ExecuteTxBlockRequest as WebExecuteTxBlockRequest,
    ExecuteTxWorkflowRequest as WebExecuteTxWorkflowRequest,
    ExecuteUploadRequest as WebExecuteUploadRequest, ExecutionTargetOptions, ManagedTaskOptions,
    RecordLevel, TemplateDetail as WebTemplateDetail, TemplateMeta as WebTemplateMeta,
    UpdateCommandFlowTemplateRequest, UpsertConnectionRequest as WebUpsertConnectionRequest,
};
use crate::web::state::AppState;
use axum::{Json, Router, extract::State};
use serde_json::Value;
use std::sync::Arc;
use tonic::metadata::MetadataMap;
use tonic::service::Routes;
use tonic::{Request, Response, Status};

mod helpers;
mod service;
use self::helpers::*;

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
