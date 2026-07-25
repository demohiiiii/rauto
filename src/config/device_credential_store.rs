use crate::config::keyring_store;
use crate::db;
use anyhow::{Result, anyhow};
use sqlx::Row;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct DeviceCredentialInput {
    pub name: String,
    pub username: String,
    pub password: Option<String>,
    pub enable_password: Option<String>,
    pub enable_enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeviceCredentialMeta {
    pub id: String,
    pub name: String,
    pub username: String,
    pub has_password: bool,
    pub has_enable_password: bool,
    pub enable_enabled: bool,
    pub connection_count: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedDeviceCredential {
    pub id: String,
    pub name: String,
    pub username: String,
    pub password: String,
    pub enable_password: Option<String>,
    pub enable_enabled: bool,
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
                   d.enable_enabled,
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
                   d.enable_enabled,
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
                   d.enable_enabled,
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
            "SELECT id, name, username, password_ref, enable_password_ref, enable_enabled FROM device_credentials WHERE id = ?",
        )
        .bind(&id)
        .fetch_optional(db::pool())
        .await?
        .ok_or_else(|| anyhow!("device credential '{}' not found", id))?;
        let password_ref = row.get::<String, _>("password_ref");
        let password = keyring_store::load_secret(Some(&password_ref))?
            .filter(|value| !value.is_empty())
            .ok_or_else(|| anyhow!("device credential '{}' is missing its login password", id))?;
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
            password,
            enable_password,
            enable_enabled: row.get::<Option<i64>, _>("enable_enabled").unwrap_or(0) != 0,
        })
    })
}

pub fn create_credential(input: &DeviceCredentialInput) -> Result<DeviceCredentialMeta> {
    let name = normalize_name(&input.name)?;
    let username = normalize_username(&input.username)?;
    let password = required_password(input.password.as_deref())?;
    let password_ref = keyring_store::store_secret(Some(password))?
        .ok_or_else(|| anyhow!("login password is required"))?;
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
                 enable_enabled, created_at_ms, updated_at_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(&name)
        .bind(&username)
        .bind(&password_ref)
        .bind(&enable_password_ref)
        .bind(if input.enable_enabled { 1_i64 } else { 0 })
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
    let password_ref = match input.password.as_deref() {
        Some(value) => keyring_store::store_secret(Some(required_password(Some(value))?))?
            .ok_or_else(|| anyhow!("login password is required"))?,
        None => existing.password_ref,
    };
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
                enable_enabled = ?, updated_at_ms = ?
            WHERE id = ?
            "#,
        )
        .bind(&name)
        .bind(&username)
        .bind(&password_ref)
        .bind(&enable_password_ref)
        .bind(if input.enable_enabled { 1_i64 } else { 0 })
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
    password_ref: String,
}

fn credential_secret_refs(id: &str) -> Result<CredentialSecretRefs> {
    db::run_sync(async move {
        let row = sqlx::query("SELECT password_ref FROM device_credentials WHERE id = ?")
            .bind(id)
            .fetch_optional(db::pool())
            .await?
            .ok_or_else(|| anyhow!("device credential '{}' not found", id))?;
        Ok(CredentialSecretRefs {
            password_ref: row.get("password_ref"),
        })
    })
}

fn meta_from_row(row: sqlx::sqlite::SqliteRow) -> Result<DeviceCredentialMeta> {
    Ok(DeviceCredentialMeta {
        id: row.get("id"),
        name: row.get("name"),
        username: row.get("username"),
        has_password: !row.get::<String, _>("password_ref").is_empty(),
        has_enable_password: row
            .get::<Option<String>, _>("enable_password_ref")
            .is_some_and(|value| !value.is_empty()),
        enable_enabled: row.get::<Option<i64>, _>("enable_enabled").unwrap_or(0) != 0,
        connection_count: row.get::<i64, _>("connection_count") as u64,
    })
}

fn normalize_name(raw: &str) -> Result<String> {
    let value = raw.trim();
    if value.is_empty()
        || !value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.'))
    {
        return Err(anyhow!(
            "invalid device credential name '{}', use only letters/numbers/_/./-",
            raw
        ));
    }
    Ok(value.to_string())
}

fn normalize_username(raw: &str) -> Result<String> {
    let value = raw.trim();
    if value.is_empty() {
        return Err(anyhow!("device credential username is required"));
    }
    Ok(value.to_string())
}

fn required_password(value: Option<&str>) -> Result<&str> {
    value
        .filter(|item| !item.trim().is_empty())
        .ok_or_else(|| anyhow!("login password is required"))
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
    use crate::db;
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
