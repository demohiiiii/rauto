use super::build_local_app;
use crate::cli::GlobalOpts;
use crate::config::connection_store::{SavedConnection, save_connection};
use crate::config::device_credential_store::{DeviceCredentialInput, create_credential};
use crate::config::ssh_security::SshSecurityProfile;
use crate::db;
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
            | "/api/command-flow/execute"
            | "/api/flow/batch-execute"
            | "/api/show/execute"
            | "/api/show/batch-execute"
            | "/api/config/fetch"
            | "/api/config/batch-fetch"
            | "/api/upload"
            | "/api/tx/block"
            | "/api/tx/block/async"
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

fn three_step_flow() -> &'static str {
    r#"name = "http-test-flow"
default_mode = "Enable"

[[steps]]
command = "show clock"

[[steps]]
command = "show inventory"

[[steps]]
command = "show interfaces"
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

        let flow = context
            .post_json(
                "/api/command-flow/execute",
                json!({
                    "content": three_step_flow(),
                    "connection": connection()
                }),
            )
            .await;
        let flow_body = flow.assert_ok();
        assert_eq!(flow_body["outputs"].as_array().map(Vec::len), Some(3));
        assert_success_summary(flow_body);
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

        let flow = context
            .post_json(
                "/api/flow/batch-execute",
                json!({
                    "content": three_step_flow(),
                    "targets": targets(),
                    "max_parallel": 2
                }),
            )
            .await;
        let flow_results = assert_batch_success(flow.assert_ok());
        for result in flow_results {
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
fn http_batch_flow_reports_partial_success_when_one_target_disconnects() {
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
                "/api/flow/batch-execute",
                json!({
                    "content": three_step_flow(),
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
fn http_batch_flow_propagates_retry_options_and_resumes() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco(
                "edge-a",
                FaultInjection::new().with_disconnect_command("show inventory", 1),
            )
            .await;
        let response = context
            .post_json(
                "/api/flow/batch-execute",
                json!({
                    "content": three_step_flow(),
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
                    "connection": { "connection_name": single.connection_name }
                }),
            )
            .await;
        assert_normalized_running_config(single_response.assert_ok(), RUNNING_CONFIG);
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
                    "targets": [batch.connection_name]
                }),
            )
            .await;
        let batch_body = batch_response.assert_ok();
        assert_eq!(batch_body["kind"], json!("running"));
        let result = assert_single_target_batch_success(batch_body, "edge-batch");
        assert_normalized_running_config(result, RUNNING_CONFIG);
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
fn http_flow_retry_resumes_at_first_unfinished_step() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco(
                "edge-a",
                FaultInjection::new().with_disconnect_command("show inventory", 1),
            )
            .await;
        let response = context
            .post_json(
                "/api/command-flow/execute",
                json!({
                    "content": three_step_flow(),
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
            .expect("flow outputs should be an array");
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
fn http_flow_retry_exhaustion_stops_before_later_steps() {
    run_route_test(|context| async move {
        let device = context
            .spawn_cisco(
                "edge-a",
                FaultInjection::new().with_disconnect_command("show inventory", 2),
            )
            .await;
        let response = context
            .post_json(
                "/api/command-flow/execute",
                json!({
                    "content": three_step_flow(),
                    "retry": retry_once_without_backoff(),
                    "connection": { "connection_name": device.connection_name }
                }),
            )
            .await;

        assert!(
            !response.status.is_success(),
            "retry-exhausted flow unexpectedly succeeded: {}",
            response.body
        );
        assert!(
            response.body["error"]["message"]
                .as_str()
                .is_some_and(|error| !error.trim().is_empty()),
            "retry-exhausted flow should return a useful error: {}",
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
