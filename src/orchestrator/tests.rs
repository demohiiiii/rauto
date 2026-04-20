use super::validation::{validate_plan, validate_tx_block_action, validate_tx_workflow_action};
use super::*;
use serde_json::json;

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
fn plan_validation_rejects_empty_stage_targets() {
    let plan = OrchestrationPlan {
        name: "demo".to_string(),
        fail_fast: true,
        inventory_file: None,
        inventory: None,
        stages: vec![OrchestrationStage {
            name: "stage-1".to_string(),
            strategy: StageStrategy::Serial,
            max_parallel: None,
            fail_fast: None,
            target_groups: Vec::new(),
            targets: Vec::new(),
            action: OrchestrationAction::TxBlock(TxBlockAction {
                name: None,
                template: None,
                tx_block_template_name: None,
                tx_block_template_content: None,
                tx_block_template_vars: Value::Null,
                vars: Value::Null,
                commands: vec!["show ver".to_string()],
                rollback_commands: Vec::new(),
                rollback_on_failure: false,
                rollback_trigger_step_index: None,
                mode: None,
                timeout_secs: None,
                resource_rollback_command: None,
            }),
        }],
    };

    assert!(validate_plan(&plan, &OrchestrationInventory::default()).is_err());
}

#[test]
fn resolve_stage_targets_supports_inventory_groups_and_inline_targets() {
    let stage = OrchestrationStage {
        name: "access".to_string(),
        strategy: StageStrategy::Parallel,
        max_parallel: Some(5),
        fail_fast: None,
        target_groups: vec!["edge".to_string()],
        targets: vec![OrchestrationTargetInput::Detailed(Box::new(
            OrchestrationTarget {
                name: Some("adhoc-sw".to_string()),
                host: Some("10.0.0.99".to_string()),
                ..OrchestrationTarget::default()
            },
        ))],
        action: OrchestrationAction::TxBlock(TxBlockAction {
            name: None,
            template: Some("configure_vlan.j2".to_string()),
            tx_block_template_name: None,
            tx_block_template_content: None,
            tx_block_template_vars: Value::Null,
            vars: Value::Null,
            commands: Vec::new(),
            rollback_commands: Vec::new(),
            rollback_on_failure: false,
            rollback_trigger_step_index: None,
            mode: None,
            timeout_secs: None,
            resource_rollback_command: None,
        }),
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

    let targets = orchestrator_targets::resolve_stage_targets(&stage, &inventory).expect("targets");
    let labels = targets
        .iter()
        .enumerate()
        .map(|(idx, target)| target_label(target, idx))
        .collect::<Vec<_>>();

    assert_eq!(labels, vec!["sw-01", "sw-02", "adhoc-sw"]);
}

#[test]
fn resolve_stage_targets_merges_inventory_and_group_defaults() {
    let stage = OrchestrationStage {
        name: "access".to_string(),
        strategy: StageStrategy::Parallel,
        max_parallel: Some(5),
        fail_fast: None,
        target_groups: vec!["access".to_string()],
        targets: Vec::new(),
        action: OrchestrationAction::TxBlock(TxBlockAction {
            name: None,
            template: Some("configure_vlan.j2".to_string()),
            tx_block_template_name: None,
            tx_block_template_content: None,
            tx_block_template_vars: Value::Null,
            vars: Value::Null,
            commands: Vec::new(),
            rollback_commands: Vec::new(),
            rollback_on_failure: false,
            rollback_trigger_step_index: None,
            mode: None,
            timeout_secs: None,
            resource_rollback_command: None,
        }),
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

    let targets = orchestrator_targets::resolve_stage_targets(&stage, &inventory).expect("targets");
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
    let stage = OrchestrationStage {
        name: "stage-1".to_string(),
        strategy: StageStrategy::Serial,
        max_parallel: None,
        fail_fast: None,
        target_groups: vec!["edge".to_string()],
        targets: Vec::new(),
        action: OrchestrationAction::TxBlock(TxBlockAction {
            name: None,
            template: Some("cmd.j2".to_string()),
            tx_block_template_name: Some("saved-block".to_string()),
            tx_block_template_content: None,
            tx_block_template_vars: Value::Null,
            vars: Value::Null,
            commands: vec![],
            rollback_commands: vec![],
            rollback_on_failure: false,
            rollback_trigger_step_index: None,
            mode: None,
            timeout_secs: None,
            resource_rollback_command: None,
        }),
    };
    let action = match &stage.action {
        OrchestrationAction::TxBlock(action) => action,
        _ => unreachable!(),
    };
    assert!(validate_tx_block_action(&stage, action).is_err());
}

#[test]
fn validate_tx_workflow_action_accepts_template_source() {
    let stage = OrchestrationStage {
        name: "stage-1".to_string(),
        strategy: StageStrategy::Serial,
        max_parallel: None,
        fail_fast: None,
        target_groups: vec!["edge".to_string()],
        targets: Vec::new(),
        action: OrchestrationAction::TxWorkflow(TxWorkflowAction {
            workflow_file: None,
            workflow: None,
            workflow_template_name: Some("linux-rollout".to_string()),
            workflow_template_content: None,
            workflow_vars: json!({"peer":"edge94"}),
        }),
    };
    let action = match &stage.action {
        OrchestrationAction::TxWorkflow(action) => action,
        _ => unreachable!(),
    };
    assert!(validate_tx_workflow_action(&stage, action).is_ok());
}
