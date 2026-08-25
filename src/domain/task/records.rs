use serde::{Deserialize, Serialize};
use serde_json::Value;

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

pub fn extract_task_artifacts(
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn task_records_serialize_stable_field_names() {
        let record = TaskArtifactRecord {
            id: 7,
            task_id: "task-1".to_string(),
            artifact_type: "execution_result_json".to_string(),
            name: "Execution Result".to_string(),
            storage_ref: None,
            content_type: Some("application/json".to_string()),
            size_bytes: Some(2),
            content_text: Some("{}".to_string()),
            created_at: "2026-08-24T00:00:00Z".to_string(),
        };

        let value = serde_json::to_value(record).expect("serialize task artifact");

        assert_eq!(value["task_id"], "task-1");
        assert_eq!(value["artifact_type"], "execution_result_json");
        assert_eq!(value["size_bytes"], 2);
    }

    #[test]
    fn extracts_known_artifacts_from_execution_result() {
        let artifacts = extract_task_artifacts(
            "task-1",
            "2026-08-24T00:00:00Z",
            Some(&serde_json::json!({
                "rendered_commands": "show version",
                "tx_result": { "success": true }
            })),
        );

        assert_eq!(artifacts.len(), 3);
        assert_eq!(artifacts[0].id, 1);
        assert_eq!(artifacts[0].artifact_type, "rendered_commands");
        assert_eq!(artifacts[1].artifact_type, "tx_result_json");
        assert_eq!(artifacts[2].artifact_type, "execution_result_json");
    }
}
