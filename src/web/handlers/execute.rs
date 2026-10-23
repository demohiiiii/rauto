use super::*;
pub use crate::application::execution::ShowObjectsQuery;

pub async fn execute_orchestration_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteOrchestrationRequest>,
) -> Result<(StatusCode, Json<ApiResponse<AsyncTaskAcceptedResponse>>), ApiError> {
    let response = queue_orchestration_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(ApiResponse::accepted(response))))
}

pub async fn execute_orchestration(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteOrchestrationRequest>,
) -> Result<Json<ApiResponse<ExecuteOrchestrationResponse>>, ApiError> {
    crate::application::execution::execute_orchestration(state, req)
        .await
        .map(Json)
}

pub async fn exec_command_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecRequest>,
) -> Result<(StatusCode, Json<ApiResponse<AsyncTaskAcceptedResponse>>), ApiError> {
    let response = queue_exec_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(ApiResponse::accepted(response))))
}

pub async fn execute_template_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTemplateRequest>,
) -> Result<(StatusCode, Json<ApiResponse<AsyncTaskAcceptedResponse>>), ApiError> {
    let response = queue_template_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(ApiResponse::accepted(response))))
}

pub async fn render_template(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RenderRequest>,
) -> Result<Json<RenderResponse>, ApiError> {
    crate::application::execution::render_template(state, req)
        .await
        .map(Json)
}

pub async fn exec_command(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecRequest>,
) -> Result<Json<ApiResponse<ExecResponse>>, ApiError> {
    crate::application::execution::exec_command(state, req)
        .await
        .map(Json)
}

pub async fn execute_show(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ShowExecuteRequest>,
) -> Result<Json<ApiResponse<ShowExecuteResponse>>, ApiError> {
    crate::application::execution::execute_show(state, req)
        .await
        .map(Json)
}

pub async fn execute_show_batch(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ShowBatchExecuteRequest>,
) -> Result<Json<ApiResponse<ShowBatchExecuteResponse>>, ApiError> {
    crate::application::execution::execute_show_batch(state, req)
        .await
        .map(Json)
}

pub async fn execute_exec_batch(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecBatchExecuteRequest>,
) -> Result<Json<ApiResponse<ExecBatchExecuteResponse>>, ApiError> {
    crate::application::execution::execute_exec_batch(state, req)
        .await
        .map(Json)
}

pub async fn execute_template(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTemplateRequest>,
) -> Result<Json<ApiResponse<ExecuteTemplateResponse>>, ApiError> {
    crate::application::execution::execute_template(state, req)
        .await
        .map(Json)
}

pub async fn execute_tx_workflow_async(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxWorkflowRequest>,
) -> Result<(StatusCode, Json<ApiResponse<AsyncTaskAcceptedResponse>>), ApiError> {
    let response = queue_tx_workflow_async_task(state, req)?;
    Ok((StatusCode::ACCEPTED, Json(ApiResponse::accepted(response))))
}

pub async fn execute_tx_workflow(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteTxWorkflowRequest>,
) -> Result<Json<ApiResponse<ExecuteTxWorkflowResponse>>, ApiError> {
    crate::application::execution::execute_tx_workflow(state, req)
        .await
        .map(Json)
}

pub async fn execute_interactive(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteInteractiveRequest>,
) -> Result<Json<ApiResponse<ExecuteInteractiveResponse>>, ApiError> {
    crate::application::execution::execute_interactive(state, req)
        .await
        .map(Json)
}

pub async fn execute_interactive_batch(
    State(state): State<Arc<AppState>>,
    Json(req): Json<InteractiveBatchExecuteRequest>,
) -> Result<Json<ApiResponse<InteractiveBatchExecuteResponse>>, ApiError> {
    crate::application::execution::execute_interactive_batch(state, req)
        .await
        .map(Json)
}

pub async fn execute_upload(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteUploadRequest>,
) -> Result<Json<ApiResponse<ExecuteUploadResponse>>, ApiError> {
    crate::application::execution::execute_upload(state, req)
        .await
        .map(Json)
}

pub async fn fetch_config(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ConfigFetchRequest>,
) -> Result<Json<ApiResponse<ConfigFetchResponse>>, ApiError> {
    crate::application::execution::fetch_config(state, req)
        .await
        .map(Json)
}

pub async fn fetch_config_batch(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ConfigBatchFetchRequest>,
) -> Result<Json<ApiResponse<ConfigBatchFetchResponse>>, ApiError> {
    crate::application::execution::fetch_config_batch(state, req)
        .await
        .map(Json)
}

pub async fn list_show_objects(
    Query(query): Query<ShowObjectsQuery>,
) -> Result<Json<ShowObjectsResponse>, ApiError> {
    crate::application::execution::list_show_objects(query)
        .await
        .map(Json)
}
