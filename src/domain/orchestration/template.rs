use super::{OrchestrationAction, OrchestrationPlan};
use crate::domain::execution::workflow_template::{
    has_workflow_controls, render_json_template_value,
};
use crate::domain::template::renderer::Renderer;
use anyhow::Result;
use serde_json::Value;

#[derive(Debug, Clone)]
pub(crate) struct InlineWorkflowTemplateContext {
    pub vars: Value,
    pub now: Option<Value>,
    pub defaults: Option<Value>,
}

pub fn render_plan_template(
    source: &Value,
    context: &Value,
    renderer: &Renderer<'_>,
) -> Result<OrchestrationPlan> {
    let rendered = render_plan_value(source, context, renderer)?;
    let mut plan: OrchestrationPlan = serde_json::from_value(rendered)?;
    for stage in &mut plan.stages {
        for job in &mut stage.jobs {
            let OrchestrationAction::TxWorkflow(action) = &mut job.action;
            if action.workflow.as_ref().is_some_and(has_workflow_controls) {
                // Keep only plan namespaces; connection aliases must come from each target.
                action.inline_template_context = Some(InlineWorkflowTemplateContext {
                    vars: context.get("vars").cloned().unwrap_or(Value::Null),
                    now: context.get("now").cloned(),
                    defaults: context.get("defaults").cloned(),
                });
            }
        }
    }
    Ok(plan)
}

fn render_plan_value(source: &Value, context: &Value, renderer: &Renderer<'_>) -> Result<Value> {
    match source {
        Value::Object(map) => {
            let mut rendered = serde_json::Map::with_capacity(map.len());
            for (key, value) in map {
                if key != "workflow" {
                    rendered.insert(
                        key.clone(),
                        if key == "tx_block_template_content" && value.is_string() {
                            value.clone()
                        } else {
                            render_plan_value(value, context, renderer)?
                        },
                    );
                }
            }
            if let Some(workflow) = map.get("workflow") {
                let defer = rendered.get("kind").and_then(Value::as_str) == Some("tx_workflow")
                    && has_workflow_controls(workflow);
                rendered.insert(
                    "workflow".into(),
                    if defer {
                        workflow.clone()
                    } else {
                        render_plan_value(workflow, context, renderer)?
                    },
                );
            }
            Ok(Value::Object(rendered))
        }
        Value::Array(items) => items
            .iter()
            .map(|value| render_plan_value(value, context, renderer))
            .collect(),
        _ => render_json_template_value(source, context, renderer),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn plan_rendering_preserves_inline_controls_and_their_local_variables() {
        let workflow = json!({"name":"workflow", "blocks":[
            {"kind":"loop", "iterations":"vars.commands", "blocks":[
                {"name":"iteration-{{ loop.index }}", "steps":[{"run":{"kind":"command", "command":"{{ item }} on {{ connection.host }}"}}]}
            ]},
            {"kind":"choice", "branches":[
                {"condition":"connection.host == 'target-a'", "blocks":[]}
            ], "else":[]}
        ]});
        let source = json!({"name":"{{ vars.name }}", "stages":[{
            "name":"stage", "strategy":"serial", "jobs":[{
                "strategy":"parallel", "targets":"{{ vars.targets }}",
                "action":{"kind":"{{ vars.action_kind }}", "workflow":workflow}
            }]
        }]});
        for connection in [None, Some(json!({"host":"unrelated"}))] {
            let mut context = json!({"vars":{
                "name":"rendered-plan", "action_kind":"tx_workflow", "targets":["target-a","target-b"], "commands":["show clock"]
            }});
            if let Some(connection) = connection {
                context["connection"] = connection;
            }
            let plan = render_plan_template(&source, &context, &Renderer::new()).unwrap();
            super::super::validate_plan(&plan).unwrap();
            assert_eq!(plan.name, "rendered-plan");
            let job = &plan.stages[0].jobs[0];
            assert_eq!(job.targets, ["target-a", "target-b"]);
            let OrchestrationAction::TxWorkflow(action) = &job.action;
            assert_eq!(action.workflow.as_ref().unwrap(), &workflow);
            let deferred = action.inline_template_context.as_ref().unwrap();
            assert_eq!(deferred.vars, context["vars"]);
            let serialized = serde_json::to_value(action).unwrap();
            assert!(serialized.get("inline_template_context").is_none());
            assert_eq!(serialized["workflow"], workflow);
        }
    }

    #[test]
    fn ordinary_inline_workflows_keep_plan_level_rendering() {
        let plan = render_plan_template(
            &json!({"name":"plan", "stages":[{"name":"stage", "strategy":"serial", "jobs":[{
                "strategy":"serial", "targets":["device"], "action":{"kind":"tx_workflow", "workflow":{
                    "name":"workflow", "blocks":[{"name":"block", "steps":[{"run":{"kind":"command", "command":"{{ vars.command }}"}}]}]
                }}
            }]}]}),
            &json!({"vars":{"command":"show version"}}),
            &Renderer::new(),
        ).unwrap();
        let OrchestrationAction::TxWorkflow(action) = &plan.stages[0].jobs[0].action;
        assert!(action.inline_template_context.is_none());
        assert_eq!(
            action.workflow.as_ref().unwrap()["blocks"][0]["steps"][0]["run"]["command"],
            "show version"
        );
    }
}
