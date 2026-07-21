use super::targets as orchestrator_targets;
use super::validation::{validate_plan, validate_tx_workflow_action};
use super::*;
use crate::config::connection_store::{SavedConnection, save_connection};
use crate::db;
use serde_json::json;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

static TEST_ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

struct TestEnvGuard {
    original_home: Option<std::ffi::OsString>,
    _root: PathBuf,
    _guard: std::sync::MutexGuard<'static, ()>,
}

impl TestEnvGuard {
    fn new() -> anyhow::Result<Self> {
        let guard = TEST_ENV_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .expect("test env lock poisoned");
        let root = std::env::temp_dir().join(format!(
            "rauto-orchestrator-test-{}",
            SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos()
        ));
        let original_home = std::env::var_os("RAUTO_HOME");
        unsafe {
            std::env::set_var("RAUTO_HOME", &root);
        }
        Ok(Self {
            original_home,
            _root: root,
            _guard: guard,
        })
    }
}

impl Drop for TestEnvGuard {
    fn drop(&mut self) {
        if let Some(value) = &self.original_home {
            unsafe {
                std::env::set_var("RAUTO_HOME", value);
            }
        } else {
            unsafe {
                std::env::remove_var("RAUTO_HOME");
            }
        }
    }
}

fn saved_connection(host: &str, groups: Vec<&str>, labels: Vec<&str>) -> SavedConnection {
    SavedConnection {
        host: Some(host.to_string()),
        username: Some("ops".to_string()),
        password: None,
        password_ref: None,
        port: Some(22),
        connect_timeout_secs: None,
        device_model: None,
        software_version: None,
        enable_password: None,
        enable_password_ref: None,
        enable_password_empty_enter: false,
        ssh_security: None,
        linux_shell_flavor: None,
        device_profile: Some("linux".to_string()),
        template_dir: None,
        enabled: true,
        labels: labels.into_iter().map(str::to_string).collect(),
        vars: json!({}),
        groups: groups.into_iter().map(str::to_string).collect(),
    }
}

fn sample_tx_workflow_action() -> TxWorkflowAction {
    TxWorkflowAction {
        workflow: Some(json!({"name": "workflow", "blocks": []})),
        workflow_template_name: None,
        workflow_vars: Value::Null,
    }
}

fn sample_stage_with_job(job: OrchestrationJob) -> OrchestrationStage {
    OrchestrationStage {
        name: "stage-1".to_string(),
        strategy: StageStrategy::Serial,
        max_parallel: None,
        fail_fast: None,
        jobs: vec![job],
    }
}

fn sample_job_with_targets() -> OrchestrationJob {
    OrchestrationJob {
        name: Some("job-1".to_string()),
        strategy: StageStrategy::Serial,
        max_parallel: None,
        fail_fast: None,
        target_groups: Vec::new(),
        target_tags: Vec::new(),
        targets: vec!["sw-01".to_string()],
        action: OrchestrationAction::TxWorkflow(sample_tx_workflow_action()),
    }
}

#[test]
fn legacy_inventory_fields_are_ignored() -> anyhow::Result<()> {
    let plan: OrchestrationPlan = serde_json::from_value(json!({
        "name": "legacy",
        "inventory_file": "./inventory.json",
        "inventory": {"groups": {"edge": ["edge-01"]}},
        "stages": []
    }))?;
    let value = serde_json::to_value(plan)?;

    assert!(value.get("inventory_file").is_none());
    assert!(value.get("inventory").is_none());
    Ok(())
}

#[test]
fn resolve_job_targets_uses_saved_groups_and_deduplicates_connections() -> anyhow::Result<()> {
    let _env_guard = TestEnvGuard::new()?;
    db::init_sync()?;
    save_connection(
        "orchestration-edge-a",
        &saved_connection("192.0.2.11", vec!["edge"], vec!["prod"]),
    )?;
    save_connection(
        "orchestration-edge-b",
        &saved_connection("192.0.2.12", vec!["core"], vec!["edge"]),
    )?;
    let mut job = sample_job_with_targets();
    job.target_groups = vec!["edge".to_string(), "core".to_string()];
    job.target_tags = vec!["prod".to_string()];
    job.targets = vec!["orchestration-edge-a".to_string()];

    let targets = orchestrator_targets::resolve_job_targets("stage-1", &job)?;
    let labels = targets
        .iter()
        .enumerate()
        .map(|(idx, target)| target_label(target, idx))
        .collect::<Vec<_>>();

    assert_eq!(labels, vec!["orchestration-edge-a", "orchestration-edge-b"]);
    Ok(())
}

#[test]
fn orchestration_plan_rejects_custom_target_objects() {
    let plan = json!({
        "name": "saved-connections-only",
        "stages": [{
            "name": "stage-1",
            "strategy": "serial",
            "jobs": [{
                "strategy": "serial",
                "targets": [{"host": "192.0.2.10", "username": "admin"}],
                "action": {
                    "kind": "tx_workflow",
                    "workflow": {"name": "workflow", "blocks": []}
                }
            }]
        }]
    });

    let error = serde_json::from_value::<OrchestrationPlan>(plan)
        .expect_err("custom target objects must be rejected");
    assert!(error.to_string().contains("invalid type: map"));
}

#[test]
fn resolve_job_targets_rejects_unknown_saved_group() -> anyhow::Result<()> {
    let _env_guard = TestEnvGuard::new()?;
    db::init_sync()?;
    let mut job = sample_job_with_targets();
    job.name = Some("deploy".to_string());
    job.target_groups = vec!["missing-group".to_string()];
    job.targets.clear();

    let error = orchestrator_targets::resolve_job_targets("release", &job)
        .expect_err("unknown groups must fail");

    assert!(
        error.to_string().contains(
            "stage 'release' job 'deploy' references unknown device group 'missing-group'"
        )
    );
    Ok(())
}

#[test]
fn plan_validation_rejects_empty_stage_jobs() {
    let plan = OrchestrationPlan {
        name: "demo".to_string(),
        fail_fast: true,
        rollback_on_stage_failure: false,
        rollback_completed_stages_on_failure: false,
        stages: vec![OrchestrationStage {
            name: "stage-1".to_string(),
            strategy: StageStrategy::Serial,
            max_parallel: None,
            fail_fast: None,
            jobs: Vec::new(),
        }],
    };

    assert!(validate_plan(&plan).is_err());
}

#[test]
fn plan_accepts_compensation_switches() {
    let plan = OrchestrationPlan {
        name: "demo".to_string(),
        fail_fast: true,
        rollback_on_stage_failure: true,
        rollback_completed_stages_on_failure: true,
        stages: vec![sample_stage_with_job(sample_job_with_targets())],
    };

    validate_plan(&plan).expect("plan should validate");
    let rendered = render::render_plan(&plan, None).expect("plan should render");
    assert!(rendered.contains("rollback_on_stage_failure=true"));
    assert!(rendered.contains("rollback_completed_stages_on_failure=true"));
}

#[test]
fn plan_validation_rejects_job_without_targets() {
    let mut job = sample_job_with_targets();
    job.targets = Vec::new();
    let plan = OrchestrationPlan {
        name: "demo".to_string(),
        fail_fast: true,
        rollback_on_stage_failure: false,
        rollback_completed_stages_on_failure: false,
        stages: vec![sample_stage_with_job(job)],
    };

    assert!(validate_plan(&plan).is_err());
}

#[test]
fn plan_validation_rejects_parallel_max_parallel_zero_for_stage_and_job() {
    let mut job = sample_job_with_targets();
    job.strategy = StageStrategy::Parallel;
    job.max_parallel = Some(0);
    let stage_with_bad_job = sample_stage_with_job(job);
    let plan_bad_job = OrchestrationPlan {
        name: "demo".to_string(),
        fail_fast: true,
        rollback_on_stage_failure: false,
        rollback_completed_stages_on_failure: false,
        stages: vec![stage_with_bad_job],
    };
    assert!(validate_plan(&plan_bad_job).is_err());

    let mut stage_bad_parallel = sample_stage_with_job(sample_job_with_targets());
    stage_bad_parallel.strategy = StageStrategy::Parallel;
    stage_bad_parallel.max_parallel = Some(0);
    let plan_bad_stage = OrchestrationPlan {
        name: "demo".to_string(),
        fail_fast: true,
        rollback_on_stage_failure: false,
        rollback_completed_stages_on_failure: false,
        stages: vec![stage_bad_parallel],
    };
    assert!(validate_plan(&plan_bad_stage).is_err());
}

#[test]
fn validate_tx_workflow_action_requires_single_source() {
    let action = TxWorkflowAction {
        workflow: None,
        workflow_template_name: None,
        workflow_vars: Value::Null,
    };
    assert!(validate_tx_workflow_action("stage 'demo' job 1", &action).is_err());
}

#[test]
fn orchestration_action_accepts_inline_workflow() {
    let action: OrchestrationAction = serde_json::from_value(json!({
        "kind": "tx_workflow",
        "workflow": {"name": "inline", "blocks": []}
    }))
    .expect("inline workflow action");

    assert!(matches!(action, OrchestrationAction::TxWorkflow(_)));
}

#[test]
fn orchestration_action_accepts_saved_workflow_template() {
    let action: OrchestrationAction = serde_json::from_value(json!({
        "kind": "tx_workflow",
        "workflow_template_name": "campus-upgrade",
        "workflow_vars": {"version": "17.9"}
    }))
    .expect("saved workflow template action");

    assert!(matches!(action, OrchestrationAction::TxWorkflow(_)));
}

#[test]
fn orchestration_action_rejects_removed_kinds_and_fields() {
    for value in [
        json!({"kind": "tx_block", "commands": ["show version"]}),
        json!({"kind": "tx_workflow", "workflow_file": "workflow.json"}),
        json!({"kind": "tx_workflow", "workflow_template_content": "{}"}),
        json!({
            "kind": "tx_workflow",
            "name": "redundant",
            "workflow": {"name": "inline", "blocks": []}
        }),
    ] {
        assert!(
            serde_json::from_value::<OrchestrationAction>(value).is_err(),
            "removed orchestration action shape must be rejected"
        );
    }
}

#[test]
fn validate_tx_workflow_action_rejects_mixed_sources_and_inline_vars() {
    let mixed = TxWorkflowAction {
        workflow: Some(json!({"name": "inline", "blocks": []})),
        workflow_template_name: Some("campus-upgrade".to_string()),
        workflow_vars: Value::Null,
    };
    assert!(validate_tx_workflow_action("stage 'demo' job 1", &mixed).is_err());

    let inline_with_vars = TxWorkflowAction {
        workflow: Some(json!({"name": "inline", "blocks": []})),
        workflow_template_name: None,
        workflow_vars: json!({"version": "17.9"}),
    };
    assert!(validate_tx_workflow_action("stage 'demo' job 1", &inline_with_vars).is_err());
}

#[test]
fn orchestration_plan_rejects_legacy_stage_action_shape() {
    let legacy_plan = json!({
        "name": "legacy-shape",
        "fail_fast": true,
        "stages": [
            {
                "name": "phase-1",
                "strategy": "serial",
                "targets": ["edge-01"],
                "action": {
                    "kind": "tx_block",
                    "commands": ["show version"]
                }
            }
        ]
    });

    let err = serde_json::from_value::<OrchestrationPlan>(legacy_plan)
        .expect_err("legacy stage.action shape must be rejected");
    assert!(
        err.to_string().contains("missing field `jobs`"),
        "unexpected parse error: {err}"
    );
}
