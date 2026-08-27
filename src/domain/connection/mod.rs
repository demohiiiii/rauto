#![forbid(unsafe_code)]

//! Connection and inventory domain crate.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::error::Error;
use std::fmt;

pub mod import;
pub mod security;

pub use import::{ConnectionImportFailure, ConnectionImportReport};
pub use security::SshSecurityProfile;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConnectionRuleError {
    InvalidConnectionName(String),
    EmptySimpleName,
    InvalidSimpleName(String),
    InvalidLabelsJson(String),
    LabelsMustBeArray,
    LabelValuesMustBeStrings,
    InvalidVarsJson(String),
    VarsMustBeObject,
    SerializeJson(String),
    InvalidConnectTimeout,
}

impl fmt::Display for ConnectionRuleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidConnectionName(raw) => write!(
                f,
                "invalid connection name '{}', use only letters/numbers/_/-",
                raw
            ),
            Self::EmptySimpleName => f.write_str("name is required"),
            Self::InvalidSimpleName(raw) => {
                write!(f, "invalid name '{}', use only letters/numbers/_/./-", raw)
            }
            Self::InvalidLabelsJson(err) => {
                write!(f, "failed to parse stored labels json: {}", err)
            }
            Self::LabelsMustBeArray => f.write_str("stored labels must be a JSON array"),
            Self::LabelValuesMustBeStrings => f.write_str("stored label values must be strings"),
            Self::InvalidVarsJson(err) => write!(f, "failed to parse stored vars json: {}", err),
            Self::VarsMustBeObject => f.write_str("vars must be a JSON object"),
            Self::SerializeJson(err) => f.write_str(err),
            Self::InvalidConnectTimeout => {
                write!(f, "connect_timeout_secs must be between 1 and {}", i64::MAX)
            }
        }
    }
}

impl Error for ConnectionRuleError {}

pub type Result<T> = std::result::Result<T, ConnectionRuleError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryGroup {
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub hosts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryLabel {
    pub name: String,
    #[serde(default)]
    pub hosts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedConnection<SshSecurity, LinuxShell, Encoding> {
    pub host: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credential_id: Option<String>,
    pub port: Option<u16>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub connect_timeout_secs: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub software_version: Option<String>,
    pub ssh_security: Option<SshSecurity>,
    pub linux_shell_flavor: Option<LinuxShell>,
    #[serde(default)]
    pub output_encoding: Encoding,
    pub device_profile: Option<String>,
    pub template_dir: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub labels: Vec<String>,
    #[serde(default = "default_vars")]
    pub vars: Value,
    #[serde(default)]
    pub groups: Vec<String>,
}

fn default_enabled() -> bool {
    true
}

fn default_vars() -> Value {
    Value::Object(Default::default())
}

pub fn safe_connection_name(raw: &str) -> Result<String> {
    let normalized = raw.trim().trim_end_matches(".toml");
    if normalized.is_empty()
        || !normalized
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
    {
        return Err(ConnectionRuleError::InvalidConnectionName(raw.to_string()));
    }
    Ok(normalized.to_string())
}

pub fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

pub fn validate_persisted_connect_timeout(connect_timeout_secs: Option<u64>) -> Result<()> {
    if connect_timeout_secs.is_some_and(|value| value == 0 || value > i64::MAX as u64) {
        return Err(ConnectionRuleError::InvalidConnectTimeout);
    }
    Ok(())
}

pub fn parse_labels_json(raw: String) -> Result<Vec<String>> {
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|err| ConnectionRuleError::InvalidLabelsJson(err.to_string()))?;
    let items = parsed
        .as_array()
        .ok_or(ConnectionRuleError::LabelsMustBeArray)?;
    let mut normalized = Vec::new();
    for item in items {
        let value = item
            .as_str()
            .ok_or(ConnectionRuleError::LabelValuesMustBeStrings)?;
        normalized.push(normalize_simple_name(value)?);
    }
    normalized.sort();
    normalized.dedup();
    Ok(normalized)
}

pub fn normalize_labels_json(values: &[String]) -> Result<String> {
    serde_json::to_string(&normalize_name_list(values)?)
        .map_err(|err| ConnectionRuleError::SerializeJson(err.to_string()))
}

pub fn parse_vars_json(raw: String) -> Result<Value> {
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|err| ConnectionRuleError::InvalidVarsJson(err.to_string()))?;
    ensure_json_object(&parsed)?;
    Ok(parsed)
}

pub fn normalize_vars_json(value: Value) -> Result<String> {
    ensure_json_object(&value)?;
    serde_json::to_string(&value).map_err(|err| ConnectionRuleError::SerializeJson(err.to_string()))
}

fn ensure_json_object(value: &Value) -> Result<()> {
    if !value.is_object() {
        return Err(ConnectionRuleError::VarsMustBeObject);
    }
    Ok(())
}

pub fn normalize_simple_name(raw: &str) -> Result<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(ConnectionRuleError::EmptySimpleName);
    }
    if !trimmed
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.'))
    {
        return Err(ConnectionRuleError::InvalidSimpleName(raw.to_string()));
    }
    Ok(trimmed.to_string())
}

pub fn normalize_name_list(values: &[String]) -> Result<Vec<String>> {
    let mut items = values
        .iter()
        .map(|value| normalize_simple_name(value))
        .collect::<Result<Vec<_>>>()?;
    items.sort();
    items.dedup();
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_connection_name_trims_suffix_and_validates_charset() {
        assert_eq!(
            safe_connection_name(" edge_01.toml ").expect("valid name"),
            "edge_01"
        );
        assert!(safe_connection_name("edge/01").is_err());
        assert!(safe_connection_name("   ").is_err());
    }

    #[test]
    fn normalize_name_list_trims_sorts_and_dedups() {
        let values = vec![" prod ".to_string(), "edge".to_string(), "prod".to_string()];

        let normalized = normalize_name_list(&values).expect("normalize names");

        assert_eq!(normalized, vec!["edge".to_string(), "prod".to_string()]);
    }

    #[test]
    fn labels_json_round_trips_normalized_names() {
        let labels = parse_labels_json(r#"["prod", " edge ", "prod"]"#.to_string())
            .expect("parse labels json");
        assert_eq!(labels, vec!["edge".to_string(), "prod".to_string()]);

        let json = normalize_labels_json(&labels).expect("serialize labels");
        assert_eq!(json, r#"["edge","prod"]"#);
    }

    #[test]
    fn vars_must_be_object() {
        assert!(parse_vars_json("[]".to_string()).is_err());
        assert!(normalize_vars_json(serde_json::json!([])).is_err());
        assert_eq!(
            parse_vars_json(r#"{"role":"edge"}"#.to_string()).expect("parse vars"),
            serde_json::json!({ "role": "edge" })
        );
    }

    #[test]
    fn persisted_connect_timeout_must_be_in_sqlite_i64_range() {
        assert!(validate_persisted_connect_timeout(None).is_ok());
        assert!(validate_persisted_connect_timeout(Some(1)).is_ok());
        assert!(validate_persisted_connect_timeout(Some(i64::MAX as u64)).is_ok());
        assert!(validate_persisted_connect_timeout(Some(0)).is_err());
        assert!(validate_persisted_connect_timeout(Some(i64::MAX as u64 + 1)).is_err());
    }

    #[test]
    fn optional_text_is_trimmed_and_empty_becomes_none() {
        assert_eq!(
            normalize_optional_text(Some(" edge ".to_string())),
            Some("edge".to_string())
        );
        assert_eq!(normalize_optional_text(Some("   ".to_string())), None);
        assert_eq!(normalize_optional_text(None), None);
    }

    #[test]
    fn saved_connection_defaults_enabled_and_empty_vars() {
        let saved: SavedConnection<String, String, String> =
            serde_json::from_value(serde_json::json!({ "host": "192.0.2.1" }))
                .expect("deserialize saved connection");

        assert!(saved.enabled);
        assert_eq!(saved.vars, serde_json::json!({}));
        assert!(saved.labels.is_empty());
        assert!(saved.groups.is_empty());
        assert_eq!(saved.output_encoding, "");
    }
}
