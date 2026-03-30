use crate::config::paths::default_db_path;
use anyhow::{Context, Result};
use sqlx::SqlitePool;
use sqlx::migrate::Migrator;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::future::Future;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Mutex;

static DB_POOL: OnceLock<SqlitePool> = OnceLock::new();
static DB_PATH: OnceLock<PathBuf> = OnceLock::new();
static MIGRATOR: Migrator = sqlx::migrate!("./migrations");
static DB_MIGRATED: AtomicBool = AtomicBool::new(false);
static DB_MIGRATE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

pub fn pool() -> &'static SqlitePool {
    DB_POOL.get_or_init(|| {
        let path = db_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let options = SqliteConnectOptions::from_str(&format!("sqlite://{}", path.display()))
            .expect("invalid sqlite path")
            .create_if_missing(true)
            .foreign_keys(true);
        SqlitePoolOptions::new()
            .max_connections(5)
            .connect_lazy_with(options)
    })
}

pub fn db_path() -> std::path::PathBuf {
    DB_PATH.get_or_init(default_db_path).clone()
}

pub fn init_sync() -> Result<()> {
    run_sync(async {
        init().await?;
        Ok(())
    })
}

pub async fn init() -> Result<()> {
    if DB_MIGRATED.load(Ordering::Acquire) {
        return Ok(());
    }
    let _guard = DB_MIGRATE_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .await;
    if DB_MIGRATED.load(Ordering::Acquire) {
        return Ok(());
    }
    let pool = pool();
    MIGRATOR.run(pool).await?;
    DB_MIGRATED.store(true, Ordering::Release);
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
