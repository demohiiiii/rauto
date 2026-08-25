use crate::infrastructure::db;
use anyhow::{Result, anyhow};
use sqlx::Row;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

mod helpers;
use self::helpers::{parse_linux_shell_flavor, parse_ssh_security_profile};
use crate::domain::connection::{
    SshSecurityProfile, normalize_labels_json, normalize_name_list, normalize_vars_json,
    parse_labels_json, parse_vars_json, validate_persisted_connect_timeout,
};
use crate::domain::device::LinuxShellFlavor;

pub type SavedConnection =
    crate::domain::connection::SavedConnection<SshSecurityProfile, LinuxShellFlavor>;

pub fn storage_path() -> PathBuf {
    db::db_path()
}

pub fn list_connections() -> Result<Vec<String>> {
    db::run_sync(async {
        let rows = sqlx::query("SELECT name FROM connections ORDER BY name ASC")
            .fetch_all(db::pool())
            .await?;
        Ok(rows
            .into_iter()
            .map(|row| row.get::<String, _>("name"))
            .collect())
    })
}

pub fn list_connections_by_endpoint(host: &str, port: u16) -> Result<Vec<String>> {
    let host = host.trim().to_string();
    db::run_sync(async move {
        let rows = sqlx::query(
            r#"
            SELECT name
            FROM connections
            WHERE TRIM(host) = ? COLLATE NOCASE AND COALESCE(port, 22) = ?
            ORDER BY name ASC
            "#,
        )
        .bind(host)
        .bind(i64::from(port))
        .fetch_all(db::pool())
        .await?;
        Ok(rows
            .into_iter()
            .map(|row| row.get::<String, _>("name"))
            .collect())
    })
}

pub fn list_connections_by_labels_any(labels: &[String]) -> Result<Vec<String>> {
    let mut required = labels
        .iter()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .map(|item| item.to_string())
        .collect::<Vec<_>>();
    required.sort();
    required.dedup();
    if required.is_empty() {
        return Ok(Vec::new());
    }

    db::run_sync(async move {
        let rows = sqlx::query("SELECT name, labels_json FROM connections ORDER BY name ASC")
            .fetch_all(db::pool())
            .await?;
        let mut names = Vec::new();
        for row in rows {
            let name = row.get::<String, _>("name");
            let parsed = parse_labels_json(
                row.try_get::<Option<String>, _>("labels_json")?
                    .unwrap_or_else(|| "[]".to_string()),
            )?;
            if required
                .iter()
                .any(|wanted| parsed.iter().any(|label| label == wanted))
            {
                names.push(name);
            }
        }
        Ok(names)
    })
}

pub fn list_connections_by_groups_any(groups: &[String]) -> Result<Vec<String>> {
    let mut required = groups
        .iter()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .map(|item| item.to_string())
        .collect::<Vec<_>>();
    required.sort();
    required.dedup();
    if required.is_empty() {
        return Ok(Vec::new());
    }

    db::run_sync(async move {
        let mut names = Vec::new();
        for group in required {
            let rows = sqlx::query(
                r#"
                SELECT connection_name
                FROM inventory_group_members
                WHERE group_name = ?
                ORDER BY connection_name ASC
                "#,
            )
            .bind(group)
            .fetch_all(db::pool())
            .await?;
            for row in rows {
                names.push(row.get::<String, _>("connection_name"));
            }
        }
        names.sort();
        names.dedup();
        Ok(names)
    })
}

pub fn load_connection_raw(name: &str) -> Result<SavedConnection> {
    let safe = safe_connection_name(name)?;
    db::run_sync(async move {
        let row = sqlx::query(
            r#"
            SELECT host, credential_id, port, connect_timeout_secs, device_model, software_version,
                   ssh_security, linux_shell_flavor, device_profile, template_dir,
                   enabled, labels_json, vars_json
            FROM connections
            WHERE name = ?
            "#,
        )
        .bind(&safe)
        .fetch_optional(db::pool())
        .await?
        .ok_or_else(|| anyhow!("saved connection '{}' not found", safe))?;
        let groups = load_connection_groups_async(&safe).await?;

        Ok(SavedConnection {
            host: row.try_get("host")?,
            credential_id: row.try_get("credential_id")?,
            port: row
                .try_get::<Option<i64>, _>("port")?
                .map(|value| value as u16),
            connect_timeout_secs: row
                .try_get::<Option<i64>, _>("connect_timeout_secs")?
                .map(|value| {
                    u64::try_from(value)
                        .ok()
                        .filter(|value| *value > 0)
                        .ok_or_else(|| anyhow!("connect_timeout_secs must be positive"))
                })
                .transpose()?,
            device_model: row.try_get("device_model")?,
            software_version: row.try_get("software_version")?,
            ssh_security: row
                .try_get::<Option<String>, _>("ssh_security")?
                .map(|value| parse_ssh_security_profile(&value))
                .transpose()?,
            linux_shell_flavor: row
                .try_get::<Option<String>, _>("linux_shell_flavor")?
                .map(|value| parse_linux_shell_flavor(&value))
                .transpose()?,
            device_profile: row.try_get("device_profile")?,
            template_dir: row.try_get("template_dir")?,
            enabled: row.try_get::<i64, _>("enabled").unwrap_or(1) != 0,
            labels: parse_labels_json(
                row.try_get::<Option<String>, _>("labels_json")?
                    .unwrap_or_else(|| "[]".to_string()),
            )?,
            vars: parse_vars_json(
                row.try_get::<Option<String>, _>("vars_json")?
                    .unwrap_or_else(|| "{}".to_string()),
            )?,
            groups,
        })
    })
}

pub fn save_connection(name: &str, data: &SavedConnection) -> Result<PathBuf> {
    let safe = safe_connection_name(name)?;
    persist_connection(&safe, data)?;
    Ok(db::db_path())
}

pub fn delete_connection(name: &str) -> Result<bool> {
    let safe = safe_connection_name(name)?;
    if load_connection_raw(&safe).is_err() {
        return Ok(false);
    }
    db::run_sync(async move {
        sqlx::query("DELETE FROM inventory_group_members WHERE connection_name = ?")
            .bind(&safe)
            .execute(db::pool())
            .await?;
        let deleted = sqlx::query("DELETE FROM connections WHERE name = ?")
            .bind(&safe)
            .execute(db::pool())
            .await?
            .rows_affected()
            > 0;
        Ok(deleted)
    })
}

pub fn has_saved_password(data: &SavedConnection) -> bool {
    data.credential_id
        .as_deref()
        .and_then(|id| crate::infrastructure::db::device_credential_store::get_credential(id).ok())
        .is_some_and(|credential| credential.has_password)
}

pub fn has_saved_enable_password(data: &SavedConnection) -> bool {
    data.credential_id
        .as_deref()
        .and_then(|id| crate::infrastructure::db::device_credential_store::get_credential(id).ok())
        .is_some_and(|credential| credential.has_enable_password)
}

pub fn safe_connection_name(raw: &str) -> Result<String> {
    crate::domain::connection::safe_connection_name(raw).map_err(Into::into)
}

fn persist_connection(connection_name: &str, data: &SavedConnection) -> Result<()> {
    validate_persisted_connect_timeout(data.connect_timeout_secs)?;
    let stored = data.clone();
    let labels_json = normalize_labels_json(&stored.labels)?;
    let vars_json = normalize_vars_json(stored.vars.clone())?;
    let groups = normalize_name_list(&stored.groups)?;

    let now_ms = now_ms();
    let name = connection_name.to_string();
    db::run_sync(async move {
        let created_at_ms =
            sqlx::query_scalar::<_, i64>("SELECT created_at_ms FROM connections WHERE name = ?")
                .bind(&name)
                .fetch_optional(db::pool())
                .await?
                .unwrap_or(now_ms as i64);

        sqlx::query(
            r#"
            INSERT INTO connections (
                name, host, credential_id, port, connect_timeout_secs, device_model, software_version,
                ssh_security, linux_shell_flavor, device_profile, template_dir, enabled, labels_json,
                vars_json, created_at_ms, updated_at_ms
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                host = excluded.host,
                credential_id = excluded.credential_id,
                port = excluded.port,
                connect_timeout_secs = excluded.connect_timeout_secs,
                device_model = excluded.device_model,
                software_version = excluded.software_version,
                ssh_security = excluded.ssh_security,
                linux_shell_flavor = excluded.linux_shell_flavor,
                device_profile = excluded.device_profile,
                template_dir = excluded.template_dir,
                enabled = excluded.enabled,
                labels_json = excluded.labels_json,
                vars_json = excluded.vars_json,
                updated_at_ms = excluded.updated_at_ms
            "#,
        )
        .bind(&name)
        .bind(&stored.host)
        .bind(&stored.credential_id)
        .bind(stored.port.map(i64::from))
        .bind(stored.connect_timeout_secs.map(|value| value as i64))
        .bind(&stored.device_model)
        .bind(&stored.software_version)
        .bind(stored.ssh_security.map(|value| value.to_string()))
        .bind(stored.linux_shell_flavor.map(|value| value.to_string()))
        .bind(&stored.device_profile)
        .bind(&stored.template_dir)
        .bind(if stored.enabled { 1_i64 } else { 0_i64 })
        .bind(labels_json)
        .bind(vars_json)
        .bind(created_at_ms)
        .bind(now_ms as i64)
        .execute(db::pool())
        .await?;

        sqlx::query("DELETE FROM inventory_group_members WHERE connection_name = ?")
            .bind(&name)
            .execute(db::pool())
            .await?;

        for group_name in &groups {
            let group_created_at = sqlx::query_scalar::<_, i64>(
                "SELECT created_at_ms FROM inventory_groups WHERE name = ?",
            )
            .bind(group_name)
            .fetch_optional(db::pool())
            .await?
            .unwrap_or(now_ms as i64);

            sqlx::query(
                r#"
                INSERT INTO inventory_groups (name, description, created_at_ms, updated_at_ms)
                VALUES (?, NULL, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    updated_at_ms = excluded.updated_at_ms
                "#,
            )
            .bind(group_name)
            .bind(group_created_at)
            .bind(now_ms as i64)
            .execute(db::pool())
            .await?;

            sqlx::query(
                "INSERT INTO inventory_group_members (group_name, connection_name, created_at_ms) VALUES (?, ?, ?)",
            )
            .bind(group_name)
            .bind(&name)
            .bind(now_ms as i64)
            .execute(db::pool())
            .await?;
        }
        Ok(())
    })
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

async fn load_connection_groups_async(name: &str) -> Result<Vec<String>> {
    let rows = sqlx::query(
        "SELECT group_name FROM inventory_group_members WHERE connection_name = ? ORDER BY group_name ASC",
    )
    .bind(name)
    .fetch_all(db::pool())
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| row.get::<String, _>("group_name"))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::{
        SavedConnection, delete_connection, list_connections_by_groups_any,
        list_connections_by_labels_any, save_connection,
    };
    use crate::domain::connection::SshSecurityProfile;
    use crate::infrastructure::db;
    use anyhow::Result;
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    struct TestEnvGuard {
        original_home: Option<std::ffi::OsString>,
        _root: PathBuf,
        _guard: std::sync::MutexGuard<'static, ()>,
    }

    impl TestEnvGuard {
        fn new() -> Result<Self> {
            let guard = TEST_ENV_LOCK
                .get_or_init(|| Mutex::new(()))
                .lock()
                .expect("test env lock poisoned");
            let root = std::env::temp_dir().join(format!(
                "rauto-connection-store-test-{}",
                SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos()
            ));
            let original_home = std::env::var_os("RAUTO_HOME");
            unsafe {
                std::env::set_var("RAUTO_HOME", &root);
            }
            Ok(Self {
                original_home,
                _root: root,
                _guard: guard,
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
    fn list_connections_by_labels_any_matches_saved_labels() -> Result<()> {
        let _env_guard = TestEnvGuard::new()?;
        db::init_sync()?;
        let left = "conn_store_label_left";
        let right = "conn_store_label_right";
        let _ = delete_connection(left);
        let _ = delete_connection(right);

        save_connection(
            left,
            &SavedConnection {
                credential_id: None,
                host: Some("192.0.2.41".to_string()),
                port: Some(22),
                connect_timeout_secs: None,
                device_model: None,
                software_version: None,
                ssh_security: Some(SshSecurityProfile::Balanced),
                linux_shell_flavor: None,
                device_profile: Some("linux".to_string()),
                template_dir: None,
                enabled: true,
                labels: vec!["edge".to_string(), "prod".to_string()],
                vars: serde_json::json!({}),
                groups: vec![],
            },
        )?;
        save_connection(
            right,
            &SavedConnection {
                credential_id: None,
                host: Some("192.0.2.42".to_string()),
                port: Some(22),
                connect_timeout_secs: None,
                device_model: None,
                software_version: None,
                ssh_security: Some(SshSecurityProfile::Balanced),
                linux_shell_flavor: None,
                device_profile: Some("linux".to_string()),
                template_dir: None,
                enabled: true,
                labels: vec!["core".to_string()],
                vars: serde_json::json!({}),
                groups: vec![],
            },
        )?;

        let items = list_connections_by_labels_any(&["edge".to_string(), "qa".to_string()])?;
        assert_eq!(items, vec![left.to_string()]);
        Ok(())
    }

    #[test]
    fn list_connections_by_groups_any_matches_saved_groups() -> Result<()> {
        let _env_guard = TestEnvGuard::new()?;
        db::init_sync()?;
        let left = "conn_store_group_left";
        let right = "conn_store_group_right";
        let _ = delete_connection(left);
        let _ = delete_connection(right);

        save_connection(
            left,
            &SavedConnection {
                credential_id: None,
                host: Some("192.0.2.51".to_string()),
                port: Some(22),
                connect_timeout_secs: None,
                device_model: None,
                software_version: None,
                ssh_security: Some(SshSecurityProfile::Balanced),
                linux_shell_flavor: None,
                device_profile: Some("linux".to_string()),
                template_dir: None,
                enabled: true,
                labels: vec![],
                vars: serde_json::json!({}),
                groups: vec!["access".to_string(), "lab".to_string()],
            },
        )?;
        save_connection(
            right,
            &SavedConnection {
                credential_id: None,
                host: Some("192.0.2.52".to_string()),
                port: Some(22),
                connect_timeout_secs: None,
                device_model: None,
                software_version: None,
                ssh_security: Some(SshSecurityProfile::Balanced),
                linux_shell_flavor: None,
                device_profile: Some("linux".to_string()),
                template_dir: None,
                enabled: true,
                labels: vec![],
                vars: serde_json::json!({}),
                groups: vec!["core".to_string()],
            },
        )?;

        let items = list_connections_by_groups_any(&["access".to_string(), "core".to_string()])?;
        assert_eq!(items, vec![left.to_string(), right.to_string()]);
        Ok(())
    }
}
