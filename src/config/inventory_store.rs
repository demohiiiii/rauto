use crate::config::connection_store;
use crate::db;
use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::Row;
use std::collections::BTreeSet;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryGroup {
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub vars: Value,
    #[serde(default)]
    pub hosts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryVarsResolution {
    pub host_name: Option<String>,
    #[serde(default)]
    pub group_names: Vec<String>,
    #[serde(default)]
    pub merged_vars: Value,
}

pub fn list_groups() -> Result<Vec<InventoryGroup>> {
    db::run_sync(async {
        let rows = sqlx::query(
            r#"
            SELECT name, description
            FROM inventory_groups
            ORDER BY name ASC
            "#,
        )
        .fetch_all(db::pool())
        .await?;

        let mut groups = Vec::with_capacity(rows.len());
        for row in rows {
            let name = row.get::<String, _>("name");
            groups.push(build_group(&name, row).await?);
        }
        Ok(groups)
    })
}

pub fn get_group(name: &str) -> Result<Option<InventoryGroup>> {
    let safe_name = normalize_inventory_name(name)?;
    db::run_sync(async move {
        let row = sqlx::query(
            r#"
            SELECT name, description
            FROM inventory_groups
            WHERE name = ?
            "#,
        )
        .bind(&safe_name)
        .fetch_optional(db::pool())
        .await?;

        match row {
            Some(row) => Ok(Some(build_group(&safe_name, row).await?)),
            None => Ok(None),
        }
    })
}

pub fn upsert_group(name: &str, group: &InventoryGroup) -> Result<()> {
    let safe_name = normalize_inventory_name(name)?;
    let description = empty_to_none(group.description.clone());
    let vars_json = normalize_vars_json(group.vars.clone())?;
    let hosts = normalize_string_list(&group.hosts)?;
    let now = now_ms() as i64;

    for host_name in &hosts {
        connection_store::load_connection_raw(host_name)
            .map_err(|_| anyhow!("saved connection '{}' not found", host_name))?;
    }

    db::run_sync(async move {
        let created_at_ms = sqlx::query_scalar::<_, i64>(
            "SELECT created_at_ms FROM inventory_groups WHERE name = ?",
        )
        .bind(&safe_name)
        .fetch_optional(db::pool())
        .await?
        .unwrap_or(now);

        sqlx::query(
            r#"
            INSERT INTO inventory_groups (name, description, created_at_ms, updated_at_ms)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                description = excluded.description,
                updated_at_ms = excluded.updated_at_ms
            "#,
        )
        .bind(&safe_name)
        .bind(&description)
        .bind(created_at_ms)
        .bind(now)
        .execute(db::pool())
        .await?;

        sqlx::query(
            r#"
            INSERT INTO inventory_group_vars (group_name, vars_json, updated_at_ms)
            VALUES (?, ?, ?)
            ON CONFLICT(group_name) DO UPDATE SET
                vars_json = excluded.vars_json,
                updated_at_ms = excluded.updated_at_ms
            "#,
        )
        .bind(&safe_name)
        .bind(vars_json)
        .bind(now)
        .execute(db::pool())
        .await?;

        sqlx::query("DELETE FROM inventory_group_members WHERE group_name = ?")
            .bind(&safe_name)
            .execute(db::pool())
            .await?;

        for connection_name in &hosts {
            sqlx::query(
                "INSERT INTO inventory_group_members (group_name, connection_name, created_at_ms) VALUES (?, ?, ?)",
            )
            .bind(&safe_name)
            .bind(connection_name)
            .bind(now)
            .execute(db::pool())
            .await?;
        }

        Ok(())
    })
}

pub fn delete_group(name: &str) -> Result<bool> {
    let safe_name = normalize_inventory_name(name)?;
    db::run_sync(async move {
        let rows = sqlx::query("DELETE FROM inventory_groups WHERE name = ?")
            .bind(&safe_name)
            .execute(db::pool())
            .await?
            .rows_affected();
        Ok(rows > 0)
    })
}

pub fn resolve_vars(
    host_name: Option<&str>,
    group_names: &[String],
    runtime_vars: Value,
) -> Result<InventoryVarsResolution> {
    let resolved_host_name = host_name.map(normalize_inventory_name).transpose()?;
    let explicit_groups = normalize_string_list(group_names)?;
    ensure_json_object(&runtime_vars)?;

    db::run_sync(async move {
        let mut merged = Value::Object(Map::new());
        let mut group_set = BTreeSet::new();
        let mut host_vars: Option<Value> = None;

        if let Some(host_name) = resolved_host_name.as_ref() {
            host_vars = Some(
                load_connection_vars(host_name)
                    .await?
                    .ok_or_else(|| anyhow!("saved connection '{}' not found", host_name))?,
            );
            for group in connection_group_names(host_name).await? {
                group_set.insert(group);
            }
        }
        for group in explicit_groups {
            group_set.insert(group);
        }

        for group_name in &group_set {
            if !group_exists(group_name).await? {
                return Err(anyhow!("inventory group '{}' not found", group_name));
            }
            if let Some(vars) = load_group_vars(group_name).await? {
                merge_json_object(&mut merged, &vars)?;
            }
        }

        if let Some(vars) = host_vars.as_ref() {
            merge_json_object(&mut merged, vars)?;
        }

        merge_json_object(&mut merged, &runtime_vars)?;

        Ok(InventoryVarsResolution {
            host_name: resolved_host_name,
            group_names: group_set.into_iter().collect(),
            merged_vars: merged,
        })
    })
}

async fn build_group(name: &str, row: sqlx::sqlite::SqliteRow) -> Result<InventoryGroup> {
    Ok(InventoryGroup {
        name: name.to_string(),
        description: row.try_get("description")?,
        vars: load_group_vars(name)
            .await?
            .unwrap_or_else(|| Value::Object(Map::new())),
        hosts: group_host_names(name).await?,
    })
}

async fn group_exists(group_name: &str) -> Result<bool> {
    let found =
        sqlx::query_scalar::<_, i64>("SELECT 1 FROM inventory_groups WHERE name = ? LIMIT 1")
            .bind(group_name)
            .fetch_optional(db::pool())
            .await?;
    Ok(found.is_some())
}

async fn connection_group_names(connection_name: &str) -> Result<Vec<String>> {
    let rows = sqlx::query(
        "SELECT group_name FROM inventory_group_members WHERE connection_name = ? ORDER BY group_name ASC",
    )
    .bind(connection_name)
    .fetch_all(db::pool())
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| row.get::<String, _>("group_name"))
        .collect())
}

async fn load_connection_vars(connection_name: &str) -> Result<Option<Value>> {
    let row = sqlx::query("SELECT vars_json FROM connections WHERE name = ?")
        .bind(connection_name)
        .fetch_optional(db::pool())
        .await?;
    row.map(|row| parse_vars_json(row.get::<String, _>("vars_json")))
        .transpose()
}

async fn group_host_names(group_name: &str) -> Result<Vec<String>> {
    let rows = sqlx::query(
        "SELECT connection_name FROM inventory_group_members WHERE group_name = ? ORDER BY connection_name ASC",
    )
    .bind(group_name)
    .fetch_all(db::pool())
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| row.get::<String, _>("connection_name"))
        .collect())
}

async fn load_group_vars(group_name: &str) -> Result<Option<Value>> {
    let row = sqlx::query("SELECT vars_json FROM inventory_group_vars WHERE group_name = ?")
        .bind(group_name)
        .fetch_optional(db::pool())
        .await?;
    row.map(|row| parse_vars_json(row.get::<String, _>("vars_json")))
        .transpose()
}

fn parse_vars_json(raw: String) -> Result<Value> {
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|err| anyhow!("failed to parse stored vars json: {}", err))?;
    ensure_json_object(&parsed)?;
    Ok(parsed)
}

fn normalize_vars_json(value: Value) -> Result<String> {
    ensure_json_object(&value)?;
    serde_json::to_string(&value).map_err(|err| anyhow!(err))
}

fn ensure_json_object(value: &Value) -> Result<()> {
    if !value.is_object() {
        return Err(anyhow!("vars must be a JSON object"));
    }
    Ok(())
}

fn merge_json_object(target: &mut Value, source: &Value) -> Result<()> {
    let target_map = target
        .as_object_mut()
        .ok_or_else(|| anyhow!("merged vars target must be a JSON object"))?;
    let source_map = source
        .as_object()
        .ok_or_else(|| anyhow!("vars source must be a JSON object"))?;
    for (key, value) in source_map {
        target_map.insert(key.clone(), value.clone());
    }
    Ok(())
}

fn normalize_inventory_name(raw: &str) -> Result<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("name is required"));
    }
    if !trimmed
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.'))
    {
        return Err(anyhow!(
            "invalid name '{}', use only letters/numbers/_/./-",
            raw
        ));
    }
    Ok(trimmed.to_string())
}

fn normalize_string_list(values: &[String]) -> Result<Vec<String>> {
    let mut items = BTreeSet::new();
    for value in values {
        let normalized = normalize_inventory_name(value)?;
        items.insert(normalized);
    }
    Ok(items.into_iter().collect())
}

fn empty_to_none(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

#[cfg(test)]
mod tests {
    use super::{InventoryGroup, get_group, list_groups, resolve_vars};
    use crate::config::connection_store::{SavedConnection, save_connection};
    use crate::db;
    use anyhow::Result;
    use serde_json::json;
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};
    use std::fs;
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
                "rauto-inventory-store-test-{}",
                SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos()
            ));
            fs::create_dir_all(&root)?;
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

    fn sample_connection(host: &str, groups: Vec<&str>, vars: serde_json::Value) -> SavedConnection {
        SavedConnection {
            host: Some(host.to_string()),
            port: Some(22),
            username: Some("ops".into()),
            device_profile: Some("linux".into()),
            enabled: true,
            labels: vec!["edge".into()],
            vars,
            groups: groups.into_iter().map(|item| item.to_string()).collect(),
            password: None,
            password_ref: None,
            enable_password: None,
            enable_password_ref: None,
            ssh_security: None,
            template_dir: None,
        }
    }

    #[test]
    fn resolves_group_connection_and_runtime_vars_in_order() -> Result<()> {
        let _env_guard = TestEnvGuard::new()?;
        db::init_sync()?;
        save_connection(
            "edge-01",
            &sample_connection("10.0.0.1", vec!["core"], json!({"mode":"root","site":"shanghai"})),
        )?;
        super::upsert_group(
            "core",
            &InventoryGroup {
                name: "core".into(),
                description: None,
                vars: json!({"region":"cn","mode":"config"}),
                hosts: vec!["edge-01".into()],
            },
        )?;

        let resolved = resolve_vars(
            Some("edge-01"),
            &[],
            json!({"ticket":"CHG-1","mode":"override"}),
        )?;
        assert_eq!(resolved.group_names, vec!["core"]);
        assert_eq!(
            resolved.merged_vars,
            json!({"region":"cn","mode":"override","site":"shanghai","ticket":"CHG-1"})
        );
        Ok(())
    }

    #[test]
    fn inventory_group_crud_roundtrip() -> Result<()> {
        let _env_guard = TestEnvGuard::new()?;
        db::init_sync()?;
        save_connection(
            "edge-01",
            &sample_connection("10.0.0.1", vec![], json!({"site":"a"})),
        )?;
        save_connection(
            "edge-02",
            &sample_connection("10.0.0.2", vec![], json!({"site":"b"})),
        )?;

        super::upsert_group(
            "access",
            &InventoryGroup {
                name: "access".into(),
                description: Some("access layer".into()),
                vars: json!({"role":"access"}),
                hosts: vec!["edge-02".into(), "edge-01".into()],
            },
        )?;

        let all = list_groups()?;
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].name, "access");
        assert_eq!(all[0].hosts, vec!["edge-01", "edge-02"]);

        let one = get_group("access")?.expect("group should exist");
        assert_eq!(one.description.as_deref(), Some("access layer"));
        assert_eq!(one.vars, json!({"role":"access"}));
        assert_eq!(one.hosts, vec!["edge-01", "edge-02"]);

        assert!(super::delete_group("access")?);
        assert!(get_group("access")?.is_none());
        Ok(())
    }

    #[test]
    fn upsert_group_rejects_unknown_saved_connection() -> Result<()> {
        let _env_guard = TestEnvGuard::new()?;
        db::init_sync()?;

        let err = super::upsert_group(
            "core",
            &InventoryGroup {
                name: "core".into(),
                description: None,
                vars: json!({}),
                hosts: vec!["missing-conn".into()],
            },
        )
        .expect_err("should reject missing saved connection");
        assert!(
            err.to_string()
                .contains("saved connection 'missing-conn' not found")
        );

        Ok(())
    }

    #[test]
    fn resolve_vars_rejects_unknown_group() -> Result<()> {
        let _env_guard = TestEnvGuard::new()?;
        db::init_sync()?;
        save_connection(
            "edge-01",
            &sample_connection("10.0.0.1", vec![], json!({"site":"a"})),
        )?;

        let err = resolve_vars(Some("edge-01"), &["missing".into()], json!({}))
            .expect_err("unknown group should fail");
        assert!(err.to_string().contains("inventory group 'missing' not found"));
        Ok(())
    }
}
