use crate::web::error::ApiError;
use crate::web::state::AppState;
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::{
    Json,
    extract::{Request, State},
    middleware::Next,
    response::{IntoResponse, Response},
};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use rand::RngCore;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};
use subtle::ConstantTimeEq;

const WEB_SESSION_COOKIE: &str = "rauto_web_session";
const WEB_SESSION_TTL: Duration = Duration::from_secs(12 * 60 * 60);

#[derive(Debug)]
pub struct WebAuth {
    password_digest: [u8; 32],
    sessions: Mutex<HashMap<String, Instant>>,
}

impl WebAuth {
    pub fn new(password: &str) -> Self {
        Self {
            password_digest: Sha256::digest(password.as_bytes()).into(),
            sessions: Mutex::new(HashMap::new()),
        }
    }

    fn verify_password(&self, password: &str) -> bool {
        let candidate: [u8; 32] = Sha256::digest(password.as_bytes()).into();
        bool::from(self.password_digest.ct_eq(&candidate))
    }

    fn create_session(&self) -> String {
        let mut bytes = [0_u8; 32];
        OsRng.fill_bytes(&mut bytes);
        let token = URL_SAFE_NO_PAD.encode(bytes);
        let mut sessions = self.sessions();
        remove_expired_sessions(&mut sessions);
        sessions.insert(token.clone(), Instant::now() + WEB_SESSION_TTL);
        token
    }

    fn is_authenticated(&self, headers: &HeaderMap) -> bool {
        let Some(token) = session_cookie(headers) else {
            return false;
        };
        let mut sessions = self.sessions();
        remove_expired_sessions(&mut sessions);
        sessions.contains_key(token)
    }

    fn revoke_session(&self, headers: &HeaderMap) {
        if let Some(token) = session_cookie(headers) {
            self.sessions().remove(token);
        }
    }

    fn sessions(&self) -> MutexGuard<'_, HashMap<String, Instant>> {
        self.sessions
            .lock()
            .unwrap_or_else(|error| error.into_inner())
    }
}

#[derive(Debug, Deserialize)]
pub struct WebLoginRequest {
    password: String,
}

#[derive(Debug, Serialize)]
pub struct WebAuthStatusResponse {
    mode: &'static str,
    authenticated: bool,
}

pub async fn web_auth_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Json<WebAuthStatusResponse> {
    if state.is_managed() {
        return Json(WebAuthStatusResponse {
            mode: "agent",
            authenticated: true,
        });
    }
    Json(WebAuthStatusResponse {
        mode: "web",
        authenticated: state
            .web_auth()
            .is_none_or(|auth| auth.is_authenticated(&headers)),
    })
}

pub async fn web_login(
    State(state): State<Arc<AppState>>,
    Json(request): Json<WebLoginRequest>,
) -> Result<Response, ApiError> {
    let auth = state.web_auth().ok_or_else(web_auth_not_available)?;
    if request.password.is_empty() || !auth.verify_password(&request.password) {
        tokio::time::sleep(Duration::from_millis(200)).await;
        return Err(unauthorized("Invalid Web password"));
    }

    let token = auth.create_session();
    let mut response = Json(WebAuthStatusResponse {
        mode: "web",
        authenticated: true,
    })
    .into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&format!(
            "{WEB_SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Strict"
        ))
        .map_err(|error| ApiError::from(anyhow::anyhow!(error)))?,
    );
    Ok(response)
}

pub async fn web_logout(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    let auth = state.web_auth().ok_or_else(web_auth_not_available)?;
    auth.revoke_session(&headers);

    let mut response = Json(WebAuthStatusResponse {
        mode: "web",
        authenticated: false,
    })
    .into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_static(
            "rauto_web_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
        ),
    );
    Ok(response)
}

pub async fn web_auth_middleware(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Response {
    if state
        .web_auth()
        .is_none_or(|auth| auth.is_authenticated(request.headers()))
    {
        return next.run(request).await;
    }
    unauthorized("Unauthorized: Web login required").into_response()
}

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

    if secure_token_eq(bearer_token, expected_token) || secure_token_eq(api_key, expected_token) {
        return next.run(request).await;
    }
    unauthorized("Unauthorized: invalid or missing API token").into_response()
}

fn session_cookie(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok())?
        .split(';')
        .map(str::trim)
        .find_map(|cookie| cookie.strip_prefix(&format!("{WEB_SESSION_COOKIE}=")))
        .filter(|value| !value.is_empty())
}

fn remove_expired_sessions(sessions: &mut HashMap<String, Instant>) {
    let now = Instant::now();
    sessions.retain(|_, expires_at| *expires_at > now);
}

fn secure_token_eq(candidate: &str, expected: &str) -> bool {
    candidate.len() == expected.len() && bool::from(candidate.as_bytes().ct_eq(expected.as_bytes()))
}

fn unauthorized(message: &str) -> ApiError {
    ApiError {
        status: StatusCode::UNAUTHORIZED,
        message: message.to_string(),
    }
}

fn web_auth_not_available() -> ApiError {
    ApiError {
        status: StatusCode::NOT_FOUND,
        message: "Web authentication is not available in this mode".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn web_session_requires_password_and_can_be_revoked() {
        let auth = WebAuth::new("correct-password");
        assert!(!auth.verify_password("wrong-password"));
        assert!(auth.verify_password("correct-password"));

        let token = auth.create_session();
        let mut headers = HeaderMap::new();
        headers.insert(
            header::COOKIE,
            HeaderValue::from_str(&format!("other=1; {WEB_SESSION_COOKIE}={token}"))
                .expect("valid cookie"),
        );
        assert!(auth.is_authenticated(&headers));
        auth.revoke_session(&headers);
        assert!(!auth.is_authenticated(&headers));
    }

    #[test]
    fn api_tokens_use_exact_constant_time_comparison() {
        assert!(secure_token_eq("secret", "secret"));
        assert!(!secure_token_eq("Secret", "secret"));
        assert!(!secure_token_eq("secret-extra", "secret"));
    }
}
