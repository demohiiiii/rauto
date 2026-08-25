#![forbid(unsafe_code)]

//! Credential domain crate.

use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fmt;
use std::str::FromStr;

pub mod import;

pub use import::{DeviceCredentialImportFailure, DeviceCredentialImportReport};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CredentialRuleError {
    UnsupportedAuthType(String),
    InvalidCredentialName(String),
    UsernameRequired,
}

impl fmt::Display for CredentialRuleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedAuthType(value) => write!(
                f,
                "unsupported SSH auth type '{}'; expected password, private_key, private_key_file, or agent",
                value
            ),
            Self::InvalidCredentialName(raw) => write!(
                f,
                "invalid device credential name '{}', use only letters/numbers/_/./-",
                raw
            ),
            Self::UsernameRequired => f.write_str("device credential username is required"),
        }
    }
}

impl Error for CredentialRuleError {}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeviceAuthType {
    #[default]
    Password,
    PrivateKey,
    PrivateKeyFile,
    Agent,
}

impl DeviceAuthType {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Password => "password",
            Self::PrivateKey => "private_key",
            Self::PrivateKeyFile => "private_key_file",
            Self::Agent => "agent",
        }
    }
}

impl FromStr for DeviceAuthType {
    type Err = CredentialRuleError;

    fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().replace('-', "_").as_str() {
            "password" => Ok(Self::Password),
            "private_key" | "key" => Ok(Self::PrivateKey),
            "private_key_file" | "key_file" => Ok(Self::PrivateKeyFile),
            "agent" | "ssh_agent" => Ok(Self::Agent),
            _ => Err(CredentialRuleError::UnsupportedAuthType(value.to_string())),
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct DeviceCredentialInput {
    pub name: String,
    pub username: String,
    pub auth_type: DeviceAuthType,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub private_key_path: Option<String>,
    pub passphrase: Option<String>,
    pub enable_password: Option<String>,
    pub enable_enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeviceCredentialMeta {
    pub id: String,
    pub name: String,
    pub username: String,
    pub auth_type: DeviceAuthType,
    pub has_auth_secret: bool,
    pub has_password: bool,
    pub private_key_path: Option<String>,
    pub has_passphrase: bool,
    pub has_enable_password: bool,
    pub enable_enabled: bool,
    pub connection_count: u64,
}

pub type Result<T> = std::result::Result<T, CredentialRuleError>;

pub fn normalize_credential_name(raw: &str) -> Result<String> {
    let value = raw.trim();
    if value.is_empty()
        || !value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.'))
    {
        return Err(CredentialRuleError::InvalidCredentialName(raw.to_string()));
    }
    Ok(value.to_string())
}

pub fn normalize_username(raw: &str) -> Result<String> {
    let value = raw.trim();
    if value.is_empty() {
        return Err(CredentialRuleError::UsernameRequired);
    }
    Ok(value.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_type_accepts_cli_and_storage_aliases() {
        assert_eq!(
            "password".parse::<DeviceAuthType>().unwrap(),
            DeviceAuthType::Password
        );
        assert_eq!(
            "private-key".parse::<DeviceAuthType>().unwrap(),
            DeviceAuthType::PrivateKey
        );
        assert_eq!(
            "key_file".parse::<DeviceAuthType>().unwrap(),
            DeviceAuthType::PrivateKeyFile
        );
        assert_eq!(
            "ssh_agent".parse::<DeviceAuthType>().unwrap(),
            DeviceAuthType::Agent
        );
    }

    #[test]
    fn auth_type_rejects_unknown_values() {
        let err = "keyboard_interactive"
            .parse::<DeviceAuthType>()
            .expect_err("unknown auth type should fail");

        assert!(err.to_string().contains("unsupported SSH auth type"));
    }

    #[test]
    fn credential_name_allows_inventory_style_names() {
        assert_eq!(
            normalize_credential_name(" admin.ops-1 ").expect("valid credential name"),
            "admin.ops-1"
        );
        assert!(normalize_credential_name("admin/ops").is_err());
    }

    #[test]
    fn username_is_required_and_trimmed() {
        assert_eq!(
            normalize_username(" admin ").expect("valid username"),
            "admin"
        );
        assert!(normalize_username("   ").is_err());
    }
}
