use super::*;
use crate::domain::task::extract_task_artifacts;
use serde_json::Value;

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
