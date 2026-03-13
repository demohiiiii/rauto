use crate::web::error::ApiError;
use crate::web::state::AppState;
use axum::{
    extract::{Request, State},
    http::header,
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::sync::Arc;

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Response {
    let Some(expected_token) = state
        .api_token
        .as_deref()
        .map(str::trim)
        .filter(|token| !token.is_empty())
    else {
        return next.run(request).await;
    };

    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    let bearer_token = auth_header
        .strip_prefix("Bearer ")
        .map(str::trim)
        .unwrap_or_default();
    let api_key = request
        .headers()
        .get("X-API-Key")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .unwrap_or_default();

    if bearer_token == expected_token || api_key == expected_token {
        return next.run(request).await;
    }

    ApiError {
        status: axum::http::StatusCode::UNAUTHORIZED,
        message: "Unauthorized: invalid or missing API token".to_string(),
    }
    .into_response()
}
