use crate::config::device_discovery_store::{DiscoveryResultRecord, DiscoveryRunRecord};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
pub struct CreateDiscoveryRunRequest {
    pub targets: Vec<String>,
    #[serde(default = "default_discovery_ports")]
    pub ports: Vec<u16>,
    pub credential_ids: Vec<String>,
    #[serde(default)]
    pub default_groups: Vec<String>,
    #[serde(default)]
    pub default_labels: Vec<String>,
    #[serde(default = "default_discovery_concurrency")]
    pub concurrency: usize,
    #[serde(default = "default_tcp_timeout_ms")]
    pub tcp_timeout_ms: u64,
    #[serde(default = "default_probe_timeout_secs")]
    pub probe_timeout_secs: u64,
}

fn default_discovery_ports() -> Vec<u16> {
    vec![22]
}

fn default_discovery_concurrency() -> usize {
    32
}

fn default_tcp_timeout_ms() -> u64 {
    1_000
}

fn default_probe_timeout_secs() -> u64 {
    15
}

#[derive(Debug, Clone, Serialize)]
pub struct DiscoveryRunDetailResponse {
    pub run: DiscoveryRunRecord,
    pub results: Vec<DiscoveryResultRecord>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ImportDiscoveryResultsRequest {
    pub items: Vec<ImportDiscoveryResultItem>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ImportDiscoveryResultItem {
    pub host: String,
    pub port: u16,
    pub connection_name: String,
    #[serde(default)]
    pub credential_id: Option<String>,
    #[serde(default)]
    pub groups: Option<Vec<String>>,
    #[serde(default)]
    pub labels: Option<Vec<String>>,
    #[serde(default)]
    pub overwrite: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportDiscoveryResultsResponse {
    pub total: usize,
    pub created: usize,
    pub updated: usize,
    pub skipped: usize,
    pub failed: usize,
    pub results: Vec<ImportDiscoveryResultResponse>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportDiscoveryResultResponse {
    pub host: String,
    pub port: u16,
    pub connection_name: String,
    pub status: String,
    pub error: Option<String>,
}
