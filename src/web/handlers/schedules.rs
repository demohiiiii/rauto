use super::execute::resolve_batch_target_names;
use crate::config::{config_catalog, connection_store, content_store};
use crate::domain::scheduling::{
    ScheduleDefinition, ScheduledAction, next_runs_after_ms, timestamp_ms_in_timezone,
};
use crate::infrastructure::db::schedule_store;
use crate::interfaces::api::models::{
    ScheduleMutationResponse, SchedulePreviewRequest, SchedulePreviewResponse, ScheduleRun,
    ScheduleRunsQuery, StoredSchedule,
};
use crate::web::error::ApiError;
use crate::web::state::AppState;
use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use chrono::Utc;
use std::sync::Arc;

pub async fn list_schedules() -> Result<Json<Vec<StoredSchedule>>, ApiError> {
    Ok(Json(
        schedule_store::list_schedules()
            .await
            .map_err(ApiError::from)?,
    ))
}

pub async fn get_schedule(Path(id): Path<String>) -> Result<Json<StoredSchedule>, ApiError> {
    schedule_store::get_schedule(&id)
        .await
        .map_err(ApiError::from)?
        .map(Json)
        .ok_or_else(|| not_found("schedule not found"))
}

pub async fn create_schedule(
    State(state): State<Arc<AppState>>,
    Json(definition): Json<ScheduleDefinition>,
) -> Result<(StatusCode, Json<StoredSchedule>), ApiError> {
    validate_definition(&definition)?;
    let schedule = schedule_store::create_schedule(definition)
        .await
        .map_err(map_store_error)?;
    state.notify_schedule_changed();
    Ok((StatusCode::CREATED, Json(schedule)))
}

pub async fn update_schedule(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(definition): Json<ScheduleDefinition>,
) -> Result<Json<StoredSchedule>, ApiError> {
    validate_definition(&definition)?;
    let schedule = schedule_store::update_schedule(&id, definition)
        .await
        .map_err(map_store_error)?
        .ok_or_else(|| not_found("schedule not found"))?;
    state.notify_schedule_changed();
    Ok(Json(schedule))
}

pub async fn delete_schedule(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ScheduleMutationResponse>, ApiError> {
    let changed = schedule_store::delete_schedule(&id)
        .await
        .map_err(map_store_error)?;
    if !changed {
        return Err(not_found("schedule not found"));
    }
    state.notify_schedule_changed();
    Ok(Json(ScheduleMutationResponse { id, changed }))
}

pub async fn enable_schedule(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<StoredSchedule>, ApiError> {
    set_enabled(state, id, true).await
}

pub async fn disable_schedule(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<StoredSchedule>, ApiError> {
    set_enabled(state, id, false).await
}

pub async fn run_schedule_now(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<(StatusCode, Json<ScheduleRun>), ApiError> {
    let run = schedule_store::enqueue_manual_run(&id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| not_found("schedule not found"))?;
    state.notify_schedule_changed();
    Ok((StatusCode::ACCEPTED, Json(run)))
}

pub async fn list_schedule_runs(
    Path(id): Path<String>,
    Query(query): Query<ScheduleRunsQuery>,
) -> Result<Json<Vec<ScheduleRun>>, ApiError> {
    if schedule_store::get_schedule(&id)
        .await
        .map_err(ApiError::from)?
        .is_none()
    {
        return Err(not_found("schedule not found"));
    }
    Ok(Json(
        schedule_store::list_schedule_runs(&id, query.limit.unwrap_or(50))
            .await
            .map_err(ApiError::from)?,
    ))
}

pub async fn preview_schedule(
    Json(request): Json<SchedulePreviewRequest>,
) -> Result<Json<SchedulePreviewResponse>, ApiError> {
    let next_runs = next_runs_after_ms(
        &request.cron_expression,
        &request.timezone,
        Utc::now().timestamp_millis(),
        5,
    )
    .and_then(|timestamps| {
        timestamps
            .into_iter()
            .map(|timestamp| timestamp_ms_in_timezone(timestamp, &request.timezone))
            .collect()
    })
    .map_err(|error| ApiError::bad_request(error.to_string()))?;
    Ok(Json(SchedulePreviewResponse { next_runs }))
}

async fn set_enabled(
    state: Arc<AppState>,
    id: String,
    enabled: bool,
) -> Result<Json<StoredSchedule>, ApiError> {
    let schedule = schedule_store::set_schedule_enabled(&id, enabled)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| not_found("schedule not found"))?;
    state.notify_schedule_changed();
    Ok(Json(schedule))
}

fn validate_definition(definition: &ScheduleDefinition) -> Result<(), ApiError> {
    definition
        .validate()
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    match &definition.action {
        ScheduledAction::Orchestrate { template_name, .. } => {
            if content_store::load_orchestration_template(template_name)
                .map_err(ApiError::from)?
                .is_none()
            {
                return Err(ApiError::bad_request(format!(
                    "orchestration template '{}' was not found",
                    template_name.trim()
                )));
            }
        }
        ScheduledAction::ConfigFetch {
            connection_name,
            targets,
            groups,
            labels,
            kind,
        } => {
            let mut targets = targets.clone();
            if let Some(connection_name) = connection_name {
                targets.push(connection_name.clone());
            }
            let connection_names = resolve_batch_target_names(&targets, groups, labels)?;
            if connection_names.is_empty() {
                return Err(ApiError::bad_request(
                    "configuration fetch resolved no saved connections",
                ));
            }
            for connection_name in connection_names {
                let connection = load_connection(&connection_name)?;
                if let Some(profile) = connection
                    .device_profile
                    .as_deref()
                    .filter(|profile| *profile != "autodetect")
                {
                    config_catalog::resolve_config_command(profile, kind)
                        .map_err(|error| ApiError::bad_request(error.to_string()))?;
                }
            }
        }
        ScheduledAction::TxWorkflow {
            connection_name,
            template_name,
            ..
        } => {
            load_connection(connection_name)?;
            if content_store::load_tx_workflow_template(template_name)
                .map_err(ApiError::from)?
                .is_none()
            {
                return Err(ApiError::bad_request(format!(
                    "tx workflow template '{}' was not found",
                    template_name.trim()
                )));
            }
        }
    }
    Ok(())
}

fn load_connection(connection_name: &str) -> Result<connection_store::SavedConnection, ApiError> {
    connection_store::load_connection_raw(connection_name).map_err(|_| {
        ApiError::bad_request(format!(
            "saved connection '{}' was not found",
            connection_name.trim()
        ))
    })
}

fn map_store_error(error: anyhow::Error) -> ApiError {
    let message = error.to_string();
    if message.contains("UNIQUE constraint failed: schedules.name") {
        ApiError::conflict("a schedule with this name already exists")
    } else if message.contains("schedule has an active run") {
        ApiError::conflict("a schedule with an active run cannot be deleted")
    } else {
        ApiError::internal(message)
    }
}

fn not_found(message: &str) -> ApiError {
    ApiError {
        status: StatusCode::NOT_FOUND,
        message: message.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn cron_preview_returns_five_local_occurrences() {
        let Json(response) = preview_schedule(Json(SchedulePreviewRequest {
            cron_expression: "0 2 * * *".to_string(),
            timezone: "Asia/Shanghai".to_string(),
        }))
        .await
        .expect("preview schedule");

        assert_eq!(response.next_runs.len(), 5);
        assert!(
            response
                .next_runs
                .iter()
                .all(|value| value.ends_with("CST"))
        );
    }
}
