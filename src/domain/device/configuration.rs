use regex::Regex;
use serde::Serialize;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum DeviceConfigSnapshotSortOrder {
    Ascending,
    #[default]
    Descending,
}

#[derive(Debug, Clone)]
pub struct NewDeviceConfigSnapshot<'a> {
    pub connection_name: &'a str,
    pub host: &'a str,
    pub profile: &'a str,
    pub kind: &'a str,
    pub command: &'a str,
    pub source: &'a str,
    pub task_id: Option<&'a str>,
    pub fetched_at_ms: i64,
    pub content: &'a str,
    pub sha256: &'a str,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeviceConfigHistoryDevice {
    pub name: String,
    pub host: String,
    pub device_profile: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeviceConfigSnapshotSummary {
    pub id: String,
    pub connection_name: String,
    pub host: String,
    pub profile: String,
    pub kind: String,
    pub command: String,
    pub source: String,
    pub task_id: Option<String>,
    pub fetched_at: String,
    pub sha256: String,
    pub content_size_bytes: u64,
    pub previous_snapshot_id: Option<String>,
    pub changed_from_previous: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeviceConfigSnapshot {
    #[serde(flatten)]
    pub summary: DeviceConfigSnapshotSummary,
    pub content: String,
}

pub fn normalize_config(content: &str, patterns: &[String]) -> String {
    let compiled: Vec<Regex> = patterns
        .iter()
        .filter_map(|pattern| Regex::new(pattern).ok())
        .collect();
    if compiled.is_empty() {
        return content.to_string();
    }
    let mut normalized = String::with_capacity(content.len());
    for line in content.lines() {
        if compiled.iter().any(|regex| regex.is_match(line)) {
            continue;
        }
        normalized.push_str(line);
        normalized.push('\n');
    }
    normalized
}

pub fn sha256_hex(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    let digest = hasher.finalize();
    let mut hex = String::with_capacity(digest.len() * 2);
    for byte in digest {
        let _ = std::fmt::Write::write_fmt(&mut hex, format_args!("{:02x}", byte));
    }
    hex
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn volatile_lines_do_not_affect_normalized_hash() {
        let patterns = vec![r"^Last changed: ".to_string()];
        let monday = "hostname edge\nLast changed: Monday\n";
        let tuesday = "hostname edge\nLast changed: Tuesday\n";

        assert_ne!(sha256_hex(monday), sha256_hex(tuesday));
        assert_eq!(
            sha256_hex(&normalize_config(monday, &patterns)),
            sha256_hex(&normalize_config(tuesday, &patterns))
        );
    }
}
