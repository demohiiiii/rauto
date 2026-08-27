use crate::domain::scheduling::{
    MisfirePolicy, OverlapPolicy, ScheduleDefinition, ScheduleRun, ScheduleRunStatus,
    ScheduledAction, StoredSchedule, next_run_after_ms, timestamp_ms_to_rfc3339,
};
use crate::infrastructure::db;
use anyhow::{Context, Result, anyhow};
use sqlx::{Row, Sqlite, Transaction};
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};

const MISFIRE_GRACE_MS: i64 = 60_000;

#[derive(Debug, Clone)]
pub struct ClaimedScheduleRun {
    pub schedule: StoredSchedule,
    pub run: ScheduleRun,
}

pub async fn create_schedule(definition: ScheduleDefinition) -> Result<StoredSchedule> {
    definition.validate()?;
    let definition = definition.normalized();
    let now = now_ms();
    let id = new_id("schedule");
    let next_run_at = definition
        .enabled
        .then(|| next_run_after_ms(&definition.cron_expression, &definition.timezone, now))
        .transpose()?;
    let action_json = serde_json::to_string(&definition.action)?;

    sqlx::query(
        r#"
        INSERT INTO schedules (
            id, name, cron_expression, timezone, action_type, action_payload_json,
            payload_version, enabled, overlap_policy, misfire_policy,
            max_runtime_seconds, next_run_at_ms, created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&definition.name)
    .bind(&definition.cron_expression)
    .bind(&definition.timezone)
    .bind(definition.action.action_type())
    .bind(action_json)
    .bind(definition.enabled)
    .bind(definition.overlap_policy.as_str())
    .bind(definition.misfire_policy.as_str())
    .bind(definition.max_runtime_seconds as i64)
    .bind(next_run_at)
    .bind(now)
    .bind(now)
    .execute(db::pool())
    .await?;

    get_schedule(&id)
        .await?
        .ok_or_else(|| anyhow!("created schedule was not found"))
}

pub async fn update_schedule(
    id: &str,
    definition: ScheduleDefinition,
) -> Result<Option<StoredSchedule>> {
    definition.validate()?;
    let definition = definition.normalized();
    let now = now_ms();
    let next_run_at = definition
        .enabled
        .then(|| next_run_after_ms(&definition.cron_expression, &definition.timezone, now))
        .transpose()?;
    let action_json = serde_json::to_string(&definition.action)?;
    let result = sqlx::query(
        r#"
        UPDATE schedules
        SET name = ?, cron_expression = ?, timezone = ?, action_type = ?,
            action_payload_json = ?, payload_version = 1, enabled = ?,
            overlap_policy = ?, misfire_policy = ?, max_runtime_seconds = ?,
            next_run_at_ms = ?, updated_at_ms = ?
        WHERE id = ?
        "#,
    )
    .bind(&definition.name)
    .bind(&definition.cron_expression)
    .bind(&definition.timezone)
    .bind(definition.action.action_type())
    .bind(action_json)
    .bind(definition.enabled)
    .bind(definition.overlap_policy.as_str())
    .bind(definition.misfire_policy.as_str())
    .bind(definition.max_runtime_seconds as i64)
    .bind(next_run_at)
    .bind(now)
    .bind(id.trim())
    .execute(db::pool())
    .await?;
    if result.rows_affected() == 0 {
        return Ok(None);
    }
    get_schedule(id).await
}

pub async fn set_schedule_enabled(id: &str, enabled: bool) -> Result<Option<StoredSchedule>> {
    let Some(schedule) = get_schedule(id).await? else {
        return Ok(None);
    };
    let now = now_ms();
    let next_run_at = enabled
        .then(|| {
            next_run_after_ms(
                &schedule.definition.cron_expression,
                &schedule.definition.timezone,
                now,
            )
        })
        .transpose()?;
    sqlx::query(
        "UPDATE schedules SET enabled = ?, next_run_at_ms = ?, updated_at_ms = ? WHERE id = ?",
    )
    .bind(enabled)
    .bind(next_run_at)
    .bind(now)
    .bind(id.trim())
    .execute(db::pool())
    .await?;
    get_schedule(id).await
}

pub async fn delete_schedule(id: &str) -> Result<bool> {
    let mut transaction = db::pool().begin_with("BEGIN IMMEDIATE").await?;
    if active_run_exists(&mut transaction, id.trim()).await? {
        return Err(anyhow!("schedule has an active run"));
    }
    let result = sqlx::query("DELETE FROM schedules WHERE id = ?")
        .bind(id.trim())
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(result.rows_affected() == 1)
}

pub async fn get_schedule(id: &str) -> Result<Option<StoredSchedule>> {
    let row = sqlx::query("SELECT * FROM schedules WHERE id = ?")
        .bind(id.trim())
        .fetch_optional(db::pool())
        .await?;
    row.map(row_to_schedule).transpose()
}

pub async fn list_schedules() -> Result<Vec<StoredSchedule>> {
    let rows = sqlx::query("SELECT * FROM schedules ORDER BY name COLLATE NOCASE ASC")
        .fetch_all(db::pool())
        .await?;
    rows.into_iter().map(row_to_schedule).collect()
}

pub async fn list_schedule_runs(schedule_id: &str, limit: usize) -> Result<Vec<ScheduleRun>> {
    let rows = sqlx::query(
        r#"
        SELECT r.*, s.name AS schedule_name
        FROM schedule_runs r
        JOIN schedules s ON s.id = r.schedule_id
        WHERE r.schedule_id = ?
        ORDER BY r.created_at_ms DESC
        LIMIT ?
        "#,
    )
    .bind(schedule_id.trim())
    .bind(limit.clamp(1, 500) as i64)
    .fetch_all(db::pool())
    .await?;
    rows.into_iter().map(row_to_schedule_run).collect()
}

pub async fn enqueue_manual_run(schedule_id: &str) -> Result<Option<ScheduleRun>> {
    let Some(schedule) = get_schedule(schedule_id).await? else {
        return Ok(None);
    };
    let now = now_ms();
    let mut transaction = db::pool().begin_with("BEGIN IMMEDIATE").await?;
    let latest_scheduled_for = sqlx::query_scalar::<_, Option<i64>>(
        "SELECT MAX(scheduled_for_ms) FROM schedule_runs WHERE schedule_id = ?",
    )
    .bind(schedule_id)
    .fetch_one(&mut *transaction)
    .await?;
    let scheduled_for = latest_scheduled_for
        .map(|value| now.max(value.saturating_add(1)))
        .unwrap_or(now);
    let active = active_run_exists(&mut transaction, schedule_id).await?;
    let should_skip = active && schedule.definition.overlap_policy == OverlapPolicy::Skip;
    let run = insert_run(
        &mut transaction,
        &schedule,
        "manual",
        scheduled_for,
        should_skip,
        should_skip.then_some("another run is already active"),
    )
    .await?;
    transaction.commit().await?;
    Ok(Some(run))
}

pub async fn enqueue_due_runs(now: i64, limit: usize) -> Result<usize> {
    let mut transaction = db::pool().begin_with("BEGIN IMMEDIATE").await?;
    let rows = sqlx::query(
        r#"
        SELECT * FROM schedules
        WHERE enabled = 1 AND next_run_at_ms IS NOT NULL AND next_run_at_ms <= ?
        ORDER BY next_run_at_ms ASC
        LIMIT ?
        "#,
    )
    .bind(now)
    .bind(limit.clamp(1, 100) as i64)
    .fetch_all(&mut *transaction)
    .await?;

    let mut created = 0;
    for row in rows {
        let schedule = row_to_schedule(row)?;
        let scheduled_for = schedule_next_run_ms(&schedule)?;
        let next_run_at = next_run_after_ms(
            &schedule.definition.cron_expression,
            &schedule.definition.timezone,
            now,
        )?;
        let active = active_run_exists(&mut transaction, &schedule.id).await?;
        let missed = now.saturating_sub(scheduled_for) > MISFIRE_GRACE_MS;
        let skip_reason = if active && schedule.definition.overlap_policy == OverlapPolicy::Skip {
            Some("another run is already active")
        } else if missed && schedule.definition.misfire_policy == MisfirePolicy::Skip {
            Some("missed trigger skipped by policy")
        } else {
            None
        };
        insert_run(
            &mut transaction,
            &schedule,
            "cron",
            scheduled_for,
            skip_reason.is_some(),
            skip_reason,
        )
        .await?;
        sqlx::query(
            "UPDATE schedules SET next_run_at_ms = ?, updated_at_ms = ? WHERE id = ? AND next_run_at_ms = ?",
        )
        .bind(next_run_at)
        .bind(now)
        .bind(&schedule.id)
        .bind(scheduled_for)
        .execute(&mut *transaction)
        .await?;
        created += 1;
    }
    transaction.commit().await?;
    Ok(created)
}

pub async fn claim_pending_runs(
    owner: &str,
    now: i64,
    limit: usize,
) -> Result<Vec<ClaimedScheduleRun>> {
    let mut transaction = db::pool().begin_with("BEGIN IMMEDIATE").await?;
    let rows = sqlx::query(
        r#"
        SELECT r.id
        FROM schedule_runs r
        WHERE r.status = 'queued'
           OR (r.status = 'running' AND COALESCE(r.lease_until_ms, 0) <= ?)
        ORDER BY r.created_at_ms ASC
        LIMIT ?
        "#,
    )
    .bind(now)
    .bind(limit.clamp(1, 100) as i64)
    .fetch_all(&mut *transaction)
    .await?;

    let mut claimed = Vec::new();
    for row in rows {
        let run_id: String = row.get("id");
        let schedule_row = sqlx::query(
            r#"
            SELECT s.*
            FROM schedules s
            JOIN schedule_runs r ON r.schedule_id = s.id
            WHERE r.id = ?
            "#,
        )
        .bind(&run_id)
        .fetch_one(&mut *transaction)
        .await?;
        let schedule = row_to_schedule(schedule_row)?;
        let lease_until = now.saturating_add(
            (schedule.definition.max_runtime_seconds as i64)
                .saturating_add(60)
                .saturating_mul(1_000),
        );
        let updated = sqlx::query(
            r#"
            UPDATE schedule_runs
            SET status = 'running', started_at_ms = COALESCE(started_at_ms, ?),
                lease_owner = ?, lease_until_ms = ?
            WHERE id = ?
              AND (status = 'queued' OR (status = 'running' AND COALESCE(lease_until_ms, 0) <= ?))
            "#,
        )
        .bind(now)
        .bind(owner)
        .bind(lease_until)
        .bind(&run_id)
        .bind(now)
        .execute(&mut *transaction)
        .await?;
        if updated.rows_affected() == 0 {
            continue;
        }
        let run_row = sqlx::query(
            r#"
            SELECT r.*, s.name AS schedule_name
            FROM schedule_runs r
            JOIN schedules s ON s.id = r.schedule_id
            WHERE r.id = ?
            "#,
        )
        .bind(&run_id)
        .fetch_one(&mut *transaction)
        .await?;
        claimed.push(ClaimedScheduleRun {
            schedule,
            run: row_to_schedule_run(run_row)?,
        });
    }
    transaction.commit().await?;
    Ok(claimed)
}

pub async fn finish_run(
    run_id: &str,
    owner: &str,
    status: ScheduleRunStatus,
    error: Option<&str>,
) -> Result<bool> {
    if !matches!(
        status,
        ScheduleRunStatus::Success | ScheduleRunStatus::Failed
    ) {
        return Err(anyhow!(
            "a running schedule can only finish as success or failed"
        ));
    }
    let now = now_ms();
    let mut transaction = db::pool().begin_with("BEGIN IMMEDIATE").await?;
    let schedule_id = sqlx::query_scalar::<_, String>(
        "SELECT schedule_id FROM schedule_runs WHERE id = ? AND lease_owner = ?",
    )
    .bind(run_id)
    .bind(owner)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(schedule_id) = schedule_id else {
        return Ok(false);
    };
    sqlx::query(
        r#"
        UPDATE schedule_runs
        SET status = ?, error = ?, completed_at_ms = ?, lease_owner = NULL,
            lease_until_ms = NULL
        WHERE id = ? AND lease_owner = ?
        "#,
    )
    .bind(status.as_str())
    .bind(error)
    .bind(now)
    .bind(run_id)
    .bind(owner)
    .execute(&mut *transaction)
    .await?;
    sqlx::query("UPDATE schedules SET last_run_at_ms = ?, updated_at_ms = ? WHERE id = ?")
        .bind(now)
        .bind(now)
        .bind(schedule_id)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(true)
}

pub async fn next_due_at_ms() -> Result<Option<i64>> {
    Ok(sqlx::query_scalar::<_, Option<i64>>(
        "SELECT MIN(next_run_at_ms) FROM schedules WHERE enabled = 1",
    )
    .fetch_one(db::pool())
    .await?)
}

async fn active_run_exists(
    transaction: &mut Transaction<'_, Sqlite>,
    schedule_id: &str,
) -> Result<bool> {
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM schedule_runs WHERE schedule_id = ? AND status IN ('queued', 'running')",
    )
    .bind(schedule_id)
    .fetch_one(&mut **transaction)
    .await?;
    Ok(count > 0)
}

async fn insert_run(
    transaction: &mut Transaction<'_, Sqlite>,
    schedule: &StoredSchedule,
    trigger_type: &str,
    scheduled_for: i64,
    skipped: bool,
    skip_reason: Option<&str>,
) -> Result<ScheduleRun> {
    let id = new_id("run");
    let task_id = (!skipped).then(|| format!("cron-{id}"));
    let now = now_ms();
    let status = if skipped {
        ScheduleRunStatus::Skipped
    } else {
        ScheduleRunStatus::Queued
    };
    sqlx::query(
        r#"
        INSERT INTO schedule_runs (
            id, schedule_id, task_id, trigger_type, scheduled_for_ms, status,
            skip_reason, completed_at_ms, created_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&schedule.id)
    .bind(&task_id)
    .bind(trigger_type)
    .bind(scheduled_for)
    .bind(status.as_str())
    .bind(skip_reason)
    .bind(skipped.then_some(now))
    .bind(now)
    .execute(&mut **transaction)
    .await?;
    Ok(ScheduleRun {
        id,
        schedule_id: schedule.id.clone(),
        schedule_name: schedule.definition.name.clone(),
        task_id,
        trigger_type: trigger_type.to_string(),
        scheduled_for: timestamp_ms_to_rfc3339(scheduled_for),
        status,
        skip_reason: skip_reason.map(ToOwned::to_owned),
        error: None,
        started_at: None,
        completed_at: skipped.then(|| timestamp_ms_to_rfc3339(now)),
        created_at: timestamp_ms_to_rfc3339(now),
    })
}

fn row_to_schedule(row: sqlx::sqlite::SqliteRow) -> Result<StoredSchedule> {
    let action_type: String = row.get("action_type");
    let action_json: String = row.get("action_payload_json");
    let action: ScheduledAction = serde_json::from_str(&action_json)
        .with_context(|| format!("invalid {action_type} schedule action payload"))?;
    if action.action_type() != action_type {
        return Err(anyhow!(
            "schedule action type '{}' does not match payload type '{}'",
            action_type,
            action.action_type()
        ));
    }
    let next_run_at_ms: Option<i64> = row.get("next_run_at_ms");
    let last_run_at_ms: Option<i64> = row.get("last_run_at_ms");
    Ok(StoredSchedule {
        id: row.get("id"),
        definition: ScheduleDefinition {
            name: row.get("name"),
            cron_expression: row.get("cron_expression"),
            timezone: row.get("timezone"),
            action,
            enabled: row.get("enabled"),
            overlap_policy: OverlapPolicy::from_str(
                row.get::<String, _>("overlap_policy").as_str(),
            )?,
            misfire_policy: MisfirePolicy::from_str(
                row.get::<String, _>("misfire_policy").as_str(),
            )?,
            max_runtime_seconds: row.get::<i64, _>("max_runtime_seconds") as u64,
        },
        next_run_at: next_run_at_ms.map(timestamp_ms_to_rfc3339),
        last_run_at: last_run_at_ms.map(timestamp_ms_to_rfc3339),
        created_at: timestamp_ms_to_rfc3339(row.get("created_at_ms")),
        updated_at: timestamp_ms_to_rfc3339(row.get("updated_at_ms")),
    })
}

fn row_to_schedule_run(row: sqlx::sqlite::SqliteRow) -> Result<ScheduleRun> {
    let started_at_ms: Option<i64> = row.get("started_at_ms");
    let completed_at_ms: Option<i64> = row.get("completed_at_ms");
    Ok(ScheduleRun {
        id: row.get("id"),
        schedule_id: row.get("schedule_id"),
        schedule_name: row.get("schedule_name"),
        task_id: row.get("task_id"),
        trigger_type: row.get("trigger_type"),
        scheduled_for: timestamp_ms_to_rfc3339(row.get("scheduled_for_ms")),
        status: ScheduleRunStatus::from_str(row.get::<String, _>("status").as_str())?,
        skip_reason: row.get("skip_reason"),
        error: row.get("error"),
        started_at: started_at_ms.map(timestamp_ms_to_rfc3339),
        completed_at: completed_at_ms.map(timestamp_ms_to_rfc3339),
        created_at: timestamp_ms_to_rfc3339(row.get("created_at_ms")),
    })
}

fn schedule_next_run_ms(schedule: &StoredSchedule) -> Result<i64> {
    let value = schedule
        .next_run_at
        .as_deref()
        .ok_or_else(|| anyhow!("due schedule is missing next_run_at"))?;
    Ok(chrono::DateTime::parse_from_rfc3339(value)?.timestamp_millis())
}

fn new_id(prefix: &str) -> String {
    format!("{prefix}-{:016x}", rand::random::<u64>())
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::scheduling::{
        MisfirePolicy, OverlapPolicy, ScheduleDefinition, ScheduledAction,
    };
    use serde_json::json;
    use std::path::{Path, PathBuf};

    fn definition(name: &str, enabled: bool) -> ScheduleDefinition {
        ScheduleDefinition {
            name: name.to_string(),
            cron_expression: "*/5 * * * *".to_string(),
            timezone: "Asia/Shanghai".to_string(),
            action: ScheduledAction::Orchestrate {
                template_name: "nightly".to_string(),
                vars: json!({"site": "lab"}),
            },
            enabled,
            overlap_policy: OverlapPolicy::Skip,
            misfire_policy: MisfirePolicy::FireOnce,
            max_runtime_seconds: 300,
        }
    }

    async fn setup_test_db(test_name: &str) -> (db::TestDbPathGuard, PathBuf) {
        let path = std::env::temp_dir().join(format!(
            "rauto-schedule-{test_name}-{:016x}.db",
            rand::random::<u64>()
        ));
        let guard = db::override_test_db_path(path.clone());
        db::init().await.expect("initialize schedule test database");
        (guard, path)
    }

    async fn cleanup_test_db(guard: db::TestDbPathGuard, path: &Path) {
        db::close_test_db(path).await;
        drop(guard);
        for suffix in ["", "-shm", "-wal"] {
            let _ = std::fs::remove_file(format!("{}{}", path.display(), suffix));
        }
    }

    #[tokio::test(flavor = "current_thread")]
    async fn creates_and_updates_persisted_schedule() {
        let (guard, path) = setup_test_db("crud").await;
        let created = create_schedule(definition("nightly", true))
            .await
            .expect("create schedule");
        assert!(created.next_run_at.is_some());
        assert_eq!(created.definition.action.action_type(), "orchestrate");

        let mut changed = created.definition.clone();
        changed.cron_expression = "15 3 * * *".to_string();
        changed.enabled = false;
        let updated = update_schedule(&created.id, changed)
            .await
            .expect("update schedule")
            .expect("schedule exists");
        assert_eq!(updated.definition.cron_expression, "15 3 * * *");
        assert!(updated.next_run_at.is_none());

        cleanup_test_db(guard, &path).await;
    }

    #[tokio::test(flavor = "current_thread")]
    async fn manual_run_is_claimed_only_once() {
        let (guard, path) = setup_test_db("claim").await;
        let schedule = create_schedule(definition("manual", false))
            .await
            .expect("create schedule");
        let queued = enqueue_manual_run(&schedule.id)
            .await
            .expect("enqueue manual run")
            .expect("schedule exists");
        assert_eq!(queued.status, ScheduleRunStatus::Queued);

        let claimed = claim_pending_runs("owner-a", now_ms(), 4)
            .await
            .expect("claim run");
        assert_eq!(claimed.len(), 1);
        assert_eq!(claimed[0].run.id, queued.id);
        assert!(
            claim_pending_runs("owner-b", now_ms(), 4)
                .await
                .expect("second claim")
                .is_empty()
        );

        cleanup_test_db(guard, &path).await;
    }

    #[tokio::test(flavor = "current_thread")]
    async fn overlap_policy_records_skipped_manual_run() {
        let (guard, path) = setup_test_db("overlap").await;
        let schedule = create_schedule(definition("overlap", false))
            .await
            .expect("create schedule");
        let first = enqueue_manual_run(&schedule.id)
            .await
            .expect("enqueue first run")
            .expect("schedule exists");
        let second = enqueue_manual_run(&schedule.id)
            .await
            .expect("enqueue overlapping run")
            .expect("schedule exists");
        assert_eq!(first.status, ScheduleRunStatus::Queued);
        assert_eq!(second.status, ScheduleRunStatus::Skipped);
        assert!(second.skip_reason.is_some());
        assert!(delete_schedule(&schedule.id).await.is_err());

        cleanup_test_db(guard, &path).await;
    }

    #[tokio::test(flavor = "current_thread")]
    async fn due_schedule_advances_before_dispatch() {
        let (guard, path) = setup_test_db("due").await;
        let schedule = create_schedule(definition("due", true))
            .await
            .expect("create schedule");
        let due_at = now_ms().saturating_sub(1_000);
        sqlx::query("UPDATE schedules SET next_run_at_ms = ? WHERE id = ?")
            .bind(due_at)
            .bind(&schedule.id)
            .execute(db::pool())
            .await
            .expect("make schedule due");

        assert_eq!(
            enqueue_due_runs(now_ms(), 10).await.expect("enqueue due"),
            1
        );
        assert_eq!(
            enqueue_due_runs(now_ms(), 10)
                .await
                .expect("enqueue due again"),
            0
        );
        let runs = list_schedule_runs(&schedule.id, 10)
            .await
            .expect("list runs");
        assert_eq!(runs.len(), 1);

        cleanup_test_db(guard, &path).await;
    }
}
