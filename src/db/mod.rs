use crate::config::paths::default_db_path;
use anyhow::{Context, Result};
use sqlx::SqlitePool;
use sqlx::migrate::Migrator;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
#[cfg(test)]
use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::path::PathBuf;
#[cfg(test)]
use std::sync::Mutex as StdMutex;
use std::sync::OnceLock;
#[cfg(not(test))]
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Mutex;

#[cfg(test)]
thread_local! {
    static TEST_DB_PATH_OVERRIDE: std::cell::RefCell<Option<PathBuf>> = const { std::cell::RefCell::new(None) };
}

#[cfg(not(test))]
static DB_POOL: OnceLock<SqlitePool> = OnceLock::new();
#[cfg(not(test))]
static DB_PATH: OnceLock<PathBuf> = OnceLock::new();
static MIGRATOR: Migrator = sqlx::migrate!("./migrations");
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
