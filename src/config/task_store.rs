use crate::db;
use crate::task::{TaskCallback, TaskEvent, TaskOperation};
use anyhow::Result;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRunRecord {
    pub task_id: String,
    pub operation: String,
    pub status: String,
    pub outcome: Option<String>,
    pub summary: String,
    pub success: bool,
    pub agent_name: Option<String>,
    pub source: Option<String>,
    pub target_label: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub execution_time_ms: Option<u64>,
    pub has_recording: bool,
    pub has_error: bool,
    pub result_summary: Option<Value>,
    pub result: Option<Value>,
    pub error: Option<Value>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskEventRecord {
    pub seq: u64,
    pub task_id: String,
    pub operation: String,
    pub event_type: String,
    pub level: String,
    pub stage: Option<String>,
    pub message: String,
    pub progress: Option<u8>,
    pub details: Option<Value>,
    pub occurred_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskArtifactRecord {
    pub id: u64,
    pub task_id: String,
    pub artifact_type: String,
    pub name: String,
    pub storage_ref: Option<String>,
    pub content_type: Option<String>,
    pub size_bytes: Option<u64>,
    pub content_text: Option<String>,
    pub created_at: String,
}

pub fn save_task_accepted(task_id: &str, operation: TaskOperation) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    let summary_json = serde_json::to_string(&serde_json::json!({
        "operation": operation,
        "outcome": null,
        "success": false,
        "summary": "Task accepted and queued"
    }))?;
    let task_id = task_id.to_string();
    let operation = operation.to_string();
    db::run_sync(async move {
        sqlx::query(
            r#"
            INSERT INTO task_runs (
                task_id, operation, status, outcome, summary, success, agent_name, source,
                target_label, started_at, completed_at, execution_time_ms, has_recording,
                has_error, result_summary_json, result_json, error_json, created_at, updated_at
            ) VALUES (?, ?, 'queued', NULL, 'Task accepted and queued', 0, NULL, 'agent_async',
                      NULL, ?, NULL, NULL, 0, 0, ?, NULL, NULL, ?, ?)
            ON CONFLICT(task_id) DO UPDATE SET
                operation = excluded.operation,
                status = excluded.status,
                summary = excluded.summary,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(task_id)
        .bind(operation)
        .bind(&now)
        .bind(summary_json)
        .bind(&now)
        .bind(&now)
        .execute(db::pool())
        .await?;
        Ok(())
    })
}

pub fn append_task_event(task_id: &str, operation: TaskOperation, event: &TaskEvent) -> Result<()> {
    let task_id = task_id.to_string();
    let operation = operation.to_string();
    let event = event.clone();
    db::run_sync(async move {
        let event_type = event.event_type.to_string();
        let level = event.level.to_string();
        let stage = event.stage.clone();
        let message = event.message.clone();
        let progress = event.progress.map(i64::from);
        let occurred_at = event.occurred_at.clone();
        let next_seq = sqlx::query_scalar::<_, i64>(
            "SELECT COALESCE(MAX(seq), 0) + 1 FROM task_events WHERE task_id = ?",
        )
        .bind(&task_id)
        .fetch_one(db::pool())
        .await?;

        let details_json = event
            .details
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;

        sqlx::query(
            r#"
            INSERT INTO task_events (
                task_id, seq, operation, event_type, level, stage, message, progress,
                details_json, occurred_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&task_id)
        .bind(next_seq)
        .bind(&operation)
        .bind(event_type)
        .bind(level)
        .bind(stage)
        .bind(&message)
        .bind(progress)
        .bind(details_json)
        .bind(occurred_at)
        .execute(db::pool())
        .await?;

        let status = event_status_name(&event);
        let target_label = infer_target_label_from_details(event.details.as_ref());
        let updated_at = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            UPDATE task_runs
            SET
                status = ?,
                summary = ?,
                agent_name = COALESCE(agent_name, ?),
                target_label = COALESCE(target_label, ?),
                updated_at = ?
            WHERE task_id = ?
            "#,
        )
        .bind(status)
        .bind(message)
        .bind(&event.agent_name)
        .bind(target_label)
        .bind(updated_at)
        .bind(&task_id)
        .execute(db::pool())
        .await?;
        Ok(())
    })
}

pub fn save_task_callback(callback: &TaskCallback, operation: TaskOperation) -> Result<()> {
    let callback = callback.clone();
    let operation = operation.to_string();
    db::run_sync(async move {
        let outcome = callback
            .result_summary
            .as_ref()
            .map(|summary| summary.outcome.to_string());
        let summary_text = callback
            .result_summary
            .as_ref()
            .map(|summary| summary.summary.clone())
            .unwrap_or_else(|| {
                callback
                    .error
                    .clone()
                    .unwrap_or_else(|| "Task finished".to_string())
            });
        let success = matches!(callback.status, crate::task::TaskStatus::Success);
        let has_recording = callback
            .result_summary
            .as_ref()
            .and_then(|summary| summary.recording_available)
            .unwrap_or(false);
        let has_error = callback.error.is_some();
        let target_label = callback
            .result_summary
            .as_ref()
            .and_then(|summary| infer_target_label_from_details(summary.details.as_ref()));
        let result_summary_json = callback
            .result_summary
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        let result_json = callback
            .result
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        let error_json = callback
            .error
            .as_ref()
            .map(|error| serde_json::to_string(&serde_json::json!({ "message": error })))
            .transpose()?;
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            INSERT INTO task_runs (
                task_id, operation, status, outcome, summary, success, agent_name, source,
                target_label, started_at, completed_at, execution_time_ms, has_recording,
                has_error, result_summary_json, result_json, error_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'agent_task', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(task_id) DO UPDATE SET
                operation = excluded.operation,
                status = excluded.status,
                outcome = excluded.outcome,
                summary = excluded.summary,
                success = excluded.success,
                agent_name = excluded.agent_name,
                target_label = COALESCE(task_runs.target_label, excluded.target_label),
                completed_at = excluded.completed_at,
                execution_time_ms = excluded.execution_time_ms,
                has_recording = excluded.has_recording,
                has_error = excluded.has_error,
                result_summary_json = excluded.result_summary_json,
                result_json = excluded.result_json,
                error_json = excluded.error_json,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(&callback.task_id)
        .bind(&operation)
        .bind(callback.status.to_string())
        .bind(outcome)
        .bind(summary_text)
        .bind(if success { 1 } else { 0 })
        .bind(&callback.agent_name)
        .bind(target_label)
        .bind(&callback.started_at)
        .bind(&callback.completed_at)
        .bind(callback.execution_time_ms as i64)
        .bind(if has_recording { 1 } else { 0 })
        .bind(if has_error { 1 } else { 0 })
        .bind(result_summary_json)
        .bind(result_json)
        .bind(error_json)
        .bind(&callback.started_at)
        .bind(&now)
        .execute(db::pool())
        .await?;

        replace_task_artifacts(
            &callback.task_id,
            &callback.completed_at,
            callback.result.as_ref(),
        )
        .await?;
        Ok(())
    })
}

#[allow(dead_code)]
pub fn task_event_count(task_id: &str) -> Result<u64> {
    let task_id = task_id.to_string();
    db::run_sync(async move {
        let count = sqlx::query("SELECT COUNT(*) AS count FROM task_events WHERE task_id = ?")
            .bind(task_id)
            .fetch_one(db::pool())
            .await?
            .get::<i64, _>("count");
        Ok(count as u64)
    })
}

pub fn list_task_runs(
    limit: usize,
    operation: Option<&str>,
    status: Option<&str>,
) -> Result<Vec<TaskRunRecord>> {
    let operation = operation
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let status = status
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    db::run_sync(async move {
        let mut query = String::from("SELECT * FROM task_runs");
        let mut has_where = false;
        if operation.is_some() {
            query.push_str(" WHERE operation = ?");
            has_where = true;
        }
        if status.is_some() {
            query.push_str(if has_where {
                " AND status = ?"
            } else {
                " WHERE status = ?"
            });
        }
        query.push_str(" ORDER BY updated_at DESC, created_at DESC");
        if limit > 0 {
            query.push_str(" LIMIT ?");
        }

        let mut sql = sqlx::query(&query);
        if let Some(operation) = operation {
            sql = sql.bind(operation);
        }
        if let Some(status) = status {
            sql = sql.bind(status);
        }
        if limit > 0 {
            sql = sql.bind(limit as i64);
        }

        let rows = sql.fetch_all(db::pool()).await?;
        Ok(rows.into_iter().map(row_to_task_run_record).collect())
    })
}

pub fn load_task_run(task_id: &str) -> Result<Option<TaskRunRecord>> {
    let task_id = task_id.trim().to_string();
    if task_id.is_empty() {
        return Ok(None);
    }
    db::run_sync(async move {
        let row = sqlx::query("SELECT * FROM task_runs WHERE task_id = ?")
            .bind(task_id)
            .fetch_optional(db::pool())
            .await?;
        Ok(row.map(row_to_task_run_record))
    })
}

pub fn list_task_events(task_id: &str) -> Result<Vec<TaskEventRecord>> {
    let task_id = task_id.trim().to_string();
    if task_id.is_empty() {
        return Ok(Vec::new());
    }
    db::run_sync(async move {
        let rows = sqlx::query("SELECT * FROM task_events WHERE task_id = ? ORDER BY seq ASC")
            .bind(task_id)
            .fetch_all(db::pool())
            .await?;
        Ok(rows.into_iter().map(row_to_task_event_record).collect())
    })
}

pub fn list_task_artifacts(task_id: &str) -> Result<Vec<TaskArtifactRecord>> {
    let task_id = task_id.trim().to_string();
    if task_id.is_empty() {
        return Ok(Vec::new());
    }
    db::run_sync(async move {
        let rows = sqlx::query(
            "SELECT * FROM task_artifacts WHERE task_id = ? ORDER BY created_at ASC, id ASC",
        )
        .bind(task_id)
        .fetch_all(db::pool())
        .await?;
        Ok(rows.into_iter().map(row_to_task_artifact_record).collect())
    })
}

fn row_to_task_run_record(row: sqlx::sqlite::SqliteRow) -> TaskRunRecord {
    TaskRunRecord {
        task_id: row.get("task_id"),
        operation: row.get("operation"),
        status: row.get("status"),
        outcome: row.get("outcome"),
        summary: row.get("summary"),
        success: row.get::<i64, _>("success") != 0,
        agent_name: row.get("agent_name"),
        source: row.get("source"),
        target_label: row.get("target_label"),
        started_at: row.get("started_at"),
        completed_at: row.get("completed_at"),
        execution_time_ms: row
            .get::<Option<i64>, _>("execution_time_ms")
            .map(|value| value as u64),
        has_recording: row.get::<i64, _>("has_recording") != 0,
        has_error: row.get::<i64, _>("has_error") != 0,
        result_summary: parse_optional_json(row.get("result_summary_json")),
        result: parse_optional_json(row.get("result_json")),
        error: parse_optional_json(row.get("error_json")),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn row_to_task_event_record(row: sqlx::sqlite::SqliteRow) -> TaskEventRecord {
    TaskEventRecord {
        seq: row.get::<i64, _>("seq") as u64,
        task_id: row.get("task_id"),
        operation: row.get("operation"),
        event_type: row.get("event_type"),
        level: row.get("level"),
        stage: row.get("stage"),
        message: row.get("message"),
        progress: row
            .get::<Option<i64>, _>("progress")
            .map(|value| value as u8),
        details: parse_optional_json(row.get("details_json")),
        occurred_at: row.get("occurred_at"),
    }
}

fn row_to_task_artifact_record(row: sqlx::sqlite::SqliteRow) -> TaskArtifactRecord {
    TaskArtifactRecord {
        id: row.get::<i64, _>("id") as u64,
        task_id: row.get("task_id"),
        artifact_type: row.get("artifact_type"),
        name: row.get("name"),
        storage_ref: row.get("storage_ref"),
        content_type: row.get("content_type"),
        size_bytes: row
            .get::<Option<i64>, _>("size_bytes")
            .map(|value| value as u64),
        content_text: row.get("content_text"),
        created_at: row.get("created_at"),
    }
}

fn parse_optional_json(raw: Option<String>) -> Option<Value> {
    raw.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            serde_json::from_str(trimmed).ok()
        }
    })
}

async fn replace_task_artifacts(
    task_id: &str,
    completed_at: &str,
    result: Option<&Value>,
) -> Result<()> {
    let artifacts = extract_task_artifacts(task_id, completed_at, result);
    sqlx::query("DELETE FROM task_artifacts WHERE task_id = ?")
        .bind(task_id)
        .execute(db::pool())
        .await?;
    for artifact in artifacts {
        sqlx::query(
            r#"
            INSERT INTO task_artifacts (
                task_id, artifact_type, name, storage_ref, content_type, size_bytes, content_text, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&artifact.task_id)
        .bind(&artifact.artifact_type)
        .bind(&artifact.name)
        .bind(&artifact.storage_ref)
        .bind(&artifact.content_type)
        .bind(artifact.size_bytes.map(|value| value as i64))
        .bind(&artifact.content_text)
        .bind(&artifact.created_at)
        .execute(db::pool())
        .await?;
    }
    Ok(())
}

fn extract_task_artifacts(
    task_id: &str,
    completed_at: &str,
    result: Option<&Value>,
) -> Vec<TaskArtifactRecord> {
    let mut artifacts = Vec::new();
    let Some(result) = result else {
        return artifacts;
    };

    push_text_artifact(
        &mut artifacts,
        task_id,
        completed_at,
        "recording_jsonl",
        "Session Recording",
        result.get("recording_jsonl").and_then(Value::as_str),
        Some("application/jsonl"),
    );
    push_text_artifact(
        &mut artifacts,
        task_id,
        completed_at,
        "rendered_commands",
        "Rendered Commands",
        result.get("rendered_commands").and_then(Value::as_str),
        Some("text/plain"),
    );
    push_json_artifact(
        &mut artifacts,
        task_id,
        completed_at,
        "tx_result_json",
        "Tx Result",
        result.get("tx_result"),
    );
    push_json_artifact(
        &mut artifacts,
        task_id,
        completed_at,
        "workflow_result_json",
        "Workflow Result",
        result.get("workflow_result"),
    );
    push_json_artifact(
        &mut artifacts,
        task_id,
        completed_at,
        "orchestration_result_json",
        "Orchestration Result",
        result.get("result"),
    );
    push_json_artifact(
        &mut artifacts,
        task_id,
        completed_at,
        "execution_result_json",
        "Execution Result",
        Some(result),
    );

    for (idx, artifact) in artifacts.iter_mut().enumerate() {
        artifact.id = (idx + 1) as u64;
    }

    artifacts
}

fn push_text_artifact(
    artifacts: &mut Vec<TaskArtifactRecord>,
    task_id: &str,
    created_at: &str,
    artifact_type: &str,
    name: &str,
    content: Option<&str>,
    content_type: Option<&str>,
) {
    let Some(content) = content.map(str::trim).filter(|value| !value.is_empty()) else {
        return;
    };
    artifacts.push(TaskArtifactRecord {
        id: 0,
        task_id: task_id.to_string(),
        artifact_type: artifact_type.to_string(),
        name: name.to_string(),
        storage_ref: None,
        content_type: content_type.map(ToOwned::to_owned),
        size_bytes: Some(content.len() as u64),
        content_text: Some(content.to_string()),
        created_at: created_at.to_string(),
    });
}

fn push_json_artifact(
    artifacts: &mut Vec<TaskArtifactRecord>,
    task_id: &str,
    created_at: &str,
    artifact_type: &str,
    name: &str,
    value: Option<&Value>,
) {
    let Some(value) = value else {
        return;
    };
    if value.is_null() {
        return;
    }
    let Ok(content_text) = serde_json::to_string_pretty(value) else {
        return;
    };
    artifacts.push(TaskArtifactRecord {
        id: 0,
        task_id: task_id.to_string(),
        artifact_type: artifact_type.to_string(),
        name: name.to_string(),
        storage_ref: None,
        content_type: Some("application/json".to_string()),
        size_bytes: Some(content_text.len() as u64),
        content_text: Some(content_text),
        created_at: created_at.to_string(),
    });
}

fn event_status_name(event: &TaskEvent) -> &'static str {
    match event.event_type {
        crate::task::TaskEventType::Completed => "success",
        crate::task::TaskEventType::Failed => "failed",
        _ => "running",
    }
}

fn infer_target_label_from_details(details: Option<&Value>) -> Option<String> {
    let details = details?;
    details
        .get("connection_name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            details
                .get("host")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
        })
        .or_else(|| {
            details
                .get("device_addr")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
        })
        .or_else(|| {
            details
                .get("workflow_name")
                .and_then(Value::as_str)
                .map(|value| format!("workflow:{value}"))
        })
        .or_else(|| {
            details
                .get("plan_name")
                .and_then(Value::as_str)
                .map(|value| format!("plan:{value}"))
        })
}
