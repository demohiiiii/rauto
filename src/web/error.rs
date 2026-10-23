pub use crate::application::error::ApiError;
use crate::web::models::ApiResponse;
use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let code = match self.status {
            StatusCode::BAD_REQUEST | StatusCode::UNPROCESSABLE_ENTITY => "invalid_request",
            StatusCode::UNAUTHORIZED => "unauthorized",
            StatusCode::FORBIDDEN => "forbidden",
            StatusCode::NOT_FOUND => "not_found",
            StatusCode::CONFLICT => "conflict",
            StatusCode::SERVICE_UNAVAILABLE => "service_unavailable",
            StatusCode::INTERNAL_SERVER_ERROR => "internal_error",
            _ if self.status.is_client_error() => "request_failed",
            _ => "internal_error",
        };
        (self.status, Json(ApiResponse::failure(code, self.message))).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;
    use serde_json::json;

    #[tokio::test]
    async fn api_error_uses_the_unified_response_envelope() {
        let response = ApiError::bad_request("invalid command").into_response();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let bytes = to_bytes(response.into_body(), 64 * 1024)
            .await
            .expect("read error response");
        let value: serde_json::Value =
            serde_json::from_slice(&bytes).expect("deserialize error response");

        assert_eq!(value["success"], json!(false));
        assert_eq!(value["error"]["code"], json!("invalid_request"));
        assert_eq!(value["error"]["message"], json!("invalid command"));
        assert!(value["result_summary"].is_null());
        assert!(value["data"].is_null());
    }

    #[tokio::test]
    async fn status_codes_map_to_stable_error_codes() {
        for (status, expected) in [
            (StatusCode::UNAUTHORIZED, "unauthorized"),
            (StatusCode::FORBIDDEN, "forbidden"),
            (StatusCode::NOT_FOUND, "not_found"),
            (StatusCode::CONFLICT, "conflict"),
            (StatusCode::SERVICE_UNAVAILABLE, "service_unavailable"),
            (StatusCode::INTERNAL_SERVER_ERROR, "internal_error"),
        ] {
            let response = ApiError {
                status,
                message: "failure".to_string(),
            }
            .into_response();
            assert_eq!(response.status(), status);
            let bytes = to_bytes(response.into_body(), 64 * 1024)
                .await
                .expect("read error response");
            let value: serde_json::Value =
                serde_json::from_slice(&bytes).expect("deserialize error response");
            assert_eq!(value["error"]["code"], json!(expected));
        }
    }
}
