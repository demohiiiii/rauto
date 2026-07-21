use crate::agent_task_grpc::rauto::agent::v1::agent_task_service_server::{
    AgentTaskService, AgentTaskServiceServer,
};
use crate::agent_task_grpc::rauto::agent::v1::*;
use crate::agent_task_grpc::rauto::agent::v1::{
    CommandFlowTemplateDetail as GrpcCommandFlowTemplateDetail,
    CommandFlowTemplateMeta as GrpcCommandFlowTemplateMeta,
    CommandFlowTemplateVarField as GrpcCommandFlowTemplateVarField,
    CreateTemplateRequest as GrpcCreateTemplateRequest,
    ExecuteCommandFlowRequest as GrpcExecuteCommandFlowRequest,
    ExecuteOrchestrationRequest as GrpcExecuteOrchestrationRequest,
    ExecuteTemplateRequest as GrpcExecuteTemplateRequest,
    ExecuteTxBlockRequest as GrpcExecuteTxBlockRequest,
    ExecuteTxWorkflowRequest as GrpcExecuteTxWorkflowRequest,
    ExecuteUploadRequest as GrpcExecuteUploadRequest,
    UpsertConnectionRequest as GrpcUpsertConnectionRequest,
};
use crate::config::device_profile::DeviceProfile;
use crate::config::inventory_store::InventoryGroup;
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::ssh_security::SshSecurityProfile;
use crate::config::template_loader;
use crate::config::{backup, connection_import, connection_store, content_store, textfsm_export};
use crate::web::agent_handlers::{agent_info, agent_status, probe_devices};
use crate::web::error::ApiError;
use crate::web::handlers::{
    CreateTextfsmTemplateRequest as WebCreateTextfsmTemplateRequest,
    CustomShowObjectQuery as WebCustomShowObjectQuery,
    DeleteCustomShowObjectRequest as WebDeleteCustomShowObjectRequest,
    DeleteTextfsmMappingRequest as WebDeleteTextfsmMappingRequest,
    ShowObjectsQuery as WebShowObjectsQuery, TextfsmMappingQuery as WebTextfsmMappingQuery,
    UpdateTextfsmTemplateRequest as WebUpdateTextfsmTemplateRequest,
    UpsertCustomShowObjectRequest as WebUpsertCustomShowObjectRequest,
    UpsertTextfsmMappingRequest as WebUpsertTextfsmMappingRequest, add_blacklist_pattern,
    check_blacklist_command, create_backup,
    create_command_flow_template as create_command_flow_template_handler,
    create_or_update_custom_profile,
    create_orchestration_template as create_orchestration_template_handler,
    create_template as create_template_handler, create_textfsm_template,
    create_tx_block_template as create_tx_block_template_handler,
    create_tx_workflow_template as create_tx_workflow_template_handler, delete_blacklist_pattern,
    delete_command_flow_template as delete_command_flow_template_handler, delete_connection,
    delete_connection_history, delete_custom_profile, delete_custom_show_object,
    delete_inventory_group, delete_inventory_label, delete_orchestration_template, delete_template,
    delete_textfsm_mapping, delete_textfsm_template, delete_tx_block_template,
    delete_tx_workflow_template, detect_connection_facts as detect_connection_facts_handler,
    diagnose_profile, exec_command as exec_command_handler, exec_command_async,
    execute_command_flow as execute_command_flow_handler, execute_orchestration, execute_show,
    execute_show_batch, execute_template as execute_template_handler, execute_template_async,
    execute_tx_block as execute_tx_block_handler, execute_tx_workflow,
    execute_upload as execute_upload_handler, get_builtin_command_flow_template,
    get_builtin_profile_detail, get_builtin_profile_form,
    get_command_flow_template as get_command_flow_template_handler, get_connection,
    get_connection_history, get_connection_history_detail, get_custom_profile,
    get_custom_profile_form, get_inventory_group, get_inventory_label,
    get_orchestration_template as get_orchestration_template_handler, get_task_run_detail,
    get_template as get_template_handler, get_textfsm_template,
    get_tx_block_template as get_tx_block_template_handler,
    get_tx_workflow_template as get_tx_workflow_template_handler, list_backups,
    list_blacklist_patterns, list_builtin_command_flow_templates,
    list_command_flow_templates as list_command_flow_templates_handler, list_custom_show_objects,
    list_inventory_groups, list_inventory_labels,
    list_orchestration_templates as list_orchestration_templates_handler, list_show_objects,
    list_task_runs, list_templates as list_templates_handler, list_textfsm_mappings,
    list_textfsm_templates, list_tx_block_templates as list_tx_block_templates_handler,
    list_tx_workflow_templates as list_tx_workflow_templates_handler,
    profiles_overview as profiles_overview_handler, queue_orchestration_async_task,
    queue_tx_block_async_task, queue_tx_workflow_async_task, render_template, replay_session,
    restore_backup, test_connection as test_connection_handler,
    update_command_flow_template as update_command_flow_template_handler,
    update_orchestration_template, update_template, update_textfsm_template,
    update_tx_block_template, update_tx_workflow_template,
    upsert_connection as upsert_connection_handler, upsert_custom_profile_form,
    upsert_custom_show_object, upsert_inventory_group, upsert_inventory_label,
    upsert_textfsm_mapping,
};
use crate::web::models::{
    BackupCreateRequest as WebBackupCreateRequest, BackupRestoreRequest,
    BlacklistCheckRequest as WebBlacklistCheckRequest,
    BlacklistUpsertRequest as WebBlacklistUpsertRequest,
    CommandFlowTemplateDetail as WebCommandFlowTemplateDetail,
    CommandFlowTemplateMeta as WebCommandFlowTemplateMeta, CommandResult, ConnectionRequest,
    ConnectionTestRequest, CreateCommandFlowTemplateRequest, CreateTemplateRequest, DryRunOptions,
    ExecRequest, ExecuteCommandFlowRequest as WebExecuteCommandFlowRequest,
    ExecuteOrchestrationRequest as WebExecuteOrchestrationRequest,
    ExecuteTemplateRequest as WebExecuteTemplateRequest,
    ExecuteTxBlockRequest as WebExecuteTxBlockRequest,
    ExecuteTxWorkflowRequest as WebExecuteTxWorkflowRequest,
    ExecuteUploadRequest as WebExecuteUploadRequest, ExecutionTargetOptions, ManagedTaskOptions,
    ProfileDiagnoseRequest as WebProfileDiagnoseRequest, RecordLevel, RenderRequest, ReplayRequest,
    ShowBatchExecuteRequest as WebShowBatchExecuteRequest,
    ShowExecuteRequest as WebShowExecuteRequest, TaskRunsQuery,
    TemplateDetail as WebTemplateDetail, TemplateMeta as WebTemplateMeta,
    UpdateCommandFlowTemplateRequest, UpdateTemplateRequest as WebUpdateTemplateRequest,
    UpsertConnectionRequest as WebUpsertConnectionRequest,
    UpsertCustomProfileRequest as WebUpsertCustomProfileRequest,
    UpsertInventoryGroupRequest as WebUpsertInventoryGroupRequest,
    UpsertInventoryLabelRequest as WebUpsertInventoryLabelRequest,
};
use crate::web::state::AppState;
use axum::{
    Json, Router,
    extract::{Path, Query, State},
};
use rneter::session::MultilineMode;
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
