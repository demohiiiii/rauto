pub use crate::domain::scheduling::{
    MisfirePolicy, OverlapPolicy, ScheduleDefinition, ScheduleRun, ScheduleRunStatus,
    ScheduledAction, StoredSchedule,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ScheduleRunsQuery {
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct ScheduleMutationResponse {
    pub id: String,
    pub changed: bool,
}

#[derive(Debug, Deserialize)]
pub struct SchedulePreviewRequest {
    pub cron_expression: String,
    pub timezone: String,
}

#[derive(Debug, Serialize)]
pub struct SchedulePreviewResponse {
    pub next_runs: Vec<String>,
}
