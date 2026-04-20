use super::*;

#[derive(Debug, Clone)]
pub(crate) struct TaskReportContext {
    pub(crate) task_id: String,
    pub(crate) operation: TaskOperation,
    pub(crate) started_at: chrono::DateTime<Utc>,
    pub(crate) started_instant: Instant,
}

impl TaskReportContext {
    pub(crate) fn from_request(
        operation: TaskOperation,
        task_id: Option<String>,
        managed: bool,
    ) -> Option<Self> {
        if !managed {
            return None;
        }
        let task_id = task_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)?;
        Some(Self {
            task_id,
            operation,
            started_at: Utc::now(),
            started_instant: Instant::now(),
        })
    }
}

#[derive(Debug, Clone)]
pub(crate) struct TaskEventInput {
    pub(crate) event_type: String,
    pub(crate) message: String,
    pub(crate) level: String,
    pub(crate) stage: Option<String>,
    pub(crate) progress: Option<u8>,
    pub(crate) details: Option<Value>,
}

impl TaskEventInput {
    pub(crate) fn new(event_type: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            event_type: event_type.into(),
            message: message.into(),
            level: "info".to_string(),
            stage: None,
            progress: None,
            details: None,
        }
    }

    pub(crate) fn with_level(mut self, level: impl Into<String>) -> Self {
        self.level = level.into();
        self
    }

    pub(crate) fn with_stage(mut self, stage: impl Into<String>) -> Self {
        self.stage = Some(stage.into());
        self
    }

    pub(crate) fn with_progress(mut self, progress: Option<u8>) -> Self {
        self.progress = progress;
        self
    }

    pub(crate) fn with_details(mut self, details: Option<Value>) -> Self {
        self.details = details;
        self
    }
}

#[derive(Debug, Clone)]
pub(crate) enum RecordingEventPlan {
    TxBlock {
        total_steps: usize,
    },
    TxWorkflow {
        total_blocks: usize,
        total_steps: usize,
        block_indices: HashMap<String, usize>,
        block_step_counts: HashMap<String, usize>,
        step_offsets: HashMap<String, usize>,
    },
}

pub(crate) struct RecordingEventForwarder {
    pub(crate) initial_entries: usize,
    pub(crate) finish_tx: oneshot::Sender<usize>,
    pub(crate) join_handle: JoinHandle<()>,
}

impl RecordingEventForwarder {
    pub(crate) async fn finish(self, expected_entries: usize) {
        let expected_new_entries = expected_entries.saturating_sub(self.initial_entries);
        let _ = self.finish_tx.send(expected_new_entries);
        let _ = self.join_handle.await;
    }
}

pub(crate) fn task_event_progress(current: usize, total: usize) -> Option<u8> {
    if total == 0 {
        return None;
    }
    let pct = ((current as f64 / total as f64) * 100.0).round() as i64;
    Some(pct.clamp(0, 100) as u8)
}
