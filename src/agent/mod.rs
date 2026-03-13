pub mod config;
pub mod registration;

use crate::config::{connection_store, template_loader};
use crate::web::{error::ApiError, storage};
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
    template_dir: Option<&std::path::PathBuf>,
) -> Result<Vec<String>, anyhow::Error> {
    template_loader::list_available_profiles(template_dir)
}

pub fn count_connections() -> Result<u32, anyhow::Error> {
    Ok(connection_store::list_connections()?.len() as u32)
}

pub fn count_templates(template_dir: Option<&std::path::PathBuf>) -> Result<u32, ApiError> {
    let commands_dir = storage::resolve_commands_dir(template_dir);
    Ok(storage::list_templates(&commands_dir)?.len() as u32)
}

pub fn count_custom_profiles(template_dir: Option<&std::path::PathBuf>) -> Result<u32, ApiError> {
    let profiles_dir = storage::resolve_profiles_dir(template_dir);
    Ok(storage::list_custom_profiles(&profiles_dir)?.len() as u32)
}

#[derive(Debug, Clone, Serialize)]
pub struct ReportedDevice {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub device_profile: String,
    pub reachable: bool,
}

#[derive(Debug, Serialize)]
struct InventorySignatureDevice {
    name: String,
    host: String,
    port: u16,
    device_profile: String,
}

pub async fn collect_reported_devices(timeout_secs: u64) -> Result<Vec<ReportedDevice>> {
    let names = connection_store::list_connections()?;
    let mut join_set = JoinSet::new();
    for name in names {
        join_set.spawn(async move { report_device_from_connection(name, timeout_secs).await });
    }

    let mut devices = Vec::new();
    while let Some(joined) = join_set.join_next().await {
        match joined {
            Ok(Some(device)) => devices.push(device),
            Ok(None) => {}
            Err(err) => tracing::warn!("device report probe task join error: {}", err),
        }
    }
    devices.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(devices)
}

pub fn device_inventory_signature() -> Result<String> {
    let names = connection_store::list_connections()?;
    let mut devices = Vec::new();
    for name in names {
        match connection_store::load_connection(&name) {
            Ok(loaded) => devices.push(InventorySignatureDevice {
                name,
                host: loaded.host.unwrap_or_default(),
                port: loaded.port.unwrap_or(22),
                device_profile: loaded.device_profile.unwrap_or_else(|| "cisco".to_string()),
            }),
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
    Ok(serde_json::to_string(&devices)?)
}

async fn report_device_from_connection(name: String, timeout_secs: u64) -> Option<ReportedDevice> {
    let loaded = match connection_store::load_connection(&name) {
        Ok(value) => value,
        Err(err) => {
            tracing::warn!(
                "failed to load saved connection '{}' for report: {}",
                name,
                err
            );
            return None;
        }
    };

    let host = loaded.host.unwrap_or_default();
    if host.trim().is_empty() {
        tracing::warn!(
            "skipping saved connection '{}' in device report because host is empty",
            name
        );
        return None;
    }
    let port = loaded.port.unwrap_or(22);
    let device_profile = loaded.device_profile.unwrap_or_else(|| "cisco".to_string());
    let target = format!("{}:{}", host, port);
    let reachable = matches!(
        timeout(
            Duration::from_secs(timeout_secs.max(1)),
            tokio::net::TcpStream::connect(&target),
        )
        .await,
        Ok(Ok(_))
    );

    Some(ReportedDevice {
        name,
        host,
        port,
        device_profile,
        reachable,
    })
}
