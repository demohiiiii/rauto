use super::MIGRATOR;
use anyhow::Result;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Row, SqlitePool};

async fn initial_database() -> Result<SqlitePool> {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            SqliteConnectOptions::new()
                .in_memory(true)
                .foreign_keys(true),
        )
        .await?;
    MIGRATOR.run(&pool).await?;
    Ok(pool)
}

async fn columns(pool: &SqlitePool, table: &str) -> Result<Vec<String>> {
    Ok(
        sqlx::query("SELECT name FROM pragma_table_info(?) ORDER BY cid")
            .bind(table)
            .fetch_all(pool)
            .await?
            .into_iter()
            .map(|row| row.get("name"))
            .collect(),
    )
}

#[tokio::test]
async fn initial_schema_stores_authentication_only_in_device_credentials() -> Result<()> {
    let pool = initial_database().await?;
    let credential_columns = columns(&pool, "device_credentials").await?;
    let connection_columns = columns(&pool, "connections").await?;
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
    pool.close().await;
    Ok(())
}

#[tokio::test]
async fn initial_migration_reopens_without_changing_templates_or_authentication() -> Result<()> {
    let pool = initial_database().await?;
    let content = "name = 'copy'\ncommand = 'copy source destination'\n";
    sqlx::query("INSERT INTO interactive_templates VALUES ('copy', ?, 1, 2)")
        .bind(content)
        .execute(&pool)
        .await?;
    sqlx::query(
        "INSERT INTO device_credentials (id, name, username, password_ref, created_at_ms, updated_at_ms)
         VALUES ('credential', 'network', 'test-user', 'opaque-secret-reference', 1, 2)",
    ).execute(&pool).await?;
    MIGRATOR.run(&pool).await?;
    let applied = sqlx::query("SELECT version, checksum, success FROM _sqlx_migrations")
        .fetch_all(&pool)
        .await?;
    assert_eq!(applied.len(), 2);
    assert_eq!(applied[0].get::<i64, _>("version"), 202609220001);
    assert_eq!(applied[1].get::<i64, _>("version"), 202609231900);
    assert!(applied[0].get::<bool, _>("success"));
    assert_eq!(
        applied[0].get::<Vec<u8>, _>("checksum"),
        MIGRATOR
            .iter()
            .next()
            .expect("initial migration")
            .checksum
            .as_ref(),
    );
    let saved: String =
        sqlx::query_scalar("SELECT content FROM interactive_templates WHERE name = 'copy'")
            .fetch_one(&pool)
            .await?;
    assert_eq!(saved, content);
    let secret: String =
        sqlx::query_scalar("SELECT password_ref FROM device_credentials WHERE id = 'credential'")
            .fetch_one(&pool)
            .await?;
    assert_eq!(secret, "opaque-secret-reference");
    assert!(columns(&pool, "command_flow_templates").await?.is_empty());
    assert!(
        sqlx::query("INSERT INTO interactive_templates VALUES ('copy', '', 3, 4)")
            .execute(&pool)
            .await
            .is_err(),
        "template names must stay unique"
    );
    pool.close().await;
    Ok(())
}

#[tokio::test]
async fn initial_schema_enforces_connection_defaults_foreign_keys_and_membership() -> Result<()> {
    let pool = initial_database().await?;
    sqlx::query(
        "INSERT INTO connections (name, created_at_ms, updated_at_ms) VALUES ('edge', 1, 1)",
    )
    .execute(&pool)
    .await?;
    let connection = sqlx::query("SELECT enabled, labels_json, vars_json, output_encoding FROM connections WHERE name = 'edge'")
        .fetch_one(&pool).await?;
    assert!(connection.get::<bool, _>("enabled"));
    assert_eq!(connection.get::<String, _>("labels_json"), "[]");
    assert_eq!(connection.get::<String, _>("vars_json"), "{}");
    assert_eq!(connection.get::<String, _>("output_encoding"), "utf8");
    assert!(
        sqlx::query("UPDATE connections SET output_encoding = 'invalid'")
            .execute(&pool)
            .await
            .is_err()
    );
    assert!(
        sqlx::query("UPDATE connections SET credential_id = 'missing'")
            .execute(&pool)
            .await
            .is_err()
    );
    sqlx::query("INSERT INTO inventory_groups VALUES ('site', NULL, 1, 1)")
        .execute(&pool)
        .await?;
    sqlx::query("INSERT INTO inventory_group_members VALUES ('site', 'edge', 1)")
        .execute(&pool)
        .await?;
    assert!(
        sqlx::query("INSERT INTO inventory_group_members VALUES ('site', 'edge', 2)")
            .execute(&pool)
            .await
            .is_err()
    );
    sqlx::query("DELETE FROM connections WHERE name = 'edge'")
        .execute(&pool)
        .await?;
    let members: i64 = sqlx::query_scalar("SELECT count(*) FROM inventory_group_members")
        .fetch_one(&pool)
        .await?;
    assert_eq!(members, 0);
    assert!(
        sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&pool)
            .await?
            .is_empty()
    );
    pool.close().await;
    Ok(())
}

#[tokio::test]
async fn initial_config_history_keeps_raw_content_unique_and_referenced() -> Result<()> {
    let pool = initial_database().await?;
    for table in ["device_config_contents", "device_config_snapshots"] {
        assert!(
            columns(&pool, table)
                .await?
                .iter()
                .all(|name| !name.starts_with("normalized_"))
        );
    }
    sqlx::query("INSERT INTO device_config_contents VALUES ('content', 'edge', 'running', 'raw config', 'hash', 10)")
        .execute(&pool).await?;
    assert!(sqlx::query("INSERT INTO device_config_contents VALUES ('duplicate', 'edge', 'running', 'raw config', 'hash', 10)")
        .execute(&pool).await.is_err());
    sqlx::query("INSERT INTO device_config_snapshots (id, connection_name, host, device_profile, kind, command, source, fetched_at_ms, content_id)
        VALUES ('snapshot', 'edge', '192.0.2.1', 'linux', 'running', 'cat config', 'test', 1, 'content')")
        .execute(&pool).await?;
    assert!(
        sqlx::query("DELETE FROM device_config_contents WHERE id = 'content'")
            .execute(&pool)
            .await
            .is_err()
    );
    pool.close().await;
    Ok(())
}
