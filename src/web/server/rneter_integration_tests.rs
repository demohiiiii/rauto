use super::build_local_app;
use crate::cli::GlobalOpts;
use crate::config::connection_store::{SavedConnection, save_connection};
use crate::config::device_credential_store::{DeviceCredentialInput, create_credential};
use crate::config::ssh_security::SshSecurityProfile;
use crate::db;
use crate::infrastructure::db::device_config_store;
use crate::web::state::AppState;
use axum::Router;
use axum::body::{Body, to_bytes};
use axum::http::{Request, StatusCode, header};
use rneter::testkit::{
    DEFAULT_ENABLE_PASSWORD, DEFAULT_PASSWORD, DEFAULT_USERNAME, DevicePersona, FakeSshDevice,
    FaultInjection,
};
use serde_json::{Value, json};
use std::future::Future;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tower::ServiceExt;

static TEST_ROOT_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn is_execution_endpoint(path: &str) -> bool {
    matches!(
        path,
        "/api/exec"
            | "/api/exec/async"
            | "/api/exec/batch-execute"
            | "/api/template/execute"
            | "/api/template/execute/async"
            | "/api/interactive/execute"
            | "/api/interactive/batch-execute"
            | "/api/show/execute"
            | "/api/show/batch-execute"
            | "/api/config/fetch"
            | "/api/config/batch-fetch"
            | "/api/upload"
            | "/api/tx/workflow"
            | "/api/tx/workflow/async"
            | "/api/orchestrate"
            | "/api/orchestrate/async"
    )
}

struct TestRoot {
    path: PathBuf,
}

impl TestRoot {
    fn new() -> Self {
        let sequence = TEST_ROOT_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before Unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "rauto-rneter-http-{}-{timestamp}-{sequence}",
            std::process::id()
        ));
        std::fs::create_dir_all(&path).expect("create rneter HTTP test root");
        Self { path }
    }

    fn db_path(&self) -> PathBuf {
        self.path.join("rauto.db")
    }
}

impl Drop for TestRoot {
    fn drop(&mut self) {
        if let Err(error) = std::fs::remove_dir_all(&self.path)
            && error.kind() != std::io::ErrorKind::NotFound
        {
            if std::thread::panicking() {
                eprintln!(
                    "failed to remove rneter HTTP test root {}: {error}",
                    self.path.display()
                );
            } else {
                panic!(
                    "failed to remove rneter HTTP test root {}: {error}",
                    self.path.display()
                );
            }
        }
    }
}

struct TestDevice {
    connection_name: String,
    handle: FakeSshDevice,
}

struct RouteTestContext {
    app: Router,
    credential_id: String,
}

impl RouteTestContext {
    async fn spawn_cisco(&self, connection_name: &str, faults: FaultInjection) -> TestDevice {
        let persona = DevicePersona::builtin("cisco_ios")
            .expect("load cisco_ios test persona")
            .with_faults(faults);
        self.spawn_cisco_with(connection_name, persona, Vec::new(), Vec::new())
            .await
    }

    async fn spawn_cisco_with(
        &self,
        connection_name: &str,
        persona: DevicePersona,
        labels: Vec<&str>,
        groups: Vec<&str>,
    ) -> TestDevice {
        let handle = FakeSshDevice::spawn(persona)
            .await
            .expect("spawn Cisco virtual device");
        let connection = handle
            .connection_request()
            .expect("build virtual device connection request");
        save_connection(
            connection_name,
            &SavedConnection {
                host: Some(connection.addr),
                credential_id: Some(self.credential_id.clone()),
                port: Some(connection.port),
                connect_timeout_secs: Some(10),
                device_model: None,
                software_version: None,
                ssh_security: Some(SshSecurityProfile::TestNoCheck),
                linux_shell_flavor: None,
                output_encoding: Default::default(),
                device_profile: Some("cisco_ios".to_string()),
                template_dir: None,
                enabled: true,
                labels: labels.into_iter().map(str::to_string).collect(),
                vars: json!({}),
                groups: groups.into_iter().map(str::to_string).collect(),
            },
        )
        .expect("save virtual device connection");
        TestDevice {
            connection_name: connection_name.to_string(),
            handle,
        }
    }

    async fn post_json(&self, path: &str, body: Value) -> TestResponse {
        let response = self
            .app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(path)
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(body.to_string()))
                    .expect("build HTTP integration request"),
            )
            .await
            .expect("route should return a response");
        let status = response.status();
        let bytes = to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read HTTP integration response body");
        let envelope: Value = serde_json::from_slice(&bytes).unwrap_or_else(|error| {
            panic!(
                "parse JSON response from {path}: {error}; body={}",
                String::from_utf8_lossy(&bytes)
            )
        });
        let execution_endpoint = is_execution_endpoint(path);
        let body = if execution_endpoint && status.is_success() {
            let mut data = envelope.get("data").cloned().unwrap_or(Value::Null);
            if let (Value::Object(data), Some(summary)) =
                (&mut data, envelope.get("result_summary"))
            {
                data.insert("result_summary".to_string(), summary.clone());
            }
            data
        } else {
            envelope.clone()
        };
        TestResponse {
            endpoint: path.to_string(),
            status,
            body,
            envelope,
            execution_endpoint,
        }
    }

    async fn get_json(&self, path: &str) -> TestResponse {
        let response = self
            .app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(path)
                    .body(Body::empty())
                    .expect("build HTTP integration request"),
            )
            .await
            .expect("route should return a response");
        let status = response.status();
        let bytes = to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read HTTP integration response body");
        let body: Value = serde_json::from_slice(&bytes).unwrap_or_else(|error| {
            panic!(
                "parse JSON response from {path}: {error}; body={}",
                String::from_utf8_lossy(&bytes)
            )
        });
        TestResponse {
            endpoint: path.to_string(),
            status,
            envelope: body.clone(),
            body,
            execution_endpoint: false,
        }
    }
}

struct TestResponse {
    endpoint: String,
    status: StatusCode,
    body: Value,
    envelope: Value,
    execution_endpoint: bool,
}

impl TestResponse {
    fn assert_ok(&self) -> &Value {
        assert!(
            self.status.is_success(),
            "{} returned {}: {}",
            self.endpoint,
            self.status,
            self.body
        );
        if self.execution_endpoint {
            assert_eq!(
                self.envelope.as_object().map(|object| object.len()),
                Some(4),
                "{} should return exactly the unified execution envelope: {}",
                self.endpoint,
                self.envelope
            );
            assert!(self.envelope["success"].is_boolean());
            assert!(self.envelope.get("error").is_some());
            assert!(self.envelope["result_summary"].is_object());
            assert!(self.envelope["data"].is_object());
            assert!(self.envelope["data"].get("result_summary").is_none());
            assert_eq!(
                self.envelope["success"], self.envelope["result_summary"]["success"],
                "{} envelope and summary outcomes should agree",
                self.endpoint
            );
            if self.envelope["success"] == json!(true) {
                assert!(self.envelope["error"].is_null());
            } else {
                assert!(self.envelope["error"]["code"].is_string());
                assert!(self.envelope["error"]["message"].is_string());
            }
        }
        &self.body
    }
}

fn defaults() -> GlobalOpts {
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

fn run_route_test<F, Fut>(test: F)
where
    F: FnOnce(RouteTestContext) -> Fut,
    Fut: Future<Output = ()>,
{
    let root = TestRoot::new();
    let db_path = root.db_path();
    let worker_db_path = db_path.clone();
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .on_thread_start(move || {
            db::set_test_db_path_for_current_thread(worker_db_path.clone());
        })
        .build()
        .expect("build rneter HTTP test runtime");
    let _db_guard = db::override_test_db_path(db_path.clone());

    let test_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        runtime.block_on(async move {
            db::init().await.expect("initialize isolated test database");
            let credential = create_credential(&DeviceCredentialInput {
                name: "rneter-http-test".to_string(),
                username: DEFAULT_USERNAME.to_string(),
                password: Some(DEFAULT_PASSWORD.to_string()),
                enable_password: Some(DEFAULT_ENABLE_PASSWORD.to_string()),
                enable_enabled: true,
                ..Default::default()
            })
            .expect("create virtual device credential");
            let app = build_local_app(AppState::new(defaults(), None, None));
            test(RouteTestContext {
                app,
                credential_id: credential.id,
            })
            .await;
        });
    }));

    runtime.block_on(db::close_test_db(&db_path));
    drop(runtime);
    drop(root);
    if let Err(payload) = test_result {
        std::panic::resume_unwind(payload);
    }
}

fn multiline_interactive() -> &'static str {
    r#"name = "http-test-interactive"
mode = "Enable"

command = "show clock\nshow inventory\nshow interfaces"
multiline_mode = "split_lines"
"#
}

fn assert_success_summary(body: &Value) {
    assert_eq!(body["result_summary"]["success"], json!(true));
}

fn command_attempts(device: &FakeSshDevice, command: &str) -> usize {
    device
        .received_commands()
        .iter()
        .filter(|received| received.as_str() == command)
        .count()
}

fn business_command_delta(device: &FakeSshDevice, cursor: &mut usize) -> Vec<String> {
    let commands = device.received_commands();
    let delta = commands
        .get(*cursor..)
        .expect("command log cursor should stay within the device log");
    *cursor = commands.len();
    delta
        .iter()
        .filter(|command| {
            !matches!(
                command.as_str(),
                "enable" | DEFAULT_ENABLE_PASSWORD | "terminal pager 0" | "disable"
            )
        })
        .cloned()
        .collect()
}

fn assert_next_commands(device: &FakeSshDevice, cursor: &mut usize, expected: &[&str]) {
    assert_eq!(
        business_command_delta(device, cursor),
        expected
            .iter()
            .map(|command| (*command).to_string())
            .collect::<Vec<_>>()
    );
}

fn assert_next_commands_in_any_order(
    device: &FakeSshDevice,
    cursor: &mut usize,
    expected: &[&str],
) {
    let mut actual = business_command_delta(device, cursor);
    actual.sort();
    let mut expected = expected
        .iter()
        .map(|command| (*command).to_string())
        .collect::<Vec<_>>();
    expected.sort();
    assert_eq!(actual, expected);
}

fn assert_sha256(value: &Value) {
    let hash = value.as_str().expect("SHA-256 should be a string");
    assert_eq!(hash.len(), 64, "unexpected SHA-256 value: {hash}");
    assert!(hash.bytes().all(|byte| byte.is_ascii_hexdigit()));
}

fn assert_normalized_running_config(result: &Value, expected_content: &str) {
    assert_eq!(result["kind"], json!("running"));
    assert_eq!(result["command"], json!("show running-config"));
    let content = result["content"]
        .as_str()
        .expect("original config content should be returned");
    assert!(content.contains(expected_content.trim()));
    assert!(content.contains("Last configuration change"));
    let normalized = result["normalized_content"]
        .as_str()
        .expect("normalized config content should be returned");
    assert!(!normalized.contains("Building configuration"));
    assert!(!normalized.contains("Last configuration change"));
    assert!(normalized.contains("hostname edge-1"));
    assert!(normalized.contains("interface Ethernet1"));
    assert_sha256(&result["sha256"]);
    assert_sha256(&result["normalized_sha256"]);
    assert_ne!(result["sha256"], result["normalized_sha256"]);
    assert!(result["error"].is_null());
}

fn assert_batch_success(body: &Value) -> &[Value] {
    assert_eq!(body["targets"], json!(["edge-a", "edge-b"]));
    let results = body["results"]
        .as_array()
        .expect("batch results should be an array");
    assert_eq!(results.len(), 2);
    assert_eq!(results[0]["target"], json!("edge-a"));
    assert_eq!(results[1]["target"], json!("edge-b"));
    assert_eq!(body["result_summary"]["counts"]["succeeded"], json!(2));
    assert_eq!(body["result_summary"]["counts"]["failed"], json!(0));
    assert_success_summary(body);
    results
}

fn assert_batch_partial_success(body: &Value) -> &[Value] {
    assert_eq!(body["targets"], json!(["edge-a", "edge-b"]));
    assert_eq!(body["result_summary"]["outcome"], json!("partial_success"));
    assert_eq!(body["result_summary"]["success"], json!(false));
    assert_eq!(body["result_summary"]["counts"]["total"], json!(2));
    assert_eq!(body["result_summary"]["counts"]["succeeded"], json!(1));
    assert_eq!(body["result_summary"]["counts"]["failed"], json!(1));
    let results = body["results"]
        .as_array()
        .expect("batch results should be an array");
    assert_eq!(results.len(), 2);
    assert_eq!(results[0]["target"], json!("edge-a"));
    assert_eq!(results[1]["target"], json!("edge-b"));
    results
}

fn assert_nonempty_error(result: &Value) {
    assert!(
        result["error"]
            .as_str()
            .is_some_and(|error| !error.trim().is_empty()),
        "expected a non-empty target error: {result}"
    );
}

fn retry_once_without_backoff() -> Value {
    json!({
        "max_retries": 1,
        "initial_backoff_ms": 0,
        "max_backoff_ms": 0
    })
}

fn assert_single_target_batch_success<'a>(body: &'a Value, target: &str) -> &'a Value {
    assert_eq!(body["targets"], json!([target]));
    assert_eq!(body["result_summary"]["outcome"], json!("success"));
    assert_eq!(body["result_summary"]["success"], json!(true));
    assert_eq!(body["result_summary"]["counts"]["total"], json!(1));
    assert_eq!(body["result_summary"]["counts"]["succeeded"], json!(1));
    assert_eq!(body["result_summary"]["counts"]["failed"], json!(0));
    let results = body["results"]
        .as_array()
        .expect("batch results should be an array");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0]["target"], json!(target));
    &results[0]
}

#[test]
fn http_interactive_templates_save_inspect_and_execute_prompts() {
    run_route_test(|context| async move {
        let persona = DevicePersona::builtin("cisco_ios").unwrap().with_challenge(
            "copy image",
            "Continue?",
            "yes",
        );
        let device = context
            .spawn_cisco_with("edge-a", persona, Vec::new(), Vec::new())
            .await;
        let content = r#"name = "copy-image"
command = "copy {{source}}"
mode = "Enable"
timeout_secs = 5
[[prompts]]
patterns = ['Continue\?']
response = "{{answer}}"
append_newline = true
record_input = false
"#;
        let inspection = context
            .post_json(
                "/api/interactive-templates/inspect",
                json!({"content":content}),
            )
            .await;
        let inspection = inspection.assert_ok();
        assert_eq!(inspection["vars_schema"].as_array().unwrap().len(), 2);
        assert!(
            !inspection["content"]
                .as_str()
                .unwrap()
                .contains("[[steps]]")
        );
        context
            .post_json(
                "/api/interactive-templates",
                json!({"name":"copy-image", "content":content}),
            )
            .await
            .assert_ok();
        let saved = context
            .get_json("/api/interactive-templates/copy-image")
            .await;
        assert!(
            saved.assert_ok()["content"]
                .as_str()
                .unwrap()
                .contains("[[prompts]]")
        );
        let mut cursor = 0;
        for batch in [false, true] {
            let (path, payload) = if batch {
                (
                    "/api/interactive/batch-execute",
                    json!({"template_name":"copy-image", "vars":{"source":"image", "answer":"yes"}, "targets":[device.connection_name]}),
                )
            } else {
                (
                    "/api/interactive/execute",
                    json!({"template_name":"copy-image", "vars":{"source":"image", "answer":"yes"}, "connection":{"connection_name":device.connection_name}}),
                )
            };
            let response = context.post_json(path, payload).await;
            let result = response.assert_ok();
            assert_success_summary(result);
            let outputs = if batch {
                &result["results"][0]["outputs"]
            } else {
                &result["outputs"]
            };
            assert_eq!(outputs.as_array().unwrap().len(), 1);
            assert_next_commands(&device.handle, &mut cursor, &["copy image", "yes"]);
        }
        let old = "name = \"old\"\n[[steps]]\ncommand = \"show version\"";
        for path in [
            "/api/interactive-templates/inspect",
            "/api/interactive-templates",
            "/api/interactive/execute",
        ] {
            let response = context.post_json(path, json!({"name":"old", "content":old,"connection":{"connection_name":device.connection_name}})).await;
            assert_eq!(response.status, StatusCode::BAD_REQUEST);
            assert!(
                response.body["error"]["message"]
                    .as_str()
                    .unwrap()
                    .contains("unsupported interactive command field: steps")
            );
        }
        assert_next_commands(&device.handle, &mut cursor, &[]);
    });
}

#[test]
fn workbench_connection_preserves_heartbeat_policy_through_execution_and_releases_session() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco("heartbeat-edge", FaultInjection::new())
            .await;
        let request = device.handle.connection_request().expect("device request");
        let execution_context = device
            .handle
            .execution_context()
            .with_keep_alive(true)
            .with_keep_alive_interval_secs(45);
        let original = rneter::session::MANAGER
            .get_with_context(request.clone(), execution_context.clone())
            .await
            .expect("establish heartbeat session");
        let connection = json!({
            "connection_name": device.connection_name,
            "keep_alive": { "enabled": true, "interval_secs": 45 }
        });
        let connected = context
            .post_json("/api/connection/connect", json!({"connection": connection}))
            .await;
        let connected = connected.assert_ok();
        assert_eq!(connected["ok"], true);
        let reused = rneter::session::MANAGER
            .get_with_context(request.clone(), execution_context.clone())
            .await
            .expect("inspect warmed connection");
        assert!(
            original.same_channel(&reused),
            "connect endpoint must apply heartbeat settings"
        );

        for overrides in [json!({}), json!({"device_profile": "autodetect"})] {
            let mut test_connection = json!({"connection_name": device.connection_name});
            test_connection
                .as_object_mut()
                .unwrap()
                .extend(overrides.as_object().unwrap().clone());
            context
                .post_json(
                    "/api/connection/test",
                    json!({"connection": test_connection}),
                )
                .await
                .assert_ok();
            let after_test = rneter::session::MANAGER
                .get_with_context(request.clone(), execution_context.clone())
                .await
                .expect("inspect connection after independent test");
            assert!(
                original.same_channel(&after_test),
                "connection testing must preserve the kept-alive session"
            );
        }

        let (recorded, _) = rneter::session::MANAGER
            .get_with_recording_level_and_context(
                request.clone(),
                execution_context.clone(),
                rneter::session::SessionRecordLevel::KeyEventsOnly,
            )
            .await
            .expect("warm recorded execution session");

        context
            .post_json(
                "/api/exec",
                json!({"command": "show clock", "connection": connection}),
            )
            .await
            .assert_ok();
        let (after_exec, _) = rneter::session::MANAGER
            .get_with_recording_level_and_context(
                request.clone(),
                execution_context,
                rneter::session::SessionRecordLevel::KeyEventsOnly,
            )
            .await
            .expect("inspect execution connection");
        assert!(
            recorded.same_channel(&after_exec),
            "executions must preserve heartbeat settings"
        );

        let identity = json!({"host": connected["host"], "port": connected["port"], "username": connected["username"]});
        let closed = context
            .post_json("/api/connection/disconnect", identity.clone())
            .await;
        assert_eq!(closed.assert_ok()["closed_connections"], 2);
        let repeated = context
            .post_json("/api/connection/disconnect", identity)
            .await;
        assert_eq!(repeated.assert_ok()["closed_connections"], 0);
        assert!(original.is_closed());
        assert!(recorded.is_closed());

        let disabled = json!({"connection_name": device.connection_name, "keep_alive": {"enabled": false, "interval_secs": 45}});
        context
            .post_json("/api/connection/connect", json!({"connection": disabled}))
            .await
            .assert_ok();
        let normal = rneter::session::MANAGER
            .get_with_context(request, device.handle.execution_context())
            .await
            .expect("disabled heartbeat session");
        assert!(!original.same_channel(&normal));
    });
}

#[test]
fn workbench_rejects_invalid_heartbeat_intervals_without_opening_a_connection() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco("invalid-heartbeat", FaultInjection::new())
            .await;
        for enabled in [true, false] {
            for interval in [0, 3601] {
                let result = context.post_json("/api/connection/connect", json!({
                    "connection": {"connection_name": device.connection_name, "keep_alive": {"enabled": enabled, "interval_secs": interval}}
                })).await;
                assert_eq!(result.status, StatusCode::BAD_REQUEST);
                assert!(
                    result.body["error"]["message"]
                        .as_str()
                        .unwrap()
                        .contains("interval_secs")
                );
            }
        }
        assert!(device.handle.received_commands().is_empty());
    });
}

#[test]
fn workbench_connection_revalidates_a_dropped_session() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco(
                "revalidate-edge",
                FaultInjection::new().with_disconnect_command("show clock", 1),
            )
            .await;
        let connection = json!({"connection_name": device.connection_name, "keep_alive":{"enabled": true,"interval_secs":30}});
        context
            .post_json("/api/connection/connect", json!({"connection": connection}))
            .await
            .assert_ok();
        let request = device.handle.connection_request().expect("request");
        let execution_context = device.handle.execution_context().with_keep_alive(true);
        let original = rneter::session::MANAGER
            .get_with_context(request.clone(), execution_context.clone())
            .await
            .expect("pooled session");
        let result = rneter::session::MANAGER
            .execute_command_with_context(
                request.clone(),
                rneter::session::Command {
                    mode: "Enable".to_string(),
                    command: "show clock".to_string(),
                    timeout: Some(2),
                    ..Default::default()
                },
                execution_context.clone(),
            )
            .await;
        assert!(
            result.is_err(),
            "the virtual device should drop the session"
        );
        context
            .post_json("/api/connection/connect", json!({"connection": connection}))
            .await
            .assert_ok();
        let recovered = rneter::session::MANAGER
            .get_with_context(request, execution_context)
            .await
            .expect("recovered session");
        assert!(
            !original.same_channel(&recovered),
            "revalidation must detect and replace the closed SSH session"
        );
    });
}

#[test]
fn http_execution_routes_reach_rneter_virtual_device() {
    run_route_test(|context| async move {
        let device = context.spawn_cisco("edge-a", FaultInjection::new()).await;
        let connection = || json!({ "connection_name": device.connection_name });
        let mut command_cursor = 0;

        let exec = context
            .post_json(
                "/api/exec",
                json!({
                    "command": "show clock",
                    "connection": connection()
                }),
            )
            .await;
        let exec_body = exec.assert_ok();
        assert_eq!(exec_body["output"], json!("testkit-ok sample output"));
        assert_success_summary(exec_body);
        assert_next_commands(&device.handle, &mut command_cursor, &["show clock"]);

        let interactive = context
            .post_json(
                "/api/interactive/execute",
                json!({
                    "content": multiline_interactive(),
                    "connection": connection()
                }),
            )
            .await;
        let interactive_body = interactive.assert_ok();
        assert_eq!(
            interactive_body["outputs"].as_array().map(Vec::len),
            Some(3)
        );
        assert_success_summary(interactive_body);
        assert_next_commands(
            &device.handle,
            &mut command_cursor,
            &["show clock", "show inventory", "show interfaces"],
        );

        let show = context
            .post_json(
                "/api/show/execute",
                json!({
                    "object": "version",
                    "no_parse": true,
                    "connection": connection()
                }),
            )
            .await;
        let show_body = show.assert_ok();
        assert_eq!(show_body["command"], json!("show version"));
        assert!(
            show_body["output"]
                .as_str()
                .is_some_and(|value| !value.is_empty())
        );
        assert_success_summary(show_body);
        assert_next_commands(&device.handle, &mut command_cursor, &["show version"]);

        let config = context
            .post_json(
                "/api/config/fetch",
                json!({
                    "kind": "running",
                    "connection": connection()
                }),
            )
            .await;
        let config_body = config.assert_ok();
        assert_eq!(config_body["command"], json!("show running-config"));
        assert!(
            config_body["content"]
                .as_str()
                .is_some_and(|value| !value.is_empty())
        );
        assert_sha256(&config_body["sha256"]);
        assert!(config_body["error"].is_null());
        assert_next_commands(
            &device.handle,
            &mut command_cursor,
            &["show running-config"],
        );
    });
}

#[test]
fn temporary_connection_execution_is_available_in_global_session_history() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco("temporary-audit-source", FaultInjection::new())
            .await;
        let connection = device
            .handle
            .connection_request()
            .expect("build temporary virtual device connection");

        context
            .post_json(
                "/api/exec",
                json!({
                    "command": "show clock",
                    "connection": {
                        "host": connection.addr.clone(),
                        "port": connection.port,
                        "credential_id": context.credential_id.clone(),
                        "device_profile": "cisco_ios",
                        "ssh_security": "test-no-check"
                    },
                    "record_level": "key-events-only"
                }),
            )
            .await
            .assert_ok();

        let history = context.get_json("/api/session-history?limit=10").await;
        let rows = history
            .assert_ok()
            .as_array()
            .expect("session history should be an array");
        let entry = rows
            .iter()
            .find(|row| row["operation"] == json!("exec"))
            .expect("temporary execution should be listed");
        assert!(entry["connection_name"].is_null());
        assert_eq!(entry["host"], json!(connection.addr));

        let filtered_history = context
            .get_json(&format!(
                "/api/session-history?limit=10&temporary_host={}&temporary_port={}",
                connection.addr, connection.port
            ))
            .await;
        assert_eq!(
            filtered_history
                .assert_ok()
                .as_array()
                .expect("filtered session history should be an array")
                .len(),
            1
        );

        let devices = context.get_json("/api/session-history/devices").await;
        let device_rows = devices
            .assert_ok()
            .as_array()
            .expect("session history devices should be an array");
        assert!(device_rows.iter().any(|row| {
            row["connection_name"].is_null() && row["host"] == json!(connection.addr)
        }));

        let history_id = entry["id"]
            .as_str()
            .expect("session history id should be a string");
        let detail = context
            .get_json(&format!("/api/session-history/{history_id}"))
            .await;
        let detail_body = detail.assert_ok();
        assert_eq!(detail_body["meta"]["id"], json!(history_id));
        assert!(
            detail_body["entries"]
                .as_array()
                .is_some_and(|entries| !entries.is_empty())
        );
        assert!(
            detail_body["recording_jsonl"]
                .as_str()
                .is_some_and(|jsonl| !jsonl.trim().is_empty())
        );
    });
}

#[test]
fn http_show_routes_preserve_rneter_command_failure() {
    run_route_test(|context| async move {
        let device = context.spawn_cisco("edge-a", FaultInjection::new()).await;
        context
            .post_json(
                "/api/show/custom-objects",
                json!({
                    "device_profile": "cisco_ios",
                    "object": "forced-error",
                    "command": "make-error",
                    "mode": "Enable"
                }),
            )
            .await
            .assert_ok();

        let single = context
            .post_json(
                "/api/show/execute",
                json!({
                    "object": "forced-error",
                    "no_parse": true,
                    "connection": { "connection_name": device.connection_name }
                }),
            )
            .await;
        let single_body = single.assert_ok();
        assert_eq!(single_body["success"], json!(false));
        assert_eq!(single_body["result_summary"]["success"], json!(false));
        assert!(
            single_body["all"].as_str().is_some_and(
                |all| all.contains("make-error") && all.contains("ERROR: forced failure")
            )
        );

        let batch = context
            .post_json(
                "/api/show/batch-execute",
                json!({
                    "object": "forced-error",
                    "no_parse": true,
                    "targets": [device.connection_name]
                }),
            )
            .await;
        let batch_body = batch.assert_ok();
        assert_eq!(batch_body["results"][0]["success"], json!(false));
        assert_eq!(batch_body["result_summary"]["success"], json!(false));
        assert_eq!(batch_body["result_summary"]["counts"]["failed"], json!(1));
        assert!(
            batch_body["results"][0]["all"].as_str().is_some_and(
                |all| all.contains("make-error") && all.contains("ERROR: forced failure")
            )
        );
    });
}

#[test]
fn http_config_fetch_preserves_rneter_command_failure_transcript() {
    run_route_test(|context| async move {
        let device = context.spawn_cisco("edge-a", FaultInjection::new()).await;
        context
            .post_json(
                "/api/config/commands",
                json!({
                    "device_profile": "cisco_ios",
                    "kind": "forced-error",
                    "command": "make-error",
                    "mode": "Enable"
                }),
            )
            .await
            .assert_ok();

        let single = context
            .post_json(
                "/api/config/fetch",
                json!({
                    "kind": "forced-error",
                    "connection": { "connection_name": device.connection_name }
                }),
            )
            .await;
        let single_body = single.assert_ok();
        assert_eq!(single_body["result_summary"]["success"], json!(false));
        assert_nonempty_error(single_body);
        assert!(
            single_body["content"]
                .as_str()
                .is_some_and(|content| content.contains("ERROR: forced failure"))
        );
        assert!(
            single_body["all"].as_str().is_some_and(
                |all| all.contains("make-error") && all.contains("ERROR: forced failure")
            )
        );
        assert!(single_body["sha256"].is_null());
        assert!(single_body["normalized_sha256"].is_null());

        let batch = context
            .post_json(
                "/api/config/batch-fetch",
                json!({
                    "kind": "forced-error",
                    "targets": [device.connection_name]
                }),
            )
            .await;
        let batch_body = batch.assert_ok();
        assert_eq!(batch_body["result_summary"]["success"], json!(false));
        assert_eq!(batch_body["result_summary"]["counts"]["failed"], json!(1));
        let result = &batch_body["results"][0];
        assert_nonempty_error(result);
        assert!(
            result["all"].as_str().is_some_and(
                |all| all.contains("make-error") && all.contains("ERROR: forced failure")
            )
        );
    });
}

#[test]
fn http_batch_routes_execute_every_saved_target() {
    run_route_test(|context| async move {
        let edge_a = context.spawn_cisco("edge-a", FaultInjection::new()).await;
        let edge_b = context.spawn_cisco("edge-b", FaultInjection::new()).await;
        let targets = || json!(["edge-b", "edge-a"]);
        let mut edge_a_cursor = 0;
        let mut edge_b_cursor = 0;

        let exec = context
            .post_json(
                "/api/exec/batch-execute",
                json!({
                    "command": "show clock",
                    "targets": targets(),
                    "max_parallel": 2
                }),
            )
            .await;
        let exec_results = assert_batch_success(exec.assert_ok());
        for result in exec_results {
            assert_eq!(result["command"], json!("show clock"));
            assert!(result["error"].is_null());
            assert!(
                result["output"]
                    .as_str()
                    .is_some_and(|value| !value.is_empty())
            );
        }
        assert_next_commands(&edge_a.handle, &mut edge_a_cursor, &["show clock"]);
        assert_next_commands(&edge_b.handle, &mut edge_b_cursor, &["show clock"]);

        let interactive = context
            .post_json(
                "/api/interactive/batch-execute",
                json!({
                    "content": multiline_interactive(),
                    "targets": targets(),
                    "max_parallel": 2
                }),
            )
            .await;
        let interactive_results = assert_batch_success(interactive.assert_ok());
        for result in interactive_results {
            assert_eq!(result["success"], json!(true));
            assert!(result["error"].is_null());
            assert_eq!(result["outputs"].as_array().map(Vec::len), Some(3));
        }
        let expected_flow = &["show clock", "show inventory", "show interfaces"];
        assert_next_commands(&edge_a.handle, &mut edge_a_cursor, expected_flow);
        assert_next_commands(&edge_b.handle, &mut edge_b_cursor, expected_flow);

        let show = context
            .post_json(
                "/api/show/batch-execute",
                json!({
                    "object": "version",
                    "no_parse": true,
                    "targets": targets(),
                    "max_parallel": 2
                }),
            )
            .await;
        let show_results = assert_batch_success(show.assert_ok());
        for result in show_results {
            assert_eq!(result["command"], json!("show version"));
            assert!(result["error"].is_null());
            assert!(
                result["output"]
                    .as_str()
                    .is_some_and(|value| !value.is_empty())
            );
        }
        assert_next_commands(&edge_a.handle, &mut edge_a_cursor, &["show version"]);
        assert_next_commands(&edge_b.handle, &mut edge_b_cursor, &["show version"]);

        let config = context
            .post_json(
                "/api/config/batch-fetch",
                json!({
                    "kind": "running",
                    "targets": targets(),
                    "max_parallel": 2
                }),
            )
            .await;
        let config_body = config.assert_ok();
        assert_batch_success(config_body);
        for result in config_body["results"]
            .as_array()
            .expect("batch config results should be an array")
        {
            assert_eq!(result["command"], json!("show running-config"));
            assert!(result["error"].is_null());
            assert_sha256(&result["sha256"]);
        }
        assert_next_commands(&edge_a.handle, &mut edge_a_cursor, &["show running-config"]);
        assert_next_commands(&edge_b.handle, &mut edge_b_cursor, &["show running-config"]);
    });
}

#[test]
fn http_batch_exec_reports_partial_success_when_one_target_disconnects() {
    run_route_test(|context| async move {
        let edge_a = context.spawn_cisco("edge-a", FaultInjection::new()).await;
        let edge_b = context
            .spawn_cisco(
                "edge-b",
                FaultInjection::new().with_disconnect_command("show clock", 1),
            )
            .await;
        let response = context
            .post_json(
                "/api/exec/batch-execute",
                json!({
                    "command": "show clock",
                    "targets": ["edge-b", "edge-a"],
                    "max_parallel": 2
                }),
            )
            .await;

        let results = assert_batch_partial_success(response.assert_ok());
        assert_eq!(results[0]["command"], json!("show clock"));
        assert!(results[0]["error"].is_null());
        assert!(
            results[0]["output"]
                .as_str()
                .is_some_and(|output| !output.is_empty())
        );
        assert_eq!(results[1]["command"], json!("show clock"));
        assert!(results[1]["output"].is_null());
        assert_nonempty_error(&results[1]);
        assert_eq!(command_attempts(&edge_a.handle, "show clock"), 1);
        assert_eq!(command_attempts(&edge_b.handle, "show clock"), 1);
    });
}

#[test]
fn http_batch_command_templates_render_per_device_and_parse_each_command() {
    run_route_test(|context| async move {
        let edge_a = context.spawn_cisco("edge-a", FaultInjection::new()).await;
        let edge_b = context.spawn_cisco("edge-b", FaultInjection::new()).await;
        for (name, command) in [("edge-a", "show clock"), ("edge-b", "show version")] {
            let mut saved = crate::config::connection_store::load_connection_raw(name).unwrap();
            saved.vars = json!({"inspection_command": command});
            save_connection(name, &saved).unwrap();
        }
        let response = context
            .post_json(
                "/api/exec/batch-execute",
                json!({
                    "template_content": "{{ inspection_command }}\n{{ extra }}",
                    "vars": {"extra": "show version"},
                    "targets": ["edge-b", "edge-a"],
                    "multiline_mode": "split_lines",
                    "parse_textfsm": true,
                    "max_parallel": 2
                }),
            )
            .await;
        let body = response.assert_ok();
        assert_batch_success(body);
        let results = body["results"].as_array().unwrap();
        assert_eq!(results[0]["command"], "show clock\nshow version");
        assert_eq!(results[1]["command"], "show version\nshow version");
        for result in results {
            let outputs = result["outputs"].as_array().unwrap();
            assert_eq!(outputs.len(), 2);
            assert_eq!(outputs[1]["command"], "show version");
            assert!(outputs[1]["parsed_output"].is_array());
            assert!(outputs[1]["parse_error"].is_null());
        }
        assert_eq!(command_attempts(&edge_a.handle, "show clock"), 1);
        assert_eq!(command_attempts(&edge_b.handle, "show clock"), 0);
        assert_eq!(command_attempts(&edge_b.handle, "show version"), 2);
    });
}

#[test]
fn http_batch_command_template_precheck_failure_prevents_all_execution() {
    run_route_test(|context| async move {
        let edge_a = context.spawn_cisco("edge-a", FaultInjection::new()).await;
        let edge_b = context.spawn_cisco("edge-b", FaultInjection::new()).await;
        let response = context.post_json("/api/exec/batch-execute", json!({
            "template_content": "{% if connection.name == 'edge-b' %}{{ missing_function() }}{% else %}show clock{% endif %}",
            "targets": ["edge-a", "edge-b"]
        })).await;
        assert_eq!(response.status, StatusCode::BAD_REQUEST);
        assert!(response.body.to_string().contains("edge-b"));
        assert_eq!(command_attempts(&edge_a.handle, "show clock"), 0);
        assert_eq!(command_attempts(&edge_b.handle, "show clock"), 0);
    });
}

#[test]
fn http_batch_interactive_reports_partial_success_when_one_target_disconnects() {
    run_route_test(|context| async move {
        let edge_a = context.spawn_cisco("edge-a", FaultInjection::new()).await;
        let edge_b = context
            .spawn_cisco(
                "edge-b",
                FaultInjection::new().with_disconnect_command("show inventory", 1),
            )
            .await;
        let response = context
            .post_json(
                "/api/interactive/batch-execute",
                json!({
                    "content": multiline_interactive(),
                    "targets": ["edge-b", "edge-a"],
                    "max_parallel": 2
                }),
            )
            .await;

        let results = assert_batch_partial_success(response.assert_ok());
        assert_eq!(results[0]["success"], json!(true));
        assert_eq!(results[0]["outputs"].as_array().map(Vec::len), Some(3));
        assert!(results[0]["error"].is_null());
        assert_ne!(results[1]["success"], json!(true));
        assert_nonempty_error(&results[1]);
        assert_eq!(command_attempts(&edge_a.handle, "show inventory"), 1);
        assert_eq!(command_attempts(&edge_b.handle, "show inventory"), 1);
        assert_eq!(command_attempts(&edge_b.handle, "show interfaces"), 0);
    });
}

#[test]
fn http_batch_show_reports_partial_success_when_one_target_disconnects() {
    run_route_test(|context| async move {
        let edge_a = context.spawn_cisco("edge-a", FaultInjection::new()).await;
        let edge_b = context
            .spawn_cisco(
                "edge-b",
                FaultInjection::new().with_disconnect_command("show version", 1),
            )
            .await;
        let response = context
            .post_json(
                "/api/show/batch-execute",
                json!({
                    "object": "version",
                    "no_parse": true,
                    "targets": ["edge-b", "edge-a"],
                    "max_parallel": 2
                }),
            )
            .await;

        let results = assert_batch_partial_success(response.assert_ok());
        assert_eq!(results[0]["command"], json!("show version"));
        assert!(results[0]["error"].is_null());
        assert!(
            results[0]["output"]
                .as_str()
                .is_some_and(|output| !output.is_empty())
        );
        assert_eq!(results[1]["command"], json!("show version"));
        assert!(results[1]["output"].is_null());
        assert_nonempty_error(&results[1]);
        assert_eq!(command_attempts(&edge_a.handle, "show version"), 1);
        assert_eq!(command_attempts(&edge_b.handle, "show version"), 1);
    });
}

#[test]
fn http_batch_config_fetch_reports_partial_success_when_one_target_disconnects() {
    run_route_test(|context| async move {
        let edge_a = context.spawn_cisco("edge-a", FaultInjection::new()).await;
        let edge_b = context
            .spawn_cisco(
                "edge-b",
                FaultInjection::new().with_disconnect_command("show running-config", 1),
            )
            .await;
        let response = context
            .post_json(
                "/api/config/batch-fetch",
                json!({
                    "targets": ["edge-b", "edge-a"],
                    "max_parallel": 2
                }),
            )
            .await;

        let body = response.assert_ok();
        assert_eq!(body["kind"], json!("running"));
        let results = assert_batch_partial_success(body);
        assert_eq!(results[0]["command"], json!("show running-config"));
        assert!(results[0]["error"].is_null());
        assert!(
            results[0]["content"]
                .as_str()
                .is_some_and(|content| !content.is_empty())
        );
        assert_sha256(&results[0]["sha256"]);
        assert_eq!(results[1]["command"], json!("show running-config"));
        assert!(results[1]["content"].is_null());
        assert_nonempty_error(&results[1]);
        assert_eq!(command_attempts(&edge_a.handle, "show running-config"), 1);
        assert_eq!(command_attempts(&edge_b.handle, "show running-config"), 1);
    });
}

#[test]
fn http_exec_retries_multiple_transient_disconnects() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco(
                "edge-a",
                FaultInjection::new().with_disconnect_command("show clock", 2),
            )
            .await;
        let response = context
            .post_json(
                "/api/exec",
                json!({
                    "command": "show clock",
                    "retry": {
                        "max_retries": 2,
                        "initial_backoff_ms": 0,
                        "max_backoff_ms": 0
                    },
                    "connection": {
                        "connection_name": device.connection_name
                    }
                }),
            )
            .await;

        assert_success_summary(response.assert_ok());
        assert_eq!(command_attempts(&device.handle, "show clock"), 3);
    });
}

#[test]
fn http_exec_does_not_retry_by_default() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco(
                "edge-a",
                FaultInjection::new().with_disconnect_command("show clock", 1),
            )
            .await;
        let response = context
            .post_json(
                "/api/exec",
                json!({
                    "command": "show clock",
                    "connection": { "connection_name": device.connection_name }
                }),
            )
            .await;

        assert!(
            !response.status.is_success(),
            "retry-disabled request unexpectedly succeeded: {}",
            response.body
        );
        assert_eq!(command_attempts(&device.handle, "show clock"), 1);
    });
}

#[test]
fn http_show_retries_transient_disconnect() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco(
                "edge-a",
                FaultInjection::new().with_disconnect_command("show version", 1),
            )
            .await;
        let response = context
            .post_json(
                "/api/show/execute",
                json!({
                    "object": "version",
                    "no_parse": true,
                    "retry": retry_once_without_backoff(),
                    "connection": { "connection_name": device.connection_name }
                }),
            )
            .await;

        let body = response.assert_ok();
        assert_eq!(body["command"], json!("show version"));
        assert!(
            body["output"]
                .as_str()
                .is_some_and(|output| !output.is_empty())
        );
        assert_success_summary(body);
        assert_eq!(command_attempts(&device.handle, "show version"), 2);
    });
}

#[test]
fn http_config_fetch_retries_transient_disconnect() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco(
                "edge-a",
                FaultInjection::new().with_disconnect_command("show running-config", 1),
            )
            .await;
        let response = context
            .post_json(
                "/api/config/fetch",
                json!({
                    "retry": retry_once_without_backoff(),
                    "connection": { "connection_name": device.connection_name }
                }),
            )
            .await;

        let body = response.assert_ok();
        assert_eq!(body["kind"], json!("running"));
        assert_eq!(body["command"], json!("show running-config"));
        assert!(body["error"].is_null());
        assert_sha256(&body["sha256"]);
        assert_eq!(command_attempts(&device.handle, "show running-config"), 2);
    });
}

#[test]
fn http_batch_exec_propagates_retry_options() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco(
                "edge-a",
                FaultInjection::new().with_disconnect_command("show clock", 1),
            )
            .await;
        let response = context
            .post_json(
                "/api/exec/batch-execute",
                json!({
                    "command": "show clock",
                    "targets": [device.connection_name],
                    "retry": retry_once_without_backoff()
                }),
            )
            .await;

        let result = assert_single_target_batch_success(response.assert_ok(), "edge-a");
        assert_eq!(result["command"], json!("show clock"));
        assert!(result["error"].is_null());
        assert!(
            result["output"]
                .as_str()
                .is_some_and(|output| !output.is_empty())
        );
        assert_eq!(command_attempts(&device.handle, "show clock"), 2);
    });
}

#[test]
fn http_batch_interactive_propagates_retry_options_and_resumes() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco(
                "edge-a",
                FaultInjection::new().with_disconnect_command("show inventory", 1),
            )
            .await;
        let response = context
            .post_json(
                "/api/interactive/batch-execute",
                json!({
                    "content": multiline_interactive(),
                    "targets": [device.connection_name],
                    "retry": retry_once_without_backoff()
                }),
            )
            .await;

        let result = assert_single_target_batch_success(response.assert_ok(), "edge-a");
        assert_eq!(result["success"], json!(true));
        assert_eq!(result["outputs"].as_array().map(Vec::len), Some(3));
        assert!(result["error"].is_null());
        let mut cursor = 0;
        assert_next_commands(
            &device.handle,
            &mut cursor,
            &[
                "show clock",
                "show inventory",
                "show inventory",
                "show interfaces",
            ],
        );
    });
}

#[test]
fn http_batch_show_propagates_retry_options() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco(
                "edge-a",
                FaultInjection::new().with_disconnect_command("show version", 1),
            )
            .await;
        let response = context
            .post_json(
                "/api/show/batch-execute",
                json!({
                    "object": "version",
                    "no_parse": true,
                    "targets": [device.connection_name],
                    "retry": retry_once_without_backoff()
                }),
            )
            .await;

        let result = assert_single_target_batch_success(response.assert_ok(), "edge-a");
        assert_eq!(result["command"], json!("show version"));
        assert!(result["error"].is_null());
        assert!(
            result["output"]
                .as_str()
                .is_some_and(|output| !output.is_empty())
        );
        assert_eq!(command_attempts(&device.handle, "show version"), 2);
    });
}

#[test]
fn http_batch_config_fetch_propagates_retry_options() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco(
                "edge-a",
                FaultInjection::new().with_disconnect_command("show running-config", 1),
            )
            .await;
        let response = context
            .post_json(
                "/api/config/batch-fetch",
                json!({
                    "targets": [device.connection_name],
                    "retry": retry_once_without_backoff()
                }),
            )
            .await;

        let body = response.assert_ok();
        assert_eq!(body["kind"], json!("running"));
        let result = assert_single_target_batch_success(body, "edge-a");
        assert_eq!(result["command"], json!("show running-config"));
        assert!(result["error"].is_null());
        assert_sha256(&result["sha256"]);
        assert_eq!(command_attempts(&device.handle, "show running-config"), 2);
    });
}

#[test]
fn http_batch_targets_merge_explicit_groups_and_tags_without_duplicates() {
    run_route_test(|context| async move {
        let edge_a = context
            .spawn_cisco_with(
                "edge-a",
                DevicePersona::builtin("cisco_ios").expect("load cisco_ios test persona"),
                vec!["prod"],
                vec!["core"],
            )
            .await;
        let edge_b = context
            .spawn_cisco_with(
                "edge-b",
                DevicePersona::builtin("cisco_ios").expect("load cisco_ios test persona"),
                Vec::new(),
                vec!["core"],
            )
            .await;
        let edge_c = context
            .spawn_cisco_with(
                "edge-c",
                DevicePersona::builtin("cisco_ios").expect("load cisco_ios test persona"),
                vec!["prod"],
                Vec::new(),
            )
            .await;
        let response = context
            .post_json(
                "/api/exec/batch-execute",
                json!({
                    "command": "show clock",
                    "targets": ["edge-a", "edge-a"],
                    "groups": ["core"],
                    "tags": ["prod"],
                    "max_parallel": 3
                }),
            )
            .await;

        let body = response.assert_ok();
        assert_eq!(body["targets"], json!(["edge-a", "edge-b", "edge-c"]));
        assert_eq!(body["result_summary"]["counts"]["total"], json!(3));
        assert_eq!(body["result_summary"]["counts"]["succeeded"], json!(3));
        assert_eq!(body["result_summary"]["counts"]["failed"], json!(0));
        assert_success_summary(body);
        let result_targets = body["results"]
            .as_array()
            .expect("batch results should be an array")
            .iter()
            .map(|result| result["target"].as_str().expect("result target"))
            .collect::<Vec<_>>();
        assert_eq!(result_targets, vec!["edge-a", "edge-b", "edge-c"]);
        for device in [&edge_a, &edge_b, &edge_c] {
            assert_eq!(command_attempts(&device.handle, "show clock"), 1);
        }
    });
}

#[test]
fn http_config_fetch_defaults_to_running_and_returns_normalized_content() {
    run_route_test(|context| async move {
        const RUNNING_CONFIG: &str = "Building configuration...\n\
! Last configuration change at 09:00:00 Mon Jul 20 2026\n\
hostname edge-1\n\
interface Ethernet1\n";

        let single = context
            .spawn_cisco_with(
                "edge-single",
                DevicePersona::builtin("cisco_ios")
                    .expect("load cisco_ios test persona")
                    .with_canned_reply("show running-config", RUNNING_CONFIG),
                Vec::new(),
                Vec::new(),
            )
            .await;
        let single_response = context
            .post_json(
                "/api/config/fetch",
                json!({
                    "include_normalized": true,
                    "connection": { "connection_name": single.connection_name.clone() }
                }),
            )
            .await;
        let single_body = single_response.assert_ok();
        assert_normalized_running_config(single_body, RUNNING_CONFIG);
        let single_snapshot_id = single_body["snapshot_id"]
            .as_str()
            .expect("single fetch should return a snapshot id");
        let single_snapshot = device_config_store::get_snapshot(single_snapshot_id)
            .await
            .expect("load single config snapshot")
            .expect("single config snapshot exists");
        assert_eq!(
            single_snapshot.summary.connection_name,
            single.connection_name
        );
        assert!(
            single_snapshot
                .content
                .contains("Last configuration change")
        );
        assert_eq!(command_attempts(&single.handle, "show running-config"), 1);

        let batch = context
            .spawn_cisco_with(
                "edge-batch",
                DevicePersona::builtin("cisco_ios")
                    .expect("load cisco_ios test persona")
                    .with_canned_reply("show running-config", RUNNING_CONFIG),
                Vec::new(),
                Vec::new(),
            )
            .await;
        let batch_response = context
            .post_json(
                "/api/config/batch-fetch",
                json!({
                    "include_normalized": true,
                    "targets": [batch.connection_name.clone()]
                }),
            )
            .await;
        let batch_body = batch_response.assert_ok();
        assert_eq!(batch_body["kind"], json!("running"));
        let result = assert_single_target_batch_success(batch_body, "edge-batch");
        assert_normalized_running_config(result, RUNNING_CONFIG);
        let batch_snapshot_id = result["snapshot_id"]
            .as_str()
            .expect("batch fetch should return a snapshot id");
        let batch_snapshot = device_config_store::get_snapshot(batch_snapshot_id)
            .await
            .expect("load batch config snapshot")
            .expect("batch config snapshot exists");
        assert_eq!(
            batch_snapshot.summary.connection_name,
            batch.connection_name
        );
        assert_eq!(command_attempts(&batch.handle, "show running-config"), 1);
    });
}

#[test]
fn http_batch_show_deduplicates_and_sorts_multiple_objects() {
    run_route_test(|context| async move {
        let edge_a = context.spawn_cisco("edge-a", FaultInjection::new()).await;
        let edge_b = context.spawn_cisco("edge-b", FaultInjection::new()).await;
        let response = context
            .post_json(
                "/api/show/batch-execute",
                json!({
                    "object": "",
                    "objects": ["version", "interfaces", "version"],
                    "no_parse": true,
                    "targets": ["edge-b", "edge-a"],
                    "max_parallel": 4
                }),
            )
            .await;

        let body = response.assert_ok();
        assert_eq!(body["object"], json!("interfaces, version"));
        assert_eq!(body["targets"], json!(["edge-a", "edge-b"]));
        assert_eq!(body["result_summary"]["counts"]["total"], json!(4));
        assert_eq!(body["result_summary"]["counts"]["succeeded"], json!(4));
        assert_eq!(body["result_summary"]["counts"]["failed"], json!(0));
        assert_success_summary(body);
        let results = body["results"]
            .as_array()
            .expect("batch show results should be an array");
        assert_eq!(results.len(), 4);
        let identities = results
            .iter()
            .map(|result| {
                (
                    result["target"].as_str().expect("show result target"),
                    result["object"].as_str().expect("show result object"),
                    result["command"].as_str().expect("show result command"),
                )
            })
            .collect::<Vec<_>>();
        assert_eq!(
            identities,
            vec![
                ("edge-a", "interfaces", "show interfaces"),
                ("edge-a", "version", "show version"),
                ("edge-b", "interfaces", "show interfaces"),
                ("edge-b", "version", "show version"),
            ]
        );
        assert!(results.iter().all(|result| result["error"].is_null()));
        let mut edge_a_cursor = 0;
        let mut edge_b_cursor = 0;
        assert_next_commands_in_any_order(
            &edge_a.handle,
            &mut edge_a_cursor,
            &["show interfaces", "show version"],
        );
        assert_next_commands_in_any_order(
            &edge_b.handle,
            &mut edge_b_cursor,
            &["show interfaces", "show version"],
        );
    });
}

#[test]
fn http_interactive_retry_resumes_at_first_unfinished_step() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco(
                "edge-a",
                FaultInjection::new().with_disconnect_command("show inventory", 1),
            )
            .await;
        let response = context
            .post_json(
                "/api/interactive/execute",
                json!({
                    "content": multiline_interactive(),
                    "retry": {
                        "max_retries": 1,
                        "initial_backoff_ms": 0,
                        "max_backoff_ms": 0
                    },
                    "connection": { "connection_name": device.connection_name }
                }),
            )
            .await;

        let body = response.assert_ok();
        assert_success_summary(body);
        let outputs = body["outputs"]
            .as_array()
            .expect("interactive outputs should be an array");
        assert_eq!(outputs.len(), 3);
        assert!(
            outputs
                .iter()
                .all(|output| output["success"] == json!(true))
        );
        let mut command_cursor = 0;
        assert_eq!(
            business_command_delta(&device.handle, &mut command_cursor),
            vec![
                "show clock".to_string(),
                "show inventory".to_string(),
                "show inventory".to_string(),
                "show interfaces".to_string(),
            ]
        );
    });
}

#[test]
fn http_interactive_retry_exhaustion_stops_before_later_steps() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco(
                "edge-a",
                FaultInjection::new().with_disconnect_command("show inventory", 2),
            )
            .await;
        let response = context
            .post_json(
                "/api/interactive/execute",
                json!({
                    "content": multiline_interactive(),
                    "retry": retry_once_without_backoff(),
                    "connection": { "connection_name": device.connection_name }
                }),
            )
            .await;

        assert!(
            !response.status.is_success(),
            "retry-exhausted interactive unexpectedly succeeded: {}",
            response.body
        );
        assert!(
            response.body["error"]["message"]
                .as_str()
                .is_some_and(|error| !error.trim().is_empty()),
            "retry-exhausted interactive should return a useful error: {}",
            response.body
        );
        let mut cursor = 0;
        assert_next_commands(
            &device.handle,
            &mut cursor,
            &["show clock", "show inventory", "show inventory"],
        );
        assert_eq!(command_attempts(&device.handle, "show interfaces"), 0);
    });
}

#[test]
fn http_orchestration_expands_inline_controls_for_each_saved_target() {
    run_route_test(|context| async move {
        let target_a = context
            .spawn_cisco("control-a", FaultInjection::new())
            .await;
        let target_b = context
            .spawn_cisco("control-b", FaultInjection::new())
            .await;
        let operation = |command: &str| json!({"kind":"command", "mode":"Enable", "command":command, "timeout":10});
        let block = |name: &str, command: &str| {
            json!({
                "name":name, "fail_fast":true, "rollback_policy":"none", "steps":[{"run":operation(command)}]
            })
        };
        let plan = json!({"name":"control-plan", "stages":[{
            "name":"execute", "strategy":"serial", "jobs":[{
                "strategy":"serial", "targets":"{{ vars.targets }}",
                "action":{"kind":"tx_workflow", "workflow":{"name":"control-workflow", "fail_fast":true, "blocks":[
                    {"kind":"loop", "iterations":"vars.commands", "blocks":[
                        block("iteration-{{ loop.index }}", "{{ item }}")]},
                    {"kind":"choice", "branches":[{
                        "condition":"connection.name == 'control-a'", "blocks":[block("a", "show version")]
                    }], "else":[block("b", "show interfaces")]}
                ]}}
            }]
        }]});
        let mut cursor_a = 0;
        let mut cursor_b = 0;
        for selected_connection in [
            Value::Null,
            json!({"connection_name":target_a.connection_name}),
        ] {
            let response = context.post_json("/api/orchestrate", json!({
                "connection":selected_connection,
                "plan":plan,
                "plan_vars":{"targets":[target_a.connection_name,target_b.connection_name], "commands":["show clock","show inventory"]}
            })).await;
            let body = response.assert_ok();
            assert_eq!(body["orchestration_result"]["success"], true);
            assert_eq!(
                body["plan"]["stages"][0]["jobs"][0]["action"]["workflow"]["blocks"][0]["kind"],
                "loop"
            );
            assert!(
                body["plan"]["stages"][0]["jobs"][0]["action"]
                    .get("inline_template_context")
                    .is_none()
            );
            assert_next_commands(
                &target_a.handle,
                &mut cursor_a,
                &["show clock", "show inventory", "show version"],
            );
            assert_next_commands(
                &target_b.handle,
                &mut cursor_b,
                &["show clock", "show inventory", "show interfaces"],
            );
        }
    });
}

#[test]
fn http_orchestration_dry_run_rejects_empty_target_resolution() {
    run_route_test(|context| async move {
        let response = context
            .post_json(
                "/api/orchestrate",
                json!({
                    "dry_run":true,
                    "plan":{"name":"plan", "stages":[{"name":"stage", "strategy":"serial", "jobs":[{
                        "strategy":"serial", "target_tags":["nonexistent-tag"],
                        "action":{"kind":"tx_workflow", "workflow":{"name":"workflow", "blocks":[]}}
                    }]}]}
                }),
            )
            .await;
        assert!(!response.status.is_success());
        assert!(response.body.to_string().contains("resolved no targets"));
    });
}

#[test]
fn http_workflow_controls_expand_and_preserve_cross_iteration_rollback() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco("control-target", FaultInjection::new())
            .await;
        let operation = |command: &str| json!({"kind":"command", "mode":"Enable", "command":command,"timeout":10});
        let workflow = json!({"name":"control-test","fail_fast":true,"blocks":[
            {"kind":"loop","name":"repeat","iterations":"vars.commands","item_variable":"action","blocks":[
                {"name":"iteration-{{ loop.index }}","fail_fast":true,"rollback_policy":"per_step","steps":[
                    {"run":operation("{{ action }}"),"rollback":operation("show version")}
                ]}
            ]},
            {"kind":"choice","name":"finish","branches":[
                {"condition":"false","blocks":[{"name":"{{ missing }}"}]},
                {"condition":"vars.fail","blocks":[
                {"name":"failure","fail_fast":true,"rollback_policy":"none","steps":[{"run":operation("make-error")}]}
            ]}],"else":[
                {"name":"verify","fail_fast":true,"rollback_policy":"none","steps":[{"run":operation("show interfaces")}]}
            ]}
        ]});
        let mut cursor = 0;
        for fail in [false, true] {
            let body = context.post_json("/api/tx/workflow",json!({
                "connection":{"connection_name":device.connection_name},
                "workflow":workflow,"workflow_vars":{"commands":["show clock","show inventory"],"fail":fail},
            })).await;
            let body = body.assert_ok();
            assert_eq!(body["tx_workflow_result"]["committed"], json!(!fail));
            assert_eq!(body["workflow"]["blocks"].as_array().unwrap().len(), 3);
            assert_eq!(body["workflow"]["blocks"][0]["name"], "iteration-1");
            assert_eq!(body["workflow"]["blocks"][1]["name"], "iteration-2");
            if fail {
                assert_eq!(body["tx_workflow_result"]["rollback_attempted"], true);
                assert_eq!(body["tx_workflow_result"]["rollback_succeeded"], true);
                assert_next_commands(
                    &device.handle,
                    &mut cursor,
                    &[
                        "show clock",
                        "show inventory",
                        "make-error",
                        "show version",
                        "show version",
                    ],
                );
            } else {
                assert_next_commands(
                    &device.handle,
                    &mut cursor,
                    &["show clock", "show inventory", "show interfaces"],
                );
            }
        }
        let invalid = context.post_json("/api/tx/workflow",json!({
            "connection":{"connection_name":device.connection_name},
            "dry_run":true,
            "workflow":{"name":"invalid","fail_fast":true,"blocks":[{"kind":"loop","iterations":"-1","blocks":[]}]}
        })).await;
        assert_eq!(invalid.status, StatusCode::BAD_REQUEST);
    });
}

#[test]
fn http_block_local_controls_preview_and_rollback_inside_one_transaction() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco("block-controls", FaultInjection::new())
            .await;
        let op = |command: &str| json!({"kind":"command", "mode":"Enable", "command":command, "timeout":10});
        let workflow = json!({"name":"block-controls", "fail_fast":true, "blocks":[{
            "name":"single-transaction", "rollback_policy":"per_step", "fail_fast":true,
            "steps":[
                {"kind":"loop", "iterations":"vars.commands", "item_variable":"command", "steps":[
                    {"run":op("{{ command }}"), "rollback":op("show version")}
                ]},
                {"kind":"choice", "branches":[
                    {"condition":"vars.fail", "steps":[{"run":op("make-error")}]}
                ], "else":[{"run":op("show interfaces")}]}
            ]
        }]});
        let mut cursor = 0;
        for fail in [false, true] {
            let vars = json!({"commands":["show clock", "show inventory"], "fail":fail});
            let dry_run = context
                .post_json(
                    "/api/tx/workflow",
                    json!({
                        "connection":{"connection_name":device.connection_name},
                        "workflow":workflow, "workflow_vars":vars, "dry_run":true,
                    }),
                )
                .await;
            let preview = dry_run.assert_ok();
            assert_eq!(preview["workflow"]["blocks"].as_array().unwrap().len(), 1);
            assert_eq!(
                preview["workflow"]["blocks"][0]["steps"]
                    .as_array()
                    .unwrap()
                    .len(),
                3
            );
            assert_eq!(
                preview["workflow"]["blocks"][0]["steps"][0]["run"]["command"],
                "show clock"
            );
            let response = context
                .post_json(
                    "/api/tx/workflow",
                    json!({
                        "connection":{"connection_name":device.connection_name},
                        "workflow":workflow, "workflow_vars":vars,
                    }),
                )
                .await;
            let result = response.assert_ok();
            assert_eq!(result["tx_workflow_result"]["committed"], !fail);
            assert_eq!(result["workflow"]["blocks"].as_array().unwrap().len(), 1);
            if fail {
                assert_eq!(result["tx_workflow_result"]["rollback_succeeded"], true);
                assert_next_commands(
                    &device.handle,
                    &mut cursor,
                    &[
                        "show clock",
                        "show inventory",
                        "make-error",
                        "show version",
                        "show version",
                    ],
                );
            } else {
                assert_next_commands(
                    &device.handle,
                    &mut cursor,
                    &["show clock", "show inventory", "show interfaces"],
                );
            }
        }
        let template_preview = context.post_json("/api/tx/workflow", json!({
            "connection":{"connection_name":device.connection_name}, "dry_run":true,
            "workflow":{"name":"template-reference", "fail_fast":true, "blocks":[{
                "tx_block_template_content":serde_json::to_string(&workflow["blocks"][0]).unwrap(),
                "tx_block_template_vars":{"commands":["show clock", "show inventory"], "fail":false}
            }]}
        })).await;
        let preview = template_preview.assert_ok();
        assert_eq!(preview["workflow"]["blocks"].as_array().unwrap().len(), 1);
        assert_eq!(
            preview["workflow"]["blocks"][0]["steps"]
                .as_array()
                .unwrap()
                .len(),
            3
        );
        assert_eq!(
            preview["workflow"]["blocks"][0]["steps"][1]["run"]["command"],
            "show inventory"
        );
    });
}

#[test]
fn http_single_block_workflow_preserves_results_rollback_and_recording() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco("workflow-target", FaultInjection::new())
            .await;
        let command = |text: &str| {
            json!({
                "kind": "command", "mode": "Enable", "command": text, "timeout": 10
            })
        };
        let mut cursor = 0;
        for fail in [false, true] {
            let second_command = if fail { "make-error" } else { "show inventory" };
            let response = context.post_json("/api/tx/workflow", json!({
                "connection": { "connection_name": device.connection_name },
                "record_level": "full",
                "workflow": {
                    "name": "single-block",
                    "fail_fast": true,
                    "blocks": [{
                        "name": "precheck",
                        "rollback_policy": "per_step",
                        "fail_fast": true,
                        "steps": [
                            { "run": command("show clock"), "rollback": command("show version") },
                            { "run": command(second_command), "rollback": null }
                        ]
                    }]
                }
            })).await;
            let body = response.assert_ok();
            assert_eq!(body["result_summary"]["operation"], json!("tx_workflow"));
            assert_eq!(body["result_summary"]["success"], json!(!fail));
            let result = &body["tx_workflow_result"];
            assert_eq!(result["committed"], json!(!fail));
            assert_eq!(result["block_results"].as_array().unwrap().len(), 1);
            let block = &result["block_results"][0];
            assert_eq!(block["block_name"], json!("precheck"));
            assert_eq!(block["committed"], json!(!fail));
            assert_eq!(block["rollback_attempted"], json!(fail));
            assert_eq!(block["step_results"].as_array().unwrap().len(), 2);
            if fail {
                assert_eq!(block["failed_step"], json!(1));
                assert_eq!(block["rollback_succeeded"], json!(true));
                assert_eq!(
                    block["step_results"][0]["rollback_state"],
                    json!("succeeded")
                );
                assert_next_commands(
                    &device.handle,
                    &mut cursor,
                    &["show clock", "make-error", "show version"],
                );
            } else {
                assert_next_commands(
                    &device.handle,
                    &mut cursor,
                    &["show clock", "show inventory"],
                );
            }
            let recording = body["recording_jsonl"]
                .as_str()
                .expect("workflow recording");
            assert!(recording.contains("tx_workflow_started"));
            assert!(recording.contains("tx_workflow_finished"));
        }
        let history = context.get_json("/api/session-history?limit=10").await;
        let rows = history.assert_ok().as_array().unwrap();
        assert_eq!(rows.len(), 2);
        assert!(
            rows.iter()
                .all(|row| row["operation"] == json!("tx_workflow"))
        );
    });
}

#[test]
fn http_workflow_resolves_saved_block_templates_and_previews_without_execution() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco("workflow-template-target", FaultInjection::new())
            .await;
        context.post_json("/api/tx-block-templates", json!({
            "name": "precheck",
            "content": json!({
                "name": "template-block", "rollback_policy": "none", "fail_fast": true,
                "steps": [{"run": {
                    "kind": "command", "mode": "Enable", "command": "show {{ object }}", "timeout": 10
                }, "rollback": null}]
            }).to_string()
        })).await.assert_ok();
        let response = context
            .post_json(
                "/api/tx/workflow",
                json!({
                    "connection": { "connection_name": device.connection_name },
                    "dry_run": true,
                    "workflow": {
                        "name": "preview", "fail_fast": true,
                        "blocks": [{
                            "name": "resolved-block",
                            "tx_block_template_name": "precheck",
                            "tx_block_template_vars": {"object": "version"}
                        }]
                    }
                }),
            )
            .await;
        let body = response.assert_ok();
        assert_eq!(
            body["workflow"]["blocks"][0]["name"],
            json!("resolved-block")
        );
        assert_eq!(
            body["workflow"]["blocks"][0]["steps"][0]["run"]["command"],
            json!("show version")
        );
        assert_eq!(body["result_summary"]["outcome"], json!("dry_run"));
        assert!(body["tx_workflow_result"].is_null());
        assert!(device.handle.received_commands().is_empty());
    });
}

#[test]
fn http_workflow_preview_masks_saved_block_variables_and_keeps_dry_run_unchanged() {
    run_route_test(|context| async move {
        for name in ["short-token", "long-token"] {
            context.post_json("/api/tx-block-templates", json!({
                "name":name,
                "content":json!({
                    "name":name, "fail_fast":true, "rollback_policy":"per_step",
                    "steps":[{
                        "run":{"kind":"command", "mode":"User", "command":"send {{ vars.api_token }}",
                            "interaction":{"prompts":[{"patterns":["Confirm:"], "response":"{{ vars.api_token }}"}]}},
                        "rollback":{"kind":"command", "mode":"User", "command":"undo {{ vars.api_token }}"}
                    }]
                }).to_string()
            })).await.assert_ok();
        }
        let mut request = json!({
            "connection":{"host":"192.0.2.10", "credential_id":context.credential_id, "device_profile":"linux"},
            "dry_run":true,
            "workflow":{"name":"preview", "fail_fast":true, "blocks":[
                {"tx_block_template_name":"short-token", "tx_block_template_vars":{"api_token":"private-value"}},
                {"tx_block_template_name":"long-token", "tx_block_template_vars":{"api_token":"private-value-long"}}
            ]}
        });
        let ordinary = context.post_json("/api/tx/workflow", request.clone()).await;
        assert_eq!(
            ordinary.assert_ok()["workflow"]["blocks"][0]["steps"][0]["run"]["command"],
            "send private-value"
        );
        request["preview_commands"] = json!(true);
        let preview = context.post_json("/api/tx/workflow", request).await;
        let body = preview.assert_ok();
        for block in body["workflow"]["blocks"].as_array().unwrap() {
            assert_eq!(block["steps"][0]["run"]["command"], "send ******");
            assert_eq!(
                block["steps"][0]["run"]["interaction"]["prompts"][0]["response"],
                "******"
            );
            assert_eq!(block["steps"][0]["rollback"]["command"], "undo ******");
        }
        assert!(!body.to_string().contains("private-value"));
        assert!(
            context
                .get_json("/api/session-history?limit=10")
                .await
                .assert_ok()
                .as_array()
                .unwrap()
                .is_empty()
        );
    });
}

#[test]
fn http_orchestration_preview_preserves_types_when_tokens_and_passwords_match_them() {
    run_route_test(|context| async move {
        for password in ["preview-login", "command", "User"] {
            let credential = create_credential(&DeviceCredentialInput {
                name: format!("preview-{password}"),
                username: "admin".into(),
                password: Some(password.into()),
                ..Default::default()
            })
            .unwrap();
            save_connection(
                "preview-target",
                &SavedConnection {
                    host: Some("192.0.2.10".into()),
                    credential_id: Some(credential.id),
                    device_profile: Some("linux".into()),
                    enabled: true,
                    port: Some(22),
                    connect_timeout_secs: None,
                    device_model: None,
                    software_version: None,
                    ssh_security: None,
                    linux_shell_flavor: None,
                    output_encoding: Default::default(),
                    template_dir: None,
                    labels: Vec::new(),
                    groups: Vec::new(),
                    vars: json!({}),
                },
            )
            .unwrap();
            let response = context.post_json("/api/orchestrate", json!({
                "dry_run":true, "preview_commands":true, "plan_vars":{"api_token":"command"},
                "plan":{"name":"preview", "stages":[{"name":"stage", "strategy":"serial", "jobs":[{
                    "name":"job", "strategy":"parallel", "targets":["preview-target"],
                    "action":{"kind":"tx_workflow", "workflow":{"name":"workflow", "fail_fast":true, "blocks":[{
                        "name":"block", "fail_fast":true, "rollback_policy":"none", "steps":[{
                            "run":{"kind":"command", "mode":"User", "multiline_mode":"whole",
                                "command":"echo {{ vars.api_token }}", "interaction":{"prompts":[{
                                    "patterns":["Password:"], "response":password
                                }]}}
                        }]
                    }]}}
                }]}]}
            })).await;
            let body = response.assert_ok();
            let run = &body["rendered_workflows"][0]["workflow"]["blocks"][0]["steps"][0]["run"];
            assert_eq!(run["kind"], "command");
            assert_eq!(run["mode"], "User");
            assert_eq!(run["multiline_mode"], "whole");
            assert_eq!(
                run["command"],
                if password == "command" {
                    "echo ***"
                } else {
                    "echo ******"
                }
            );
            assert_eq!(run["interaction"]["prompts"][0]["response"], "***");
            assert_eq!(
                body["plan"]["stages"][0]["jobs"][0]["action"]["kind"],
                "tx_workflow"
            );
        }
    });
}

#[test]
fn http_workflow_dry_run_rejects_empty_workflows_and_invalid_blocks() {
    run_route_test(|context| async move {
        for blocks in [
            json!([]),
            json!([{
                "name": "empty-block", "rollback_policy": "none", "fail_fast": true, "steps": []
            }]),
        ] {
            let response = context
                .post_json(
                    "/api/tx/workflow",
                    json!({
                        "dry_run": true,
                        "workflow": {"name": "invalid", "fail_fast": true, "blocks": blocks}
                    }),
                )
                .await;
            assert_eq!(
                response.status,
                StatusCode::BAD_REQUEST,
                "{}",
                response.body
            );
        }
    });
}
