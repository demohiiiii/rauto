use super::{OrchestrationAction, OrchestrationJob, OrchestrationPlan, targets, template_resolver};
use crate::EffectiveConnection;
use crate::cli::GlobalOpts;
use crate::domain::orchestration::{RenderedOrchestrationWorkflow, job_name};
use anyhow::{Context, Result, bail};

pub(crate) fn preview_plan_commands(
    plan: &OrchestrationPlan,
    opts: &GlobalOpts,
) -> Result<Vec<RenderedOrchestrationWorkflow>> {
    preview_with_connections(plan, |stage, job| {
        targets::resolve_job_targets(stage, job)?
            .iter()
            .map(|target| targets::resolve_target_connection(opts, target))
            .collect()
    })
}

fn preview_with_connections(
    plan: &OrchestrationPlan,
    mut resolve: impl FnMut(&str, &OrchestrationJob) -> Result<Vec<EffectiveConnection>>,
) -> Result<Vec<RenderedOrchestrationWorkflow>> {
    let mut previews = Vec::new();
    for (stage_index, stage) in plan.stages.iter().enumerate() {
        for (job_index, job) in stage.jobs.iter().enumerate() {
            let name = job_name(job, job_index);
            let connections = resolve(&stage.name, job)
                .with_context(|| format!("stage '{}' job '{}'", stage.name, name))?;
            if connections.is_empty() {
                bail!("stage '{}' job '{}' has no targets", stage.name, name);
            }
            let OrchestrationAction::TxWorkflow(action) = &job.action;
            for connection in connections {
                let workflow = template_resolver::load_workflow_preview(action, &connection)
                    .with_context(|| {
                        format!(
                            "stage '{}' job '{}' target '{}'",
                            stage.name,
                            name,
                            connection
                                .connection_name
                                .as_deref()
                                .unwrap_or(&connection.host)
                        )
                    })?;
                previews.push(RenderedOrchestrationWorkflow {
                    stage_index,
                    stage_name: stage.name.clone(),
                    job_index,
                    job_name: name.clone(),
                    connection_name: connection.connection_name,
                    host: connection.host,
                    workflow,
                });
            }
        }
    }
    Ok(previews)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::template::renderer::Renderer;
    use serde_json::json;

    fn connection(host: &str) -> EffectiveConnection {
        EffectiveConnection {
            connection_name: Some(host.into()),
            credential_id: None,
            host: host.into(),
            username: "admin".into(),
            auth: rneter::session::SshAuthMethod::password("preview-secret"),
            password: "preview-secret".into(),
            port: 22,
            connect_timeout_secs: None,
            enable_password: Some("enable-secret".into()),
            ssh_security: Default::default(),
            linux_shell_flavor: None,
            output_encoding: Default::default(),
            device_profile: "linux".into(),
            vars: json!({}),
            template_dir: None,
            force_autodetect: false,
            retry_policy: Default::default(),
        }
    }

    fn plan() -> OrchestrationPlan {
        let block = |command: &str| {
            json!({
                "name":"address-{{ loop.index }}", "rollback_policy":"per_step", "fail_fast":true,
                "steps":[{
                    "run":{"kind":"command", "mode":"Root,User", "command":command,
                        "interaction":{"prompts":[{"patterns":["Password:"],"response":"username\n{{ connection.password }}\nend"}]}},
                    "rollback":{"kind":"command", "mode":"Root,User", "command":"undo {{ ip }}\nverify {{ connection.host }}"}
                }]
            })
        };
        let source = json!({"name":"preview-plan", "stages":[{"name":"deploy", "strategy":"serial", "jobs":[{
            "name":"addresses", "strategy":"parallel", "targets":["device-a", "device-b"],
            "action":{"kind":"tx_workflow", "workflow":{"name":"addresses", "fail_fast":true, "blocks":[
                {"kind":"loop", "iterations":"vars.addresses", "item_variable":"ip", "blocks":[
                    {"kind":"choice", "branches":[{"condition":"connection.host == 'device-a'", "blocks":[block("echo {{ ip }}\necho {{ connection.host }}")]}],
                        "else":[block("echo alternate {{ ip }} {{ connection.host }}")]}
                ]}
            ]}}
        }]}]});
        Renderer::new()
            .render_orchestration_plan(
                &source,
                &json!({"vars":{"addresses":["192.0.2.1","192.0.2.2"]}}),
            )
            .unwrap()
    }

    #[test]
    fn preview_expands_each_target_with_matching_rollbacks_and_redacted_prompts() {
        let plan = plan();
        let previews = preview_with_connections(&plan, |_, _| {
            Ok(vec![connection("device-a"), connection("device-b")])
        })
        .unwrap();
        assert_eq!(previews.len(), 2);
        let first = serde_json::to_value(&previews[0]).unwrap();
        let second = serde_json::to_value(&previews[1]).unwrap();
        assert_eq!(first["stage_name"], "deploy");
        assert_eq!(first["job_name"], "addresses");
        assert_eq!(first["connection_name"], "device-a");
        assert_eq!(first["workflow"]["blocks"].as_array().unwrap().len(), 2);
        assert_eq!(
            first["workflow"]["blocks"][0]["steps"][0]["run"]["command"],
            "echo 192.0.2.1\necho device-a"
        );
        assert_eq!(
            first["workflow"]["blocks"][1]["steps"][0]["rollback"]["command"],
            "undo 192.0.2.2\nverify device-a"
        );
        assert_eq!(
            second["workflow"]["blocks"][0]["steps"][0]["run"]["command"],
            "echo alternate 192.0.2.1 device-b"
        );
        assert_eq!(
            second["workflow"]["blocks"][1]["steps"][0]["run"]["interaction"]["prompts"][0]["response"],
            "username\n***\nend"
        );
        assert!(
            !serde_json::to_string(&previews)
                .unwrap()
                .contains("preview-secret")
        );
        // The preview must not mutate the plan used by actual execution.
        let OrchestrationAction::TxWorkflow(action) = &plan.stages[0].jobs[0].action;
        assert!(
            crate::domain::execution::workflow_template::has_workflow_controls(
                action.workflow.as_ref().unwrap()
            )
        );
    }

    #[test]
    fn preview_reports_unresolved_targets_and_invalid_workflows_with_context() {
        let plan = plan();
        let error = preview_with_connections(&plan, |_, _| Ok(vec![])).unwrap_err();
        assert!(error.to_string().contains("addresses"));
        let error = preview_with_connections(&plan, |_, _| anyhow::bail!("credential unavailable"))
            .unwrap_err();
        assert!(format!("{error:#}").contains("deploy"));
        assert!(format!("{error:#}").contains("credential unavailable"));
        let mut invalid = plan;
        let OrchestrationAction::TxWorkflow(action) = &mut invalid.stages[0].jobs[0].action;
        action.workflow = Some(json!({"name":"invalid", "fail_fast":true, "blocks":[{
            "name":"invalid", "rollback_policy":"none", "fail_fast":true,
            "steps":[{"run":{"kind":"command", "mode":"User", "command":""}}]
        }]}));
        let error = preview_with_connections(&invalid, |_, _| Ok(vec![connection("device-a")]))
            .unwrap_err();
        assert!(format!("{error:#}").contains("target 'device-a'"));
    }
}
