use super::*;
use anyhow::Result;
use sqlx::Row;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

struct TestDbGuard {
    original_home: Option<std::ffi::OsString>,
    _root: PathBuf,
}

impl TestDbGuard {
    fn new() -> Result<Self> {
        let root = std::env::temp_dir().join(format!(
            "rauto-device-credentials-migration-{}",
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

impl Drop for TestDbGuard {
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
fn final_schema_stores_authentication_only_in_device_credentials() -> Result<()> {
    let _guard = TestDbGuard::new()?;
    init_sync()?;

    let (credential_columns, connection_columns) = run_sync(async {
        let credential_rows = sqlx::query("PRAGMA table_info(device_credentials)")
            .fetch_all(pool())
            .await?;
        let connection_rows = sqlx::query("PRAGMA table_info(connections)")
            .fetch_all(pool())
            .await?;
        Ok((
            credential_rows
                .into_iter()
                .map(|row| row.get::<String, _>("name"))
                .collect::<Vec<_>>(),
            connection_rows
                .into_iter()
                .map(|row| row.get::<String, _>("name"))
                .collect::<Vec<_>>(),
        ))
    })?;

    assert_eq!(
        credential_columns,
        vec![
            "id",
            "name",
            "username",
            "password_ref",
            "enable_password_ref",
            "created_at_ms",
            "updated_at_ms",
            "enable_enabled",
            "auth_type",
            "auth_metadata_json",
        ]
    );
    assert!(connection_columns.contains(&"credential_id".to_string()));
    for removed in [
        "username",
        "password_ref",
        "enable_password_ref",
        "enable_password_empty_enter",
    ] {
        assert!(!connection_columns.contains(&removed.to_string()));
    }
    Ok(())
}
