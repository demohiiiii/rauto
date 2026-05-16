use crate::db;
use anyhow::{Result, anyhow};
use sqlx::Row;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn load_cached_profile(host: &str, port: u16) -> Result<Option<String>> {
    let normalized_host = normalize_host(host)?;
    db::run_sync(async move {
        let row = sqlx::query(
            r#"
            SELECT device_profile
            FROM autodetect_profile_cache
            WHERE host = ? AND port = ?
            "#,
        )
        .bind(&normalized_host)
        .bind(port as i64)
        .fetch_optional(db::pool())
        .await?;
        Ok(row.map(|row| row.get::<String, _>("device_profile")))
    })
}

pub fn save_cached_profile(host: &str, port: u16, device_profile: &str) -> Result<()> {
    let normalized_host = normalize_host(host)?;
    let normalized_profile = normalize_profile(device_profile)?;
    let now_ms = now_ms()?;
    db::run_sync(async move {
        let created_at_ms = sqlx::query_scalar::<_, i64>(
            "SELECT created_at_ms FROM autodetect_profile_cache WHERE host = ? AND port = ?",
        )
        .bind(&normalized_host)
        .bind(port as i64)
        .fetch_optional(db::pool())
        .await?
        .unwrap_or(now_ms);

        sqlx::query(
            r#"
            INSERT INTO autodetect_profile_cache (
                host, port, device_profile, created_at_ms, updated_at_ms
            ) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(host, port) DO UPDATE SET
                device_profile = excluded.device_profile,
                updated_at_ms = excluded.updated_at_ms
            "#,
        )
        .bind(&normalized_host)
        .bind(port as i64)
        .bind(&normalized_profile)
        .bind(created_at_ms)
        .bind(now_ms)
        .execute(db::pool())
        .await?;
        Ok(())
    })
}

fn normalize_host(raw: &str) -> Result<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("autodetect cache host is required"));
    }
    Ok(trimmed.to_ascii_lowercase())
}

fn normalize_profile(raw: &str) -> Result<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("autodetect cache device_profile is required"));
    }
    Ok(trimmed.to_string())
}

fn now_ms() -> Result<i64> {
    Ok(SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis() as i64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    static TEST_ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    struct TestEnvGuard {
        original_home: Option<std::ffi::OsString>,
        _root: std::path::PathBuf,
        _guard: std::sync::MutexGuard<'static, ()>,
    }

    impl TestEnvGuard {
        fn new() -> Result<Self> {
            let guard = TEST_ENV_LOCK
                .get_or_init(|| Mutex::new(()))
                .lock()
                .expect("test env lock poisoned");
            let root = std::env::temp_dir().join(format!(
                "rauto-autodetect-cache-test-{}",
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
    fn cache_roundtrip_uses_host_port_key() -> Result<()> {
        let _env_guard = TestEnvGuard::new()?;
        db::init_sync()?;

        assert_eq!(load_cached_profile("192.0.2.10", 22)?, None);
        save_cached_profile("192.0.2.10", 22, "cisco")?;
        assert_eq!(
            load_cached_profile("192.0.2.10", 22)?.as_deref(),
            Some("cisco")
        );
        assert_eq!(load_cached_profile("192.0.2.10", 23)?, None);
        Ok(())
    }

    #[test]
    fn cache_normalizes_host_case() -> Result<()> {
        let _env_guard = TestEnvGuard::new()?;
        db::init_sync()?;

        save_cached_profile("EDGE-A.EXAMPLE.COM", 2222, "huawei")?;
        assert_eq!(
            load_cached_profile("edge-a.example.com", 2222)?.as_deref(),
            Some("huawei")
        );
        Ok(())
    }
}
