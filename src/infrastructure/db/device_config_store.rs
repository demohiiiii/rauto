use crate::domain::device::{
    DeviceConfigHistoryDevice, DeviceConfigSnapshot, DeviceConfigSnapshotSortOrder,
    DeviceConfigSnapshotSummary, NewDeviceConfigSnapshot,
};
use crate::infrastructure::db;
use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};
use sqlx::Row;

pub async fn save_snapshot(
    input: NewDeviceConfigSnapshot<'_>,
) -> Result<DeviceConfigSnapshotSummary> {
    let mut transaction = db::pool().begin_with("BEGIN IMMEDIATE").await?;
    let previous = sqlx::query(
        r#"
        SELECT snapshots.id, snapshots.content_id, contents.sha256
        FROM device_config_snapshots AS snapshots
        JOIN device_config_contents AS contents ON contents.id = snapshots.content_id
        WHERE snapshots.connection_name = ? AND snapshots.kind = ?
        ORDER BY snapshots.fetched_at_ms DESC, snapshots.rowid DESC
        LIMIT 1
        "#,
    )
    .bind(input.connection_name)
    .bind(input.kind)
    .fetch_optional(&mut *transaction)
    .await?;
    let previous_snapshot_id = previous.as_ref().map(|row| row.get::<String, _>("id"));
    let changed_from_previous = previous
        .as_ref()
        .map(|row| row.get::<String, _>("sha256") != input.sha256);
    let content_id = match previous
        .as_ref()
        .filter(|row| row.get::<String, _>("sha256") == input.sha256)
    {
        Some(row) => row.get::<String, _>("content_id"),
        None => save_content(&mut transaction, &input).await?,
    };
    let id = format!("config-{:016x}", rand::random::<u64>());
    let content_size_bytes = input.content.len() as u64;

    sqlx::query(
        r#"
        INSERT INTO device_config_snapshots (
            id, connection_name, host, device_profile, kind, command, source,
            task_id, fetched_at_ms, content_id, previous_snapshot_id, changed_from_previous
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(input.connection_name)
    .bind(input.host)
    .bind(input.profile)
    .bind(input.kind)
    .bind(input.command)
    .bind(input.source)
    .bind(input.task_id)
    .bind(input.fetched_at_ms)
    .bind(content_id)
    .bind(&previous_snapshot_id)
    .bind(changed_from_previous)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;

    Ok(DeviceConfigSnapshotSummary {
        id,
        connection_name: input.connection_name.to_string(),
        host: input.host.to_string(),
        profile: input.profile.to_string(),
        kind: input.kind.to_string(),
        command: input.command.to_string(),
        source: input.source.to_string(),
        task_id: input.task_id.map(ToOwned::to_owned),
        fetched_at: timestamp_ms_to_rfc3339(input.fetched_at_ms),
        sha256: input.sha256.to_string(),
        content_size_bytes,
        previous_snapshot_id,
        changed_from_previous,
    })
}

async fn save_content(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    input: &NewDeviceConfigSnapshot<'_>,
) -> Result<String> {
    let id = format!("config-content-{:016x}", rand::random::<u64>());
    sqlx::query(
        r#"
        INSERT INTO device_config_contents (
            id, connection_name, kind, content, sha256, content_size_bytes
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(connection_name, kind, sha256) DO NOTHING
        "#,
    )
    .bind(&id)
    .bind(input.connection_name)
    .bind(input.kind)
    .bind(input.content)
    .bind(input.sha256)
    .bind(input.content.len() as i64)
    .execute(&mut **transaction)
    .await?;

    sqlx::query_scalar(
        r#"
        SELECT id
        FROM device_config_contents
        WHERE connection_name = ? AND kind = ? AND sha256 = ?
        "#,
    )
    .bind(input.connection_name)
    .bind(input.kind)
    .bind(input.sha256)
    .fetch_one(&mut **transaction)
    .await
    .map_err(Into::into)
}

pub async fn list_snapshots(
    connection_name: Option<&str>,
    kind: Option<&str>,
    fetched_from_ms: Option<i64>,
    fetched_to_ms: Option<i64>,
    sort_order: DeviceConfigSnapshotSortOrder,
    limit: usize,
) -> Result<Vec<DeviceConfigSnapshotSummary>> {
    let connection_name = normalized_filter(connection_name);
    let kind = normalized_filter(kind);
    let statement = match sort_order {
        DeviceConfigSnapshotSortOrder::Ascending => {
            r#"
        SELECT snapshots.id, snapshots.connection_name, snapshots.host,
               snapshots.device_profile, snapshots.kind, snapshots.command,
               snapshots.source, snapshots.task_id, snapshots.fetched_at_ms,
               contents.sha256, contents.content_size_bytes,
               snapshots.previous_snapshot_id, snapshots.changed_from_previous
        FROM device_config_snapshots AS snapshots
        JOIN device_config_contents AS contents ON contents.id = snapshots.content_id
        WHERE (? IS NULL OR snapshots.connection_name = ?)
          AND (? IS NULL OR snapshots.kind = ?)
          AND (? IS NULL OR snapshots.fetched_at_ms >= ?)
          AND (? IS NULL OR snapshots.fetched_at_ms <= ?)
        ORDER BY snapshots.fetched_at_ms ASC, snapshots.rowid ASC
        LIMIT ?
        "#
        }
        DeviceConfigSnapshotSortOrder::Descending => {
            r#"
        SELECT snapshots.id, snapshots.connection_name, snapshots.host,
               snapshots.device_profile, snapshots.kind, snapshots.command,
               snapshots.source, snapshots.task_id, snapshots.fetched_at_ms,
               contents.sha256, contents.content_size_bytes,
               snapshots.previous_snapshot_id, snapshots.changed_from_previous
        FROM device_config_snapshots AS snapshots
        JOIN device_config_contents AS contents ON contents.id = snapshots.content_id
        WHERE (? IS NULL OR snapshots.connection_name = ?)
          AND (? IS NULL OR snapshots.kind = ?)
          AND (? IS NULL OR snapshots.fetched_at_ms >= ?)
          AND (? IS NULL OR snapshots.fetched_at_ms <= ?)
        ORDER BY snapshots.fetched_at_ms DESC, snapshots.rowid DESC
        LIMIT ?
        "#
        }
    };
    let rows = sqlx::query(statement)
        .bind(connection_name.as_deref())
        .bind(connection_name.as_deref())
        .bind(kind.as_deref())
        .bind(kind.as_deref())
        .bind(fetched_from_ms)
        .bind(fetched_from_ms)
        .bind(fetched_to_ms)
        .bind(fetched_to_ms)
        .bind(limit.clamp(1, 500) as i64)
        .fetch_all(db::pool())
        .await?;
    rows.into_iter().map(row_to_summary).collect()
}

pub async fn get_snapshot(id: &str) -> Result<Option<DeviceConfigSnapshot>> {
    let row = sqlx::query(
        r#"
        SELECT snapshots.id, snapshots.connection_name, snapshots.host,
               snapshots.device_profile, snapshots.kind, snapshots.command,
               snapshots.source, snapshots.task_id, snapshots.fetched_at_ms,
               contents.sha256, contents.content_size_bytes,
               snapshots.previous_snapshot_id, snapshots.changed_from_previous,
               contents.content
        FROM device_config_snapshots AS snapshots
        JOIN device_config_contents AS contents ON contents.id = snapshots.content_id
        WHERE snapshots.id = ?
        "#,
    )
    .bind(id.trim())
    .fetch_optional(db::pool())
    .await?;
    row.map(|row| {
        let content = row.get("content");
        Ok(DeviceConfigSnapshot {
            summary: row_to_summary(row)?,
            content,
        })
    })
    .transpose()
}

pub async fn delete_snapshot(id: &str) -> Result<bool> {
    let mut transaction = db::pool().begin_with("BEGIN IMMEDIATE").await?;
    let content_id = sqlx::query_scalar::<_, String>(
        "SELECT content_id FROM device_config_snapshots WHERE id = ?",
    )
    .bind(id.trim())
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(content_id) = content_id else {
        transaction.commit().await?;
        return Ok(false);
    };
    sqlx::query("DELETE FROM device_config_snapshots WHERE id = ?")
        .bind(id.trim())
        .execute(&mut *transaction)
        .await?;
    sqlx::query(
        r#"
        DELETE FROM device_config_contents
        WHERE id = ?
          AND NOT EXISTS (
              SELECT 1 FROM device_config_snapshots WHERE content_id = ?
          )
        "#,
    )
    .bind(&content_id)
    .bind(&content_id)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(true)
}

pub async fn list_connection_names() -> Result<Vec<String>> {
    let rows = sqlx::query_scalar::<_, String>(
        "SELECT DISTINCT connection_name FROM device_config_snapshots ORDER BY connection_name COLLATE NOCASE ASC",
    )
    .fetch_all(db::pool())
    .await?;
    Ok(rows)
}

pub async fn list_history_devices() -> Result<Vec<DeviceConfigHistoryDevice>> {
    let rows = sqlx::query(
        r#"
        SELECT connection_name, host, device_profile
        FROM (
            SELECT connection_name, host, device_profile,
                   ROW_NUMBER() OVER (
                       PARTITION BY connection_name
                       ORDER BY fetched_at_ms DESC, rowid DESC
                   ) AS history_rank
            FROM device_config_snapshots
        )
        WHERE history_rank = 1
        ORDER BY connection_name COLLATE NOCASE ASC
        "#,
    )
    .fetch_all(db::pool())
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| DeviceConfigHistoryDevice {
            name: row.get("connection_name"),
            host: row.get("host"),
            device_profile: row.get("device_profile"),
        })
        .collect())
}

pub async fn list_kinds() -> Result<Vec<String>> {
    let rows = sqlx::query_scalar::<_, String>(
        "SELECT DISTINCT kind FROM device_config_snapshots ORDER BY kind COLLATE NOCASE ASC",
    )
    .fetch_all(db::pool())
    .await?;
    Ok(rows)
}

fn row_to_summary(row: sqlx::sqlite::SqliteRow) -> Result<DeviceConfigSnapshotSummary> {
    let content_size_bytes = row.get::<i64, _>("content_size_bytes");
    if content_size_bytes < 0 {
        return Err(anyhow!(
            "device config snapshot has a negative content size"
        ));
    }
    Ok(DeviceConfigSnapshotSummary {
        id: row.get("id"),
        connection_name: row.get("connection_name"),
        host: row.get("host"),
        profile: row.get("device_profile"),
        kind: row.get("kind"),
        command: row.get("command"),
        source: row.get("source"),
        task_id: row.get("task_id"),
        fetched_at: timestamp_ms_to_rfc3339(row.get("fetched_at_ms")),
        sha256: row.get("sha256"),
        content_size_bytes: content_size_bytes as u64,
        previous_snapshot_id: row.get("previous_snapshot_id"),
        changed_from_previous: row.get("changed_from_previous"),
    })
}

fn normalized_filter(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn timestamp_ms_to_rfc3339(value: i64) -> String {
    DateTime::<Utc>::from_timestamp_millis(value)
        .unwrap_or(DateTime::<Utc>::UNIX_EPOCH)
        .to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};

    async fn setup_test_db(test_name: &str) -> (db::TestDbPathGuard, PathBuf) {
        let path = std::env::temp_dir().join(format!(
            "rauto-device-config-{test_name}-{:016x}.db",
            rand::random::<u64>()
        ));
        let guard = db::override_test_db_path(path.clone());
        db::init()
            .await
            .expect("initialize device config test database");
        (guard, path)
    }

    async fn cleanup_test_db(guard: db::TestDbPathGuard, path: &Path) {
        db::close_test_db(path).await;
        drop(guard);
        for suffix in ["", "-shm", "-wal"] {
            let _ = std::fs::remove_file(format!("{}{}", path.display(), suffix));
        }
    }

    async fn save_test_snapshot(fetched_at_ms: i64, content: &str) -> DeviceConfigSnapshotSummary {
        let sha256 = crate::domain::device::sha256_hex(content);
        save_snapshot(NewDeviceConfigSnapshot {
            connection_name: "edge-1",
            host: "192.0.2.10",
            profile: "cisco_ios",
            kind: "running",
            command: "show running-config",
            source: "cron",
            task_id: Some("task-1"),
            fetched_at_ms,
            content,
            sha256: &sha256,
        })
        .await
        .expect("save device config snapshot")
    }

    #[tokio::test(flavor = "current_thread")]
    async fn snapshots_record_every_fetch_without_duplicating_content() {
        let (guard, path) = setup_test_db("versions").await;
        let baseline = save_test_snapshot(1_700_000_000_000, "hostname edge\n").await;
        assert_eq!(baseline.changed_from_previous, None);
        assert_eq!(baseline.previous_snapshot_id, None);

        let unchanged = save_test_snapshot(1_700_000_001_000, "hostname edge\n").await;
        assert_ne!(unchanged.id, baseline.id);
        assert_eq!(unchanged.changed_from_previous, Some(false));
        assert_eq!(
            unchanged.previous_snapshot_id.as_deref(),
            Some(&*baseline.id)
        );

        let changed = save_test_snapshot(1_700_000_002_000, "hostname edge\ninterface Gi1\n").await;
        assert_eq!(changed.changed_from_previous, Some(true));
        assert_eq!(
            changed.previous_snapshot_id.as_deref(),
            Some(&*unchanged.id)
        );

        let content_count =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM device_config_contents")
                .fetch_one(db::pool())
                .await
                .expect("count stored configuration contents");
        assert_eq!(content_count, 2);

        let rows = list_snapshots(
            Some("edge-1"),
            Some("running"),
            None,
            None,
            DeviceConfigSnapshotSortOrder::Descending,
            10,
        )
        .await
        .expect("list snapshots");
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].id, changed.id);

        let filtered = list_snapshots(
            Some("edge-1"),
            Some("running"),
            Some(1_700_000_000_000),
            Some(1_700_000_002_000),
            DeviceConfigSnapshotSortOrder::Ascending,
            10,
        )
        .await
        .expect("list filtered snapshots");
        assert_eq!(
            filtered
                .iter()
                .map(|snapshot| snapshot.id.as_str())
                .collect::<Vec<_>>(),
            vec![
                baseline.id.as_str(),
                unchanged.id.as_str(),
                changed.id.as_str(),
            ]
        );
        let unchanged_detail = get_snapshot(&unchanged.id)
            .await
            .expect("get unchanged snapshot")
            .expect("unchanged snapshot exists");
        assert_eq!(unchanged_detail.content, "hostname edge\n");
        let detail = get_snapshot(&changed.id)
            .await
            .expect("get snapshot")
            .expect("snapshot exists");
        assert!(detail.content.contains("interface Gi1"));
        assert!(delete_snapshot(&changed.id).await.expect("delete snapshot"));
        assert!(
            get_snapshot(&changed.id)
                .await
                .expect("lookup deleted")
                .is_none()
        );
        let content_count =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM device_config_contents")
                .fetch_one(db::pool())
                .await
                .expect("count retained configuration contents");
        assert_eq!(content_count, 1);

        cleanup_test_db(guard, &path).await;
    }

    #[tokio::test(flavor = "current_thread")]
    async fn history_devices_use_the_latest_snapshot_metadata() {
        let (guard, path) = setup_test_db("history-devices").await;
        for (fetched_at_ms, host, profile) in [
            (1_700_000_000_000, "192.0.2.10", "cisco_ios"),
            (1_700_000_001_000, "192.0.2.20", "arista_eos"),
        ] {
            let content = format!("hostname edge\n! {host}\n");
            let sha256 = crate::domain::device::sha256_hex(&content);
            save_snapshot(NewDeviceConfigSnapshot {
                connection_name: "deleted-edge",
                host,
                profile,
                kind: "running",
                command: "show running-config",
                source: "cron",
                task_id: None,
                fetched_at_ms,
                content: &content,
                sha256: &sha256,
            })
            .await
            .expect("save device config snapshot");
        }

        let devices = list_history_devices().await.expect("list history devices");
        assert_eq!(devices.len(), 1);
        assert_eq!(devices[0].name, "deleted-edge");
        assert_eq!(devices[0].host, "192.0.2.20");
        assert_eq!(devices[0].device_profile, "arista_eos");

        cleanup_test_db(guard, &path).await;
    }
}
