use anyhow::Result;
use rneter::session::{SessionEvent, SessionRecorder};

pub fn command_output_only_jsonl(jsonl: &str) -> Result<String> {
    if jsonl.trim().is_empty() {
        return Ok(String::new());
    }
    let recorder = SessionRecorder::from_jsonl(jsonl)?;
    let entries = recorder.entries()?;
    let mut lines = Vec::new();
    for entry in entries {
        if !matches!(entry.event, SessionEvent::CommandOutput { .. }) {
            continue;
        }
        lines.push(serde_json::to_string(&entry)?);
    }
    Ok(lines.join("\n"))
}
