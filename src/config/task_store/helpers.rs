use super::*;

pub(super) fn row_to_task_run_record(row: sqlx::sqlite::SqliteRow) -> TaskRunRecord {
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

pub(super) fn row_to_task_event_record(row: sqlx::sqlite::SqliteRow) -> TaskEventRecord {
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

pub(super) fn row_to_task_artifact_record(row: sqlx::sqlite::SqliteRow) -> TaskArtifactRecord {
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

pub(super) fn event_status_name(event: &TaskEvent) -> &'static str {
    match event.event_type {
        crate::task::TaskEventType::Completed => "success",
        crate::task::TaskEventType::Failed => "failed",
        _ => "running",
    }
}

pub(super) fn infer_target_label_from_details(details: Option<&Value>) -> Option<String> {
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
