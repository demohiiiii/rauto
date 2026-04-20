use super::*;

impl AgentRegistrar {
    pub async fn sync_device_inventory(&self) -> Result<u32> {
        let signature = device_inventory_signature()?;
        self.sync_device_inventory_with_signature(signature).await
    }

    pub async fn update_device_statuses(&self, timeout_secs: u64) -> Result<u32> {
        let devices = collect_reported_device_statuses(timeout_secs).await?;
        let target_url = self.reporting_target(
            "/api/agents/update-device-status",
            "/rauto.manager.v1.AgentReportingService/UpdateDeviceStatus",
        );
        let response = match self.config.manager.report_mode {
            ManagerReportMode::Grpc => {
                let payload = GrpcUpdateDeviceStatusRequest {
                    name: self.config.agent.name.clone(),
                    devices: devices
                        .iter()
                        .map(|device| GrpcReportedDeviceStatus {
                            name: device.name.clone(),
                            host: device.host.clone(),
                            reachable: device.reachable,
                        })
                        .collect(),
                };
                match self.grpc.update_device_status(payload).await {
                    Ok(response) => Ok(response.updated.max(devices.len() as u32)),
                    Err(err) => Err(err),
                }
            }
            ManagerReportMode::Http => {
                let payload = HttpUpdateDeviceStatusRequest {
                    name: self.config.agent.name.clone(),
                    devices: devices
                        .iter()
                        .map(|device| HttpReportedDeviceStatus {
                            name: device.name.clone(),
                            host: device.host.clone(),
                            reachable: device.reachable,
                        })
                        .collect(),
                };
                let response = self
                    .authed_post(target_url.clone())
                    .json(&payload)
                    .send()
                    .await
                    .and_then(|resp| resp.error_for_status())
                    .map_err(anyhow::Error::from);
                match response {
                    Ok(response) => Ok(response
                        .json::<UpdateDeviceStatusEnvelope>()
                        .await
                        .ok()
                        .and_then(|body| body.data.map(|data| data.updated))
                        .unwrap_or(devices.len() as u32)),
                    Err(err) => Err(err),
                }
            }
        };

        let updated = match response {
            Ok(updated) => updated,
            Err(err) => {
                self.report_async_error_best_effort(
                    AsyncErrorReportInput::new("device_status_update_failed", err.to_string())
                        .with_category("sync")
                        .with_operation(Some("agent_device_status_update".to_string()))
                        .with_target_url(Some(target_url))
                        .with_http_method(Some(self.reporting_http_method().to_string()))
                        .with_details(Some(json!({
                            "devices_count": devices.len(),
                            "probe_timeout_secs": timeout_secs
                        }))),
                )
                .await;
                return Err(err);
            }
        };
        info!(
            "updated {} device statuses for agent '{}'",
            updated, self.config.agent.name
        );
        Ok(updated)
    }

    pub async fn update_device_statuses_if_idle(&self, timeout_secs: u64) -> Result<bool> {
        if !self.begin_status_update() {
            return Ok(false);
        }

        let result = self.update_device_statuses(timeout_secs).await;
        self.finish_status_update();
        result.map(|_| true)
    }

    pub async fn trigger_device_inventory_sync_if_changed(
        &self,
        timeout_secs: u64,
    ) -> Result<bool> {
        let signature = device_inventory_signature()?;
        let should_report = {
            let runtime = self.runtime.lock().await;
            runtime.last_inventory_signature.as_deref() != Some(signature.as_str())
        };
        if !should_report {
            return Ok(false);
        }
        if !self.begin_inventory_sync() {
            return Ok(false);
        }

        let registrar = self.clone();
        tokio::spawn(async move {
            let result = registrar
                .sync_device_inventory_with_signature(signature)
                .await;
            registrar.finish_inventory_sync();
            match result {
                Ok(_) => {
                    if let Err(err) = registrar.update_device_statuses_if_idle(timeout_secs).await {
                        warn!("device status update after inventory sync failed: {}", err);
                    }
                }
                Err(err) => warn!("device inventory sync failed: {}", err),
            }
        });
        Ok(true)
    }

    async fn sync_device_inventory_with_signature(&self, signature: String) -> Result<u32> {
        let devices = collect_reported_inventory_devices()?;
        let target_url = self.reporting_target(
            "/api/agents/report-devices",
            "/rauto.manager.v1.AgentReportingService/ReportDevices",
        );
        let response = match self.config.manager.report_mode {
            ManagerReportMode::Grpc => {
                let payload = GrpcReportDevicesRequest {
                    name: self.config.agent.name.clone(),
                    devices: devices
                        .iter()
                        .map(|device| GrpcReportedInventoryDevice {
                            name: device.name.clone(),
                            host: device.host.clone(),
                            port: device.port as u32,
                            device_profile: device.device_profile.clone(),
                        })
                        .collect(),
                };
                match self.grpc.report_devices(payload).await {
                    Ok(response) => Ok(response.synced.max(devices.len() as u32)),
                    Err(err) => Err(err),
                }
            }
            ManagerReportMode::Http => {
                let payload = HttpReportDevicesRequest {
                    name: self.config.agent.name.clone(),
                    devices: devices
                        .iter()
                        .map(|device| HttpReportedInventoryDevice {
                            name: device.name.clone(),
                            host: device.host.clone(),
                            port: device.port,
                            device_profile: device.device_profile.clone(),
                        })
                        .collect(),
                };
                let response = self
                    .authed_post(target_url.clone())
                    .json(&payload)
                    .send()
                    .await
                    .and_then(|resp| resp.error_for_status())
                    .map_err(anyhow::Error::from);
                match response {
                    Ok(response) => Ok(response
                        .json::<ReportDevicesEnvelope>()
                        .await
                        .ok()
                        .and_then(|body| body.data.map(|data| data.synced))
                        .unwrap_or(devices.len() as u32)),
                    Err(err) => Err(err),
                }
            }
        };

        let synced = match response {
            Ok(synced) => synced,
            Err(err) => {
                self.report_async_error_best_effort(
                    AsyncErrorReportInput::new("device_inventory_sync_failed", err.to_string())
                        .with_category("sync")
                        .with_operation(Some("agent_device_inventory_sync".to_string()))
                        .with_target_url(Some(target_url))
                        .with_http_method(Some(self.reporting_http_method().to_string()))
                        .with_details(Some(json!({
                            "devices_count": devices.len()
                        }))),
                )
                .await;
                return Err(err);
            }
        };
        info!(
            "synced {} devices for agent '{}'",
            synced, self.config.agent.name
        );
        let mut runtime = self.runtime.lock().await;
        runtime.last_inventory_signature = Some(signature);
        Ok(synced)
    }

    fn begin_inventory_sync(&self) -> bool {
        self.syncing_inventory
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Relaxed)
            .is_ok()
    }

    fn finish_inventory_sync(&self) {
        self.syncing_inventory.store(false, Ordering::Release);
    }

    fn begin_status_update(&self) -> bool {
        self.updating_status
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Relaxed)
            .is_ok()
    }

    fn finish_status_update(&self) {
        self.updating_status.store(false, Ordering::Release);
    }
}
