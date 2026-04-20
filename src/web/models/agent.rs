use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct AgentInfoResponse {
    pub name: String,
    pub version: String,
    pub capabilities: Vec<String>,
    pub uptime_seconds: u64,
    pub connections_count: u32,
    pub templates_count: u32,
    pub custom_profiles_count: u32,
    pub managed: bool,
}

#[derive(Debug, Serialize)]
pub struct AgentStatusResponse {
    pub status: String,
    pub active_sessions: u32,
    pub running_tasks: u32,
    pub last_heartbeat_at: Option<String>,
    pub registered_at: Option<String>,
    pub system: SystemInfo,
}

#[derive(Debug, Serialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub hostname: String,
}

#[derive(Debug, Deserialize)]
pub struct DeviceProbeRequest {
    pub connections: Vec<String>,
    #[serde(default = "default_probe_timeout")]
    pub timeout_secs: u32,
}

fn default_probe_timeout() -> u32 {
    10
}

#[derive(Debug, Serialize)]
pub struct DeviceProbeResult {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub device_profile: String,
    pub reachable: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DeviceProbeResponse {
    pub results: Vec<DeviceProbeResult>,
    pub total: u32,
    pub reachable_count: u32,
    pub unreachable_count: u32,
}
