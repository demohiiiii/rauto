use crate::cli::GlobalOpts;
use crate::web::assets::{index_response, static_response};
use crate::web::handlers::{
    create_backup, create_or_update_custom_profile, create_template, delete_connection,
    delete_connection_history, delete_custom_profile, delete_template, diagnose_profile,
    download_backup, exec_command, execute_template, execute_tx_block, execute_tx_workflow,
    get_builtin_profile_detail, get_builtin_profile_form, get_connection, get_connection_history,
    get_connection_history_detail, get_custom_profile, get_custom_profile_form, get_template,
    health, interactive_command, interactive_start, interactive_stop, list_backups,
    list_connections, list_profiles, list_templates, profiles_overview, render_template,
    replay_session, restore_backup, test_connection, update_template, upsert_connection,
    upsert_custom_profile_form,
};
use crate::web::state::AppState;
use anyhow::{Result, anyhow};
use axum::{
    Json, Router,
    extract::{Path, Request},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{any, get, post},
};
use std::net::SocketAddr;
use tracing::info;

pub async fn run_web_server(bind: String, port: u16, defaults: GlobalOpts) -> Result<()> {
    let state = AppState::new(defaults);

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/backups", get(list_backups).post(create_backup))
        .route("/api/backups/restore", post(restore_backup))
        .route("/api/backups/{name}/download", get(download_backup))
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
        .route("/api/device-profiles/diagnose", post(diagnose_profile))
        .route("/api/render", post(render_template))
        .route("/api/connections", get(list_connections))
        .route(
            "/api/connections/{name}",
            get(get_connection)
                .put(upsert_connection)
                .delete(delete_connection),
        )
        .route(
            "/api/connections/{name}/history",
            get(get_connection_history),
        )
        .route(
            "/api/connections/{name}/history/{id}",
            get(get_connection_history_detail).delete(delete_connection_history),
        )
        .route("/api/connection/test", post(test_connection))
        .route("/api/exec", post(exec_command))
        .route("/api/template/execute", post(execute_template))
        .route("/api/tx/block", post(execute_tx_block))
        .route("/api/tx/workflow", post(execute_tx_workflow))
        .route("/api/replay", post(replay_session))
        .route("/api/interactive/start", post(interactive_start))
        .route("/api/interactive/command", post(interactive_command))
        .route(
            "/api/interactive/{id}",
            axum::routing::delete(interactive_stop),
        )
        .route("/api/templates", get(list_templates).post(create_template))
        .route(
            "/api/templates/{name}",
            get(get_template)
                .put(update_template)
                .delete(delete_template),
        )
        .route("/", get(index))
        .route("/static/{*path}", get(static_file))
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

async fn index() -> Response {
    index_response()
}

async fn static_file(Path(path): Path<String>) -> Response {
    static_response(&path)
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
