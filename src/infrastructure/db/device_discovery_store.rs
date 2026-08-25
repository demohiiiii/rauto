use crate::infrastructure::db;
use anyhow::{Result, anyhow};
use serde::Deserialize;
use sqlx::Row;
use std::time::{SystemTime, UNIX_EPOCH};

pub const DISCOVERY_LEASE_TIMEOUT_MS: u64 = 10_000;

pub use crate::domain::device::{DiscoveryResultRecord, DiscoveryRunRecord};

pub struct DiscoveryRunStateUpdate<'a> {
    pub status: &'a str,
    pub phase: &'a str,
    pub scanned_targets: usize,
    pub reachable_count: usize,
    pub probed_targets: usize,
    pub identified_count: usize,
    pub failed_count: usize,
    pub error: Option<&'a str>,
    pub started_at_ms: Option<u64>,
    pub completed_at_ms: Option<u64>,
}

pub async fn replace_latest_run(run: &DiscoveryRunRecord) -> Result<bool> {
    let mut transaction = db::pool().begin_with("BEGIN IMMEDIATE").await?;
    let active_count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM device_discovery_runs
        WHERE status IN ('queued', 'running', 'cancelling')
        "#,
    )
    .fetch_one(&mut *transaction)
    .await?;
    if active_count > 0 {
        let heartbeat_at_ms = sqlx::query_scalar::<_, i64>(
            "SELECT heartbeat_at_ms FROM device_discovery_lease WHERE singleton = 1",
        )
        .fetch_optional(&mut *transaction)
        .await?;
        let lease_is_fresh = heartbeat_at_ms.is_some_and(|heartbeat| {
            heartbeat >= now_ms().saturating_sub(DISCOVERY_LEASE_TIMEOUT_MS) as i64
        });
        if lease_is_fresh {
            return Ok(false);
        }
    }

    sqlx::query(
        r#"
        DELETE FROM task_artifacts
        WHERE task_id IN (
            SELECT task_id FROM task_runs WHERE operation = 'device_discovery'
        )
        "#,
    )
    .execute(&mut *transaction)
    .await?;
    sqlx::query(
        r#"
        DELETE FROM task_events
        WHERE task_id IN (
            SELECT task_id FROM task_runs WHERE operation = 'device_discovery'
        )
        "#,
    )
    .execute(&mut *transaction)
    .await?;
    sqlx::query("DELETE FROM task_runs WHERE operation = 'device_discovery'")
        .execute(&mut *transaction)
        .await?;
    sqlx::query("DELETE FROM device_discovery_results")
        .execute(&mut *transaction)
        .await?;
    sqlx::query("DELETE FROM device_discovery_runs")
        .execute(&mut *transaction)
        .await?;

    sqlx::query(
        r#"
        INSERT INTO device_discovery_runs (
            id, status, phase, targets_json, ports_json, credential_ids_json,
            default_groups_json, default_labels_json, concurrency, tcp_timeout_ms,
            probe_timeout_secs, total_targets, scanned_targets, reachable_count,
            probed_targets, identified_count, failed_count, error, created_at_ms, started_at_ms,
            completed_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&run.id)
    .bind(&run.status)
    .bind(&run.phase)
    .bind(serde_json::to_string(&run.targets)?)
    .bind(serde_json::to_string(&run.ports)?)
    .bind(serde_json::to_string(&run.credential_ids)?)
    .bind(serde_json::to_string(&run.default_groups)?)
    .bind(serde_json::to_string(&run.default_labels)?)
    .bind(run.concurrency as i64)
    .bind(run.tcp_timeout_ms as i64)
    .bind(run.probe_timeout_secs as i64)
    .bind(run.total_targets as i64)
    .bind(run.scanned_targets as i64)
    .bind(run.reachable_count as i64)
    .bind(run.probed_targets as i64)
    .bind(run.identified_count as i64)
    .bind(run.failed_count as i64)
    .bind(&run.error)
    .bind(run.created_at_ms as i64)
    .bind(run.started_at_ms.map(|value| value as i64))
    .bind(run.completed_at_ms.map(|value| value as i64))
    .execute(&mut *transaction)
    .await?;
    sqlx::query(
        r#"
        INSERT INTO device_discovery_lease (singleton, run_id, heartbeat_at_ms)
        VALUES (1, ?, ?)
        "#,
    )
    .bind(&run.id)
    .bind(now_ms() as i64)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(true)
}

pub async fn refresh_run_lease(run_id: &str) -> Result<bool> {
    let result = sqlx::query(
        "UPDATE device_discovery_lease SET heartbeat_at_ms = ? WHERE singleton = 1 AND run_id = ?",
    )
    .bind(now_ms() as i64)
    .bind(run_id)
    .execute(db::pool())
    .await?;
    Ok(result.rows_affected() == 1)
}

pub async fn release_run_lease(run_id: &str) -> Result<()> {
    sqlx::query("DELETE FROM device_discovery_lease WHERE singleton = 1 AND run_id = ?")
        .bind(run_id)
        .execute(db::pool())
        .await?;
    Ok(())
}

pub async fn update_run_state(run_id: &str, update: DiscoveryRunStateUpdate<'_>) -> Result<()> {
    sqlx::query(
        r#"
        UPDATE device_discovery_runs
        SET status = ?, phase = ?, scanned_targets = ?, reachable_count = ?,
            probed_targets = ?, identified_count = ?, failed_count = ?, error = ?,
            started_at_ms = COALESCE(started_at_ms, ?), completed_at_ms = ?
        WHERE id = ?
        "#,
    )
    .bind(update.status)
    .bind(update.phase)
    .bind(update.scanned_targets as i64)
    .bind(update.reachable_count as i64)
    .bind(update.probed_targets as i64)
    .bind(update.identified_count as i64)
    .bind(update.failed_count as i64)
    .bind(update.error)
    .bind(update.started_at_ms.map(|value| value as i64))
    .bind(update.completed_at_ms.map(|value| value as i64))
    .bind(run_id)
    .execute(db::pool())
    .await?;
    Ok(())
}

pub async fn upsert_result(result: &DiscoveryResultRecord) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO device_discovery_results (
            run_id, host, port, status, latency_ms, credential_id, device_profile,
            device_model, software_version, existing_connection_name,
            imported_connection_name, error, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(run_id, host, port) DO UPDATE SET
            status = excluded.status,
            latency_ms = COALESCE(excluded.latency_ms, device_discovery_results.latency_ms),
            credential_id = COALESCE(excluded.credential_id, device_discovery_results.credential_id),
            device_profile = COALESCE(excluded.device_profile, device_discovery_results.device_profile),
            device_model = COALESCE(excluded.device_model, device_discovery_results.device_model),
            software_version = COALESCE(excluded.software_version, device_discovery_results.software_version),
            existing_connection_name = COALESCE(excluded.existing_connection_name, device_discovery_results.existing_connection_name),
            imported_connection_name = COALESCE(excluded.imported_connection_name, device_discovery_results.imported_connection_name),
            error = excluded.error,
            updated_at_ms = excluded.updated_at_ms
        "#,
    )
    .bind(&result.run_id)
    .bind(&result.host)
    .bind(i64::from(result.port))
    .bind(&result.status)
    .bind(result.latency_ms.map(|value| value as i64))
    .bind(&result.credential_id)
    .bind(&result.device_profile)
    .bind(&result.device_model)
    .bind(&result.software_version)
    .bind(&result.existing_connection_name)
    .bind(&result.imported_connection_name)
    .bind(&result.error)
    .bind(result.updated_at_ms as i64)
    .execute(db::pool())
    .await?;
    Ok(())
}

pub async fn get_run(run_id: &str) -> Result<Option<DiscoveryRunRecord>> {
    let row = sqlx::query("SELECT * FROM device_discovery_runs WHERE id = ?")
        .bind(run_id)
        .fetch_optional(db::pool())
        .await?;
    row.map(row_to_run).transpose()
}

pub async fn list_runs(limit: usize) -> Result<Vec<DiscoveryRunRecord>> {
    let rows =
        sqlx::query("SELECT * FROM device_discovery_runs ORDER BY created_at_ms DESC LIMIT ?")
            .bind(limit.clamp(1, 100) as i64)
            .fetch_all(db::pool())
            .await?;
    rows.into_iter().map(row_to_run).collect()
}

pub async fn list_results(run_id: &str) -> Result<Vec<DiscoveryResultRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT result.run_id, result.host, result.port, result.status, result.latency_ms,
               result.credential_id, result.device_profile, result.device_model,
               result.software_version,
               (
                   SELECT connection.name
                   FROM connections AS connection
                   WHERE TRIM(connection.host) = TRIM(result.host) COLLATE NOCASE
                     AND COALESCE(connection.port, 22) = result.port
                   ORDER BY connection.name ASC
                   LIMIT 1
               ) AS existing_connection_name,
               result.imported_connection_name, result.error, result.updated_at_ms
        FROM device_discovery_results AS result
        WHERE result.run_id = ?
        ORDER BY result.host, result.port
        "#,
    )
    .bind(run_id)
    .fetch_all(db::pool())
    .await?;
    Ok(rows.into_iter().map(row_to_result).collect())
}

pub async fn get_result(
    run_id: &str,
    host: &str,
    port: u16,
) -> Result<Option<DiscoveryResultRecord>> {
    let row = sqlx::query(
        "SELECT * FROM device_discovery_results WHERE run_id = ? AND host = ? AND port = ?",
    )
    .bind(run_id)
    .bind(host)
    .bind(i64::from(port))
    .fetch_optional(db::pool())
    .await?;
    Ok(row.map(row_to_result))
}

fn row_to_run(row: sqlx::sqlite::SqliteRow) -> Result<DiscoveryRunRecord> {
    Ok(DiscoveryRunRecord {
        id: row.get("id"),
        status: row.get("status"),
        phase: row.get("phase"),
        targets: parse_json_column(&row, "targets_json")?,
        ports: parse_json_column(&row, "ports_json")?,
        credential_ids: parse_json_column(&row, "credential_ids_json")?,
        default_groups: parse_json_column(&row, "default_groups_json")?,
        default_labels: parse_json_column(&row, "default_labels_json")?,
        concurrency: integer_usize(&row, "concurrency")?,
        tcp_timeout_ms: integer_u64(&row, "tcp_timeout_ms")?,
        probe_timeout_secs: integer_u64(&row, "probe_timeout_secs")?,
        total_targets: integer_usize(&row, "total_targets")?,
        scanned_targets: integer_usize(&row, "scanned_targets")?,
        reachable_count: integer_usize(&row, "reachable_count")?,
        probed_targets: integer_usize(&row, "probed_targets")?,
        identified_count: integer_usize(&row, "identified_count")?,
        failed_count: integer_usize(&row, "failed_count")?,
        error: row.get("error"),
        created_at_ms: integer_u64(&row, "created_at_ms")?,
        started_at_ms: optional_integer_u64(&row, "started_at_ms")?,
        completed_at_ms: optional_integer_u64(&row, "completed_at_ms")?,
    })
}

fn row_to_result(row: sqlx::sqlite::SqliteRow) -> DiscoveryResultRecord {
    DiscoveryResultRecord {
        run_id: row.get("run_id"),
        host: row.get("host"),
        port: row.get::<i64, _>("port") as u16,
        status: row.get("status"),
        latency_ms: row
            .get::<Option<i64>, _>("latency_ms")
            .map(|value| value as u64),
        credential_id: row.get("credential_id"),
        device_profile: row.get("device_profile"),
        device_model: row.get("device_model"),
        software_version: row.get("software_version"),
        existing_connection_name: row.get("existing_connection_name"),
        imported_connection_name: row.get("imported_connection_name"),
        error: row.get("error"),
        updated_at_ms: row.get::<i64, _>("updated_at_ms") as u64,
    }
}

fn parse_json_column<T: for<'de> Deserialize<'de>>(
    row: &sqlx::sqlite::SqliteRow,
    column: &str,
) -> Result<T> {
    Ok(serde_json::from_str(&row.get::<String, _>(column))?)
}

fn integer_u64(row: &sqlx::sqlite::SqliteRow, column: &str) -> Result<u64> {
    u64::try_from(row.get::<i64, _>(column))
        .map_err(|_| anyhow!("invalid negative value in {column}"))
}

fn integer_usize(row: &sqlx::sqlite::SqliteRow, column: &str) -> Result<usize> {
    usize::try_from(row.get::<i64, _>(column))
        .map_err(|_| anyhow!("invalid negative value in {column}"))
}

fn optional_integer_u64(row: &sqlx::sqlite::SqliteRow, column: &str) -> Result<Option<u64>> {
    row.get::<Option<i64>, _>(column)
        .map(u64::try_from)
        .transpose()
        .map_err(|_| anyhow!("invalid negative value in {column}"))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::db;

    fn run(id: &str, status: &str, created_at_ms: u64) -> DiscoveryRunRecord {
        DiscoveryRunRecord {
            id: id.to_string(),
            status: status.to_string(),
            phase: status.to_string(),
            targets: vec!["192.0.2.0/30".to_string()],
            ports: vec![22],
            credential_ids: vec!["credential-1".to_string()],
            default_groups: Vec::new(),
            default_labels: Vec::new(),
            concurrency: 4,
            tcp_timeout_ms: 1_000,
            probe_timeout_secs: 15,
            total_targets: 2,
            scanned_targets: 2,
            reachable_count: 1,
            probed_targets: 1,
            identified_count: 1,
            failed_count: 1,
            error: None,
            created_at_ms,
            started_at_ms: Some(created_at_ms),
            completed_at_ms: (status == "completed").then_some(created_at_ms + 1),
        }
    }

    #[tokio::test(flavor = "current_thread")]
    async fn replacing_latest_run_removes_previous_results_and_discovery_tasks() {
        let path = std::env::temp_dir().join(format!(
            "rauto-device-discovery-latest-{:016x}.db",
            rand::random::<u64>()
        ));
        let guard = db::override_test_db_path(path.clone());
        db::init().await.expect("initialize test database");

        let first = run("run-1", "completed", 1);
        assert!(replace_latest_run(&first).await.expect("create first run"));
        upsert_result(&DiscoveryResultRecord {
            run_id: first.id.clone(),
            host: "192.0.2.1".to_string(),
            port: 22,
            status: "identified".to_string(),
            latency_ms: Some(1),
            credential_id: Some("credential-1".to_string()),
            device_profile: Some("linux".to_string()),
            device_model: None,
            software_version: None,
            existing_connection_name: None,
            imported_connection_name: None,
            error: None,
            updated_at_ms: 2,
        })
        .await
        .expect("save first result");
        sqlx::query(
            r#"
            INSERT INTO task_runs (
                task_id, operation, status, summary, success, started_at,
                has_recording, has_error, created_at, updated_at
            ) VALUES (
                'run-1', 'device_discovery', 'success', 'done', 1, 'now',
                0, 0, 'now', 'now'
            )
            "#,
        )
        .execute(db::pool())
        .await
        .expect("save discovery task");

        let second = run("run-2", "completed", 3);
        assert!(
            replace_latest_run(&second)
                .await
                .expect("replace latest run")
        );
        assert!(get_run("run-1").await.expect("load old run").is_none());
        assert_eq!(list_runs(10).await.expect("list runs").len(), 1);
        assert_eq!(
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM task_runs WHERE operation = 'device_discovery'"
            )
            .fetch_one(db::pool())
            .await
            .expect("count discovery tasks"),
            0
        );

        let active = run("run-3", "running", 4);
        assert!(
            replace_latest_run(&active)
                .await
                .expect("create active run")
        );
        assert!(
            !replace_latest_run(&run("run-4", "completed", 5))
                .await
                .expect("reject concurrent run")
        );
        assert!(get_run("run-3").await.expect("load active run").is_some());

        sqlx::query("DELETE FROM device_discovery_lease")
            .execute(db::pool())
            .await
            .expect("simulate an orphaned discovery process");
        assert!(
            replace_latest_run(&run("run-4", "completed", 5))
                .await
                .expect("replace orphaned active run")
        );

        db::close_test_db(&path).await;
        drop(guard);
        let _ = std::fs::remove_file(path);
    }
}
