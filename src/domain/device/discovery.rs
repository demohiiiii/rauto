use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryRunRecord {
    pub id: String,
    pub status: String,
    pub phase: String,
    pub targets: Vec<String>,
    pub ports: Vec<u16>,
    pub credential_ids: Vec<String>,
    pub default_groups: Vec<String>,
    pub default_labels: Vec<String>,
    pub concurrency: usize,
    pub tcp_timeout_ms: u64,
    pub probe_timeout_secs: u64,
    pub total_targets: usize,
    pub scanned_targets: usize,
    pub reachable_count: usize,
    pub probed_targets: usize,
    pub identified_count: usize,
    pub failed_count: usize,
    pub error: Option<String>,
    pub created_at_ms: u64,
    pub started_at_ms: Option<u64>,
    pub completed_at_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryResultRecord {
    pub run_id: String,
    pub host: String,
    pub port: u16,
    pub status: String,
    pub latency_ms: Option<u64>,
    pub credential_id: Option<String>,
    pub device_profile: Option<String>,
    pub device_model: Option<String>,
    pub software_version: Option<String>,
    pub existing_connection_name: Option<String>,
    pub imported_connection_name: Option<String>,
    pub error: Option<String>,
    pub updated_at_ms: u64,
}
