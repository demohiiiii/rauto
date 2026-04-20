use super::*;

pub(super) async fn replace_task_artifacts(
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
