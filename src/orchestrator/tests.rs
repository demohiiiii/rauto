use super::validation::{validate_plan, validate_tx_block_action, validate_tx_workflow_action};
use super::*;
use serde_json::json;
use std::collections::HashMap;

fn sample_tx_block_action() -> TxBlockAction {
    TxBlockAction {
        name: None,
        template: None,
        tx_block_template_name: None,
        tx_block_template_content: None,
        tx_block_template_vars: Value::Null,
        flow_template_name: None,
        flow_template_content: None,
        flow_vars: Value::Null,
        vars: Value::Null,
        commands: vec!["show version".to_string()],
        rollback_commands: Vec::new(),
        rollback_on_failure: false,
        rollback_trigger_step_index: None,
        mode: None,
        timeout_secs: None,
        resource_rollback_command: None,
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
        targets: vec![OrchestrationTargetInput::ConnectionName(
            "sw-01".to_string(),
        )],
        action: OrchestrationAction::TxBlock(sample_tx_block_action()),
    }
}

#[test]
fn merge_values_recursively() {
    let base = json!({
        "device": {"name": "a", "region": "hz"},
        "vlan": 10
    });
    let overlay = json!({
        "device": {"name": "b"},
        "desc": "edge"
    });
    let merged = orchestrator_targets::merge_values(&base, &overlay);
    assert_eq!(
        merged,
        json!({
            "device": {"name": "b", "region": "hz"},
            "vlan": 10,
            "desc": "edge"
        })
    );
}

#[test]
fn plan_validation_rejects_empty_stage_jobs() {
    let plan = OrchestrationPlan {
        name: "demo".to_string(),
        fail_fast: true,
        rollback_on_stage_failure: false,
        rollback_completed_stages_on_failure: false,
        inventory_file: None,
        inventory: None,
        stages: vec![OrchestrationStage {
            name: "stage-1".to_string(),
            strategy: StageStrategy::Serial,
            max_parallel: None,
            fail_fast: None,
            jobs: Vec::new(),
        }],
    };

    assert!(validate_plan(&plan, &OrchestrationInventory::default()).is_err());
}

#[test]
fn plan_accepts_compensation_switches() {
    let plan = OrchestrationPlan {
        name: "demo".to_string(),
        fail_fast: true,
        rollback_on_stage_failure: true,
        rollback_completed_stages_on_failure: true,
        inventory_file: None,
        inventory: None,
        stages: vec![sample_stage_with_job(sample_job_with_targets())],
    };

    validate_plan(&plan, &OrchestrationInventory::default()).expect("plan should validate");
    let rendered = render::render_plan(&plan, &OrchestrationInventory::default(), None)
        .expect("plan should render");
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
        inventory_file: None,
        inventory: None,
        stages: vec![sample_stage_with_job(job)],
    };

    assert!(validate_plan(&plan, &OrchestrationInventory::default()).is_err());
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
        inventory_file: None,
        inventory: None,
        stages: vec![stage_with_bad_job],
    };
    assert!(validate_plan(&plan_bad_job, &OrchestrationInventory::default()).is_err());

    let mut stage_bad_parallel = sample_stage_with_job(sample_job_with_targets());
    stage_bad_parallel.strategy = StageStrategy::Parallel;
    stage_bad_parallel.max_parallel = Some(0);
    let plan_bad_stage = OrchestrationPlan {
        name: "demo".to_string(),
        fail_fast: true,
        rollback_on_stage_failure: false,
        rollback_completed_stages_on_failure: false,
        inventory_file: None,
        inventory: None,
        stages: vec![stage_bad_parallel],
    };
    assert!(validate_plan(&plan_bad_stage, &OrchestrationInventory::default()).is_err());
}

#[test]
fn resolve_job_targets_supports_inventory_groups_and_inline_targets() {
    let job = OrchestrationJob {
        name: Some("access-job".to_string()),
        strategy: StageStrategy::Parallel,
        max_parallel: Some(5),
        fail_fast: None,
        target_groups: vec!["edge".to_string()],
        target_tags: Vec::new(),
        targets: vec![OrchestrationTargetInput::Detailed(Box::new(
            OrchestrationTarget {
                name: Some("adhoc-sw".to_string()),
                host: Some("10.0.0.99".to_string()),
                ..OrchestrationTarget::default()
            },
        ))],
        action: OrchestrationAction::TxBlock(sample_tx_block_action()),
    };
    let inventory = OrchestrationInventory {
        defaults: OrchestrationTargetDefaults::default(),
        groups: HashMap::from([(
            "edge".to_string(),
            InventoryGroup::Targets(vec![
                OrchestrationTargetInput::ConnectionName("sw-01".to_string()),
                OrchestrationTargetInput::ConnectionName("sw-02".to_string()),
            ]),
        )]),
    };

    let targets =
        orchestrator_targets::resolve_job_targets("stage-1", &job, &inventory).expect("targets");
    let labels = targets
        .iter()
        .enumerate()
        .map(|(idx, target)| target_label(target, idx))
        .collect::<Vec<_>>();

    assert_eq!(labels, vec!["sw-01", "sw-02", "adhoc-sw"]);
}

#[test]
fn resolve_job_targets_merges_inventory_and_group_defaults() {
    let job = OrchestrationJob {
        name: Some("access-job".to_string()),
        strategy: StageStrategy::Parallel,
        max_parallel: Some(5),
        fail_fast: None,
        target_groups: vec!["access".to_string()],
        target_tags: Vec::new(),
        targets: Vec::new(),
        action: OrchestrationAction::TxBlock(sample_tx_block_action()),
    };
    let inventory = OrchestrationInventory {
        defaults: OrchestrationTargetDefaults {
            username: Some("admin".to_string()),
            password: None,
            port: Some(22),
            enable_password: None,
            ssh_security: Some(SshSecurityProfile::Balanced),
            linux_shell_flavor: None,
            device_profile: Some("cisco".to_string()),
            template_dir: Some("/tmp/templates".to_string()),
            vars: json!({
                "site": "hz",
                "meta": {"env": "prod"}
            }),
        },
        groups: HashMap::from([(
            "access".to_string(),
            InventoryGroup::Detailed(InventoryGroupSpec {
                defaults: OrchestrationTargetDefaults {
                    username: None,
                    password: None,
                    port: None,
                    enable_password: None,
                    ssh_security: Some(SshSecurityProfile::LegacyCompatible),
                    linux_shell_flavor: None,
                    device_profile: Some("huawei".to_string()),
                    template_dir: None,
                    vars: json!({
                        "meta": {"role": "access"},
                        "region": "east"
                    }),
                },
                targets: vec![OrchestrationTargetInput::Detailed(Box::new(
                    OrchestrationTarget {
                        connection: Some("sw-01".to_string()),
                        vars: json!({
                            "hostname": "sw-01",
                            "meta": {"rack": "r1"}
                        }),
                        ..OrchestrationTarget::default()
                    },
                ))],
            }),
        )]),
    };

    let targets =
        orchestrator_targets::resolve_job_targets("stage-1", &job, &inventory).expect("targets");
    let target = targets.first().expect("one target");

    assert_eq!(target.connection.as_deref(), Some("sw-01"));
    assert_eq!(target.username.as_deref(), Some("admin"));
    assert_eq!(target.port, Some(22));
    assert_eq!(
        target.ssh_security,
        Some(SshSecurityProfile::LegacyCompatible)
    );
    assert_eq!(target.device_profile.as_deref(), Some("huawei"));
    assert_eq!(target.template_dir.as_deref(), Some("/tmp/templates"));
    assert_eq!(
        target.vars,
        json!({
            "site": "hz",
            "region": "east",
            "hostname": "sw-01",
            "meta": {
                "env": "prod",
                "role": "access",
                "rack": "r1"
            }
        })
    );
}

#[test]
fn validate_tx_block_action_rejects_mixed_template_sources() {
    let mut action = sample_tx_block_action();
    action.template = Some("cmd.j2".to_string());
    action.tx_block_template_name = Some("saved-block".to_string());
    assert!(validate_tx_block_action("stage 'demo' job 1", &action).is_err());
}

#[test]
fn validate_tx_block_action_accepts_flow_template_source() {
    let mut action = sample_tx_block_action();
    action.commands.clear();
    action.flow_template_name = Some("scp".to_string());
    action.flow_vars = json!({"peer": "edge94"});
    assert!(validate_tx_block_action("stage 'demo' job 1", &action).is_ok());
}

#[test]
fn validate_tx_workflow_action_requires_single_source() {
    let action = TxWorkflowAction {
        workflow_file: None,
        workflow: None,
        workflow_template_name: None,
        workflow_template_content: None,
        workflow_vars: Value::Null,
    };
    assert!(validate_tx_workflow_action("stage 'demo' job 1", &action).is_err());
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
