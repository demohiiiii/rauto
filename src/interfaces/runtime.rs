//! Authenticated loopback-only control plane, separate from browser login.
use crate::application::{dispatch, error::ApiError, state::AppState};
use crate::infrastructure::runtime::{PROTOCOL_VERSION, RuntimeInfo, RuntimeLock, new_id};
use crate::interfaces::api::models::{ExecutionReply, ExecutionRequest};
use anyhow::{Context, Result, bail};
use axum::{
    Json, Router,
    body::{Body, Bytes},
    extract::{DefaultBodyLimit, Request, State},
    http::{StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use std::sync::Arc;
use std::time::Duration;
use subtle::ConstantTimeEq;
use tokio::task::JoinHandle;

#[derive(Clone)]
struct ControlState {
    info: RuntimeInfo,
    app: Arc<AppState>,
}

pub struct RuntimeServer {
    http: JoinHandle<()>,
}

impl RuntimeServer {
    pub async fn start(state: Arc<AppState>, lock: &RuntimeLock) -> Result<Self> {
        let listener = tokio::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0)).await?;
        let control = ControlState {
            info: RuntimeInfo {
                protocol: PROTOCOL_VERSION,
                instance_id: new_id(),
                endpoint: format!("http://127.0.0.1:{}", listener.local_addr()?.port()),
                token: new_id(),
            },
            app: state.clone(),
        };
        lock.publish(&control.info)?;
        let app = control_router(control);
        let mut shutdown = state.subscribe_shutdown();
        let http = tokio::spawn(async move {
            let result = axum::serve(listener, app)
                .with_graceful_shutdown(async move {
                    if !*shutdown.borrow() {
                        let _ = shutdown.changed().await;
                    }
                })
                .await;
            if let Err(error) = result {
                tracing::error!("local control server failed: {error}");
                state.begin_shutdown();
            }
        });
        Ok(Self { http })
    }

    pub async fn finish(self) {
        let _ = self.http.await;
    }
}

fn control_router(state: ControlState) -> Router {
    Router::new()
        .route("/runtime", get(identity))
        .route("/execute", post(execute))
        .layer(DefaultBodyLimit::max(64 * 1024 * 1024))
        .layer(middleware::from_fn_with_state(state.clone(), authenticate))
        .with_state(state)
}

async fn authenticate(State(state): State<ControlState>, request: Request, next: Next) -> Response {
    let expected = format!("Bearer {}", state.info.token);
    let supplied = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .map(|h| h.as_bytes())
        .unwrap_or_default();
    if !bool::from(expected.as_bytes().ct_eq(supplied)) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    next.run(request).await
}

async fn identity(State(state): State<ControlState>) -> Json<serde_json::Value> {
    Json(
        serde_json::json!({ "protocol": state.info.protocol, "instance_id": state.info.instance_id }),
    )
}

async fn execute(
    State(state): State<ControlState>,
    Json(request): Json<ExecutionRequest>,
) -> Response {
    if *state.app.subscribe_shutdown().borrow() {
        return ApiError::service_unavailable("server is shutting down").into_response();
    }
    // Keep execution inside the response body, not a spawned job. Dropping the
    // connection/body drops pending execution and its in-memory permit waits.
    let body = Body::from_stream(futures_util::stream::once(async move {
        let reply = dispatch::execute(state.app, request).await;
        serde_json::to_vec(&reply)
            .map(Bytes::from)
            .map_err(std::io::Error::other)
    }));
    ([(header::CONTENT_TYPE, "application/json")], body).into_response()
}

#[derive(Clone)]
pub struct RuntimeClient {
    client: reqwest::Client,
    info: RuntimeInfo,
}

impl RuntimeClient {
    pub fn new(info: RuntimeInfo) -> Result<Self> {
        Ok(Self {
            client: reqwest::Client::builder()
                .no_proxy()
                .retry(reqwest::retry::never())
                .redirect(reqwest::redirect::Policy::none())
                .connect_timeout(Duration::from_secs(2))
                .build()?,
            info,
        })
    }
    pub async fn healthy(&self) -> Result<bool> {
        #[derive(serde::Deserialize)]
        struct Identity {
            protocol: u32,
            instance_id: String,
        }
        let response = self
            .client
            .get(format!("{}/runtime", self.info.endpoint))
            .bearer_auth(&self.info.token)
            .timeout(Duration::from_secs(2))
            .send()
            .await?
            .error_for_status()?
            .json::<Identity>()
            .await?;
        Ok(response.protocol == PROTOCOL_VERSION && response.instance_id == self.info.instance_id)
    }
    pub async fn execute(&self, request: &ExecutionRequest) -> Result<ExecutionReply> {
        let execution = async {
            let response = self
                .client
                .post(format!("{}/execute", self.info.endpoint))
                .bearer_auth(&self.info.token)
                .json(request)
                .send()
                .await?;
            if !response.status().is_success() {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                let message = serde_json::from_str::<serde_json::Value>(&text)
                    .ok()
                    .and_then(|v| v["error"]["message"].as_str().map(str::to_owned))
                    .unwrap_or_else(|| status.to_string());
                bail!("background service: {message}");
            }
            response
                .json()
                .await
                .context("read service execution result")
        };
        tokio::select! {
            result = execution => result.context("service execution failed; device state may have changed. No automatic retry or local execution was attempted"),
            _ = tokio::signal::ctrl_c() => bail!("Stopped waiting for execution; verify device state before running the command again. No automatic retry was attempted"),
        }
    }
}

pub enum ExecutionBackend {
    Local(RuntimeLock),
    Service(RuntimeClient),
}

pub async fn discover(home: &std::path::Path) -> Result<ExecutionBackend> {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(15);
    loop {
        if let Some(lock) = RuntimeLock::try_acquire(home)? {
            return Ok(ExecutionBackend::Local(lock));
        }
        if let Ok(info) = RuntimeLock::read(home) {
            let client = RuntimeClient::new(info)?;
            if client.healthy().await.unwrap_or(false) {
                return Ok(ExecutionBackend::Service(client));
            }
        }
        if tokio::time::Instant::now() >= deadline {
            bail!(
                "rauto runtime is busy or its service is unavailable; refusing to open a second device runtime"
            );
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

pub async fn acquire_service(home: &std::path::Path) -> Result<RuntimeLock> {
    loop {
        if let Some(lock) = RuntimeLock::try_acquire(home)? {
            return Ok(lock);
        }
        if let Ok(info) = RuntimeLock::read(home) {
            let client = RuntimeClient::new(info)?;
            if client.healthy().await.unwrap_or(false) {
                bail!("a service is already running for this RAUTO_HOME");
            }
        }
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_millis(200)) => {},
            _ = tokio::signal::ctrl_c() => bail!("service startup cancelled while waiting for runtime ownership"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cli::{Cli, execution::prepare};
    use crate::infrastructure::db;
    use crate::interfaces::api::models::{ExecutionAction, ExecutionOutput};
    use axum::{body::to_bytes, http::Request};
    use clap::Parser;
    use tower::ServiceExt;

    async fn virtual_device_request(
        persona: rneter::testkit::DevicePersona,
        profile: &str,
    ) -> Result<(
        rneter::testkit::FakeSshDevice,
        Arc<AppState>,
        ExecutionRequest,
    )> {
        let credential = db::device_credential_store::create_credential(
            &crate::domain::credential::DeviceCredentialInput {
                name: "runtime-test".into(),
                username: persona.username.clone(),
                password: Some(persona.password.clone()),
                ..Default::default()
            },
        )?;
        let device = rneter::testkit::FakeSshDevice::spawn(persona).await?;
        let mut cli = Cli::try_parse_from([
            "rauto",
            "--host",
            "127.0.0.1",
            "--ssh-port",
            &device.port().to_string(),
            "--device-profile",
            profile,
            "--credential",
            &credential.id,
            "exec",
            "unused",
        ])?;
        cli.global_opts.ssh_security =
            Some(crate::config::ssh_security::SshSecurityProfile::TestNoCheck);
        let state = AppState::new(cli.global_opts.clone(), None, None);
        Ok((device, state, prepare(&cli)?.unwrap().request))
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn shutdown_cancels_interactive_and_upload_waits_without_sending_commands() -> Result<()>
    {
        // Uploads use the managed home directory. Isolate the whole test process
        // rather than changing process-wide environment variables during async tests.
        const ISOLATED_HOME: &str = "RAUTO_SHUTDOWN_TEST_HOME";
        let Some(root) = std::env::var_os(ISOLATED_HOME) else {
            let root = std::env::temp_dir().join(format!("rauto-shutdown-{}", new_id()));
            let output = std::process::Command::new(std::env::current_exe()?)
                .args(["--exact", "interfaces::runtime::tests::shutdown_cancels_interactive_and_upload_waits_without_sending_commands", "--nocapture"])
                .env("RAUTO_HOME", &root)
                .env(ISOLATED_HOME, &root)
                .output()?;
            let _ = std::fs::remove_dir_all(root);
            assert!(
                output.status.success(),
                "{}\n{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            return Ok(());
        };
        let path = std::path::PathBuf::from(root).join("test.db");
        let _db_guard = db::override_test_db_path(path.clone());
        db::init_sync()?;
        let (device, defaults, request) =
            virtual_device_request(rneter::testkit::DevicePersona::builtin("linux")?, "linux")
                .await?;
        for action in [
            serde_json::json!({"kind":"interactive", "request":{"content":"name = 'test'\ncommand = 'uname -a'"}}),
            serde_json::json!({"kind":"upload", "request":{"request":{"local_path":"test.txt", "remote_path":"/tmp/test.txt"}, "content_base64":"dGVzdA=="}}),
        ] {
            let state = AppState::new(defaults.defaults.clone(), None, None);
            let mut request = request.clone();
            request.options.save_device = Some("cancelled-device".into());
            request.action = serde_json::from_value(action)?;
            let info = RuntimeInfo {
                protocol: PROTOCOL_VERSION,
                instance_id: new_id(),
                endpoint: "http://127.0.0.1:1".into(),
                token: new_id(),
            };
            let app = control_router(ControlState {
                info: info.clone(),
                app: state.clone(),
            });
            let lease =
                crate::application::limits::ExecutionLease::acquire("127.0.0.1", device.port())
                    .await;
            let response = app
                .oneshot(
                    Request::post("/execute")
                        .header("authorization", format!("Bearer {}", info.token))
                        .header("content-type", "application/json")
                        .body(Body::from(serde_json::to_vec(&request)?))?,
                )
                .await?;
            let mut body = Box::pin(to_bytes(response.into_body(), 1024 * 1024));
            assert!(
                tokio::time::timeout(Duration::from_millis(25), &mut body)
                    .await
                    .is_err()
            );
            if matches!(request.action, ExecutionAction::Upload { .. }) {
                let files =
                    std::fs::read_dir(crate::config::paths::rauto_home_dir().join("uploads"))?
                        .collect::<std::io::Result<Vec<_>>>()?;
                assert_eq!(files.len(), 1);
                assert_eq!(std::fs::read(files[0].path())?, b"test");
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    assert_eq!(files[0].metadata()?.permissions().mode() & 0o777, 0o600);
                }
            }
            state.begin_shutdown();
            let bytes = tokio::time::timeout(Duration::from_secs(2), body).await??;
            let reply: ExecutionReply = serde_json::from_slice(&bytes)?;
            let ExecutionReply::Failed(error) = reply else {
                panic!("request survived shutdown: {reply:?}")
            };
            assert_eq!(error.code, "service_unavailable");
            drop(lease);
            let ExecutionReply::Failed(error) = dispatch::execute(state, request).await else {
                panic!("shutdown must reject ready execution")
            };
            assert_eq!(error.code, "service_unavailable");
            assert!(device.received_commands().is_empty());
            assert!(
                crate::config::connection_store::load_connection_raw("cancelled-device").is_err()
            );
        }
        assert_eq!(
            std::fs::read_dir(crate::config::paths::rauto_home_dir().join("uploads"))?.count(),
            0
        );
        db::close_test_db(&path).await;
        Ok(())
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn cli_templates_continue_after_failure_while_web_templates_stop() -> Result<()> {
        use crate::interfaces::api::models::CommandErrorPolicy;
        let root = std::env::temp_dir().join(format!("rauto-template-policy-{}", new_id()));
        let path = root.join("test.db");
        let _db_guard = db::override_test_db_path(path.clone());
        db::init_sync()?;
        let (device, state, mut request) = virtual_device_request(
            rneter::testkit::DevicePersona::builtin("huawei")?.with_faults(
                rneter::testkit::FaultInjection::new()
                    .with_disconnect_command("disconnect-once", 1),
            ),
            "huawei_vrp",
        )
        .await?;
        request.action = serde_json::from_value(serde_json::json!({"kind":"template", "request":{
            "template_content":"make-error\ndisplay version", "vars":{}, "mode":"Enable"
        }}))?;
        for (policy, count) in [
            (CommandErrorPolicy::Continue, 2),
            (CommandErrorPolicy::Stop, 1),
        ] {
            request.options.template_error_policy = policy;
            let reply = match policy {
                CommandErrorPolicy::Continue => {
                    dispatch::execute(state.clone(), request.clone()).await
                }
                CommandErrorPolicy::Stop => {
                    let ExecutionAction::Template(template) = request.action.clone() else {
                        unreachable!()
                    };
                    ExecutionReply::Completed(Box::new(ExecutionOutput::Template(
                        crate::application::execution::execute_template(state.clone(), template)
                            .await
                            .map_err(|error| anyhow::anyhow!(error.message))?
                            .data
                            .context("missing Web result")?,
                    )))
                }
            };
            assert!(!reply.success());
            let ExecutionReply::Completed(output) = reply else {
                panic!("expected command results: {reply:?}")
            };
            let ExecutionOutput::Template(result) = *output else {
                panic!("expected template result")
            };
            assert_eq!(result.executed.len(), count);
            assert!(!result.executed[0].success);
            if count == 2 {
                assert!(result.executed[1].success);
                let recording = root.join("recording.jsonl");
                let expected = result
                    .recording_jsonl
                    .clone()
                    .context("missing real recording")?;
                let error = crate::cli::execution::present(
                    ExecutionReply::Completed(Box::new(ExecutionOutput::Template(result))),
                    &crate::cli::execution::Presentation {
                        record_file: Some(recording.clone()),
                        ..Default::default()
                    },
                )
                .expect_err("partial success must return a CLI failure");
                assert!(error.to_string().contains("failed commands"));
                assert_eq!(std::fs::read_to_string(recording)?, expected);
            }
        }
        assert_eq!(
            device
                .received_commands()
                .iter()
                .filter(|command| *command == "display version")
                .count(),
            1
        );
        request.options.template_error_policy = CommandErrorPolicy::Continue;
        if let ExecutionAction::Template(template) = &mut request.action {
            template.template_content = Some("disconnect-once\ndisplay clock".into());
        }
        let reply = dispatch::execute(state, request).await;
        let ExecutionReply::Completed(output) = reply else {
            panic!("expected aggregated transport failure: {reply:?}")
        };
        let ExecutionOutput::Template(result) = *output else {
            panic!("expected template result")
        };
        assert!(!result.result_summary.success);
        assert_eq!(result.executed.len(), 2);
        assert!(result.executed[0].error.is_some());
        assert!(result.executed[1].success);
        assert!(
            device
                .received_commands()
                .iter()
                .any(|command| command == "display clock")
        );
        db::close_test_db(&path).await;
        std::fs::remove_dir_all(root)?;
        Ok(())
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn local_and_http_execution_share_success_failure_and_typed_results() -> Result<()> {
        let root = std::env::temp_dir().join(format!("rauto-contract-{}", new_id()));
        std::fs::create_dir_all(&root)?;
        let path = root.join("test.db");
        let _db_guard = db::override_test_db_path(path.clone());
        db::init_sync()?;
        let cli = Cli::try_parse_from(["rauto", "exec", "--template", "unused", "--dry-run"])?;
        let state = AppState::new(cli.global_opts.clone(), None, None);
        let mut request = prepare(&cli)?.unwrap().request;
        let ExecutionAction::Template(ref mut template) = request.action else {
            panic!("template");
        };
        template.template = None;
        template.template_content = Some("echo {{ address }}".into());
        template.vars = serde_json::json!({"address": "192.0.2.1"});
        let info = RuntimeInfo {
            protocol: PROTOCOL_VERSION,
            instance_id: new_id(),
            endpoint: "http://127.0.0.1:1".into(),
            token: new_id(),
        };
        let app = control_router(ControlState {
            info: info.clone(),
            app: state.clone(),
        });
        for (success, request) in [
            (true, request.clone()),
            (false, {
                let mut bad = request;
                if let ExecutionAction::Template(ref mut t) = bad.action {
                    t.vars = serde_json::json!({});
                }
                bad
            }),
        ] {
            let local = dispatch::execute(state.clone(), request.clone()).await;
            let response = app
                .clone()
                .oneshot(
                    Request::post("/execute")
                        .header("authorization", format!("Bearer {}", info.token))
                        .header("content-type", "application/json")
                        .body(Body::from(serde_json::to_vec(&request)?))?,
                )
                .await?;
            assert_eq!(response.status(), StatusCode::OK);
            let reply: ExecutionReply =
                serde_json::from_slice(&to_bytes(response.into_body(), 1024 * 1024).await?)?;
            assert_eq!(serde_json::to_value(&local)?, serde_json::to_value(&reply)?);
            assert_eq!(reply.success(), success);
        }
        let unauthorized = app
            .clone()
            .oneshot(
                Request::post("/execute")
                    .header("content-type", "application/json")
                    .body(Body::from("{}"))?,
            )
            .await?;
        assert_eq!(unauthorized.status(), StatusCode::UNAUTHORIZED);
        db::close_test_db(&path).await;
        std::fs::remove_dir_all(root)?;
        Ok(())
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn successful_workflows_save_devices_with_and_without_recording() -> Result<()> {
        let root = std::env::temp_dir().join(format!("rauto-workflow-save-{}", new_id()));
        std::fs::create_dir_all(&root)?;
        let path = root.join("test.db");
        let _db_guard = db::override_test_db_path(path.clone());
        db::init_sync()?;
        let (device, state, mut request) =
            virtual_device_request(rneter::testkit::DevicePersona::builtin("huawei")?, "huawei")
                .await?;
        for (name, level) in [("unrecorded", None), ("recorded", Some("key-events-only"))] {
            request.options.save_device = Some(name.into());
            request.action = serde_json::from_value(serde_json::json!({
                "kind": "workflow",
                "request": {
                    "record_level": level,
                    "workflow": {
                        "name": "save-test", "fail_fast": true,
                        "blocks": [{
                            "name": "test", "rollback_policy": "none", "fail_fast": true,
                            "steps": [{"run": {"kind": "command", "mode": "Enable", "command": "display clock"}}]
                        }]
                    }
                }
            }))?;
            let reply = dispatch::execute(state.clone(), request.clone()).await;
            assert!(reply.success(), "workflow failed: {reply:?}");
            let saved = crate::config::connection_store::load_connection(name)?;
            assert_eq!(saved.host.as_deref(), Some("127.0.0.1"));
            assert_eq!(saved.port, Some(device.port()));
            assert_eq!(saved.device_profile.as_deref(), Some("huawei"));
            assert_eq!(saved.credential_id, request.options.credential);
        }
        db::close_test_db(&path).await;
        std::fs::remove_dir_all(root)?;
        Ok(())
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn shared_execution_uses_rneter_virtual_device_and_reports_nonzero_exit() -> Result<()> {
        use crate::domain::credential::DeviceCredentialInput;
        use rneter::testkit::{DevicePersona, FakeSshDevice};
        let root = std::env::temp_dir().join(format!("rauto-execution-{}", new_id()));
        std::fs::create_dir_all(&root)?;
        let path = root.join("test.db");
        let _db_guard = db::override_test_db_path(path.clone());
        db::init_sync()?;
        let persona = DevicePersona::builtin("linux")?;
        let username = persona.username.clone();
        let password = persona.password.clone();
        let device = FakeSshDevice::spawn(persona).await?;
        let credential = db::device_credential_store::create_credential(&DeviceCredentialInput {
            name: "test".into(),
            username,
            password: Some(password),
            ..Default::default()
        })?;
        crate::config::connection_store::save_connection(
            "saved",
            &crate::config::connection_store::SavedConnection {
                credential_id: Some(credential.id.clone()),
                host: Some("127.0.0.1".into()),
                port: Some(1),
                connect_timeout_secs: None,
                device_model: None,
                software_version: None,
                ssh_security: None,
                linux_shell_flavor: None,
                output_encoding: Default::default(),
                device_profile: Some("huawei_vrp".into()),
                enabled: true,
                labels: vec![],
                groups: vec![],
                vars: serde_json::json!({}),
            },
        )?;
        let mut cli = Cli::try_parse_from([
            "rauto",
            "--device",
            "saved",
            "--host",
            "127.0.0.1",
            "--ssh-port",
            &device.port().to_string(),
            "--device-profile",
            "linux",
            "--credential",
            &credential.id,
            "exec",
            "uname -a",
        ])?;
        cli.global_opts.ssh_security =
            Some(crate::config::ssh_security::SshSecurityProfile::TestNoCheck);
        let state = AppState::new(cli.global_opts.clone(), None, None);
        let request = prepare(&cli)?.unwrap().request;
        let reply = dispatch::execute(state.clone(), request.clone()).await;
        let ExecutionReply::Completed(output) = reply else {
            panic!("unexpected reply: {reply:?}");
        };
        let ExecutionOutput::Exec(result) = *output else {
            panic!("unexpected output: {output:?}");
        };
        assert!(result.result_summary.success);
        assert!(result.output.contains("Linux"));
        assert!(
            device
                .received_commands()
                .iter()
                .any(|command| command == "uname -a")
        );
        let info = RuntimeInfo {
            protocol: PROTOCOL_VERSION,
            instance_id: new_id(),
            endpoint: "http://127.0.0.1:1".into(),
            token: new_id(),
        };
        let app = control_router(ControlState {
            info: info.clone(),
            app: state.clone(),
        });
        let lease =
            crate::application::limits::ExecutionLease::acquire("127.0.0.1", device.port()).await;
        let response = app
            .oneshot(
                Request::post("/execute")
                    .header("authorization", format!("Bearer {}", info.token))
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_vec(&request)?))?,
            )
            .await?;
        let mut body = Box::pin(to_bytes(response.into_body(), 1024 * 1024));
        assert!(
            tokio::time::timeout(Duration::from_millis(25), &mut body)
                .await
                .is_err()
        );
        drop(body);
        drop(lease);
        let next = tokio::time::timeout(
            Duration::from_secs(2),
            dispatch::execute(state.clone(), request.clone()),
        )
        .await?;
        assert!(next.success());
        assert_eq!(
            device
                .received_commands()
                .iter()
                .filter(|command| *command == "uname -a")
                .count(),
            2
        );
        let mut failed = request;
        if let ExecutionAction::Exec(ref mut exec) = failed.action {
            exec.command = "make-error".into();
        }
        let mut invalid_credential = failed.clone();
        invalid_credential.options.credential = Some("missing-credential".into());
        let invalid = dispatch::execute(state.clone(), invalid_credential).await;
        let ExecutionReply::Failed(error) = invalid else {
            panic!("invalid credential was ignored");
        };
        assert_eq!(error.code, "invalid_request");
        let failure = dispatch::execute(state, failed).await;
        assert!(!failure.success());

        db::close_test_db(&path).await;
        std::fs::remove_dir_all(root)?;
        Ok(())
    }
}
