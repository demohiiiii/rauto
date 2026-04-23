use crate::agent::registration::{AsyncErrorReportInput, current_agent_name};
use crate::cli::RecordLevelOpt;
use crate::config::command_blacklist;
use crate::config::command_flow_template::{
    CommandFlowTemplate, ParsedCommandFlowTemplate, build_command_flow_runtime,
    parse_command_flow_template_with_extensions, resolve_command_flow_runtime_default_mode,
};
use crate::config::command_flow_vars::{
    ConnectionParamContext, resolve_command_flow_runtime_vars, resolve_runtime_var_aliases,
};
use crate::config::template_connection_refs::{
    enrich_context_with_connection_refs_from_template,
    enrich_context_with_connection_refs_from_value,
};
use crate::config::template_loader;
use crate::config::{
    connection_store, connection_store::SavedConnection, content_store, task_store,
};
use crate::config::{history_store, history_store::HistoryBinding};
use crate::device::DeviceClient;
use crate::orchestrator;
use crate::task::{
    TaskCallback, TaskEventLevel, TaskEventType, TaskOperation, TaskResultEnvelope,
    TaskResultOutcome, TaskStatus, build_error_result_summary, build_result_summary,
    count_non_empty_lines, extract_result_summary, result_counts, result_counts_with_skipped,
    task_name_to_operation, task_result_with_counts, task_result_with_details,
    task_result_with_recording,
};
use crate::template::renderer::Renderer;
use crate::web::error::ApiError;
use crate::web::models::{
    AsyncTaskAcceptedResponse, CommandResult, ConnectionRequest, ExecRequest, ExecResponse,
    ExecuteCommandFlowRequest, ExecuteCommandFlowResponse, ExecuteOrchestrationRequest,
    ExecuteOrchestrationResponse, ExecuteTemplateRequest, ExecuteTemplateResponse,
    ExecuteTxBlockRequest, ExecuteTxBlockResponse, ExecuteTxWorkflowRequest,
    ExecuteTxWorkflowResponse, ExecuteUploadRequest, ExecuteUploadResponse, RecordLevel,
    RenderRequest, RenderResponse, SavedConnectionDetail, TaskEvent,
};
use crate::web::state::{AppState, ResolvedConnection, merge_connection_options};
use crate::web::storage;
use crate::{manager_connection_request, manager_execution_context_with_security};
use axum::http::StatusCode;
use axum::{Json, extract::State};
use chrono::Utc;
use rneter::session::{
    MANAGER, SessionEvent, SessionRecordEntry, SessionRecordLevel, SessionRecorder, TxBlock,
};
use serde::Serialize;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::future::Future;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::oneshot;
use tokio::task::JoinHandle;
use tracing::warn;

mod async_tasks;
mod command_templates;
mod connections;
mod execute;
mod flow_templates;
mod interactive;
mod json_templates;
mod maintenance;
mod profiles;
mod replay;
mod runtime;
mod task_events;
use async_tasks::*;
pub(crate) use async_tasks::{
    queue_orchestration_async_task, queue_tx_block_async_task, queue_tx_workflow_async_task,
};
pub use command_templates::{
    create_template, delete_template, get_template, list_templates, update_template,
};
pub use connections::{
    delete_connection, delete_connection_history, delete_inventory_group, delete_inventory_label,
    get_connection, get_connection_history, get_connection_history_detail, get_inventory_group,
    get_inventory_label, import_connections, list_connections, list_inventory_groups,
    list_inventory_labels, test_connection, upsert_connection, upsert_inventory_group,
    upsert_inventory_label,
};
pub use execute::{
    exec_command, exec_command_async, execute_command_flow, execute_orchestration,
    execute_orchestration_async, execute_template, execute_template_async, execute_tx_block,
    execute_tx_block_async, execute_tx_workflow, execute_tx_workflow_async, execute_upload,
    render_template,
};
use flow_templates::{
    builtin_command_flow_template_by_name, parse_builtin_command_flow_template_token,
};
pub use flow_templates::{
    create_command_flow_template, delete_command_flow_template, get_builtin_command_flow_template,
    get_command_flow_template, list_builtin_command_flow_templates, list_command_flow_templates,
    update_command_flow_template,
};
pub use interactive::{interactive_command, interactive_start, interactive_stop};
pub use json_templates::{
    create_orchestration_template, create_tx_block_template, create_tx_workflow_template,
    delete_orchestration_template, delete_tx_block_template, delete_tx_workflow_template,
    get_orchestration_template, get_tx_block_template, get_tx_workflow_template,
    list_orchestration_templates, list_tx_block_templates, list_tx_workflow_templates,
    update_orchestration_template, update_tx_block_template, update_tx_workflow_template,
};
pub use maintenance::{
    add_blacklist_pattern, check_blacklist_command, create_backup, delete_blacklist_pattern,
    download_backup, download_connection_import_template, get_task_run_detail, health,
    list_backups, list_blacklist_patterns, list_task_runs, restore_backup,
};
pub use profiles::{
    create_or_update_custom_profile, delete_custom_profile, diagnose_profile,
    get_builtin_profile_detail, get_builtin_profile_form, get_custom_profile,
    get_custom_profile_form, get_profile_modes, list_profiles, profiles_overview,
    upsert_custom_profile_form,
};
pub use replay::replay_session;
use runtime::*;
use task_events::*;

#[derive(Debug, serde::Deserialize)]
pub struct HistoryQuery {
    pub limit: Option<usize>,
}

fn saved_connection_detail_response(
    name: &str,
    path: &std::path::Path,
    data: &SavedConnection,
) -> SavedConnectionDetail {
    SavedConnectionDetail {
        name: name.to_string(),
        path: path.to_string_lossy().to_string(),
        has_password: connection_store::has_saved_password(data),
        connection: ConnectionRequest {
            connection_name: Some(name.to_string()),
            host: data.host.clone(),
            username: data.username.clone(),
            password: None,
            port: data.port,
            enable_password: None,
            enable_password_empty_enter: Some(data.enable_password_empty_enter),
            ssh_security: data.ssh_security,
            linux_shell_flavor: data.linux_shell_flavor,
            device_profile: data.device_profile.clone(),
            template_dir: data.template_dir.clone(),
            enabled: data.enabled,
            labels: data.labels.clone(),
            groups: data.groups.clone(),
            vars: data.vars.clone(),
        },
    }
}

fn merged_saved_secret(
    save_password: bool,
    incoming: Option<String>,
    existing: Option<&String>,
) -> Option<String> {
    if !save_password {
        return None;
    }
    incoming.or_else(|| existing.cloned())
}

fn should_persist_secret(save_password: bool, incoming_secret: Option<&str>) -> bool {
    save_password || incoming_secret.is_some()
}

#[cfg(test)]
mod tests;
