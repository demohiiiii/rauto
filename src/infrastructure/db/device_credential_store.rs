pub use crate::domain::credential::{DeviceAuthType, DeviceCredentialInput, DeviceCredentialMeta};
use crate::domain::credential::{
    normalize_credential_name, normalize_username as normalize_credential_username,
};
use crate::infrastructure::db;
use crate::infrastructure::db::keyring_store;
use anyhow::{Result, anyhow};
use rneter::session::SshAuthMethod;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::path::PathBuf;
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedDeviceCredential {
    pub id: String,
    pub name: String,
    pub username: String,
    pub auth: SshAuthMethod,
    pub password: String,
    pub enable_password: Option<String>,
    pub enable_enabled: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct AuthMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    private_key_path: Option<String>,
    #[serde(default)]
    has_passphrase: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum StoredAuthSecret {
    PrivateKey {
        key_data: String,
        passphrase: Option<String>,
    },
    PrivateKeyFile {
        passphrase: Option<String>,
    },
}

impl ResolvedDeviceCredential {
    pub fn runtime_enable_password(&self) -> Option<String> {
        self.enable_enabled
            .then(|| self.enable_password.clone().unwrap_or_default())
    }
}

pub fn list_credentials() -> Result<Vec<DeviceCredentialMeta>> {
    db::run_sync(async {
        let rows = sqlx::query(
            r#"
            SELECT d.id, d.name, d.username, d.password_ref, d.enable_password_ref,
                   d.enable_enabled, d.auth_type, d.auth_metadata_json,
                   COUNT(c.name) AS connection_count
            FROM device_credentials d
            LEFT JOIN connections c ON c.credential_id = d.id
            GROUP BY d.id
            ORDER BY d.name ASC
            "#,
        )
        .fetch_all(db::pool())
        .await?;
        rows.into_iter().map(meta_from_row).collect()
    })
}

pub fn get_credential(id: &str) -> Result<DeviceCredentialMeta> {
    db::run_sync(async move {
        let row = sqlx::query(
            r#"
            SELECT d.id, d.name, d.username, d.password_ref, d.enable_password_ref,
                   d.enable_enabled, d.auth_type, d.auth_metadata_json,
                   COUNT(c.name) AS connection_count
            FROM device_credentials d
            LEFT JOIN connections c ON c.credential_id = d.id
            WHERE d.id = ?
            GROUP BY d.id
            "#,
        )
        .bind(id)
        .fetch_optional(db::pool())
        .await?
        .ok_or_else(|| anyhow!("device credential '{}' not found", id))?;
        meta_from_row(row)
    })
}

pub fn find_credential_by_name(name: &str) -> Result<DeviceCredentialMeta> {
    let normalized = normalize_name(name)?;
    db::run_sync(async move {
        let row = sqlx::query(
            r#"
            SELECT d.id, d.name, d.username, d.password_ref, d.enable_password_ref,
                   d.enable_enabled, d.auth_type, d.auth_metadata_json,
                   COUNT(c.name) AS connection_count
            FROM device_credentials d
            LEFT JOIN connections c ON c.credential_id = d.id
            WHERE d.name = ?
            GROUP BY d.id
            "#,
        )
        .bind(normalized)
        .fetch_optional(db::pool())
        .await?
        .ok_or_else(|| anyhow!("device credential '{}' not found", name))?;
        meta_from_row(row)
    })
}

pub fn resolve_credential(id: &str) -> Result<ResolvedDeviceCredential> {
    let id = id.trim().to_string();
    db::run_sync(async move {
        let row = sqlx::query(
            "SELECT id, name, username, password_ref, enable_password_ref, enable_enabled, auth_type, auth_metadata_json FROM device_credentials WHERE id = ?",
        )
        .bind(&id)
        .fetch_optional(db::pool())
        .await?
        .ok_or_else(|| anyhow!("device credential '{}' not found", id))?;
        let auth_type = DeviceAuthType::from_str(&row.get::<String, _>("auth_type"))?;
        let metadata = parse_auth_metadata(&row.get::<String, _>("auth_metadata_json"))?;
        let secret_ref = row.get::<String, _>("password_ref");
        let stored_secret = keyring_store::load_secret(Some(&secret_ref))?;
        let (auth, password) =
            resolve_auth_method(auth_type, &metadata, stored_secret.as_deref(), &id)?;
        let enable_password = row
            .get::<Option<String>, _>("enable_password_ref")
            .map(|reference| keyring_store::load_secret(Some(&reference)))
            .transpose()?
            .flatten()
            .filter(|value| !value.is_empty());
        Ok(ResolvedDeviceCredential {
            id: row.get("id"),
            name: row.get("name"),
            username: row.get("username"),
            auth,
            password,
            enable_password,
            enable_enabled: row.get::<Option<i64>, _>("enable_enabled").unwrap_or(0) != 0,
        })
    })
}

pub fn create_credential(input: &DeviceCredentialInput) -> Result<DeviceCredentialMeta> {
    let name = normalize_name(&input.name)?;
    let username = normalize_username(&input.username)?;
    let prepared_auth = prepare_auth(input, None)?;
    let enable_password_ref = if input.enable_enabled {
        store_optional_password(input.enable_password.as_deref())?
    } else {
        None
    };
    let id = new_id();
    let now = now_ms();
    let result = db::run_sync(async {
        let duplicate =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM device_credentials WHERE name = ?")
                .bind(&name)
                .fetch_one(db::pool())
                .await?;
        if duplicate > 0 {
            return Err(anyhow!("device credential '{}' already exists", name));
        }
        sqlx::query(
            r#"
            INSERT INTO device_credentials
                (id, name, username, password_ref, enable_password_ref,
                 enable_enabled, auth_type, auth_metadata_json, created_at_ms, updated_at_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(&name)
        .bind(&username)
        .bind(&prepared_auth.secret_ref)
        .bind(&enable_password_ref)
        .bind(if input.enable_enabled { 1_i64 } else { 0 })
        .bind(input.auth_type.as_str())
        .bind(&prepared_auth.metadata_json)
        .bind(now as i64)
        .bind(now as i64)
        .execute(db::pool())
        .await?;
        Ok::<_, anyhow::Error>(())
    });
    result?;
    get_credential(&id)
}

pub fn update_credential(id: &str, input: &DeviceCredentialInput) -> Result<DeviceCredentialMeta> {
    let existing = credential_secret_refs(id)?;
    let name = normalize_name(&input.name)?;
    let username = normalize_username(&input.username)?;
    let prepared_auth = prepare_auth(input, Some(&existing))?;
    let enable_password_ref = if input.enable_enabled {
        store_optional_password(input.enable_password.as_deref())?
    } else {
        None
    };
    let now = now_ms();
    db::run_sync(async move {
        let duplicate = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM device_credentials WHERE name = ? AND id <> ?",
        )
        .bind(&name)
        .bind(id)
        .fetch_one(db::pool())
        .await?;
        if duplicate > 0 {
            return Err(anyhow!("device credential '{}' already exists", name));
        }
        let changed = sqlx::query(
            r#"
            UPDATE device_credentials
            SET name = ?, username = ?, password_ref = ?, enable_password_ref = ?,
                enable_enabled = ?, auth_type = ?, auth_metadata_json = ?, updated_at_ms = ?
            WHERE id = ?
            "#,
        )
        .bind(&name)
        .bind(&username)
        .bind(&prepared_auth.secret_ref)
        .bind(&enable_password_ref)
        .bind(if input.enable_enabled { 1_i64 } else { 0 })
        .bind(input.auth_type.as_str())
        .bind(&prepared_auth.metadata_json)
        .bind(now as i64)
        .bind(id)
        .execute(db::pool())
        .await?
        .rows_affected();
        if changed == 0 {
            return Err(anyhow!("device credential '{}' not found", id));
        }
        Ok::<_, anyhow::Error>(())
    })?;
    get_credential(id)
}

pub fn delete_credential(id: &str) -> Result<bool> {
    let references = referencing_connections(id)?;
    if !references.is_empty() {
        return Err(anyhow!(
            "device credential '{}' is referenced by connections: {}",
            id,
            references.join(", ")
        ));
    }
    db::run_sync(async move {
        Ok(sqlx::query("DELETE FROM device_credentials WHERE id = ?")
            .bind(id)
            .execute(db::pool())
            .await?
            .rows_affected()
            > 0)
    })
}

pub fn referencing_connections(id: &str) -> Result<Vec<String>> {
    db::run_sync(async move {
        let rows =
            sqlx::query("SELECT name FROM connections WHERE credential_id = ? ORDER BY name ASC")
                .bind(id)
                .fetch_all(db::pool())
                .await?;
        Ok(rows
            .into_iter()
            .map(|row| row.get::<String, _>("name"))
            .collect())
    })
}

struct CredentialSecretRefs {
    auth_type: DeviceAuthType,
    secret_ref: String,
    metadata: AuthMetadata,
}

fn credential_secret_refs(id: &str) -> Result<CredentialSecretRefs> {
    db::run_sync(async move {
        let row = sqlx::query(
            "SELECT password_ref, auth_type, auth_metadata_json FROM device_credentials WHERE id = ?",
        )
            .bind(id)
            .fetch_optional(db::pool())
            .await?
            .ok_or_else(|| anyhow!("device credential '{}' not found", id))?;
        Ok(CredentialSecretRefs {
            auth_type: DeviceAuthType::from_str(&row.get::<String, _>("auth_type"))?,
            secret_ref: row.get("password_ref"),
            metadata: parse_auth_metadata(&row.get::<String, _>("auth_metadata_json"))?,
        })
    })
}

fn meta_from_row(row: sqlx::sqlite::SqliteRow) -> Result<DeviceCredentialMeta> {
    let auth_type = DeviceAuthType::from_str(&row.get::<String, _>("auth_type"))?;
    let metadata = parse_auth_metadata(&row.get::<String, _>("auth_metadata_json"))?;
    let has_auth_secret = !row.get::<String, _>("password_ref").is_empty();
    Ok(DeviceCredentialMeta {
        id: row.get("id"),
        name: row.get("name"),
        username: row.get("username"),
        auth_type,
        has_auth_secret,
        has_password: auth_type == DeviceAuthType::Password && has_auth_secret,
        private_key_path: metadata.private_key_path,
        has_passphrase: metadata.has_passphrase,
        has_enable_password: row
            .get::<Option<String>, _>("enable_password_ref")
            .is_some_and(|value| !value.is_empty()),
        enable_enabled: row.get::<Option<i64>, _>("enable_enabled").unwrap_or(0) != 0,
        connection_count: row.get::<i64, _>("connection_count") as u64,
    })
}

struct PreparedAuth {
    secret_ref: String,
    metadata_json: String,
}

fn prepare_auth(
    input: &DeviceCredentialInput,
    existing: Option<&CredentialSecretRefs>,
) -> Result<PreparedAuth> {
    let existing_secret = existing
        .filter(|value| value.auth_type == input.auth_type)
        .map(|value| keyring_store::load_secret(Some(&value.secret_ref)))
        .transpose()?
        .flatten();
    let existing_metadata = existing
        .filter(|value| value.auth_type == input.auth_type)
        .map(|value| value.metadata.clone())
        .unwrap_or_default();

    let (secret, metadata) = match input.auth_type {
        DeviceAuthType::Password => {
            let password = non_empty(input.password.as_deref())
                .map(ToOwned::to_owned)
                .or(existing_secret)
                .ok_or_else(|| anyhow!("login password is required"))?;
            (Some(password), AuthMetadata::default())
        }
        DeviceAuthType::PrivateKey => {
            let existing_payload = existing_secret
                .as_deref()
                .map(parse_stored_auth_secret)
                .transpose()?;
            let (existing_key, existing_passphrase) = match existing_payload {
                Some(StoredAuthSecret::PrivateKey {
                    key_data,
                    passphrase,
                }) => (Some(key_data), passphrase),
                Some(_) => return Err(anyhow!("stored private-key credential is invalid")),
                None => (None, None),
            };
            let key_data = non_empty(input.private_key.as_deref())
                .map(ToOwned::to_owned)
                .or(existing_key)
                .ok_or_else(|| anyhow!("inline private key is required"))?;
            let passphrase = input
                .passphrase
                .as_deref()
                .map(str::trim)
                .map(ToOwned::to_owned)
                .or(existing_passphrase)
                .filter(|value| !value.is_empty());
            let metadata = AuthMetadata {
                has_passphrase: passphrase.is_some(),
                ..Default::default()
            };
            (
                Some(serde_json::to_string(&StoredAuthSecret::PrivateKey {
                    key_data,
                    passphrase,
                })?),
                metadata,
            )
        }
        DeviceAuthType::PrivateKeyFile => {
            let existing_payload = existing_secret
                .as_deref()
                .map(parse_stored_auth_secret)
                .transpose()?;
            let existing_passphrase = match existing_payload {
                Some(StoredAuthSecret::PrivateKeyFile { passphrase }) => passphrase,
                Some(_) => return Err(anyhow!("stored private-key-file credential is invalid")),
                None => None,
            };
            let path = non_empty(input.private_key_path.as_deref())
                .map(ToOwned::to_owned)
                .or(existing_metadata.private_key_path)
                .ok_or_else(|| anyhow!("private key file path is required"))?;
            let passphrase = input
                .passphrase
                .as_deref()
                .map(str::trim)
                .map(ToOwned::to_owned)
                .or(existing_passphrase)
                .filter(|value| !value.is_empty());
            let metadata = AuthMetadata {
                private_key_path: Some(path),
                has_passphrase: passphrase.is_some(),
            };
            let secret = passphrase.map(|passphrase| {
                serde_json::to_string(&StoredAuthSecret::PrivateKeyFile {
                    passphrase: Some(passphrase),
                })
            });
            (secret.transpose()?, metadata)
        }
        DeviceAuthType::Agent => (None, AuthMetadata::default()),
    };

    Ok(PreparedAuth {
        secret_ref: keyring_store::store_secret(secret.as_deref())?.unwrap_or_default(),
        metadata_json: serde_json::to_string(&metadata)?,
    })
}

fn resolve_auth_method(
    auth_type: DeviceAuthType,
    metadata: &AuthMetadata,
    secret: Option<&str>,
    credential_id: &str,
) -> Result<(SshAuthMethod, String)> {
    match auth_type {
        DeviceAuthType::Password => {
            let password = non_empty(secret)
                .ok_or_else(|| {
                    anyhow!(
                        "device credential '{}' is missing its login password",
                        credential_id
                    )
                })?
                .to_string();
            Ok((SshAuthMethod::password(password.clone()), password))
        }
        DeviceAuthType::PrivateKey => match parse_required_stored_secret(secret, credential_id)? {
            StoredAuthSecret::PrivateKey {
                key_data,
                passphrase,
            } => Ok((
                SshAuthMethod::private_key(key_data, passphrase),
                String::new(),
            )),
            _ => Err(anyhow!(
                "credential '{}' has invalid private-key data",
                credential_id
            )),
        },
        DeviceAuthType::PrivateKeyFile => {
            let path = metadata.private_key_path.as_deref().ok_or_else(|| {
                anyhow!(
                    "credential '{}' is missing its private key file path",
                    credential_id
                )
            })?;
            let passphrase = match secret {
                Some(secret) => match parse_stored_auth_secret(secret)? {
                    StoredAuthSecret::PrivateKeyFile { passphrase } => passphrase,
                    _ => {
                        return Err(anyhow!(
                            "credential '{}' has invalid private-key-file data",
                            credential_id
                        ));
                    }
                },
                None => None,
            };
            Ok((
                SshAuthMethod::private_key_file(PathBuf::from(path), passphrase),
                String::new(),
            ))
        }
        DeviceAuthType::Agent => {
            #[cfg(not(target_os = "windows"))]
            {
                Ok((SshAuthMethod::agent(), String::new()))
            }
            #[cfg(target_os = "windows")]
            {
                Err(anyhow!(
                    "ssh-agent authentication is not supported on Windows"
                ))
            }
        }
    }
}

fn parse_required_stored_secret(
    secret: Option<&str>,
    credential_id: &str,
) -> Result<StoredAuthSecret> {
    parse_stored_auth_secret(secret.ok_or_else(|| {
        anyhow!(
            "device credential '{}' is missing authentication data",
            credential_id
        )
    })?)
}

fn parse_stored_auth_secret(secret: &str) -> Result<StoredAuthSecret> {
    serde_json::from_str(secret).map_err(|error| anyhow!("invalid stored SSH auth data: {error}"))
}

fn parse_auth_metadata(raw: &str) -> Result<AuthMetadata> {
    serde_json::from_str(raw).map_err(|error| anyhow!("invalid stored SSH auth metadata: {error}"))
}

fn non_empty(value: Option<&str>) -> Option<&str> {
    value.filter(|item| !item.trim().is_empty())
}

fn normalize_name(raw: &str) -> Result<String> {
    normalize_credential_name(raw).map_err(Into::into)
}

fn normalize_username(raw: &str) -> Result<String> {
    normalize_credential_username(raw).map_err(Into::into)
}

fn store_optional_password(value: Option<&str>) -> Result<Option<String>> {
    keyring_store::store_secret(value.filter(|item| !item.trim().is_empty()))
}

fn new_id() -> String {
    format!("cred-{}-{:016x}", now_ms(), rand::random::<u64>())
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::db;
    use anyhow::Result;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TestEnvGuard {
        original_home: Option<std::ffi::OsString>,
        _root: PathBuf,
    }

    impl TestEnvGuard {
        fn new() -> Result<Self> {
            let root = std::env::temp_dir().join(format!(
                "rauto-device-credential-store-{}",
                SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos()
            ));
            let original_home = std::env::var_os("RAUTO_HOME");
            unsafe {
                std::env::set_var("RAUTO_HOME", &root);
            }
            Ok(Self {
                original_home,
                _root: root,
            })
        }
    }

    impl Drop for TestEnvGuard {
        fn drop(&mut self) {
            if let Some(value) = &self.original_home {
                unsafe {
                    std::env::set_var("RAUTO_HOME", value);
                }
            } else {
                unsafe {
                    std::env::remove_var("RAUTO_HOME");
                }
            }
        }
    }

    #[test]
    fn credential_crud_resolves_secrets_and_blocks_referenced_delete() -> Result<()> {
        let _guard = TestEnvGuard::new()?;
        db::init_sync()?;

        let created = create_credential(&DeviceCredentialInput {
            name: "ops-account".to_string(),
            username: "admin".to_string(),
            password: Some("login-secret".to_string()),
            enable_password: Some("enable-secret".to_string()),
            enable_enabled: true,
            ..Default::default()
        })?;
        assert_eq!(created.name, "ops-account");
        assert_eq!(created.username, "admin");
        assert!(created.has_password);
        assert!(created.has_enable_password);

        let resolved = resolve_credential(&created.id)?;
        assert_eq!(resolved.username, "admin");
        assert_eq!(resolved.password, "login-secret");
        assert_eq!(resolved.enable_password.as_deref(), Some("enable-secret"));

        let enabled_without_password = update_credential(
            &created.id,
            &DeviceCredentialInput {
                name: "ops-renamed".to_string(),
                username: "operator".to_string(),
                password: None,
                enable_password: None,
                enable_enabled: true,
                ..Default::default()
            },
        )?;
        assert!(enabled_without_password.enable_enabled);
        assert!(!enabled_without_password.has_enable_password);
        let resolved_without_password = resolve_credential(&created.id)?;
        assert_eq!(
            resolved_without_password.runtime_enable_password(),
            Some(String::new())
        );

        let updated = update_credential(
            &created.id,
            &DeviceCredentialInput {
                name: "ops-renamed".to_string(),
                username: "operator".to_string(),
                password: None,
                enable_password: None,
                enable_enabled: false,
                ..Default::default()
            },
        )?;
        assert_eq!(updated.id, created.id);
        assert_eq!(updated.name, "ops-renamed");
        assert!(!updated.has_enable_password);
        assert!(!updated.enable_enabled);
        assert_eq!(resolve_credential(&created.id)?.password, "login-secret");
        assert_eq!(
            resolve_credential(&created.id)?.runtime_enable_password(),
            None
        );

        let private_key = create_credential(&DeviceCredentialInput {
            name: "inline-key".to_string(),
            username: "key-user".to_string(),
            auth_type: DeviceAuthType::PrivateKey,
            private_key: Some("-----BEGIN OPENSSH PRIVATE KEY-----\ntest-key".to_string()),
            passphrase: Some("key-passphrase".to_string()),
            ..Default::default()
        })?;
        assert_eq!(private_key.auth_type, DeviceAuthType::PrivateKey);
        assert!(private_key.has_auth_secret);
        assert!(private_key.has_passphrase);
        assert!(matches!(
            resolve_credential(&private_key.id)?.auth,
            SshAuthMethod::PrivateKey {
                key_data,
                passphrase: Some(passphrase),
            } if key_data.contains("OPENSSH PRIVATE KEY") && passphrase == "key-passphrase"
        ));
        let retained_private_key = update_credential(
            &private_key.id,
            &DeviceCredentialInput {
                name: "inline-key-renamed".to_string(),
                username: "key-user".to_string(),
                auth_type: DeviceAuthType::PrivateKey,
                ..Default::default()
            },
        )?;
        assert!(retained_private_key.has_auth_secret);
        assert!(retained_private_key.has_passphrase);
        assert!(matches!(
            resolve_credential(&private_key.id)?.auth,
            SshAuthMethod::PrivateKey {
                key_data,
                passphrase: Some(passphrase),
            } if key_data.contains("OPENSSH PRIVATE KEY") && passphrase == "key-passphrase"
        ));

        let key_file = create_credential(&DeviceCredentialInput {
            name: "key-file".to_string(),
            username: "key-user".to_string(),
            auth_type: DeviceAuthType::PrivateKeyFile,
            private_key_path: Some("/run/secrets/id_ed25519".to_string()),
            ..Default::default()
        })?;
        assert_eq!(
            key_file.private_key_path.as_deref(),
            Some("/run/secrets/id_ed25519")
        );
        assert!(matches!(
            resolve_credential(&key_file.id)?.auth,
            SshAuthMethod::PrivateKeyFile { path, passphrase: None }
                if path.as_path() == std::path::Path::new("/run/secrets/id_ed25519")
        ));

        #[cfg(not(target_os = "windows"))]
        {
            let agent = create_credential(&DeviceCredentialInput {
                name: "ssh-agent".to_string(),
                username: "agent-user".to_string(),
                auth_type: DeviceAuthType::Agent,
                ..Default::default()
            })?;
            assert!(!agent.has_auth_secret);
            assert!(matches!(
                resolve_credential(&agent.id)?.auth,
                SshAuthMethod::Agent
            ));
        }

        db::run_sync(async {
            sqlx::query(
                "INSERT INTO connections (name, credential_id, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?)",
            )
            .bind("credential-ref-connection")
            .bind(&created.id)
            .bind(1_i64)
            .bind(1_i64)
            .execute(db::pool())
            .await?;
            Ok::<_, anyhow::Error>(())
        })?;
        let err = delete_credential(&created.id).expect_err("referenced credentials cannot delete");
        assert!(err.to_string().contains("credential-ref-connection"));
        Ok(())
    }
}
