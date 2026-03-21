use crate::agent::config::{AgentCliOverrides, resolve_agent_settings};
use crate::agent::registration::AgentRegistrar;
use crate::agent::task_grpc_server::build_agent_task_grpc_router;
use crate::cli::{AgentArgs, GlobalOpts, WebArgs};
use crate::web::agent_handlers::{agent_info, agent_status, probe_devices};
use crate::web::assets::{index_response, static_response};
use crate::web::auth::auth_middleware;
use crate::web::handlers::{
    add_blacklist_pattern, check_blacklist_command, create_backup, create_or_update_custom_profile,
    create_template, delete_blacklist_pattern, delete_connection, delete_connection_history,
    delete_custom_profile, delete_template, diagnose_profile, download_backup, exec_command,
    exec_command_async, execute_orchestration, execute_orchestration_async, execute_template,
    execute_template_async, execute_tx_block, execute_tx_block_async, execute_tx_workflow,
    execute_tx_workflow_async,
    get_builtin_profile_detail, get_builtin_profile_form, get_connection, get_connection_history,
    get_connection_history_detail, get_custom_profile, get_custom_profile_form, get_template,
    health, interactive_command, interactive_start, interactive_stop, list_backups,
    list_blacklist_patterns, list_connections, list_profiles, list_templates, profiles_overview,
    render_template, replay_session, restore_backup, test_connection, update_template,
    upsert_connection, upsert_custom_profile_form,
};
use crate::web::state::AppState;
use anyhow::{Result, anyhow};
use axum::{
    Json, Router,
    extract::{Path, Request},
    http::{HeaderValue, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{any, get, post},
};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::signal;
use tracing::info;

pub async fn run_web_server(web_args: WebArgs, defaults: GlobalOpts) -> Result<()> {
    let state = AppState::new(defaults, None, None);
    let app = build_local_app(state);
    serve_app(web_args.bind, web_args.port, app, None).await
}

pub async fn run_agent_server(agent_args: AgentArgs, defaults: GlobalOpts) -> Result<()> {
    let agent_settings = resolve_agent_settings(
        agent_args.agent_config.clone(),
        AgentCliOverrides {
            manager_url: agent_args.manager_url.clone(),
            agent_name: agent_args.agent_name.clone(),
            agent_token: agent_args.agent_token.clone(),
            report_mode: agent_args.report_mode,
            probe_report_interval: agent_args.probe_report_interval,
        },
    )?;
    let Some(agent_config) = agent_settings.config else {
        return Err(anyhow!(
            "agent mode requires manager_url and agent_name via CLI, env, or agent.toml"
        ));
    };
    let state = AppState::new(
        defaults,
        Some(agent_config.clone()),
        agent_settings.api_token.clone(),
    );
    let app = build_managed_app(state.clone());

    let registrar = Arc::new(AgentRegistrar::new(agent_config.clone()));
    state.set_registrar(registrar.clone());

    let registration_state = state.clone();
    let registration_bind = agent_args.bind.clone();
    let registration_port = agent_args.port;
    tokio::spawn(async move {
        if let Err(err) = registrar
            .register(&registration_state, &registration_bind, registration_port)
            .await
        {
            tracing::error!("agent registration loop exited: {}", err);
            return;
        }
        let heartbeat_registrar = registrar.clone();
        let heartbeat_state = registration_state.clone();
        tokio::spawn(async move {
            heartbeat_registrar
                .start_heartbeat_loop(heartbeat_state)
                .await;
        });
        registrar.start_probe_report_loop().await;
    });

    info!(
        "Agent mode enabled: registered as '{}'",
        agent_config.agent.name
    );

    serve_app(agent_args.bind, agent_args.port, app, Some(state)).await
}

fn build_local_app(state: Arc<AppState>) -> Router {
    Router::new()
        .merge(public_web_routes())
        .merge(local_api_routes())
        .fallback(any(not_found))
        .layer(middleware::from_fn(disable_cache))
        .with_state(state)
}

fn build_managed_app(state: Arc<AppState>) -> Router {
    let grpc_routes = build_agent_task_grpc_router(state.clone());
    let protected_routes = Router::new()
        .route("/api/agent/status", get(agent_status))
        .route("/api/devices/probe", post(probe_devices))
        .route("/api/exec/async", post(exec_command_async))
        .route("/api/template/execute/async", post(execute_template_async))
        .route("/api/tx/block/async", post(execute_tx_block_async))
        .route("/api/tx/workflow/async", post(execute_tx_workflow_async))
        .route("/api/orchestrate/async", post(execute_orchestration_async))
        .merge(local_api_routes())
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ));

    Router::new()
        .merge(public_agent_routes())
        .merge(grpc_routes)
        .merge(protected_routes)
        .fallback(any(not_found))
        .layer(middleware::from_fn(disable_cache))
        .with_state(state)
}

fn public_web_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/health", get(health))
        .route("/", get(index))
        .route("/static/{*path}", get(static_file))
}

fn public_agent_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/health", get(health))
        .route("/api/agent/info", get(agent_info))
        .route("/", get(index))
        .route("/static/{*path}", get(static_file))
}

fn local_api_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/backups", get(list_backups).post(create_backup))
        .route(
            "/api/blacklist",
            get(list_blacklist_patterns).post(add_blacklist_pattern),
        )
        .route("/api/blacklist/check", post(check_blacklist_command))
        .route(
            "/api/blacklist/{pattern}",
            axum::routing::delete(delete_blacklist_pattern),
        )
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
        .route("/api/orchestrate", post(execute_orchestration))
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
}

async fn serve_app(
    bind: String,
    port: u16,
    app: Router,
    shutdown_state: Option<Arc<AppState>>,
) -> Result<()> {
    let addr: SocketAddr = format!("{}:{}", bind, port)
        .parse()
        .map_err(|e| anyhow!("Invalid bind address: {}", e))?;

    info!("Web UI started at http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            signal::ctrl_c().await.ok();
            if let Some(state) = shutdown_state
                && let Some(registrar) = state.registrar()
            {
                registrar.shutdown_notify().await;
            }
        })
        .await?;
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
    res.headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    res
}
