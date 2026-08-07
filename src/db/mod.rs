use crate::config::paths::default_db_path;
use anyhow::{Context, Result};
use sqlx::SqlitePool;
use sqlx::migrate::Migrator;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
#[cfg(test)]
use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::path::PathBuf;
#[cfg(test)]
use std::sync::Mutex as StdMutex;
use std::sync::OnceLock;
#[cfg(not(test))]
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tokio::sync::Mutex;

#[cfg(test)]
mod device_credentials_migration;

#[cfg(test)]
thread_local! {
    static TEST_DB_PATH_OVERRIDE: std::cell::RefCell<Option<PathBuf>> = const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
pub(crate) struct TestDbPathGuard {
    previous: Option<PathBuf>,
    _not_send: std::marker::PhantomData<std::rc::Rc<()>>,
}

#[cfg(test)]
pub(crate) fn set_test_db_path_for_current_thread(path: PathBuf) {
    TEST_DB_PATH_OVERRIDE.with(|value| *value.borrow_mut() = Some(path));
}

#[cfg(test)]
pub(crate) fn override_test_db_path(path: PathBuf) -> TestDbPathGuard {
    let previous = TEST_DB_PATH_OVERRIDE.with(|value| value.replace(Some(path)));
    TestDbPathGuard {
        previous,
        _not_send: std::marker::PhantomData,
    }
}

#[cfg(test)]
impl Drop for TestDbPathGuard {
    fn drop(&mut self) {
        TEST_DB_PATH_OVERRIDE.with(|value| *value.borrow_mut() = self.previous.take());
    }
}

#[cfg(not(test))]
static DB_POOL: OnceLock<SqlitePool> = OnceLock::new();
#[cfg(not(test))]
static DB_PATH: OnceLock<PathBuf> = OnceLock::new();
static MIGRATOR: Migrator = sqlx::migrate!("./migrations");
const _: &str = include_str!("../../migrations/202607240001_device_credentials.sql");
const _: &str = include_str!("../../migrations/202607260001_enable_stage.sql");
const _: &str = include_str!("../../migrations/202607260002_config_command_overrides.sql");
const _: &str = include_str!("../../migrations/202607260003_config_volatile_patterns.sql");
const _: &str = include_str!("../../migrations/202607270001_ssh_auth_methods.sql");
const _: &str = include_str!("../../migrations/202608060001_device_discovery.sql");
#[cfg(not(test))]
static DB_MIGRATED: AtomicBool = AtomicBool::new(false);
#[cfg(test)]
static TEST_DB_POOLS: OnceLock<StdMutex<HashMap<PathBuf, &'static SqlitePool>>> = OnceLock::new();
#[cfg(test)]
static TEST_DB_MIGRATED: OnceLock<StdMutex<HashSet<PathBuf>>> = OnceLock::new();
static DB_MIGRATE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn connect_options(path: &PathBuf) -> SqliteConnectOptions {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(30))
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
}

#[cfg(not(test))]
pub fn pool() -> &'static SqlitePool {
    DB_POOL.get_or_init(|| {
        let path = db_path();
        SqlitePoolOptions::new()
            .max_connections(5)
            .connect_lazy_with(connect_options(&path))
    })
}

#[cfg(test)]
pub(crate) async fn close_test_db(path: &std::path::Path) {
    let pool = TEST_DB_POOLS.get().and_then(|pools| {
        pools
            .lock()
            .expect("test db pool lock poisoned")
            .remove(path)
    });
    if let Some(pool) = pool {
        pool.close().await;
    }
    if let Some(migrated) = TEST_DB_MIGRATED.get() {
        migrated
            .lock()
            .expect("test db migrated lock poisoned")
            .remove(path);
    }
}

#[cfg(test)]
pub fn pool() -> &'static SqlitePool {
    let path = db_path();
    let pools = TEST_DB_POOLS.get_or_init(|| StdMutex::new(HashMap::new()));
    let mut guard = pools.lock().expect("test db pool lock poisoned");
    if let Some(pool) = guard.get(&path) {
        return pool;
    }
    let pool = Box::leak(Box::new(
        SqlitePoolOptions::new()
            .max_connections(5)
            .connect_lazy_with(connect_options(&path)),
    ));
    guard.insert(path, pool);
    pool
}

#[cfg(not(test))]
pub fn db_path() -> std::path::PathBuf {
    DB_PATH.get_or_init(default_db_path).clone()
}

#[cfg(test)]
pub fn db_path() -> std::path::PathBuf {
    TEST_DB_PATH_OVERRIDE.with(|value| value.borrow().clone().unwrap_or_else(default_db_path))
}

pub fn init_sync() -> Result<()> {
    #[cfg(test)]
    TEST_DB_PATH_OVERRIDE.with(|value| {
        if value.borrow().is_none() {
            *value.borrow_mut() = Some(default_db_path());
        }
    });
    run_sync(async {
        init().await?;
        Ok(())
    })
}

#[cfg(not(test))]
pub async fn init() -> Result<()> {
    if DB_MIGRATED.load(Ordering::Acquire) {
        return Ok(());
    }
    let _guard = DB_MIGRATE_LOCK.get_or_init(|| Mutex::new(())).lock().await;
    if DB_MIGRATED.load(Ordering::Acquire) {
        return Ok(());
    }
    let pool = pool();
    MIGRATOR.run(pool).await?;
    DB_MIGRATED.store(true, Ordering::Release);
    Ok(())
}

#[cfg(test)]
pub async fn init() -> Result<()> {
    let path = db_path();
    if TEST_DB_MIGRATED
        .get_or_init(|| StdMutex::new(HashSet::new()))
        .lock()
        .expect("test db migrated lock poisoned")
        .contains(&path)
    {
        return Ok(());
    }
    let _guard = DB_MIGRATE_LOCK.get_or_init(|| Mutex::new(())).lock().await;
    if TEST_DB_MIGRATED
        .get_or_init(|| StdMutex::new(HashSet::new()))
        .lock()
        .expect("test db migrated lock poisoned")
        .contains(&path)
    {
        return Ok(());
    }
    let pool = pool();
    MIGRATOR.run(pool).await?;
    TEST_DB_MIGRATED
        .get_or_init(|| StdMutex::new(HashSet::new()))
        .lock()
        .expect("test db migrated lock poisoned")
        .insert(path);
    Ok(())
}

pub fn run_sync<T>(future: impl Future<Output = Result<T>>) -> Result<T> {
    if let Ok(handle) = tokio::runtime::Handle::try_current() {
        tokio::task::block_in_place(|| handle.block_on(future))
    } else {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .context("failed to build temporary runtime for sqlite access")?
            .block_on(future)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_path_override_is_scoped() {
        let original = db_path();
        let isolated = std::env::temp_dir().join("rauto-scoped-db-test.db");
        {
            let _guard = override_test_db_path(isolated.clone());
            assert_eq!(db_path(), isolated);
        }
        assert_eq!(db_path(), original);
    }

    #[tokio::test(flavor = "current_thread")]
    async fn sqlite_waits_for_a_transient_write_lock() {
        let path = std::env::temp_dir().join(format!(
            "rauto-sqlite-busy-timeout-{:016x}.db",
            rand::random::<u64>()
        ));
        let guard = override_test_db_path(path.clone());
        init().await.expect("initialize test database");
        sqlx::query("CREATE TABLE busy_timeout_test (value INTEGER NOT NULL)")
            .execute(pool())
            .await
            .expect("create lock test table");

        let mut holder = pool().acquire().await.expect("acquire lock connection");
        sqlx::query("BEGIN IMMEDIATE")
            .execute(&mut *holder)
            .await
            .expect("hold sqlite write lock");

        let waiter_pool = pool().clone();
        let waiter = tokio::spawn(async move {
            sqlx::query("INSERT INTO busy_timeout_test (value) VALUES (1)")
                .execute(&waiter_pool)
                .await
        });
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert!(!waiter.is_finished());
        sqlx::query("COMMIT")
            .execute(&mut *holder)
            .await
            .expect("release sqlite write lock");
        waiter
            .await
            .expect("join waiting sqlite writer")
            .expect("write after transient lock");

        close_test_db(&path).await;
        drop(guard);
        for suffix in ["", "-shm", "-wal"] {
            let _ = std::fs::remove_file(format!("{}{}", path.display(), suffix));
        }
    }
}
