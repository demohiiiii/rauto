use serde_json::Value;
use std::path::PathBuf;
use std::process::{Child, Command, Output, Stdio};
use std::time::{Duration, Instant};

struct Fixture {
    root: PathBuf,
    service: Option<Child>,
}

impl Fixture {
    fn new() -> Self {
        let root =
            std::env::temp_dir().join(format!("rauto-routing-{:032x}", rand::random::<u128>()));
        std::fs::create_dir_all(&root).unwrap();
        Self {
            root,
            service: None,
        }
    }
    fn command(&self) -> Command {
        let mut command = Command::new(env!("CARGO_BIN_EXE_rauto"));
        command
            .env("RAUTO_HOME", &self.root)
            .env_remove("RAUTO_SESSION_RETRIES")
            .env_remove("RAUTO_RETRY_AUTHENTICATION_ERRORS")
            .env_remove("RAUTO_RETRY_INITIAL_BACKOFF_MS")
            .env_remove("RAUTO_RETRY_MAX_BACKOFF_MS")
            .env_remove("SSH_AUTH_SOCK");
        command
    }
    fn run(&self, args: &[&str]) -> Output {
        self.command().args(args).output().unwrap()
    }
    fn start(&mut self) {
        self.start_with_args(&[]);
    }
    fn start_with_args(&mut self, args: &[&str]) {
        self.service = Some(
            self.command()
                .args(["serve", "--port", "0"])
                .args(args)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .unwrap(),
        );
        self.wait_ready();
    }
    fn wait_ready(&mut self) {
        let deadline = Instant::now() + Duration::from_secs(15);
        loop {
            if std::fs::read(self.root.join("runtime.json"))
                .ok()
                .and_then(|s| serde_json::from_slice::<Value>(&s).ok())
                .is_some()
            {
                break;
            }
            assert!(
                self.service.as_mut().unwrap().try_wait().unwrap().is_none(),
                "service exited during startup"
            );
            assert!(Instant::now() < deadline, "service startup timed out");
            std::thread::sleep(Duration::from_millis(50));
        }
    }
    fn stop(&mut self) {
        if let Some(mut process) = self.service.take() {
            let _ = process.kill();
            let _ = process.wait();
        }
    }
}

#[test]
fn service_waits_for_existing_direct_runtime_ownership() {
    let mut fixture = Fixture::new();
    let owner = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(fixture.root.join("runtime.lock"))
        .unwrap();
    owner.lock().unwrap();
    fixture.service = Some(
        fixture
            .command()
            .args(["serve", "--port", "0"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap(),
    );
    std::thread::sleep(Duration::from_millis(150));
    assert!(
        fixture
            .service
            .as_mut()
            .unwrap()
            .try_wait()
            .unwrap()
            .is_none()
    );
    assert!(!fixture.root.join("rauto.db").exists());
    assert!(!fixture.root.join("runtime.json").exists());
    drop(owner);
    fixture.wait_ready();
    assert_ok(&fixture.run(&["--version"]));
}
impl Drop for Fixture {
    fn drop(&mut self) {
        self.stop();
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn assert_ok(output: &Output) {
    assert!(
        output.status.success(),
        "stdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn oversized_upload_is_rejected_before_initializing_the_runtime() {
    let fixture = Fixture::new();
    let file = fixture.root.join("oversized.bin");
    std::fs::File::create(&file)
        .unwrap()
        .set_len(32 * 1024 * 1024 + 1)
        .unwrap();
    let output = fixture.run(&[
        "upload",
        "--local-path",
        file.to_str().unwrap(),
        "--remote-path",
        "/tmp/oversized.bin",
    ]);
    assert!(!output.status.success());
    let message = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        message.contains("CLI service uploads are limited to 32 MiB per task"),
        "{message}"
    );
    assert!(!fixture.root.join("runtime.lock").exists());
    assert!(!fixture.root.join("rauto.db").exists());
    assert!(!fixture.root.join("uploads").exists());
}

#[test]
fn cli_routes_to_the_running_service_and_recovers_stale_runtime_metadata() {
    let mut fixture = Fixture::new();
    assert_ok(&fixture.run(&[
        "exec",
        "template",
        "create",
        "greeting",
        "--content",
        "echo hello",
    ]));
    let direct = fixture.run(&["exec", "--template", "greeting", "--dry-run"]);
    assert_ok(&direct);
    fixture.start();
    let remote = fixture.run(&["exec", "--template", "greeting", "--dry-run"]);
    assert_ok(&remote);
    assert_eq!(direct.stdout, remote.stdout);
    assert!(!String::from_utf8_lossy(&remote.stderr).contains("Task:"));

    let mut duplicate = fixture
        .command()
        .args(["web", "--port", "0"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if let Some(status) = duplicate.try_wait().unwrap() {
            assert!(!status.success());
            break;
        }
        if Instant::now() >= deadline {
            duplicate.kill().unwrap();
            duplicate.wait().unwrap();
            panic!("duplicate service did not refuse ownership");
        }
        std::thread::sleep(Duration::from_millis(25));
    }

    // A crashed service leaves metadata behind, but the released OS lock is
    // sufficient for the next CLI process to execute directly.
    fixture.stop();
    let after_crash = fixture.run(&["exec", "--template", "greeting", "--dry-run"]);
    assert_ok(&after_crash);
    assert_eq!(direct.stdout, after_crash.stdout);
    assert!(!String::from_utf8_lossy(&after_crash.stderr).contains("Task:"));
    fixture.start();
    let after_restart = fixture.run(&["exec", "--template", "greeting", "--dry-run"]);
    assert_ok(&after_restart);
    assert_eq!(direct.stdout, after_restart.stdout);
}

#[test]
#[cfg(not(target_os = "windows"))]
fn service_defaults_never_override_or_supply_cli_connection_options() {
    let mut fixture = Fixture::new();
    for name in ["target", "daemon"] {
        assert_ok(&fixture.run(&[
            "credential",
            "add",
            name,
            "--login-username",
            &format!("{name}-user"),
            "--auth-type",
            "agent",
        ]));
        assert_ok(&fixture.run(&[
            "device",
            "add",
            name,
            "--host",
            "192.0.2.1",
            "--device-profile",
            "linux",
            "--credential",
            name,
        ]));
    }
    assert_ok(&fixture.run(&[
        "exec",
        "template",
        "create",
        "identity",
        "--content",
        "echo {{ username }}@{{ host }}:{{ port }} {{ device_profile }}",
    ]));
    let commands = [
        vec![
            "exec",
            "--template",
            "identity",
            "--device",
            "target",
            "--dry-run",
        ],
        vec![
            "exec",
            "--template",
            "identity",
            "--device",
            "target",
            "--credential",
            "daemon",
            "--dry-run",
        ],
        vec![
            "exec",
            "--template",
            "identity",
            "--host",
            "192.0.2.3",
            "--credential",
            "target",
            "--device-profile",
            "linux",
            "--dry-run",
        ],
        vec!["exec", "--template", "identity", "--dry-run"],
    ];
    let direct: Vec<_> = commands.iter().map(|args| fixture.run(args)).collect();
    for output in &direct[..3] {
        assert_ok(output);
    }
    assert!(String::from_utf8_lossy(&direct[0].stdout).contains("target-user@192.0.2.1:22 linux"));
    assert!(String::from_utf8_lossy(&direct[1].stdout).contains("daemon-user@192.0.2.1:22 linux"));
    assert!(!direct[3].status.success());
    fixture.start_with_args(&[
        "--device",
        "daemon",
        "--credential",
        "daemon",
        "--host",
        "192.0.2.2",
        "--ssh-port",
        "2222",
        "--device-profile",
        "huawei",
        "--force-autodetect",
    ]);
    for (args, direct) in commands.iter().zip(direct) {
        let remote = fixture.run(args);
        assert_eq!(remote.status.success(), direct.status.success(), "{args:?}");
        if direct.status.success() {
            assert_eq!(remote.stdout, direct.stdout, "{args:?}");
        } else {
            assert!(String::from_utf8_lossy(&remote.stdout).contains("undefined value"));
        }
    }
}

#[test]
fn help_and_static_completion_do_not_initialize_runtime_data() {
    let fixture = Fixture::new();
    for args in [
        vec!["--help"],
        vec!["serve", "--help"],
        vec!["exec", "--help"],
        vec!["completion", "bash"],
    ] {
        assert_ok(&fixture.run(&args));
    }
    assert_eq!(std::fs::read_dir(&fixture.root).unwrap().count(), 0);
}

#[test]
fn background_task_commands_and_flags_are_rejected_before_initializing_data() {
    let fixture = Fixture::new();
    for args in [
        vec!["task", "list"],
        vec!["exec", "show version", "--detach"],
        vec!["exec", "show version", "--request-id", "previous"],
    ] {
        let output = fixture.run(&args);
        assert!(!output.status.success(), "unexpectedly accepted {args:?}");
    }
    assert_eq!(std::fs::read_dir(&fixture.root).unwrap().count(), 0);
}

fn workflow(command: &str) -> Value {
    serde_json::json!({"name":"sample", "fail_fast":true, "blocks":[{
        "name":"step", "rollback_policy":"none", "fail_fast":true, "steps":[{
            "run":{"kind":"command", "mode":"User", "command":command}, "rollback_on_failure":false
        }]
    }]})
}

#[test]
#[cfg(not(target_os = "windows"))]
fn failed_workflows_and_uploads_never_save_devices_in_either_runtime() {
    let mut fixture = Fixture::new();
    assert_ok(&fixture.run(&[
        "credential",
        "add",
        "test",
        "--login-username",
        "test",
        "--auth-type",
        "agent",
    ]));
    assert_ok(&fixture.run(&[
        "device",
        "add",
        "existing",
        "--host",
        "192.0.2.1",
        "--device-profile",
        "linux",
        "--credential",
        "test",
    ]));
    let before = fixture.run(&["device", "show", "existing", "--json"]);
    assert_ok(&before);
    let before: Value = serde_json::from_slice(&before.stdout).unwrap();
    let workflow_path = fixture.root.join("workflow.json");
    std::fs::write(&workflow_path, workflow("echo test").to_string()).unwrap();
    let upload_path = fixture.root.join("upload.txt");
    std::fs::write(&upload_path, "test").unwrap();

    for service in [false, true] {
        if service {
            fixture.start();
        }
        for name in ["existing", "new-device"] {
            for args in [
                vec!["tx-workflow", workflow_path.to_str().unwrap()],
                vec![
                    "upload",
                    "--local-path",
                    upload_path.to_str().unwrap(),
                    "--remote-path",
                    "/tmp/test.txt",
                ],
            ] {
                let mut command = fixture.command();
                command.args(args).args([
                    "--host",
                    "127.0.0.1",
                    "--ssh-port",
                    "1",
                    "--credential",
                    "test",
                    "--device-profile",
                    "linux",
                    "--save-device",
                    name,
                ]);
                let output = command.output().unwrap();
                assert!(!output.status.success());
                let error = format!(
                    "{}\n{}",
                    String::from_utf8_lossy(&output.stdout),
                    String::from_utf8_lossy(&output.stderr)
                );
                assert!(
                    error.contains("SSH_AUTH_SOCK"),
                    "expected agent connection failure, got: {error}"
                );
                let after = fixture.run(&["device", "show", "existing", "--json"]);
                assert_ok(&after);
                assert_eq!(
                    serde_json::from_slice::<Value>(&after.stdout).unwrap(),
                    before
                );
                let devices = fixture.run(&["device", "list", "--json"]);
                assert_ok(&devices);
                let devices: Value = serde_json::from_slice(&devices.stdout).unwrap();
                assert_eq!(devices.as_array().unwrap().len(), 1);
            }
        }
        assert_eq!(
            std::fs::read_dir(fixture.root.join("uploads"))
                .unwrap()
                .count(),
            0
        );
    }
}

#[test]
fn plain_json_preserves_command_syntax_and_templates_still_render_in_both_runtimes() {
    let mut fixture = Fixture::new();
    let literal = "docker inspect --format '{{.State.Status}}' service";
    let literal_workflow = workflow(literal);
    let plan = serde_json::json!({"name":"plan", "stages":[{
        "name":"stage", "strategy":"serial", "jobs":[{
            "strategy":"serial", "targets":["device"],
            "action":{"kind":"tx_workflow", "workflow":literal_workflow}
        }]
    }]});
    let controlled = serde_json::json!({"name":"loop", "fail_fast":true, "blocks":[{
        "kind":"loop", "iterations":"vars.addresses", "blocks": workflow("echo {{ item }}")["blocks"]
    }]});
    for (name, value) in [
        ("workflow", &literal_workflow),
        ("plan", &plan),
        ("loop", &controlled),
    ] {
        std::fs::write(fixture.root.join(format!("{name}.json")), value.to_string()).unwrap();
    }
    let template_path = fixture.root.join("template.json");
    std::fs::write(
        &template_path,
        workflow("echo {{ vars.message }}").to_string(),
    )
    .unwrap();
    assert_ok(&fixture.run(&[
        "tx-workflow",
        "template",
        "create",
        "greeting",
        "--file",
        template_path.to_str().unwrap(),
    ]));
    for remote in [false, true] {
        if remote {
            fixture.start();
        }
        for (command, file, expected, pointer, variables) in [
            (
                "tx-workflow",
                "workflow",
                literal,
                "/blocks/0/steps/0/run/command",
                None,
            ),
            (
                "orchestrate",
                "plan",
                literal,
                "/stages/0/jobs/0/action/workflow/blocks/0/steps/0/run/command",
                None,
            ),
            (
                "tx-workflow",
                "loop",
                "echo 192.0.2.1",
                "/blocks/0/steps/0/run/command",
                Some(r#"{"addresses":["192.0.2.1","192.0.2.2"]}"#),
            ),
        ] {
            let file = fixture.root.join(format!("{file}.json"));
            let mut args = vec![command, file.to_str().unwrap(), "--dry-run", "--json"];
            if let Some(variables) = variables {
                args.extend(["--vars-json", variables]);
            }
            let output = fixture.run(&args);
            assert_ok(&output);
            let preview: Value = serde_json::from_slice(&output.stdout).unwrap();
            assert_eq!(preview.pointer(pointer).unwrap(), expected);
            if variables.is_some() {
                assert_eq!(preview["blocks"].as_array().unwrap().len(), 2);
            }
        }
        let output = fixture.run(&[
            "tx-workflow",
            "--template",
            "greeting",
            "--vars-json",
            r#"{"message":"hello"}"#,
            "--dry-run",
            "--json",
        ]);
        assert_ok(&output);
        let preview: Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(
            preview["blocks"][0]["steps"][0]["run"]["command"],
            "echo hello"
        );
    }
}

#[test]
fn previews_skip_recording_exports_in_both_runtimes() {
    let mut fixture = Fixture::new();
    let file = fixture.root.join("workflow.json");
    std::fs::write(&file, workflow("echo hello").to_string()).unwrap();
    assert_ok(&fixture.run(&[
        "exec",
        "template",
        "create",
        "greeting",
        "--content",
        "echo hello",
    ]));
    let recording = fixture.root.join("recording.jsonl");
    std::fs::write(&recording, "existing recording").unwrap();
    for remote in [false, true] {
        if remote {
            fixture.start();
        }
        for args in [
            vec!["exec", "--template", "greeting", "--dry-run"],
            vec!["tx-workflow", file.to_str().unwrap(), "--dry-run", "--json"],
            vec!["tx-workflow", file.to_str().unwrap(), "--view"],
        ] {
            for path in [&recording, &fixture.root.join("absent/recording.jsonl")] {
                let mut args = args.clone();
                args.extend(["--record-file", path.to_str().unwrap()]);
                assert_ok(&fixture.run(&args));
            }
        }
        assert_eq!(
            std::fs::read_to_string(&recording).unwrap(),
            "existing recording"
        );
        assert!(!fixture.root.join("absent").exists());
    }
}
