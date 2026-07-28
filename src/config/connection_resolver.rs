use crate::config::connection_store::{self, SavedConnection};
use anyhow::{Result, anyhow};
use rneter::session::SshAuthMethod;
use std::ops::Deref;

#[derive(Debug, Clone)]
pub struct ResolvedConnection {
    pub saved: SavedConnection,
    pub username: Option<String>,
    pub auth: Option<SshAuthMethod>,
    pub password: Option<String>,
    pub enable_password: Option<String>,
}

impl Deref for ResolvedConnection {
    type Target = SavedConnection;

    fn deref(&self) -> &Self::Target {
        &self.saved
    }
}

pub fn resolve_saved_connection(name: &str) -> Result<ResolvedConnection> {
    resolve_connection(connection_store::load_connection_raw(name)?)
}

pub fn resolve_connection(saved: SavedConnection) -> Result<ResolvedConnection> {
    let credential_id = saved
        .credential_id
        .as_deref()
        .ok_or_else(|| anyhow!("connection requires a device credential"))?;
    let credential = crate::config::device_credential_store::resolve_credential(credential_id)?;
    let enable_password = credential.runtime_enable_password();
    Ok(ResolvedConnection {
        saved,
        username: Some(credential.username),
        auth: Some(credential.auth),
        password: Some(credential.password),
        enable_password,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::connection_store::SavedConnection;
    use crate::config::device_credential_store::{DeviceCredentialInput, create_credential};
    use crate::db;
    use anyhow::Result;

    #[test]
    fn resolves_saved_connection_authentication_from_credential_reference() -> Result<()> {
        db::init_sync()?;
        let credential = create_credential(&DeviceCredentialInput {
            name: format!("resolver-test-{}", rand::random::<u64>()),
            username: "operator".to_string(),
            password: Some("login-secret".to_string()),
            enable_password: Some("enable-secret".to_string()),
            enable_enabled: true,
            ..Default::default()
        })?;
        let saved = SavedConnection {
            host: Some("192.0.2.10".to_string()),
            credential_id: Some(credential.id),
            port: Some(22),
            connect_timeout_secs: None,
            device_model: None,
            software_version: None,
            ssh_security: None,
            linux_shell_flavor: None,
            device_profile: Some("cisco_ios".to_string()),
            template_dir: None,
            enabled: true,
            labels: vec![],
            vars: serde_json::json!({}),
            groups: vec![],
        };

        let resolved = resolve_connection(saved)?;

        assert_eq!(resolved.username.as_deref(), Some("operator"));
        assert_eq!(resolved.password.as_deref(), Some("login-secret"));
        assert_eq!(resolved.enable_password.as_deref(), Some("enable-secret"));
        assert_eq!(resolved.host.as_deref(), Some("192.0.2.10"));
        Ok(())
    }

    #[test]
    fn rejects_runtime_resolution_without_a_credential() {
        let saved = SavedConnection {
            host: Some("192.0.2.11".to_string()),
            credential_id: None,
            port: Some(22),
            connect_timeout_secs: None,
            device_model: None,
            software_version: None,
            ssh_security: None,
            linux_shell_flavor: None,
            device_profile: None,
            template_dir: None,
            enabled: true,
            labels: vec![],
            vars: serde_json::json!({}),
            groups: vec![],
        };

        let error = resolve_connection(saved).expect_err("credential is required");
        assert!(error.to_string().contains("credential"));
    }
}
