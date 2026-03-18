pub mod config;
pub mod grpc_client;
pub mod registration;

use crate::config::content_store;
use crate::config::{connection_store, template_loader};
use crate::web::error::ApiError;
use anyhow::Result;
use serde::Serialize;
use tokio::task::JoinSet;
use tokio::time::{Duration, timeout};

pub fn default_agent_name() -> String {
    hostname::get()
        .ok()
        .and_then(|value| value.into_string().ok())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "rauto-agent".to_string())
}

pub fn list_agent_capabilities(
    _template_dir: Option<&std::path::PathBuf>,
) -> Result<Vec<String>, anyhow::Error> {
    template_loader::list_available_profiles()
}

pub fn count_connections() -> Result<u32, anyhow::Error> {
    Ok(connection_store::list_connections()?.len() as u32)
}

pub fn count_templates(_template_dir: Option<&std::path::PathBuf>) -> Result<u32, ApiError> {
    Ok(content_store::list_command_template_names()
        .map_err(ApiError::from)?
        .len() as u32)
}

pub fn count_custom_profiles(_template_dir: Option<&std::path::PathBuf>) -> Result<u32, ApiError> {
    Ok(content_store::list_custom_profile_names()
        .map_err(ApiError::from)?
        .len() as u32)
}

#[derive(Debug, Clone, Serialize)]
pub struct ReportedInventoryDevice {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub device_profile: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReportedDeviceStatus {
    name: String,
    host: String,
    reachable: bool,
}

#[derive(Debug, Clone, Serialize)]
struct InventorySignatureDevice {
    name: String,
    host: String,
    port: u16,
    device_profile: String,
}

pub fn collect_reported_inventory_devices() -> Result<Vec<ReportedInventoryDevice>> {
    let devices = load_inventory_signature_devices()?
        .into_iter()
        .map(|device| ReportedInventoryDevice {
            name: device.name,
            host: device.host,
            port: device.port,
            device_profile: device.device_profile,
        })
        .collect();
    Ok(devices)
}

pub async fn collect_reported_device_statuses(
    timeout_secs: u64,
) -> Result<Vec<ReportedDeviceStatus>> {
    let devices = load_inventory_signature_devices()?;
    let mut join_set = JoinSet::new();
    for device in devices {
        join_set.spawn(async move { probe_device_status(device, timeout_secs).await });
    }

    let mut devices = Vec::new();
    while let Some(joined) = join_set.join_next().await {
        match joined {
            Ok(device) => devices.push(device),
            Err(err) => tracing::warn!("device report probe task join error: {}", err),
        }
    }
    devices.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(devices)
}

pub fn device_inventory_signature() -> Result<String> {
    let devices = load_inventory_signature_devices()?;
    Ok(serde_json::to_string(&devices)?)
}

fn load_inventory_signature_devices() -> Result<Vec<InventorySignatureDevice>> {
    let names = connection_store::list_connections()?;
    let mut devices = Vec::new();
    for name in names {
        match connection_store::load_connection_raw(&name) {
            Ok(loaded) => {
                let host = loaded.host.unwrap_or_default();
                if host.trim().is_empty() {
                    tracing::warn!(
                        "skipping saved connection '{}' in device inventory because host is empty",
                        name
                    );
                    continue;
                }
                devices.push(InventorySignatureDevice {
                    name,
                    host,
                    port: loaded.port.unwrap_or(22),
                    device_profile: loaded.device_profile.unwrap_or_else(|| "cisco".to_string()),
                });
            }
            Err(err) => {
                tracing::warn!(
                    "failed to load saved connection '{}' while building inventory signature: {}",
                    name,
                    err
                );
            }
        }
    }
    devices.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(devices)
}

async fn probe_device_status(
    device: InventorySignatureDevice,
    timeout_secs: u64,
) -> ReportedDeviceStatus {
    let target = format!("{}:{}", device.host, device.port);
    let reachable = matches!(
        timeout(
            Duration::from_secs(timeout_secs.max(1)),
            tokio::net::TcpStream::connect(&target),
        )
        .await,
        Ok(Ok(_))
    );

    ReportedDeviceStatus {
        name: device.name,
        host: device.host,
        reachable,
    }
}
