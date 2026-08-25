use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub ts_ms: u128,
    pub connection_key: String,
    pub connection_name: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub device_profile: String,
    pub operation: String,
    pub command_label: String,
    pub mode: Option<String>,
    pub record_level: String,
    pub record_path: String,
}

pub struct HistoryBinding<'a> {
    pub connection_name: Option<&'a str>,
    pub host: &'a str,
    pub port: u16,
    pub username: &'a str,
    pub device_profile: &'a str,
}
