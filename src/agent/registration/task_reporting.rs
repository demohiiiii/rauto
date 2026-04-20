use super::*;

impl AgentRegistrar {
    pub async fn send_task_callback(&self, callback: &TaskCallback) -> Result<()> {
        match self.config.manager.report_mode {
            ManagerReportMode::Grpc => {
                let payload = GrpcTaskCallbackRequest {
                    agent_name: self.config.agent.name.clone(),
                    task_id: callback.task_id.clone(),
                    status: callback.status.to_string(),
                    started_at: callback.started_at.clone(),
                    completed_at: callback.completed_at.clone(),
                    execution_time_ms: callback.execution_time_ms,
                    result_json: callback
                        .result
                        .as_ref()
                        .map(serde_json::to_string)
                        .transpose()?,
                    error: callback.error.clone(),
                    result_summary_json: callback
                        .result_summary
                        .as_ref()
                        .map(serde_json::to_string)
                        .transpose()?,
                };
                self.grpc.report_task_callback(payload).await.with_context(|| {
                    format!(
                        "failed to send task callback to manager over grpc (task_id={}, status={})",
                        callback.task_id, callback.status
                    )
                })?;
            }
            ManagerReportMode::Http => {
                self.authed_post(self.manager_endpoint("/api/agents/report-task-callback"))
                    .json(callback)
                    .send()
                    .await
                    .with_context(|| {
                        format!(
                            "failed to send task callback to manager over http (task_id={}, status={})",
                            callback.task_id, callback.status
                        )
                    })?
                    .error_for_status()
                    .with_context(|| {
                        format!(
                            "task callback HTTP endpoint returned error (task_id={}, status={})",
                            callback.task_id, callback.status
                        )
                    })?;
            }
        }
        Ok(())
    }

    pub async fn send_task_event(&self, event: &TaskEvent) -> Result<()> {
        match self.config.manager.report_mode {
            ManagerReportMode::Grpc => {
                let payload = GrpcTaskEventRequest {
                    task_id: event.task_id.clone(),
                    agent_name: event.agent_name.clone(),
                    event_type: event.event_type.to_string(),
                    message: event.message.clone(),
                    level: event.level.to_string(),
                    stage: event.stage.clone(),
                    progress: event.progress.map(u32::from),
                    details_json: event
                        .details
                        .as_ref()
                        .map(serde_json::to_string)
                        .transpose()?,
                    occurred_at: event.occurred_at.clone(),
                };
                self.grpc.report_task_event(payload).await.with_context(|| {
                    format!(
                        "failed to send task event to manager over grpc (task_id={}, event_type={}, stage={:?})",
                        event.task_id, event.event_type, event.stage
                    )
                })?;
            }
            ManagerReportMode::Http => {
                let payload = HttpTaskEventRequest {
                    task_id: event.task_id.clone(),
                    agent_name: event.agent_name.clone(),
                    event_type: event.event_type.to_string(),
                    message: event.message.clone(),
                    level: event.level.to_string(),
                    stage: event.stage.clone(),
                    progress: event.progress,
                    details: event.details.clone(),
                    occurred_at: event.occurred_at.clone(),
                };
                self.authed_post(self.manager_endpoint("/api/agents/report-task-event"))
                    .json(&payload)
                    .send()
                    .await
                    .with_context(|| {
                        format!(
                            "failed to send task event to manager over http (task_id={}, event_type={}, stage={:?})",
                            event.task_id, event.event_type, event.stage
                        )
                    })?
                    .error_for_status()
                    .with_context(|| {
                        format!(
                            "task event HTTP endpoint returned error (task_id={}, event_type={}, stage={:?})",
                            event.task_id, event.event_type, event.stage
                        )
                    })?;
            }
        }
        Ok(())
    }

    pub async fn report_task_event_best_effort(&self, event: TaskEvent) {
        if let Err(err) = self.send_task_event(&event).await {
            warn!("task event report failed: {}", err);
        }
    }

    pub async fn report_async_error(&self, input: AsyncErrorReportInput) -> Result<()> {
        match self.config.manager.report_mode {
            ManagerReportMode::Grpc => {
                let payload = GrpcReportErrorRequest {
                    name: self.config.agent.name.clone(),
                    category: input.category,
                    kind: input.kind,
                    severity: input.severity,
                    occurred_at: Utc::now().to_rfc3339(),
                    task_id: input.task_id,
                    operation: input.operation,
                    target_url: input.target_url,
                    http_method: input.http_method,
                    http_status: input.http_status.map(u32::from),
                    retryable: input.retryable,
                    message: input.message,
                    details_json: input.details.map(|value| value.to_string()),
                };
                self.grpc
                    .report_error(payload)
                    .await
                    .context("failed to send async error report to manager")?;
            }
            ManagerReportMode::Http => {
                let payload = HttpReportErrorRequest {
                    name: self.config.agent.name.clone(),
                    category: input.category,
                    kind: input.kind,
                    severity: input.severity,
                    occurred_at: Utc::now().to_rfc3339(),
                    task_id: input.task_id,
                    operation: input.operation,
                    target_url: input.target_url,
                    http_method: input.http_method,
                    http_status: input.http_status,
                    retryable: input.retryable,
                    message: input.message,
                    details: input.details,
                };
                self.authed_post(self.manager_endpoint("/api/agents/report-error"))
                    .json(&payload)
                    .send()
                    .await
                    .context("failed to send async error report to manager")?
                    .error_for_status()
                    .context("manager async error report endpoint returned error")?;
            }
        }
        Ok(())
    }

    pub async fn report_async_error_best_effort(&self, input: AsyncErrorReportInput) {
        if let Err(err) = self.report_async_error(input).await {
            warn!("manager async error report failed: {}", err);
        }
    }

    pub(super) fn manager_endpoint(&self, path: &str) -> String {
        format!(
            "{}/{}",
            self.config.manager.url.trim_end_matches('/'),
            path.trim_start_matches('/')
        )
    }

    pub(super) fn reporting_target(&self, http_path: &str, grpc_method: &str) -> String {
        match self.config.manager.report_mode {
            ManagerReportMode::Http => self.manager_endpoint(http_path),
            ManagerReportMode::Grpc => {
                format!("grpc://manager/{}", grpc_method.trim_start_matches('/'))
            }
        }
    }

    pub(super) fn reporting_http_method(&self) -> &'static str {
        match self.config.manager.report_mode {
            ManagerReportMode::Http => "POST",
            ManagerReportMode::Grpc => "GRPC",
        }
    }

    pub fn task_callback_report_target(&self) -> String {
        self.reporting_target(
            "/api/agents/report-task-callback",
            "/rauto.manager.v1.AgentReportingService/ReportTaskCallback",
        )
    }

    #[allow(dead_code)]
    pub fn task_event_report_target(&self) -> String {
        self.reporting_target(
            "/api/agents/report-task-event",
            "/rauto.manager.v1.AgentReportingService/ReportTaskEvent",
        )
    }

    pub fn report_transport_method_name(&self) -> &'static str {
        self.reporting_http_method()
    }

    pub(super) fn authed_post(&self, url: String) -> reqwest::RequestBuilder {
        let req = self.client.post(url);
        match self.config.manager.token.as_deref() {
            Some(token) if !token.trim().is_empty() => req
                .bearer_auth(token)
                .header("X-API-Key", token.to_string()),
            _ => req,
        }
    }
}
