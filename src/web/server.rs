use crate::cli::GlobalOpts;
use crate::web::handlers::{
    create_or_update_custom_profile, create_template, delete_custom_profile, delete_template,
    exec_command, execute_template, get_builtin_profile_detail, get_builtin_profile_form,
    get_custom_profile, get_custom_profile_form, get_template, health, list_profiles,
    list_templates, profiles_overview, render_template, test_connection, update_template,
    upsert_custom_profile_form,
};
use crate::web::state::AppState;
use anyhow::{Result, anyhow};
use axum::{
    Json, Router,
    extract::Request,
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{any, get, post},
};
use std::net::SocketAddr;
use std::path::PathBuf;
use tower_http::services::{ServeDir, ServeFile};
use tracing::info;

pub async fn run_web_server(bind: String, port: u16, defaults: GlobalOpts) -> Result<()> {
    let state = AppState::new(defaults);
    let static_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("static");
    let index_file = static_root.join("index.html");

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/device-profiles", get(list_profiles))
        .route("/api/device-profiles/all", get(profiles_overview))
        .route(
            "/api/device-profiles/builtin/{name}",
            get(get_builtin_profile_detail),
        )
        .route(
            "/api/device-profiles/builtin/{name}/form",
            get(get_builtin_profile_form),
        )
        .route(
            "/api/device-profiles/custom/{name}",
            get(get_custom_profile)
                .put(create_or_update_custom_profile)
                .delete(delete_custom_profile),
        )
        .route(
            "/api/device-profiles/custom/{name}/form",
            get(get_custom_profile_form).put(upsert_custom_profile_form),
        )
        .route("/api/render", post(render_template))
        .route("/api/connection/test", post(test_connection))
        .route("/api/exec", post(exec_command))
        .route("/api/template/execute", post(execute_template))
        .route("/api/templates", get(list_templates).post(create_template))
        .route(
            "/api/templates/{name}",
            get(get_template)
                .put(update_template)
                .delete(delete_template),
        )
        .route_service("/", ServeFile::new(index_file))
        .nest_service("/static", ServeDir::new(static_root))
        .fallback(any(not_found))
        .layer(middleware::from_fn(disable_cache))
        .with_state(state);

    let addr: SocketAddr = format!("{}:{}", bind, port)
        .parse()
        .map_err(|e| anyhow!("Invalid bind address: {}", e))?;

    info!("Web UI started at http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn not_found(req: Request) -> Response {
    if req.uri().path().starts_with("/api/") {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "API route not found" })),
        )
            .into_response()
    } else {
        (StatusCode::NOT_FOUND, "Not Found").into_response()
    }
}

async fn disable_cache(req: Request, next: Next) -> Response {
    let mut res = next.run(req).await;
    res.headers_mut().insert(
        axum::http::header::CACHE_CONTROL,
        axum::http::HeaderValue::from_static("no-store"),
    );
    res
}
