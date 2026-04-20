use super::{
    TaskReportContext, build_json_template_context, builtin_command_flow_template_by_name,
    merged_saved_secret, parse_builtin_command_flow_template_token, require_managed_async_task,
    resolve_tx_block_value_from_input, sanitize_rendered_output_for_response,
    saved_connection_detail_response, should_persist_secret,
};
use crate::config::connection_store::SavedConnection;
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::ssh_security::SshSecurityProfile;
use crate::task::TaskOperation;
use crate::web::state::ResolvedConnection;
use std::path::PathBuf;

#[test]
fn saved_connection_detail_response_redacts_secrets() {
    let detail = saved_connection_detail_response(
        "lab1",
        &PathBuf::from("/tmp/lab1.toml"),
        &SavedConnection {
            host: Some("192.0.2.10".to_string()),
            username: Some("admin".to_string()),
            password: Some("secret".to_string()),
            password_ref: None,
            port: Some(22),
            enable_password: Some("enable-secret".to_string()),
            enable_password_ref: None,
            ssh_security: Some(SshSecurityProfile::Balanced),
            linux_shell_flavor: None,
            device_profile: Some("cisco_ios".to_string()),
            template_dir: Some("/tmp/templates".to_string()),
            enabled: true,
            labels: vec!["edge".to_string()],
            vars: serde_json::json!({"site":"lab"}),
            groups: vec!["access".to_string()],
        },
    );

    assert!(detail.has_password);
    assert_eq!(detail.connection.connection_name.as_deref(), Some("lab1"));
    assert_eq!(detail.connection.host.as_deref(), Some("192.0.2.10"));
    assert_eq!(detail.connection.username.as_deref(), Some("admin"));
    assert_eq!(detail.connection.port, Some(22));
    assert_eq!(
        detail.connection.ssh_security,
        Some(SshSecurityProfile::Balanced)
    );
    assert_eq!(
        detail.connection.device_profile.as_deref(),
        Some("cisco_ios")
    );
    assert_eq!(
        detail.connection.template_dir.as_deref(),
        Some("/tmp/templates")
    );
    assert_eq!(detail.connection.password, None);
    assert_eq!(detail.connection.enable_password, None);
}

#[test]
fn merged_saved_secret_preserves_existing_secret_when_request_is_blank() {
    let existing = "stored-secret".to_string();
    assert_eq!(
        merged_saved_secret(true, None, Some(&existing)),
        Some("stored-secret".to_string())
    );
    assert_eq!(
        merged_saved_secret(true, Some("new-secret".to_string()), Some(&existing)),
        Some("new-secret".to_string())
    );
    assert_eq!(merged_saved_secret(false, None, Some(&existing)), None);
}

#[test]
fn explicit_secret_input_implies_secret_should_be_persisted() {
    assert!(should_persist_secret(false, Some("secret")));
    assert!(should_persist_secret(true, None));
    assert!(!should_persist_secret(false, None));
    assert!(!should_persist_secret(false, Some("   ")));
}

#[test]
fn managed_mode_allows_task_callback_with_task_id_only() {
    let managed =
        TaskReportContext::from_request(TaskOperation::Exec, Some("task-1".to_string()), true);
    assert!(managed.is_some());

    let local =
        TaskReportContext::from_request(TaskOperation::Exec, Some("task-1".to_string()), false);
    assert!(local.is_none());
}

#[test]
fn managed_async_task_requires_agent_mode_and_task_id() {
    assert!(
        require_managed_async_task(TaskOperation::TxBlock, Some("task-1".to_string()), true)
            .is_ok()
    );
    assert!(
        require_managed_async_task(TaskOperation::TxBlock, Some("   ".to_string()), true).is_err()
    );
    assert!(require_managed_async_task(TaskOperation::TxBlock, None, true).is_err());
    assert!(
        require_managed_async_task(TaskOperation::TxBlock, Some("task-1".to_string()), false)
            .is_err()
    );
}

#[test]
fn json_template_context_supports_flat_lookup_with_runtime_precedence() {
    let conn = ResolvedConnection {
        connection_name: None,
        host: "192.168.30.92".to_string(),
        username: "admin".to_string(),
        password: "secret-92".to_string(),
        port: 22,
        enable_password: None,
        ssh_security: SshSecurityProfile::Balanced,
        linux_shell_flavor: Some(LinuxShellFlavor::Fish),
        device_profile: "linux".to_string(),
        vars: serde_json::json!({
            "site": "lab-a",
            "peer_host": "192.168.30.94"
        }),
    };
    let context = build_json_template_context(
        serde_json::json!({
            "peer_host": "edge-94.host",
            "deploy_env": "prod"
        }),
        Some(&conn),
    );
    assert_eq!(context["peer_host"], serde_json::json!("edge-94.host"));
    assert_eq!(context["deploy_env"], serde_json::json!("prod"));
    assert_eq!(context["site"], serde_json::json!("lab-a"));
    assert_eq!(context["host"], serde_json::json!("192.168.30.92"));
    assert_eq!(
        context["vars"]["peer_host"],
        serde_json::json!("edge-94.host")
    );
}

#[test]
fn tx_block_direct_input_supports_template_rendering_with_connection_context() {
    let conn = ResolvedConnection {
        connection_name: Some("edge92".to_string()),
        host: "192.168.30.92".to_string(),
        username: "admin".to_string(),
        password: "secret-92".to_string(),
        port: 22,
        enable_password: None,
        ssh_security: SshSecurityProfile::Balanced,
        linux_shell_flavor: Some(LinuxShellFlavor::Posix),
        device_profile: "linux".to_string(),
        vars: serde_json::json!({}),
    };
    let raw_block = serde_json::json!({
        "name": "deploy",
        "rollback_policy": "none",
        "steps": [{
            "run": {
                "kind": "command",
                "mode": "User",
                "command": "scp /tmp/app.tar {{ username }}@{{ target_host }}:/tmp/app.tar # {{ password }}",
                "timeout": 30
            },
            "rollback": null,
            "rollback_on_failure": false
        }],
        "fail_fast": true
    });
    let rendered = resolve_tx_block_value_from_input(
        raw_block,
        None,
        None,
        serde_json::json!({
            "target_host": "host"
        }),
        Some(&conn),
    )
    .expect("tx block direct rendering should succeed");

    let command = rendered["steps"][0]["run"]["command"]
        .as_str()
        .expect("rendered command should be a string");
    assert!(command.contains("admin@192.168.30.92"));
    assert!(command.contains("secret-92"));
}

#[test]
fn sanitize_rendered_output_masks_password_like_values() {
    let context = serde_json::json!({
        "host": "192.168.30.92",
        "password": "secret-pass",
        "enable_password": "enable-pass",
        "api_token": "token-123",
        "vars": {
            "db_password": "db-pass"
        }
    });
    let rendered = "ssh admin@192.168.30.92 password=secret-pass enable=enable-pass token=token-123 db=db-pass";
    let masked = sanitize_rendered_output_for_response(rendered, &context);

    assert!(!masked.contains("secret-pass"));
    assert!(!masked.contains("enable-pass"));
    assert!(!masked.contains("token-123"));
    assert!(!masked.contains("db-pass"));
    assert!(masked.contains("192.168.30.92"));
    assert!(masked.matches("******").count() >= 4);
}

#[test]
fn parse_builtin_flow_template_token_supports_prefix() {
    assert_eq!(
        parse_builtin_command_flow_template_token("builtin:cisco_like_copy").as_deref(),
        Some("cisco-like-copy")
    );
    assert_eq!(
        parse_builtin_command_flow_template_token("BUILTIN:cisco-like-copy").as_deref(),
        Some("cisco-like-copy")
    );
    assert_eq!(
        parse_builtin_command_flow_template_token("cisco-like-copy"),
        None
    );
}

#[test]
fn builtin_flow_template_can_be_loaded() {
    let template = builtin_command_flow_template_by_name("cisco_like_copy")
        .expect("builtin flow template should exist");
    assert_eq!(template.name, "cisco-like-copy");
    assert!(!template.steps.is_empty());
}
