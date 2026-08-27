use crate::agent::config::{AgentCliOverrides, resolve_agent_settings};
use crate::agent::registration::AgentRegistrar;
use crate::agent::task_grpc_server::build_agent_task_grpc_router;
use crate::cli::{AgentArgs, GlobalOpts, WebArgs};
use crate::config::app_config;
use crate::scheduler::spawn_scheduler;
use crate::web::agent_handlers::{agent_info, agent_status, probe_devices};
use crate::web::assets::{static_response, svelte_index_response};
use crate::web::auth::{
    auth_middleware, web_auth_middleware, web_auth_status, web_login, web_logout,
};
use crate::web::handlers::{
    add_blacklist_pattern, add_config_volatile_pattern, cancel_device_discovery_run,
    check_blacklist_command, create_backup, create_command_flow_template, create_credential,
    create_device_discovery_run, create_or_update_custom_profile, create_orchestration_template,
    create_schedule, create_template, create_textfsm_template, create_tx_block_template,
    create_tx_workflow_template, delete_blacklist_pattern, delete_command_flow_template,
    delete_config_command, delete_connection, delete_connection_history, delete_credential,
    delete_custom_profile, delete_custom_show_object, delete_device_config_snapshot,
    delete_inventory_group, delete_inventory_label, delete_orchestration_template, delete_schedule,
    delete_template, delete_textfsm_mapping, delete_textfsm_template, delete_tx_block_template,
    delete_tx_workflow_template, detect_connection_facts, diagnose_profile, disable_schedule,
    download_backup, download_connection_import_template, download_credential_import_template,
    enable_schedule, exec_command, exec_command_async, execute_command_flow, execute_exec_batch,
    execute_flow_batch, execute_orchestration, execute_orchestration_async, execute_show,
    execute_show_batch, execute_template, execute_template_async, execute_tx_block,
    execute_tx_block_async, execute_tx_workflow, execute_tx_workflow_async, execute_upload,
    export_textfsm_excel, fetch_config, fetch_config_batch, get_builtin_command_flow_template,
    get_builtin_profile_detail, get_builtin_profile_form, get_command_flow_template,
    get_connection, get_connection_history, get_connection_history_detail, get_credential,
    get_custom_profile, get_custom_profile_form, get_device_config_snapshot,
    get_device_discovery_run, get_inventory_group, get_inventory_label, get_orchestration_template,
    get_profile_modes, get_schedule, get_task_run_detail, get_template, get_textfsm_template,
    get_tx_block_template, get_tx_workflow_template, health, import_connections,
    import_credentials, import_device_discovery_results, inspect_command_flow_template,
    inspect_command_template, list_backups, list_blacklist_patterns,
    list_builtin_command_flow_templates, list_command_flow_templates, list_config_commands,
    list_config_volatile_patterns, list_connections, list_credentials, list_custom_show_objects,
    list_device_config_history, list_device_config_history_devices, list_device_discovery_runs,
    list_inventory_groups, list_inventory_labels, list_orchestration_templates, list_profiles,
    list_schedule_runs, list_schedules, list_show_objects, list_task_runs, list_templates,
    list_textfsm_mappings, list_textfsm_templates, list_tx_block_templates,
    list_tx_workflow_templates, preview_schedule, preview_tx_workflow_template, profiles_overview,
    remove_config_volatile_pattern, render_template, replay_session, restore_backup,
    run_schedule_now, test_connection, update_command_flow_template, update_credential,
    update_orchestration_template, update_schedule, update_template, update_textfsm_template,
    update_tx_block_template, update_tx_workflow_template, upsert_config_command,
    upsert_connection, upsert_custom_profile_form, upsert_custom_show_object,
    upsert_inventory_group, upsert_inventory_label, upsert_textfsm_mapping,
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
use std::net::IpAddr;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::signal;
use tracing::info;

pub async fn run_web_server(web_args: WebArgs, defaults: GlobalOpts) -> Result<()> {
    let web_password = app_config::load_or_create_web_password()?;
    if web_password.generated {
        println!("Generated Web login password: {}", web_password.password);
        println!(
            "Saved Web configuration to: {}",
            web_password.path.display()
        );
    }
    let (addr, listener) = bind_listener(&web_args.bind, web_args.port).await?;
    let state = AppState::new_web(defaults, &web_password.password);
    let app = build_local_app(state.clone());
    let scheduler = spawn_scheduler(state.clone());
    let result = serve_app(listener, addr, app, state.clone()).await;
    state.begin_shutdown();
    if let Err(error) = scheduler.await {
        tracing::warn!("cron scheduler failed to join: {error}");
    }
    result
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
    let api_token = agent_settings.api_token.clone();
    if api_token
        .as_deref()
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .is_none()
        && !bind_is_loopback_only(&agent_args.bind)
    {
        return Err(anyhow!(
            "agent mode listening on non-loopback address '{}' requires --agent-token (or RAUTO_AGENT_TOKEN / agent.toml token)",
            agent_args.bind
        ));
    }
    let (addr, listener) = bind_listener(&agent_args.bind, agent_args.port).await?;
    let state = AppState::new(defaults, Some(agent_config.clone()), api_token);
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

    serve_app(listener, addr, app, state).await
}

fn build_local_app(state: Arc<AppState>) -> Router {
    let protected_routes =
        local_api_routes()
            .merge(schedule_api_routes())
            .layer(middleware::from_fn_with_state(
                state.clone(),
                web_auth_middleware,
            ));
    Router::new()
        .merge(public_web_routes())
        .merge(protected_routes)
        .fallback(any(not_found))
        .layer(middleware::from_fn(disable_cache))
        .with_state(state)
}

fn schedule_api_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/schedules", get(list_schedules).post(create_schedule))
        .route("/api/schedules/preview", post(preview_schedule))
        .route(
            "/api/schedules/{id}",
            get(get_schedule)
                .put(update_schedule)
                .delete(delete_schedule),
        )
        .route("/api/schedules/{id}/enable", post(enable_schedule))
        .route("/api/schedules/{id}/disable", post(disable_schedule))
        .route("/api/schedules/{id}/run", post(run_schedule_now))
        .route("/api/schedules/{id}/runs", get(list_schedule_runs))
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
        .route("/api/auth/status", get(web_auth_status))
        .route("/api/auth/login", post(web_login))
        .route("/api/auth/logout", post(web_logout))
        .route("/", get(svelte_index))
        .route("/app", get(svelte_index))
        .route("/app/{*path}", get(svelte_index))
        .route("/favicon.ico", get(favicon))
        .route("/static/{*path}", get(static_file))
}

fn public_agent_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/health", get(health))
        .route("/api/auth/status", get(web_auth_status))
        .route("/api/agent/info", get(agent_info))
        .route("/", get(svelte_index))
        .route("/app", get(svelte_index))
        .route("/app/{*path}", get(svelte_index))
        .route("/favicon.ico", get(favicon))
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
        .route("/api/device-profiles/{name}/modes", get(get_profile_modes))
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
        .route("/api/textfsm/export/xlsx", post(export_textfsm_excel))
        .route("/api/command-flow/execute", post(execute_command_flow))
        .route("/api/flow/execute", post(execute_command_flow))
        .route("/api/connections", get(list_connections))
        .route(
            "/api/credentials",
            get(list_credentials).post(create_credential),
        )
        .route(
            "/api/credentials/{id}",
            get(get_credential)
                .put(update_credential)
                .delete(delete_credential),
        )
        .route("/api/credentials/import", post(import_credentials))
        .route(
            "/api/credentials/import-template",
            get(download_credential_import_template),
        )
        .route("/api/inventory/groups", get(list_inventory_groups))
        .route("/api/inventory/labels", get(list_inventory_labels))
        .route(
            "/api/device-discovery/runs",
            get(list_device_discovery_runs).post(create_device_discovery_run),
        )
        .route(
            "/api/device-discovery/runs/{run_id}",
            get(get_device_discovery_run),
        )
        .route(
            "/api/device-discovery/runs/{run_id}/cancel",
            post(cancel_device_discovery_run),
        )
        .route(
            "/api/device-discovery/runs/{run_id}/import",
            post(import_device_discovery_results),
        )
        .route("/api/connections/import", post(import_connections))
        .route("/api/tasks", get(list_task_runs))
        .route("/api/tasks/{task_id}", get(get_task_run_detail))
        .route(
            "/api/connections/import-template",
            get(download_connection_import_template),
        )
        .route(
            "/api/connections/{name}",
            get(get_connection)
                .put(upsert_connection)
                .delete(delete_connection),
        )
        .route(
            "/api/inventory/groups/{name}",
            get(get_inventory_group)
                .put(upsert_inventory_group)
                .delete(delete_inventory_group),
        )
        .route(
            "/api/inventory/labels/{name}",
            get(get_inventory_label)
                .put(upsert_inventory_label)
                .delete(delete_inventory_label),
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
        .route(
            "/api/connection/detect-facts",
            post(detect_connection_facts),
        )
        .route("/api/exec", post(exec_command))
        .route("/api/show/objects", get(list_show_objects))
        .route(
            "/api/show/custom-objects",
            get(list_custom_show_objects)
                .post(upsert_custom_show_object)
                .delete(delete_custom_show_object),
        )
        .route("/api/show/execute", post(execute_show))
        .route("/api/show/batch-execute", post(execute_show_batch))
        .route("/api/exec/batch-execute", post(execute_exec_batch))
        .route("/api/flow/batch-execute", post(execute_flow_batch))
        .route("/api/config/fetch", post(fetch_config))
        .route("/api/config/batch-fetch", post(fetch_config_batch))
        .route(
            "/api/device-config-history",
            get(list_device_config_history),
        )
        .route(
            "/api/device-config-history/devices",
            get(list_device_config_history_devices),
        )
        .route(
            "/api/device-config-history/{id}",
            get(get_device_config_snapshot).delete(delete_device_config_snapshot),
        )
        .route(
            "/api/config/commands",
            get(list_config_commands)
                .post(upsert_config_command)
                .delete(delete_config_command),
        )
        .route(
            "/api/config/volatile-patterns",
            get(list_config_volatile_patterns)
                .post(add_config_volatile_pattern)
                .delete(remove_config_volatile_pattern),
        )
        .route("/api/template/execute", post(execute_template))
        .route("/api/upload", post(execute_upload))
        .route("/api/tx/block", post(execute_tx_block))
        .route("/api/tx/workflow", post(execute_tx_workflow))
        .route("/api/orchestrate", post(execute_orchestration))
        .route("/api/replay", post(replay_session))
        .route("/api/templates", get(list_templates).post(create_template))
        .route("/api/templates/inspect", post(inspect_command_template))
        .route(
            "/api/templates/{name}",
            get(get_template)
                .put(update_template)
                .delete(delete_template),
        )
        .route(
            "/api/textfsm/templates",
            get(list_textfsm_templates).post(create_textfsm_template),
        )
        .route(
            "/api/textfsm/templates/{name}",
            get(get_textfsm_template)
                .put(update_textfsm_template)
                .delete(delete_textfsm_template),
        )
        .route(
            "/api/textfsm/mappings",
            get(list_textfsm_mappings)
                .post(upsert_textfsm_mapping)
                .delete(delete_textfsm_mapping),
        )
        .route(
            "/api/command-flow-templates",
            get(list_command_flow_templates).post(create_command_flow_template),
        )
        .route(
            "/api/flow-templates",
            get(list_command_flow_templates).post(create_command_flow_template),
        )
        .route(
            "/api/flow-templates/inspect",
            post(inspect_command_flow_template),
        )
        .route(
            "/api/command-flow-templates/builtins",
            get(list_builtin_command_flow_templates),
        )
        .route(
            "/api/flow-templates/builtins",
            get(list_builtin_command_flow_templates),
        )
        .route(
            "/api/command-flow-templates/builtins/{name}",
            get(get_builtin_command_flow_template),
        )
        .route(
            "/api/flow-templates/builtins/{name}",
            get(get_builtin_command_flow_template),
        )
        .route(
            "/api/command-flow-templates/{name}",
            get(get_command_flow_template)
                .put(update_command_flow_template)
                .delete(delete_command_flow_template),
        )
        .route(
            "/api/flow-templates/{name}",
            get(get_command_flow_template)
                .put(update_command_flow_template)
                .delete(delete_command_flow_template),
        )
        .route(
            "/api/tx-block-templates",
            get(list_tx_block_templates).post(create_tx_block_template),
        )
        .route(
            "/api/tx-block-templates/{name}",
            get(get_tx_block_template)
                .put(update_tx_block_template)
                .delete(delete_tx_block_template),
        )
        .route(
            "/api/tx-workflow-templates",
            get(list_tx_workflow_templates).post(create_tx_workflow_template),
        )
        .route(
            "/api/tx-workflow-templates/{name}",
            get(get_tx_workflow_template)
                .put(update_tx_workflow_template)
                .delete(delete_tx_workflow_template),
        )
        .route(
            "/api/tx-workflow-templates/{name}/preview",
            post(preview_tx_workflow_template),
        )
        .route(
            "/api/orchestration-templates",
            get(list_orchestration_templates).post(create_orchestration_template),
        )
        .route(
            "/api/orchestration-templates/{name}",
            get(get_orchestration_template)
                .put(update_orchestration_template)
                .delete(delete_orchestration_template),
        )
}

fn bind_is_loopback_only(bind: &str) -> bool {
    let normalized = bind.trim();
    if normalized.eq_ignore_ascii_case("localhost") {
        return true;
    }
    match normalized.parse::<IpAddr>() {
        Ok(ip) => ip.is_loopback(),
        Err(_) => false,
    }
}

async fn bind_listener(bind: &str, port: u16) -> Result<(SocketAddr, TcpListener)> {
    let listener = TcpListener::bind((bind, port)).await?;
    let addr = listener.local_addr()?;
    Ok((addr, listener))
}

async fn serve_app(
    listener: TcpListener,
    addr: SocketAddr,
    app: Router,
    shutdown_state: Arc<AppState>,
) -> Result<()> {
    info!("Web UI started at http://{}", addr);
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            signal::ctrl_c().await.ok();
            shutdown_state.begin_shutdown();
            if let Some(registrar) = shutdown_state.registrar() {
                registrar.shutdown_notify().await;
            }
        })
        .await?;
    Ok(())
}

async fn svelte_index() -> Response {
    svelte_index_response()
}

async fn static_file(Path(path): Path<String>) -> Response {
    static_response(&path)
}

async fn favicon() -> Response {
    static_response("favicon.svg")
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
    if !res.headers().contains_key(header::CACHE_CONTROL) {
        res.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-store, max-age=0, must-revalidate"),
        );
    }
    if !res.headers().contains_key(header::PRAGMA) {
        res.headers_mut()
            .insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
    }
    if !res.headers().contains_key(header::EXPIRES) {
        res.headers_mut()
            .insert(header::EXPIRES, HeaderValue::from_static("0"));
    }
    res
}

#[cfg(test)]
mod rneter_integration_tests;

#[cfg(test)]
mod tests {
    use super::disable_cache;
    use super::{bind_is_loopback_only, bind_listener, build_local_app};
    use crate::cli::GlobalOpts;
    use crate::web::state::AppState;
    use axum::{
        Router,
        body::Body,
        http::{HeaderValue, Request, StatusCode, header},
        middleware,
        routing::get,
    };
    use tower::util::ServiceExt;

    fn web_test_defaults() -> GlobalOpts {
        GlobalOpts {
            host: None,
            port: None,
            ssh_security: None,
            linux_shell_flavor: None,
            device_profile: None,
            template_dir: None,
            force_autodetect: false,
            session_retries: 0,
            retry_initial_backoff_ms: 200,
            retry_max_backoff_ms: 2000,
            retry_authentication_errors: false,
            connection: None,
            credential: None,
            save_connection: None,
        }
    }

    #[test]
    fn bind_is_loopback_only_accepts_localhost_and_loopback_ips() {
        assert!(bind_is_loopback_only("localhost"));
        assert!(bind_is_loopback_only("127.0.0.1"));
        assert!(bind_is_loopback_only("::1"));
    }

    #[test]
    fn bind_is_loopback_only_rejects_non_loopback_or_unspecified_hosts() {
        assert!(!bind_is_loopback_only("0.0.0.0"));
        assert!(!bind_is_loopback_only("::"));
        assert!(!bind_is_loopback_only("192.168.1.10"));
        assert!(!bind_is_loopback_only("agent.local"));
    }

    #[tokio::test]
    async fn bind_listener_rejects_an_occupied_port() {
        let occupied = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .expect("reserve test port");
        let port = occupied.local_addr().expect("read test address").port();

        assert!(bind_listener("127.0.0.1", port).await.is_err());
    }

    #[tokio::test]
    async fn local_api_requires_a_valid_web_session() {
        let app = build_local_app(AppState::new_web(web_test_defaults(), "test-password"));

        let unauthorized_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/backups")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("protected route response");
        assert_eq!(unauthorized_response.status(), StatusCode::UNAUTHORIZED);

        let login_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/auth/login")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(r#"{"password":"test-password"}"#))
                    .unwrap(),
            )
            .await
            .expect("login response");
        assert_eq!(login_response.status(), StatusCode::OK);
        let session_cookie = login_response
            .headers()
            .get(header::SET_COOKIE)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(';').next())
            .expect("session cookie")
            .to_string();

        let authorized_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/backups")
                    .header(header::COOKIE, &session_cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("authorized route response");
        assert_eq!(authorized_response.status(), StatusCode::OK);

        let logout_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/auth/logout")
                    .header(header::COOKIE, &session_cookie)
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .expect("logout response");
        assert_eq!(logout_response.status(), StatusCode::OK);

        let revoked_response = app
            .oneshot(
                Request::builder()
                    .uri("/api/backups")
                    .header(header::COOKIE, session_cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("revoked session response");
        assert_eq!(revoked_response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn disable_cache_preserves_existing_cache_control_policy() {
        let app = Router::new()
            .route(
                "/",
                get(|| async {
                    (
                        [(
                            header::CACHE_CONTROL,
                            "no-store, max-age=0, must-revalidate",
                        )],
                        StatusCode::OK,
                    )
                }),
            )
            .layer(middleware::from_fn(disable_cache));

        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .expect("route should respond");

        assert_eq!(
            response.headers().get(header::CACHE_CONTROL),
            Some(&HeaderValue::from_static(
                "no-store, max-age=0, must-revalidate"
            )),
        );
        assert_eq!(
            response.headers().get(header::PRAGMA),
            Some(&HeaderValue::from_static("no-cache")),
        );
        assert_eq!(
            response.headers().get(header::EXPIRES),
            Some(&HeaderValue::from_static("0")),
        );
    }

    #[tokio::test]
    async fn disable_cache_sets_full_cache_control_policy_when_missing() {
        let app = Router::new()
            .route("/", get(|| async { StatusCode::OK }))
            .layer(middleware::from_fn(disable_cache));

        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .expect("route should respond");

        assert_eq!(
            response.headers().get(header::CACHE_CONTROL),
            Some(&HeaderValue::from_static(
                "no-store, max-age=0, must-revalidate"
            )),
        );
        assert_eq!(
            response.headers().get(header::PRAGMA),
            Some(&HeaderValue::from_static("no-cache")),
        );
        assert_eq!(
            response.headers().get(header::EXPIRES),
            Some(&HeaderValue::from_static("0")),
        );
    }
}
