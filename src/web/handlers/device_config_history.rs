use crate::infrastructure::db::device_config_store;
use crate::interfaces::api::models::{
    DeviceConfigHistoryQuery, DeviceConfigHistoryResponse, DeviceConfigSnapshot,
    DeviceConfigSnapshotMutationResponse,
};
use crate::web::error::ApiError;
use axum::Json;
use axum::extract::{Path, Query};
use axum::http::StatusCode;
use chrono::DateTime;

pub async fn list_device_config_history(
    Query(query): Query<DeviceConfigHistoryQuery>,
) -> Result<Json<DeviceConfigHistoryResponse>, ApiError> {
    let fetched_from_ms = parse_timestamp(query.fetched_from.as_deref(), "fetched_from")?;
    let fetched_to_ms = parse_timestamp(query.fetched_to.as_deref(), "fetched_to")?;
    if fetched_from_ms
        .zip(fetched_to_ms)
        .is_some_and(|(from, to)| from > to)
    {
        return Err(ApiError::bad_request(
            "fetched_from must be earlier than or equal to fetched_to",
        ));
    }
    let (snapshots, connection_names, kinds) = tokio::try_join!(
        device_config_store::list_snapshots(
            query.connection_name.as_deref(),
            query.kind.as_deref(),
            fetched_from_ms,
            fetched_to_ms,
            query.sort_order.into(),
            query.limit.unwrap_or(100),
        ),
        device_config_store::list_connection_names(),
        device_config_store::list_kinds(),
    )
    .map_err(ApiError::from)?;
    Ok(Json(DeviceConfigHistoryResponse {
        snapshots,
        connection_names,
        kinds,
    }))
}

fn parse_timestamp(value: Option<&str>, field: &str) -> Result<Option<i64>, ApiError> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| {
            DateTime::parse_from_rfc3339(value)
                .map(|timestamp| timestamp.timestamp_millis())
                .map_err(|_| {
                    ApiError::bad_request(format!("{field} must be an RFC 3339 timestamp"))
                })
        })
        .transpose()
}

pub async fn get_device_config_snapshot(
    Path(id): Path<String>,
) -> Result<Json<DeviceConfigSnapshot>, ApiError> {
    device_config_store::get_snapshot(&id)
        .await
        .map_err(ApiError::from)?
        .map(Json)
        .ok_or_else(snapshot_not_found)
}

pub async fn delete_device_config_snapshot(
    Path(id): Path<String>,
) -> Result<Json<DeviceConfigSnapshotMutationResponse>, ApiError> {
    let deleted = device_config_store::delete_snapshot(&id)
        .await
        .map_err(ApiError::from)?;
    if !deleted {
        return Err(snapshot_not_found());
    }
    Ok(Json(DeviceConfigSnapshotMutationResponse { id, deleted }))
}

fn snapshot_not_found() -> ApiError {
    ApiError {
        status: StatusCode::NOT_FOUND,
        message: "device configuration snapshot not found".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn history_timestamp_filter_accepts_rfc3339_and_rejects_invalid_values() {
        assert_eq!(
            parse_timestamp(Some("2026-08-26T08:30:00+08:00"), "fetched_from")
                .expect("parse timestamp"),
            Some(1_787_704_200_000)
        );
        assert!(parse_timestamp(Some("2026-08-26 08:30"), "fetched_from").is_err());
        assert_eq!(
            parse_timestamp(Some("  "), "fetched_from").expect("blank filter"),
            None
        );
    }
}
