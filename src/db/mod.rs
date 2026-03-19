use crate::config::paths::default_db_path;
use anyhow::{Context, Result};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Executor, Row, SqlitePool};
use std::future::Future;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::OnceLock;

static DB_POOL: OnceLock<SqlitePool> = OnceLock::new();
static DB_PATH: OnceLock<PathBuf> = OnceLock::new();

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
    let pool = pool();

    pool.execute(
        r#"
        CREATE TABLE IF NOT EXISTS connections (
            name TEXT PRIMARY KEY,
            host TEXT,
            username TEXT,
            password_encrypted TEXT,
            port INTEGER,
            enable_password_encrypted TEXT,
            ssh_security TEXT,
            device_profile TEXT,
            template_dir TEXT,
            created_at_ms INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL
        )
        "#,
    )
    .await?;
    ensure_column(pool, "connections", "password_encrypted", "TEXT").await?;
    ensure_column(pool, "connections", "enable_password_encrypted", "TEXT").await?;

    pool.execute(
        r#"
        CREATE TABLE IF NOT EXISTS history_entries (
            id TEXT PRIMARY KEY,
            ts_ms INTEGER NOT NULL,
            connection_key TEXT NOT NULL,
            connection_name TEXT,
            host TEXT NOT NULL,
            port INTEGER NOT NULL,
            username TEXT NOT NULL,
            device_profile TEXT NOT NULL,
            operation TEXT NOT NULL,
            command_label TEXT NOT NULL,
            mode TEXT,
            record_level TEXT NOT NULL,
            record_path TEXT NOT NULL,
            record_jsonl TEXT NOT NULL DEFAULT ''
        )
        "#,
    )
    .await?;
    ensure_column(
        pool,
        "history_entries",
        "record_jsonl",
        "TEXT NOT NULL DEFAULT ''",
    )
    .await?;
    pool.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_connection_key_ts ON history_entries(connection_key, ts_ms DESC)",
    )
    .await?;

    pool.execute(
        r#"
        CREATE TABLE IF NOT EXISTS blacklist_patterns (
            pattern TEXT PRIMARY KEY,
            normalized_pattern TEXT NOT NULL UNIQUE,
            created_at_ms INTEGER NOT NULL
        )
        "#,
    )
    .await?;

    pool.execute(
        r#"
        CREATE TABLE IF NOT EXISTS custom_profiles (
            name TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            created_at_ms INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL
        )
        "#,
    )
    .await?;

    pool.execute(
        r#"
        CREATE TABLE IF NOT EXISTS command_templates (
            name TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            created_at_ms INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL
        )
        "#,
    )
    .await?;

    Ok(())
}

async fn ensure_column(
    pool: &SqlitePool,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<()> {
    let pragma = format!("PRAGMA table_info({})", table);
    let rows = sqlx::query(&pragma).fetch_all(pool).await?;
    let exists = rows.into_iter().any(|row| {
        row.try_get::<String, _>("name")
            .map(|name| name == column)
            .unwrap_or(false)
    });
    if exists {
        return Ok(());
    }

    let alter = format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, definition);
    pool.execute(alter.as_str()).await?;
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
