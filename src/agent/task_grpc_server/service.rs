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

    async fn get_connection(
        &self,
        request: Request<GetConnectionRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = get_connection(Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn delete_connection(
        &self,
        request: Request<DeleteConnectionRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = delete_connection(State(self.state.clone()), Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn get_connection_history(
        &self,
        request: Request<GetConnectionHistoryRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = get_connection_history(
            Path(req.name),
            Query(crate::web::handlers::HistoryQuery {
                limit: (req.limit != 0).then_some(req.limit as usize),
            }),
        )
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn get_connection_history_detail(
        &self,
        request: Request<GetConnectionHistoryDetailRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = get_connection_history_detail(Path((req.name, req.id)))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn delete_connection_history(
        &self,
        request: Request<DeleteConnectionHistoryRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = delete_connection_history(Path((req.name, req.id)))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn list_inventory_groups(
        &self,
        request: Request<ListInventoryGroupsRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let _ = request.into_inner();
        let Json(response) = list_inventory_groups().await.map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn get_inventory_group(
        &self,
        request: Request<GetInventoryGroupRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = get_inventory_group(Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn upsert_inventory_group(
        &self,
        request: Request<UpsertInventoryGroupRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = upsert_inventory_group(
            Path(req.name.clone()),
            Json(WebUpsertInventoryGroupRequest {
                group: InventoryGroup {
                    name: req.name,
                    description: optional_string(req.description),
                    vars: parse_json_value(&req.vars_json, "vars_json", serde_json::json!({}))?,
                    hosts: req.hosts,
                },
            }),
        )
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn delete_inventory_group(
        &self,
        request: Request<DeleteInventoryGroupRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = delete_inventory_group(Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn list_inventory_labels(
        &self,
        request: Request<ListInventoryLabelsRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let _ = request.into_inner();
        let Json(response) = list_inventory_labels().await.map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn get_inventory_label(
        &self,
        request: Request<GetInventoryLabelRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = get_inventory_label(Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn upsert_inventory_label(
        &self,
        request: Request<UpsertInventoryLabelRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = upsert_inventory_label(
            State(self.state.clone()),
            Path(req.name),
            Json(WebUpsertInventoryLabelRequest { hosts: req.hosts }),
        )
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn delete_inventory_label(
        &self,
        request: Request<DeleteInventoryLabelRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = delete_inventory_label(State(self.state.clone()), Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn import_connections(
        &self,
        request: Request<ImportConnectionsRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let report = connection_import::import_connections_from_bytes(&req.file_name, &req.content)
            .map_err(|err| Status::invalid_argument(err.to_string()))?;
        if report.imported > 0
            && let Some(registrar) = self.state.registrar()
            && let Err(err) = registrar.trigger_device_inventory_sync_if_changed(5).await
        {
            tracing::warn!(
                "failed to schedule device inventory sync after gRPC connection import: {}",
                err
            );
        }
        Ok(Response::new(json_response(report)?))
    }

    async fn download_connection_import_template(
        &self,
        request: Request<DownloadConnectionImportTemplateRequest>,
    ) -> Result<Response<BytesResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let is_zh = req.lang.trim().eq_ignore_ascii_case("zh")
            || req.lang.trim().eq_ignore_ascii_case("zh-cn");
        let (filename, content) = if is_zh {
            (
                "rauto-connection-import-template-zh.csv",
                "\u{feff}连接名,主机地址,用户名,密码,端口,特权密码,SSH安全级别,Linux Shell,设备模板,模板目录\n",
            )
        } else {
            (
                "rauto-connection-import-template-en.csv",
                "name,host,username,password,port,enable_password,ssh_security,linux_shell_flavor,device_profile,template_dir\n",
            )
        };
        Ok(Response::new(BytesResponse {
            data: content.as_bytes().to_vec(),
            filename: filename.to_string(),
            content_type: "text/csv; charset=utf-8".to_string(),
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

    async fn update_template(
        &self,
        request: Request<UpdateTemplateRequest>,
    ) -> Result<Response<TemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = update_template(
            State(self.state.clone()),
            Path(req.name),
            Json(WebUpdateTemplateRequest {
                content: req.content,
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_template_detail(response)))
    }

    async fn delete_template(
        &self,
        request: Request<DeleteTemplateRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = delete_template(State(self.state.clone()), Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
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

    async fn list_builtin_command_flow_templates(
        &self,
        request: Request<ListBuiltinCommandFlowTemplatesRequest>,
    ) -> Result<Response<ListCommandFlowTemplatesResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let _ = request.into_inner();
        let Json(response) = list_builtin_command_flow_templates(State(self.state.clone()))
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

    async fn get_builtin_command_flow_template(
        &self,
        request: Request<GetBuiltinCommandFlowTemplateRequest>,
    ) -> Result<Response<GrpcCommandFlowTemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) =
            get_builtin_command_flow_template(State(self.state.clone()), Path(req.name))
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

    async fn update_tx_block_template(
        &self,
        request: Request<UpdateTemplateRequest>,
    ) -> Result<Response<TemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = update_tx_block_template(
            State(self.state.clone()),
            Path(req.name),
            Json(WebUpdateTemplateRequest {
                content: req.content,
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_template_detail(response)))
    }

    async fn delete_tx_block_template(
        &self,
        request: Request<DeleteTemplateRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = delete_tx_block_template(State(self.state.clone()), Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
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

    async fn update_tx_workflow_template(
        &self,
        request: Request<UpdateTemplateRequest>,
    ) -> Result<Response<TemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = update_tx_workflow_template(
            State(self.state.clone()),
            Path(req.name),
            Json(WebUpdateTemplateRequest {
                content: req.content,
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_template_detail(response)))
    }

    async fn delete_tx_workflow_template(
        &self,
        request: Request<DeleteTemplateRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = delete_tx_workflow_template(State(self.state.clone()), Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
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

    async fn update_orchestration_template(
        &self,
        request: Request<UpdateTemplateRequest>,
    ) -> Result<Response<TemplateDetail>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = update_orchestration_template(
            State(self.state.clone()),
            Path(req.name),
            Json(WebUpdateTemplateRequest {
                content: req.content,
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_template_detail(response)))
    }

    async fn delete_orchestration_template(
        &self,
        request: Request<DeleteTemplateRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) =
            delete_orchestration_template(State(self.state.clone()), Path(req.name))
                .await
                .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
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

    async fn get_builtin_profile_detail(
        &self,
        request: Request<GetProfileRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = get_builtin_profile_detail(Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn get_builtin_profile_form(
        &self,
        request: Request<GetProfileRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = get_builtin_profile_form(Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn get_custom_profile(
        &self,
        request: Request<GetProfileRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = get_custom_profile(State(self.state.clone()), Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn upsert_custom_profile(
        &self,
        request: Request<UpsertCustomProfileRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = create_or_update_custom_profile(
            State(self.state.clone()),
            Path(req.name),
            Json(WebUpsertCustomProfileRequest {
                content: req.content,
            }),
        )
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn get_custom_profile_form(
        &self,
        request: Request<GetProfileRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = get_custom_profile_form(State(self.state.clone()), Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn upsert_custom_profile_form(
        &self,
        request: Request<UpsertCustomProfileRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let profile = toml::from_str::<DeviceProfile>(&req.content).map_err(|err| {
            Status::invalid_argument(format!("invalid device profile TOML content: {err}"))
        })?;
        let Json(response) =
            upsert_custom_profile_form(State(self.state.clone()), Path(req.name), Json(profile))
                .await
                .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn delete_custom_profile(
        &self,
        request: Request<DeleteProfileRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = delete_custom_profile(State(self.state.clone()), Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn diagnose_profile(
        &self,
        request: Request<DiagnoseProfileRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = diagnose_profile(
            State(self.state.clone()),
            Json(WebProfileDiagnoseRequest {
                name: req.name,
                template_dir: optional_string(req.template_dir),
            }),
        )
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
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

    async fn render_template(
        &self,
        request: Request<RenderTemplateRequest>,
    ) -> Result<Response<RenderTemplateResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let connection = req.connection.map(connection_ref_to_request).transpose()?;
        let Json(response) = render_template(
            State(self.state.clone()),
            Json(RenderRequest {
                template: req.template,
                vars: parse_json_value(&req.vars_json, "vars_json", Value::Null)?,
                connection,
                template_dir: optional_string(req.template_dir),
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(RenderTemplateResponse {
            rendered_commands: response.rendered_commands,
        }))
    }

    async fn list_show_objects(
        &self,
        request: Request<ListShowObjectsRequest>,
    ) -> Result<Response<ListShowObjectsResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = list_show_objects(Query(WebShowObjectsQuery {
            device_profile: optional_string(req.device_profile),
            textfsm_platform: optional_string(req.textfsm_platform),
        }))
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(ListShowObjectsResponse {
            platform: response.platform,
            objects: response
                .objects
                .into_iter()
                .map(map_show_object_entry)
                .collect(),
        }))
    }

    async fn execute_show(
        &self,
        request: Request<ExecuteShowRequest>,
    ) -> Result<Response<ExecuteShowResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = execute_show(
            State(self.state.clone()),
            Json(WebShowExecuteRequest {
                object: req.object,
                mode: optional_string(req.mode),
                textfsm_platform: optional_string(req.textfsm_platform),
                no_parse: req.no_parse,
                textfsm_strict_errors: req.textfsm_strict_errors,
                target: map_execution_target_options(req.connection, &req.record_level)?,
                task: map_managed_task_options(req.task_id),
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_execute_show_response(response)?))
    }

    async fn execute_show_batch(
        &self,
        request: Request<ExecuteShowBatchRequest>,
    ) -> Result<Response<ExecuteShowBatchResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = execute_show_batch(
            State(self.state.clone()),
            Json(WebShowBatchExecuteRequest {
                object: req.object,
                objects: req.objects,
                mode: optional_string(req.mode),
                textfsm_platform: optional_string(req.textfsm_platform),
                no_parse: req.no_parse,
                textfsm_strict_errors: req.textfsm_strict_errors,
                targets: req.targets,
                groups: req.groups,
                labels: req.labels,
                record_level: parse_record_level(&req.record_level)?,
                task: map_managed_task_options(req.task_id),
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_execute_show_batch_response(response)?))
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
                textfsm_template: optional_string(req.textfsm_template),
                parse_textfsm: req.parse_textfsm,
                textfsm_platform: optional_string(req.textfsm_platform),
                textfsm_vendor: optional_string(req.textfsm_vendor),
                textfsm_strict_errors: req.textfsm_strict_errors,
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
            parsed_output_json: serialize_json_option(response.parsed_output, "parsed_output")?,
            parse_error: response.parse_error,
            recording_jsonl: response.recording_jsonl,
            result_summary_json,
        }))
    }

    async fn execute_command_async(
        &self,
        request: Request<ExecuteCommandRequest>,
    ) -> Result<Response<AcceptedTaskResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let (_, Json(response)) = exec_command_async(
            State(self.state.clone()),
            Json(ExecRequest {
                command: req.command,
                mode: optional_string(req.mode),
                textfsm_template: optional_string(req.textfsm_template),
                parse_textfsm: req.parse_textfsm,
                textfsm_platform: optional_string(req.textfsm_platform),
                textfsm_vendor: optional_string(req.textfsm_vendor),
                textfsm_strict_errors: req.textfsm_strict_errors,
                target: map_execution_target_options(req.connection, &req.record_level)?,
                task: map_managed_task_options(req.task_id),
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_async_response(response)))
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
                textfsm_template: optional_string(req.textfsm_template),
                parse_textfsm: req.parse_textfsm,
                textfsm_platform: optional_string(req.textfsm_platform),
                textfsm_vendor: optional_string(req.textfsm_vendor),
                textfsm_strict_errors: req.textfsm_strict_errors,
                run: DryRunOptions {
                    dry_run: Some(req.dry_run),
                },
                template_dir: optional_string(req.template_dir),
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

    async fn execute_template_async(
        &self,
        request: Request<GrpcExecuteTemplateRequest>,
    ) -> Result<Response<AcceptedTaskResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let (_, Json(response)) = execute_template_async(
            State(self.state.clone()),
            Json(WebExecuteTemplateRequest {
                template: req.template,
                vars: parse_json_value(&req.vars_json, "vars_json", Value::Null)?,
                mode: optional_string(req.mode),
                textfsm_template: optional_string(req.textfsm_template),
                parse_textfsm: req.parse_textfsm,
                textfsm_platform: optional_string(req.textfsm_platform),
                textfsm_vendor: optional_string(req.textfsm_vendor),
                textfsm_strict_errors: req.textfsm_strict_errors,
                run: DryRunOptions {
                    dry_run: Some(req.dry_run),
                },
                template_dir: optional_string(req.template_dir),
                target: map_execution_target_options(req.connection, &req.record_level)?,
                task: map_managed_task_options(req.task_id),
            }),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_async_response(response)))
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
                builtin_template_name: req.builtin_template_name.and_then(optional_string),
                content: req.content.and_then(optional_string),
                vars: parse_json_value(
                    req.vars_json.as_deref().unwrap_or_default(),
                    "vars_json",
                    Value::Null,
                )?,
                textfsm_template: optional_string(req.textfsm_template),
                parse_textfsm: req.parse_textfsm,
                textfsm_platform: optional_string(req.textfsm_platform),
                textfsm_vendor: optional_string(req.textfsm_vendor),
                textfsm_strict_errors: req.textfsm_strict_errors,
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

    async fn execute_tx_workflow(
        &self,
        request: Request<GrpcExecuteTxWorkflowRequest>,
    ) -> Result<Response<ExecuteTxWorkflowResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let Json(response) = execute_tx_workflow(
            State(self.state.clone()),
            Json(map_execute_tx_workflow_request(request.into_inner())?),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_execute_tx_workflow_response(response)?))
    }

    async fn execute_tx_workflow_async(
        &self,
        request: Request<GrpcExecuteTxWorkflowRequest>,
    ) -> Result<Response<AcceptedTaskResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let response = queue_tx_workflow_async_task(
            self.state.clone(),
            map_execute_tx_workflow_request(request.into_inner())?,
        )
        .map_err(api_error_to_status)?;
        Ok(Response::new(map_async_response(response)))
    }

    async fn execute_orchestration(
        &self,
        request: Request<GrpcExecuteOrchestrationRequest>,
    ) -> Result<Response<ExecuteOrchestrationResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let Json(response) = execute_orchestration(
            State(self.state.clone()),
            Json(map_execute_orchestration_request(request.into_inner())?),
        )
        .await
        .map_err(api_error_to_status)?;

        Ok(Response::new(map_execute_orchestration_response(response)?))
    }

    async fn execute_orchestration_async(
        &self,
        request: Request<GrpcExecuteOrchestrationRequest>,
    ) -> Result<Response<AcceptedTaskResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let response = queue_orchestration_async_task(
            self.state.clone(),
            map_execute_orchestration_request(request.into_inner())?,
        )
        .map_err(api_error_to_status)?;
        Ok(Response::new(map_async_response(response)))
    }

    async fn replay_session(
        &self,
        request: Request<ReplaySessionRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = replay_session(Json(ReplayRequest {
            jsonl: req.jsonl,
            command: optional_string(req.command),
            mode: optional_string(req.mode),
            list: req.list,
        }))
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn list_textfsm_templates(
        &self,
        request: Request<ListTextfsmTemplatesRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let _ = request.into_inner();
        let Json(response) = list_textfsm_templates()
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn get_textfsm_template(
        &self,
        request: Request<GetTextfsmTemplateRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = get_textfsm_template(Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn create_textfsm_template(
        &self,
        request: Request<UpsertTextfsmTemplateRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = create_textfsm_template(Json(WebCreateTextfsmTemplateRequest {
            name: req.name,
            content: req.content,
        }))
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn update_textfsm_template(
        &self,
        request: Request<UpsertTextfsmTemplateRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = update_textfsm_template(
            Path(req.name),
            Json(WebUpdateTextfsmTemplateRequest {
                content: req.content,
            }),
        )
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn delete_textfsm_template(
        &self,
        request: Request<DeleteTextfsmTemplateRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = delete_textfsm_template(Path(req.name))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn list_textfsm_mappings(
        &self,
        request: Request<ListTextfsmMappingsRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = list_textfsm_mappings(Query(WebTextfsmMappingQuery {
            profile: optional_string(req.profile),
        }))
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn upsert_textfsm_mapping(
        &self,
        request: Request<UpsertTextfsmMappingRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = upsert_textfsm_mapping(Json(WebUpsertTextfsmMappingRequest {
            device_profile: req.device_profile,
            command: req.command,
            template_name: req.template_name,
        }))
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn delete_textfsm_mapping(
        &self,
        request: Request<DeleteTextfsmMappingRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = delete_textfsm_mapping(Json(WebDeleteTextfsmMappingRequest {
            device_profile: req.device_profile,
            command: req.command,
        }))
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn export_textfsm_excel(
        &self,
        request: Request<TextfsmExcelExportRequest>,
    ) -> Result<Response<BytesResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let filename_hint = optional_string(req.filename);
        let sheets = if req.sheets.is_empty() {
            let parsed_output =
                parse_json_value(&req.parsed_output_json, "parsed_output_json", Value::Null)?;
            if parsed_output.is_null() {
                return Err(Status::invalid_argument(
                    "parsed_output_json or sheets is required",
                ));
            }
            vec![textfsm_export::ParsedOutputSheet {
                name: optional_string(req.sheet_name)
                    .or_else(|| filename_hint.clone())
                    .unwrap_or_else(|| "parsed_output".to_string()),
                parsed_output,
            }]
        } else {
            req.sheets
                .into_iter()
                .enumerate()
                .map(|(index, sheet)| {
                    Ok(textfsm_export::ParsedOutputSheet {
                        name: optional_string(sheet.name)
                            .unwrap_or_else(|| format!("parsed_output_{}", index + 1)),
                        parsed_output: parse_json_value(
                            &sheet.parsed_output_json,
                            "parsed_output_json",
                            Value::Null,
                        )?,
                    })
                })
                .collect::<Result<Vec<_>, Status>>()?
        };
        let data = textfsm_export::parsed_outputs_xlsx_bytes(&sheets)
            .map_err(|err| Status::invalid_argument(err.to_string()))?;
        let filename = filename_hint.unwrap_or_else(|| {
            sheets
                .first()
                .map(|sheet| sheet.name.clone())
                .unwrap_or_else(|| "textfsm".to_string())
        });
        let filename = if filename.ends_with(".xlsx") {
            filename
        } else {
            format!("{filename}.xlsx")
        };
        Ok(Response::new(BytesResponse {
            data,
            filename,
            content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                .to_string(),
        }))
    }

    async fn list_custom_show_objects(
        &self,
        request: Request<ListCustomShowObjectsRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = list_custom_show_objects(Query(WebCustomShowObjectQuery {
            profile: optional_string(req.profile),
        }))
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn upsert_custom_show_object(
        &self,
        request: Request<UpsertCustomShowObjectRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = upsert_custom_show_object(Json(WebUpsertCustomShowObjectRequest {
            device_profile: req.device_profile,
            object: req.object,
            command: req.command,
            mode: optional_string(req.mode),
            textfsm_mapping_command: optional_string(req.textfsm_mapping_command),
            textfsm_template_name: optional_string(req.textfsm_template_name),
            enabled: req.enabled.unwrap_or(true),
        }))
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn delete_custom_show_object(
        &self,
        request: Request<DeleteCustomShowObjectRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = delete_custom_show_object(Json(WebDeleteCustomShowObjectRequest {
            device_profile: req.device_profile,
            object: req.object,
        }))
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn list_task_runs(
        &self,
        request: Request<ListTaskRunsRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = list_task_runs(Query(TaskRunsQuery {
            limit: (req.limit != 0).then_some(req.limit as usize),
            operation: optional_string(req.operation),
            status: optional_string(req.status),
        }))
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn get_task_run_detail(
        &self,
        request: Request<GetTaskRunDetailRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = get_task_run_detail(Path(req.task_id))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn list_backups(
        &self,
        request: Request<ListBackupsRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let _ = request.into_inner();
        let Json(response) = list_backups().await.map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn create_backup(
        &self,
        request: Request<CreateBackupRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = create_backup(Json(WebBackupCreateRequest {
            output: optional_string(req.output),
        }))
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn restore_backup(
        &self,
        request: Request<RestoreBackupRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = restore_backup(
            State(self.state.clone()),
            Json(BackupRestoreRequest {
                archive: req.archive,
                replace: req.replace,
            }),
        )
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn download_backup(
        &self,
        request: Request<DownloadBackupRequest>,
    ) -> Result<Response<BytesResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let path = backup::backup_path_by_name(&req.name)
            .map_err(|err| Status::invalid_argument(err.to_string()))?;
        let data = std::fs::read(&path)
            .map_err(|err| Status::internal(format!("failed to read backup: {err}")))?;
        let filename = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("backup.tar.gz")
            .to_string();
        Ok(Response::new(BytesResponse {
            data,
            filename,
            content_type: "application/gzip".to_string(),
        }))
    }

    async fn list_blacklist_patterns(
        &self,
        request: Request<ListBlacklistPatternsRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let _ = request.into_inner();
        let Json(response) = list_blacklist_patterns()
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn add_blacklist_pattern(
        &self,
        request: Request<BlacklistPatternRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = add_blacklist_pattern(Json(WebBlacklistUpsertRequest {
            pattern: req.pattern,
        }))
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn delete_blacklist_pattern(
        &self,
        request: Request<BlacklistPatternRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = delete_blacklist_pattern(Path(req.pattern))
            .await
            .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }

    async fn check_blacklist_command(
        &self,
        request: Request<CheckBlacklistCommandRequest>,
    ) -> Result<Response<JsonResponse>, Status> {
        self.validate_auth(request.metadata())?;
        let req = request.into_inner();
        let Json(response) = check_blacklist_command(Json(WebBlacklistCheckRequest {
            command: req.command,
        }))
        .await
        .map_err(api_error_to_status)?;
        Ok(Response::new(json_response(response)?))
    }
}
