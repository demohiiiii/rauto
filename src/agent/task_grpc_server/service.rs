use super::*;

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
                linux_shell_flavor: loaded
                    .linux_shell_flavor
                    .map(|value| value.to_string())
                    .unwrap_or_default(),
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
            linux_shell_flavor: response
                .linux_shell_flavor
                .map(|value| value.to_string())
                .unwrap_or_default(),
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
            templates: response.into_iter().map(map_template_meta).collect(),
        }))
    }

    async fn get_template(
        &self,
        request: Request<GetTemplateRequest>,
    ) -> Result<Response<TemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) =
            get_template_handler(State(self.state.clone()), axum::extract::Path(req.name))
                .await
                .map_err(api_error_to_status)?;

        Ok(Response::new(map_template_detail(response)))
    }

    async fn create_template(
        &self,
        request: Request<GrpcCreateTemplateRequest>,
    ) -> Result<Response<TemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = create_template_handler(
            State(self.state.clone()),
            Json(CreateTemplateRequest {
                name: req.name,
                content: req.content,
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_template_detail(response)))
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

    async fn list_tx_block_templates(
        &self,
        request: Request<ListTxBlockTemplatesRequest>,
    ) -> Result<Response<ListTemplatesResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let _ = request.into_inner();
        let Json(response) = list_tx_block_templates_handler(State(self.state.clone()))
            .await
            .map_err(api_error_to_status)?;

        Ok(Response::new(ListTemplatesResponse {
            templates: response.into_iter().map(map_template_meta).collect(),
        }))
    }

    async fn get_tx_block_template(
        &self,
        request: Request<GetTemplateRequest>,
    ) -> Result<Response<TemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) =
            get_tx_block_template_handler(State(self.state.clone()), axum::extract::Path(req.name))
                .await
                .map_err(api_error_to_status)?;

        Ok(Response::new(map_template_detail(response)))
    }

    async fn create_tx_block_template(
        &self,
        request: Request<GrpcCreateTemplateRequest>,
    ) -> Result<Response<TemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = create_tx_block_template_handler(
            State(self.state.clone()),
            Json(CreateTemplateRequest {
                name: req.name,
                content: req.content,
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_template_detail(response)))
    }

    async fn list_tx_workflow_templates(
        &self,
        request: Request<ListTxWorkflowTemplatesRequest>,
    ) -> Result<Response<ListTemplatesResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let _ = request.into_inner();
        let Json(response) = list_tx_workflow_templates_handler(State(self.state.clone()))
            .await
            .map_err(api_error_to_status)?;

        Ok(Response::new(ListTemplatesResponse {
            templates: response.into_iter().map(map_template_meta).collect(),
        }))
    }

    async fn get_tx_workflow_template(
        &self,
        request: Request<GetTemplateRequest>,
    ) -> Result<Response<TemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = get_tx_workflow_template_handler(
            State(self.state.clone()),
            axum::extract::Path(req.name),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_template_detail(response)))
    }

    async fn create_tx_workflow_template(
        &self,
        request: Request<GrpcCreateTemplateRequest>,
    ) -> Result<Response<TemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = create_tx_workflow_template_handler(
            State(self.state.clone()),
            Json(CreateTemplateRequest {
                name: req.name,
                content: req.content,
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_template_detail(response)))
    }

    async fn list_orchestration_templates(
        &self,
        request: Request<ListOrchestrationTemplatesRequest>,
    ) -> Result<Response<ListTemplatesResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let _ = request.into_inner();
        let Json(response) = list_orchestration_templates_handler(State(self.state.clone()))
            .await
            .map_err(api_error_to_status)?;

        Ok(Response::new(ListTemplatesResponse {
            templates: response.into_iter().map(map_template_meta).collect(),
        }))
    }

    async fn get_orchestration_template(
        &self,
        request: Request<GetTemplateRequest>,
    ) -> Result<Response<TemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = get_orchestration_template_handler(
            State(self.state.clone()),
            axum::extract::Path(req.name),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_template_detail(response)))
    }

    async fn create_orchestration_template(
        &self,
        request: Request<GrpcCreateTemplateRequest>,
    ) -> Result<Response<TemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = create_orchestration_template_handler(
            State(self.state.clone()),
            Json(CreateTemplateRequest {
                name: req.name,
                content: req.content,
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_template_detail(response)))
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
        let all = template_loader::list_available_profiles()
            .map_err(|err| Status::internal(err.to_string()))?;

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
                target: map_execution_target_options(req.connection, &req.record_level)?,
                task: map_managed_task_options(req.task_id),
            }),
        )
        .await
        .map_err(api_error_to_status)?;
        let result_summary_json = Some(serde_json::to_string(&response.result_summary).map_err(
            |err| Status::internal(format!("failed to serialize result_summary: {}", err)),
        )?);

        Ok(Response::new(ExecuteCommandResponse {
            output: response.output,
            exit_code: response.exit_code,
            recording_jsonl: response.recording_jsonl,
            result_summary_json,
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
                run: DryRunOptions {
                    dry_run: Some(req.dry_run),
                },
                template_dir: None,
                target: map_execution_target_options(req.connection, &req.record_level)?,
                task: map_managed_task_options(req.task_id),
            }),
        )
        .await
        .map_err(api_error_to_status)?;
        let result_summary_json = Some(serde_json::to_string(&response.result_summary).map_err(
            |err| Status::internal(format!("failed to serialize result_summary: {}", err)),
        )?);

        Ok(Response::new(ExecuteTemplateResponse {
            rendered_commands: response.rendered_commands,
            executed: response
                .executed
                .into_iter()
                .map(map_command_result)
                .collect(),
            recording_jsonl: response.recording_jsonl,
            result_summary_json,
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
                builtin_template_name: None,
                content: req.content.and_then(optional_string),
                vars: parse_json_value(
                    req.vars_json.as_deref().unwrap_or_default(),
                    "vars_json",
                    Value::Null,
                )?,
                target: map_execution_target_options(req.connection, &req.record_level)?,
            }),
        )
        .await
        .map_err(api_error_to_status)?;
        let result_summary_json = Some(serde_json::to_string(&response.result_summary).map_err(
            |err| Status::internal(format!("failed to serialize result_summary: {}", err)),
        )?);

        Ok(Response::new(ExecuteCommandFlowResponse {
            success: response.success,
            template_name: response.template_name,
            outputs: response
                .outputs
                .into_iter()
                .map(map_command_result)
                .collect(),
            recording_jsonl: response.recording_jsonl,
            result_summary_json,
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
                target: map_execution_target_options(req.connection, &req.record_level)?,
            }),
        )
        .await
        .map_err(api_error_to_status)?;
        let result_summary_json = Some(serde_json::to_string(&response.result_summary).map_err(
            |err| Status::internal(format!("failed to serialize result_summary: {}", err)),
        )?);

        Ok(Response::new(ExecuteUploadResponse {
            ok: response.ok,
            local_path: response.local_path,
            remote_path: response.remote_path,
            recording_jsonl: response.recording_jsonl,
            result_summary_json,
        }))
    }

    async fn execute_tx_block(
        &self,
        request: Request<GrpcExecuteTxBlockRequest>,
    ) -> Result<Response<ExecuteTxBlockResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let Json(response) = execute_tx_block_handler(
            State(self.state.clone()),
            Json(map_execute_tx_block_request(request.into_inner())?),
        )
        .await
        .map_err(api_error_to_status)?;
        let result_summary_json = Some(serde_json::to_string(&response.result_summary).map_err(
            |err| Status::internal(format!("failed to serialize result_summary: {}", err)),
        )?);

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
            result_summary_json,
        }))
    }

    async fn execute_tx_block_async(
        &self,
        request: Request<GrpcExecuteTxBlockRequest>,
    ) -> Result<Response<AcceptedTaskResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let response = queue_tx_block_async_task(
            self.state.clone(),
            map_execute_tx_block_request(request.into_inner())?,
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
                workflow_template_name: None,
                workflow_template_content: None,
                workflow_vars: Value::Null,
                workflow: parse_json_value(&req.workflow_json, "workflow_json", Value::Null)?,
                run: DryRunOptions {
                    dry_run: Some(req.dry_run),
                },
                target: map_execution_target_options(req.connection, &req.record_level)?,
                task: map_managed_task_options(req.task_id),
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
                plan_template_name: None,
                plan_template_content: None,
                plan_vars: Value::Null,
                plan: parse_json_value(&req.plan_json, "plan_json", Value::Null)?,
                base_dir: optional_string(req.base_dir),
                run: DryRunOptions {
                    dry_run: Some(req.dry_run),
                },
                target: map_execution_target_options(None, &req.record_level)?,
                task: map_managed_task_options(req.task_id),
            },
        )
        .map_err(api_error_to_status)?;
        Ok(Response::new(map_async_response(response)))
    }
}
