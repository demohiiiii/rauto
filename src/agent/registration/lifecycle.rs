use super::*;

impl AgentRegistrar {
    pub fn new(config: AgentConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            client,
            grpc: ManagerGrpcClient::new(config.manager.url.clone(), config.manager.token.clone()),
            config,
            runtime: Arc::new(Mutex::new(RegistrarRuntime::default())),
            syncing_inventory: Arc::new(AtomicBool::new(false)),
            updating_status: Arc::new(AtomicBool::new(false)),
        }
    }

    pub async fn snapshot(&self) -> RegistrarSnapshot {
        let runtime = self.runtime.lock().await;
        RegistrarSnapshot {
            registered_at: runtime.registered_at.clone(),
            last_heartbeat_at: runtime.last_heartbeat_at.clone(),
        }
    }

    pub async fn register(&self, state: &Arc<AppState>, bind: &str, port: u16) -> Result<()> {
        {
            let mut runtime = self.runtime.lock().await;
            runtime.bind = Some(bind.to_string());
            runtime.port = Some(port);
        }

        let mut delay_secs = 5u64;
        let mut attempts = 0u64;
        loop {
            attempts += 1;
            match self.try_register_once(state, bind, port).await {
                Ok(()) => {
                    if let Err(err) = self.sync_device_inventory().await {
                        warn!("initial device inventory sync failed: {}", err);
                    }
                    if let Err(err) = self.update_device_statuses(5).await {
                        warn!("initial device status update failed: {}", err);
                    }
                    info!(
                        "agent '{}' registered to manager over {}",
                        self.config.agent.name, self.config.manager.report_mode
                    );
                    return Ok(());
                }
                Err(err) => {
                    warn!("agent registration attempt {} failed: {}", attempts, err);
                    sleep(Duration::from_secs(delay_secs)).await;
                    delay_secs = (delay_secs.saturating_mul(2)).min(60);
                }
            }
        }
    }

    pub async fn start_heartbeat_loop(self: Arc<Self>, state: Arc<AppState>) {
        let mut ticker = interval(Duration::from_secs(self.config.agent.heartbeat_interval));
        let mut consecutive_failures = 0u32;

        loop {
            ticker.tick().await;
            match self.send_heartbeat(&state).await {
                Ok(()) => {
                    consecutive_failures = 0;
                    if let Err(err) = self.trigger_device_inventory_sync_if_changed(5).await {
                        warn!("device inventory change detection failed: {}", err);
                    }
                }
                Err(err) => {
                    consecutive_failures += 1;
                    if consecutive_failures >= 5 {
                        error!(
                            "agent heartbeat failed {} times, retrying registration: {}",
                            consecutive_failures, err
                        );
                        let (bind, port) = {
                            let runtime = self.runtime.lock().await;
                            (runtime.bind.clone(), runtime.port)
                        };
                        if let (Some(bind), Some(port)) = (bind, port) {
                            if let Err(register_err) = self.register(&state, &bind, port).await {
                                error!("agent re-registration failed: {}", register_err);
                            } else {
                                consecutive_failures = 0;
                            }
                        }
                    } else if consecutive_failures >= 3 {
                        error!(
                            "agent heartbeat failed {} times: {}",
                            consecutive_failures, err
                        );
                    } else {
                        warn!("agent heartbeat failed: {}", err);
                    }
                }
            }
        }
    }

    pub async fn start_probe_report_loop(self: Arc<Self>) {
        let interval_secs = self.config.agent.probe_report_interval;
        if interval_secs == 0 {
            info!(
                "periodic device probe reporting disabled for agent '{}'",
                self.config.agent.name
            );
            return;
        }

        info!(
            "periodic device probe reporting enabled for agent '{}' every {}s",
            self.config.agent.name, interval_secs
        );
        let mut ticker = interval(Duration::from_secs(interval_secs));
        ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);
        ticker.tick().await;

        loop {
            ticker.tick().await;
            match self.update_device_statuses_if_idle(5).await {
                Ok(true) => {}
                Ok(false) => {}
                Err(err) => warn!("periodic device probe report failed: {}", err),
            }
        }
    }

    async fn try_register_once(&self, state: &Arc<AppState>, bind: &str, port: u16) -> Result<()> {
        let advertise_host = resolve_advertise_host(bind, &self.config.manager.url)
            .with_context(|| format!("failed to resolve advertise host from bind '{}'", bind))?;
        let version = env!("CARGO_PKG_VERSION").to_string();
        let capabilities = list_agent_capabilities(state.defaults.template_dir.as_ref())?;
        let connections_count = count_connections()?;
        let templates_count = count_templates(state.defaults.template_dir.as_ref())
            .map_err(|e| anyhow!(e.message))?;

        match self.config.manager.report_mode {
            ManagerReportMode::Grpc => {
                let payload = GrpcRegisterAgentRequest {
                    name: self.config.agent.name.clone(),
                    host: advertise_host.clone(),
                    port: port as u32,
                    version,
                    capabilities,
                    connections_count,
                    templates_count,
                };
                self.grpc.register_agent(payload).await?;
            }
            ManagerReportMode::Http => {
                let payload = HttpRegisterRequest {
                    name: self.config.agent.name.clone(),
                    host: advertise_host.clone(),
                    port,
                    version,
                    capabilities,
                    connections_count,
                    templates_count,
                };
                self.authed_post(self.manager_endpoint("/api/agents/register"))
                    .json(&payload)
                    .send()
                    .await?
                    .error_for_status()?
                    .json::<RegisterEnvelope>()
                    .await
                    .ok();
            }
        }

        info!(
            "agent '{}' registration advertised address {}:{}",
            self.config.agent.name, advertise_host, port
        );
        let mut runtime = self.runtime.lock().await;
        runtime.registered_at = Some(Utc::now().to_rfc3339());
        Ok(())
    }

    async fn send_heartbeat(&self, state: &Arc<AppState>) -> Result<()> {
        let active_sessions = state.active_session_count().await;
        let running_tasks = state.running_task_count();
        let status = "online".to_string();
        let connections_count = count_connections()?;
        let templates_count = count_templates(state.defaults.template_dir.as_ref())
            .map_err(|e| anyhow!(e.message))?;
        let uptime_seconds = state.uptime_seconds();

        match self.config.manager.report_mode {
            ManagerReportMode::Grpc => {
                let payload = GrpcHeartbeatRequest {
                    name: self.config.agent.name.clone(),
                    status,
                    active_sessions,
                    running_tasks,
                    connections_count,
                    templates_count,
                    uptime_seconds,
                };
                self.grpc.send_heartbeat(payload).await?;
            }
            ManagerReportMode::Http => {
                let payload = HttpHeartbeatRequest {
                    name: self.config.agent.name.clone(),
                    status,
                    active_sessions,
                    running_tasks,
                    connections_count,
                    templates_count,
                    uptime_seconds,
                };
                self.authed_post(self.manager_endpoint("/api/agents/heartbeat"))
                    .json(&payload)
                    .send()
                    .await?
                    .error_for_status()?;
            }
        }

        let mut runtime = self.runtime.lock().await;
        runtime.last_heartbeat_at = Some(Utc::now().to_rfc3339());
        Ok(())
    }

    pub async fn shutdown_notify(&self) {
        let request = match self.config.manager.report_mode {
            ManagerReportMode::Grpc => {
                let payload = GrpcOfflineRequest {
                    name: self.config.agent.name.clone(),
                };
                ManagerShutdownRequest::Grpc(self.grpc.notify_offline(payload))
            }
            ManagerReportMode::Http => {
                let payload = HttpOfflineRequest {
                    name: self.config.agent.name.clone(),
                };
                ManagerShutdownRequest::Http(
                    self.authed_post(self.manager_endpoint("/api/agents/offline"))
                        .json(&payload)
                        .send(),
                )
            }
        };

        match request {
            ManagerShutdownRequest::Grpc(request) => {
                match timeout(Duration::from_secs(3), request).await {
                    Ok(Ok(_)) => {}
                    Ok(Err(err)) => warn!("agent shutdown notification failed: {}", err),
                    Err(err) => warn!("agent shutdown notification timed out: {}", err),
                }
            }
            ManagerShutdownRequest::Http(request) => {
                match timeout(Duration::from_secs(3), request).await {
                    Ok(Ok(_)) => {}
                    Ok(Err(err)) => warn!("agent shutdown notification failed: {}", err),
                    Err(err) => warn!("agent shutdown notification timed out: {}", err),
                }
            }
        }
    }
}

enum ManagerShutdownRequest<FGrpc, FHttp> {
    Grpc(FGrpc),
    Http(FHttp),
}
