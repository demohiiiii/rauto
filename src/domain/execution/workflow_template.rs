use crate::domain::template::renderer::Renderer;
use anyhow::{Context, Result, anyhow, ensure};
use serde::Deserialize;
use serde_json::{Value, json};

const MAX_DEPTH: usize = 16;
const MAX_EXPANSIONS: usize = 1_000;

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum WorkflowControl {
    Loop {
        #[serde(default)]
        name: String,
        iterations: String,
        #[serde(default = "default_item")]
        item_variable: String,
        #[serde(alias = "steps")]
        blocks: Vec<Value>,
    },
    Choice(WorkflowChoice),
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WorkflowChoice {
    #[serde(default)]
    name: String,
    branches: Option<Vec<WorkflowChoiceBranch>>,
    condition: Option<String>,
    then: Option<Vec<Value>>,
    #[serde(default, rename = "else")]
    otherwise: Vec<Value>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WorkflowChoiceBranch {
    condition: String,
    #[serde(alias = "steps")]
    blocks: Vec<Value>,
}

enum ChoiceSelection {
    Branch { index: usize, blocks: Vec<Value> },
    LegacyThen(Vec<Value>),
    LegacyElse(Vec<Value>),
}

impl WorkflowChoice {
    fn select(
        self,
        context: &Value,
        renderer: &Renderer<'_>,
        expansions: &mut usize,
    ) -> Result<ChoiceSelection> {
        let WorkflowChoice {
            name,
            branches,
            condition,
            then,
            otherwise,
        } = self;
        let legacy = branches.is_none();
        let branches = match (branches, condition, then) {
            (Some(branches), None, None) => branches,
            (None, Some(condition), Some(blocks)) => {
                vec![WorkflowChoiceBranch { condition, blocks }]
            }
            _ => {
                return Err(anyhow!(
                    "choice requires branches; do not combine branches with condition/then"
                ));
            }
        };
        ensure!(
            !branches.is_empty(),
            "choice requires at least one condition branch"
        );
        ensure!(
            branches.len() <= MAX_EXPANSIONS,
            "choice exceeds {MAX_EXPANSIONS} branches"
        );
        ensure!(
            branches
                .iter()
                .all(|branch| !branch.condition.trim().is_empty()),
            "choice conditions cannot be empty"
        );
        for (index, branch) in branches.into_iter().enumerate() {
            *expansions += 1;
            ensure!(
                *expansions <= MAX_EXPANSIONS,
                "workflow expansion exceeds {MAX_EXPANSIONS} nodes"
            );
            let value = renderer
                .evaluate_expression(&branch.condition, context, MAX_EXPANSIONS)
                .map_err(|error| {
                    expression_error(
                        renderer,
                        &branch.condition,
                        context,
                        format!(
                            "invalid choice expression in '{}' at branches[{index}]",
                            name
                        ),
                        error,
                    )
                })?;
            match value {
                Value::Bool(true) => {
                    return Ok(if legacy {
                        ChoiceSelection::LegacyThen(branch.blocks)
                    } else {
                        ChoiceSelection::Branch {
                            index,
                            blocks: branch.blocks,
                        }
                    });
                }
                Value::Bool(false) => {}
                _ => {
                    return Err(anyhow!(
                        "choice condition at branches[{index}] must return a boolean"
                    ));
                }
            }
        }
        Ok(ChoiceSelection::LegacyElse(otherwise))
    }
}

fn default_item() -> String {
    "item".into()
}

pub fn has_workflow_controls(value: &Value) -> bool {
    match value {
        Value::Object(map) => {
            ["blocks", "steps"].iter().any(|key| {
                map.get(*key)
                    .and_then(Value::as_array)
                    .is_some_and(|blocks| {
                        blocks.iter().any(|block| {
                            matches!(
                                block.get("kind").and_then(Value::as_str),
                                Some("loop" | "choice")
                            )
                        })
                    })
            }) || map.values().any(has_workflow_controls)
        }
        Value::Array(items) => items.iter().any(has_workflow_controls),
        _ => false,
    }
}

pub fn render_json_template_value(
    input: &Value,
    context: &Value,
    renderer: &Renderer<'_>,
) -> Result<Value> {
    render_value(input, context, renderer, "$", 0, &mut 0)
}

fn expression_error(
    renderer: &Renderer<'_>,
    expression: &str,
    context: &Value,
    prefix: String,
    error: anyhow::Error,
) -> anyhow::Error {
    match renderer.missing_expression_variables(expression, context) {
        Ok(missing) if !missing.is_empty() => anyhow!(
            "{prefix}: missing variable(s) {}; provide them in runtime variables",
            missing.join(", ")
        ),
        _ => anyhow!("{prefix}: {error}"),
    }
}

fn render_value(
    input: &Value,
    context: &Value,
    renderer: &Renderer<'_>,
    path: &str,
    depth: usize,
    expansions: &mut usize,
) -> Result<Value> {
    match input {
        Value::Object(map) => {
            let mut out = serde_json::Map::with_capacity(map.len());
            let mut step_ranges = None;
            for (key, value) in map {
                let rendered = if key == "tx_block_template_content" && value.is_string() {
                    // A referenced block owns its local variables and is rendered by its resolver.
                    value.clone()
                } else if matches!(key.as_str(), "blocks" | "steps")
                    && value.as_array().is_some_and(|blocks| {
                        blocks.iter().any(|block| {
                            matches!(
                                block.get("kind").and_then(Value::as_str),
                                Some("loop" | "choice")
                            )
                        })
                    })
                {
                    let rendered = render_nodes(
                        value.as_array().expect("checked array"),
                        key,
                        context,
                        renderer,
                        &format!("{path}.{key}"),
                        depth,
                        expansions,
                    )?;
                    if key == "steps" {
                        ensure!(
                            !rendered.values.is_empty(),
                            "transaction block has no commands after expanding its controls"
                        );
                        step_ranges = Some(rendered.source_ranges);
                    }
                    Value::Array(rendered.values)
                } else {
                    render_value(
                        value,
                        context,
                        renderer,
                        &format!("{path}.{key}"),
                        depth,
                        expansions,
                    )?
                };
                out.insert(key.clone(), rendered);
            }
            if let Some(ranges) = step_ranges
                && let Some(whole) = out
                    .get_mut("rollback_policy")
                    .and_then(|policy| policy.get_mut("whole_resource"))
            {
                let index = whole
                    .get("trigger_step_index")
                    .map_or(Some(0), Value::as_u64)
                    .and_then(|index| usize::try_from(index).ok())
                    .ok_or_else(|| {
                        anyhow!("whole-resource rollback trigger must be a nonnegative step index")
                    })?;
                let range = ranges.get(index).ok_or_else(|| {
                    anyhow!("whole-resource rollback trigger is outside the source steps")
                })?;
                ensure!(
                    range.start < range.end,
                    "whole-resource rollback trigger targets a control that produced no commands"
                );
                // The source slot is armed only once its final expanded command succeeds.
                whole["trigger_step_index"] = json!(range.end - 1);
            }
            Ok(Value::Object(out))
        }
        Value::Array(items) => items
            .iter()
            .enumerate()
            .map(|(index, value)| {
                render_value(
                    value,
                    context,
                    renderer,
                    &format!("{path}[{index}]"),
                    depth,
                    expansions,
                )
            })
            .collect(),
        Value::String(text) if text.contains("{{") || text.contains("{%") => {
            let rendered = renderer.render_string(text, context.clone()).map_err(|error| {
                let missing = renderer
                    .missing_variables(text, context)
                    .unwrap_or_default();
                let detail = if missing.is_empty() {
                    format!("template rendering failed at {path}: {error}")
                } else {
                    format!(
                        "missing template variable(s) at {path}: {}; provide them in runtime variables",
                        missing.join(", ")
                    )
                };
                anyhow!(detail)
            })?;
            Ok(serde_json::from_str(rendered.trim()).unwrap_or(Value::String(rendered)))
        }
        _ => Ok(input.clone()),
    }
}

struct ExpandedNodes {
    values: Vec<Value>,
    source_ranges: Vec<std::ops::Range<usize>>,
}

fn render_nodes(
    blocks: &[Value],
    collection: &str,
    context: &Value,
    renderer: &Renderer<'_>,
    path: &str,
    depth: usize,
    expansions: &mut usize,
) -> Result<ExpandedNodes> {
    ensure!(
        depth <= MAX_DEPTH,
        "workflow control nesting exceeds {MAX_DEPTH}"
    );
    let mut out = Vec::new();
    let mut source_ranges = Vec::with_capacity(blocks.len());
    for (index, block) in blocks.iter().enumerate() {
        let start = out.len();
        *expansions += 1;
        ensure!(
            *expansions <= MAX_EXPANSIONS,
            "workflow expansion exceeds {MAX_EXPANSIONS} nodes"
        );
        match block.get("kind").and_then(Value::as_str) {
            Some("loop" | "choice") => {
                let control: WorkflowControl =
                    serde_json::from_value(block.clone()).with_context(|| {
                        format!("invalid workflow control at {collection}[{index}]")
                    })?;
                match control {
                    WorkflowControl::Loop {
                        name,
                        iterations,
                        item_variable,
                        blocks,
                    } => {
                        validate_item_variable(&item_variable).with_context(|| {
                            format!("invalid loop item variable at {path}[{index}]")
                        })?;
                        let expression_prefix = format!(
                            "invalid loop expression at {path}[{index}]{}",
                            if name.is_empty() {
                                String::new()
                            } else {
                                format!(" ('{name}')")
                            }
                        );
                        let value = renderer
                            .evaluate_expression(&iterations, context, MAX_EXPANSIONS)
                            .map_err(|error| {
                                expression_error(
                                    renderer,
                                    &iterations,
                                    context,
                                    expression_prefix,
                                    error,
                                )
                            })?;
                        let items = match value {
                            Value::Array(items) => items,
                            Value::Number(number) => {
                                let count = number.as_u64().ok_or_else(|| {
                                    anyhow!("loop count must be a nonnegative integer")
                                })?;
                                ensure!(
                                    count <= MAX_EXPANSIONS as u64,
                                    "loop count exceeds {MAX_EXPANSIONS}"
                                );
                                (0..count).map(|index| json!(index)).collect()
                            }
                            _ => {
                                return Err(anyhow!(
                                    "invalid loop value at {path}[{index}]: expected a list or a nonnegative integer for '{iterations}'"
                                ));
                            }
                        };
                        ensure!(
                            items.len() <= MAX_EXPANSIONS,
                            "loop list exceeds {MAX_EXPANSIONS} items"
                        );
                        let length = items.len();
                        let child_collection = child_collection_key(block, "blocks");
                        let child_path = format!("{path}[{index}].{child_collection}");
                        for (index, item) in items.into_iter().enumerate() {
                            *expansions += 1;
                            ensure!(
                                *expansions <= MAX_EXPANSIONS,
                                "workflow expansion exceeds {MAX_EXPANSIONS} nodes"
                            );
                            let mut local = context.clone();
                            let root = local
                                .as_object_mut()
                                .ok_or_else(|| anyhow!("workflow context must be an object"))?;
                            root.insert(item_variable.clone(), item.clone());
                            let vars = root.entry("vars").or_insert_with(|| json!({}));
                            if vars.is_null() {
                                *vars = json!({});
                            }
                            vars.as_object_mut()
                                .ok_or_else(|| anyhow!("workflow vars must be an object"))?
                                .insert(item_variable.clone(), item);
                            root.insert("loop".into(), json!({"index": index + 1, "index0": index, "first": index == 0, "last": index + 1 == length, "length": length}));
                            out.extend(
                                render_nodes(
                                    &blocks,
                                    collection,
                                    &local,
                                    renderer,
                                    &child_path,
                                    depth + 1,
                                    expansions,
                                )
                                .with_context(|| {
                                    format!(
                                        "failed to render loop at {path}[{index}], iteration {}/{}",
                                        index + 1,
                                        length
                                    )
                                })?
                                .values,
                            );
                        }
                    }
                    WorkflowControl::Choice(choice) => {
                        let selected = choice
                            .select(context, renderer, expansions)
                            .with_context(|| format!("invalid choice at {path}[{index}]"))?;
                        let (selected, child_path) = match selected {
                            ChoiceSelection::Branch {
                                index: branch_index,
                                blocks,
                            } => {
                                let branch = block
                                    .get("branches")
                                    .and_then(Value::as_array)
                                    .and_then(|branches| branches.get(branch_index))
                                    .ok_or_else(|| {
                                        anyhow!(
                                            "choice branch {branch_index} is missing at {path}[{index}]"
                                        )
                                    })?;
                                let child_collection = child_collection_key(branch, "blocks");
                                (
                                    blocks,
                                    format!(
                                        "{path}[{index}].branches[{branch_index}].{child_collection}"
                                    ),
                                )
                            }
                            ChoiceSelection::LegacyThen(blocks) => {
                                (blocks, format!("{path}[{index}].then"))
                            }
                            ChoiceSelection::LegacyElse(blocks) => {
                                (blocks, format!("{path}[{index}].else"))
                            }
                        };
                        out.extend(
                            render_nodes(
                                &selected,
                                collection,
                                context,
                                renderer,
                                &child_path,
                                depth + 1,
                                expansions,
                            )?
                            .values,
                        );
                    }
                }
            }
            _ => out.push(
                render_value(
                    block,
                    context,
                    renderer,
                    &format!("{path}[{index}]"),
                    depth,
                    expansions,
                )
                .with_context(|| format!("failed to render workflow node at {path}[{index}]"))?,
            ),
        }
        source_ranges.push(start..out.len());
    }
    Ok(ExpandedNodes {
        values: out,
        source_ranges,
    })
}

fn child_collection_key(value: &Value, fallback: &'static str) -> &'static str {
    if value.get("blocks").and_then(Value::as_array).is_some() {
        "blocks"
    } else if value.get("steps").and_then(Value::as_array).is_some() {
        "steps"
    } else {
        fallback
    }
}

fn validate_item_variable(name: &str) -> Result<()> {
    let mut chars = name.chars();
    ensure!(
        chars
            .next()
            .is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
            && chars.all(|c| c.is_ascii_alphanumeric() || c == '_'),
        "invalid loop item variable"
    );
    ensure!(
        !matches!(
            name,
            "vars"
                | "loop"
                | "connection"
                | "connections"
                | "now"
                | "defaults"
                | "true"
                | "false"
                | "none"
                | "True"
                | "False"
                | "None"
                | "self"
                | "super"
                | "if"
                | "else"
                | "for"
                | "in"
                | "not"
                | "and"
                | "or"
                | "is"
        ),
        "loop item variable is reserved"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn block_controls_keep_one_transaction_and_scope_run_and_rollback_together() {
        let source = json!({"name":"configure", "fail_fast":true, "rollback_policy":"per_step", "steps":[
            {"kind":"loop", "iterations":"vars.ports", "item_variable":"port", "steps":[
                {"kind":"choice", "branches":[
                    {"condition":"port.enabled", "steps":[{"run":{"kind":"command", "mode":"User", "command":"enable {{ port.name }}-{{ loop.index }}"}, "rollback":{"kind":"command", "mode":"User", "command":"disable {{ vars.port.name }}"}}]},
                    {"condition":"true", "steps":[{"run":{"kind":"command", "mode":"User", "command":"skip {{ port.name }}"}}]}
                ], "else":[{"run":{"command":"{{ missing }}"}}]}
            ]},
            {"run":{"kind":"command", "mode":"User", "command":"outside {{ vars.port }}"}},
            {"kind":"loop", "iterations":"0", "steps":[{"run":{"command":"{{ missing }}"}}]}
        ]});
        assert!(has_workflow_controls(&source));
        let result = render_json_template_value(&source, &json!({"vars":{"ports":[{"name":"a", "enabled":true},{"name":"b", "enabled":false}],"port":"original"}}), &Renderer::new()).unwrap();
        assert_eq!(result["steps"].as_array().unwrap().len(), 3);
        assert_eq!(result["steps"][0]["run"]["command"], "enable a-1");
        assert_eq!(result["steps"][0]["rollback"]["command"], "disable a");
        assert_eq!(result["steps"][1]["run"]["command"], "skip b");
        assert_eq!(result["steps"][2]["run"]["command"], "outside original");
        let block: rneter::session::TxBlock = serde_json::from_value(result).unwrap();
        block.validate().unwrap();
    }

    #[test]
    fn diagnostics_identify_missing_variables_and_source_paths() {
        let error = render(
            json!([{"run":{"command":"configure {{ vars.interface.name }}"}}]),
            json!({}),
        )
        .unwrap_err()
        .to_string();
        assert!(error.contains("missing template variable(s)"));
        assert!(error.contains("vars.interface.name"));
        assert!(error.contains("$.blocks[0].run.command"));
        assert!(error.contains("runtime variables"));
    }

    #[test]
    fn diagnostics_identify_missing_loop_variables_and_iteration() {
        let error = format!(
            "{:#}",
            render(
                json!([{"kind":"loop","iterations":"vars.ports","blocks":[
                    {"run":{"command":"{{ missing }}"}}
                ]}]),
                json!({"ports":["edge-1"]}),
            )
            .unwrap_err()
        );
        assert!(error.contains("missing template variable(s)"), "{error}");
        assert!(error.contains("iteration 1/1"), "{error}");
        assert!(
            error.contains("$.blocks[0].blocks[0].run.command"),
            "{error}"
        );
    }

    #[test]
    fn diagnostics_identify_selected_choice_branch_paths() {
        let error = format!(
            "{:#}",
            render(
                json!([{"kind":"choice","branches":[
                    {"condition":"true","steps":[{"run":{"command":"{{ missing }}"}}]},
                    {"condition":"false","steps":[]}
                ]}]),
                json!({}),
            )
            .unwrap_err()
        );
        assert!(
            error.contains("$.blocks[0].branches[0].steps[0].run.command"),
            "{error}"
        );
    }

    #[test]
    fn whole_resource_trigger_tracks_source_slots_after_expansion() {
        for (source_index, expected) in [(0, 0), (1, 2), (2, 3)] {
            let source = json!({"steps":[
                {"run":{"command":"before"}},
                {"kind":"loop", "iterations":"2", "steps":[{"run":{"command":"{{ item }}"}}]},
                {"run":{"command":"after"}}
            ],"rollback_policy":{"whole_resource":{"rollback":{"command":"undo"},"trigger_step_index":source_index}}});
            let result = render_json_template_value(&source, &json!({}), &Renderer::new()).unwrap();
            assert_eq!(
                result["rollback_policy"]["whole_resource"]["trigger_step_index"],
                expected
            );
        }
        let skipped = json!({"steps":[
            {"kind":"loop", "iterations":"0", "steps":[]},
            {"run":{"command":"after"}}
        ],"rollback_policy":{"whole_resource":{"rollback":{"command":"undo"},"trigger_step_index":0}}});
        assert!(
            render_json_template_value(&skipped, &json!({}), &Renderer::new())
                .unwrap_err()
                .to_string()
                .contains("produced no commands")
        );
    }

    #[test]
    fn block_controls_share_workflow_limits_and_reject_an_empty_expanded_block() {
        for source in [
            json!({"steps":[{"kind":"loop", "iterations":"0", "steps":[]}]}),
            json!({"steps":[{"kind":"choice", "branches":[{"condition":"false", "steps":[]}]}]}),
            json!({"blocks":[{"kind":"loop", "iterations":"40", "blocks":[{"steps":[{"kind":"loop", "iterations":"40", "steps":[{"run":{"command":"echo"}}]}]}]}]}),
        ] {
            assert!(render_json_template_value(&source, &json!({}), &Renderer::new()).is_err());
        }
    }

    fn render(blocks: Value, vars: Value) -> Result<Value> {
        render_json_template_value(
            &json!({"name":"test", "fail_fast":true,"blocks":blocks}),
            &json!({"vars":vars}),
            &Renderer::new(),
        )
    }

    #[test]
    fn loops_render_items_and_branches_without_evaluating_unused_values() {
        let blocks = json!([{"kind":"loop","iterations":"vars.ports","item_variable":"port","blocks":[
            {"kind":"choice","condition":"port.enabled","then":[{"name":"{{ port.name }}-{{ loop.index }}", "command":"{{ vars.port.name }}"}],"else":[{"name":"disabled"}]}
        ]}, {"kind":"choice","condition":"true","then":[{"name":"end"}],"else":[{"name":"{{ missing }}"}]}]);
        let value = render(
            blocks,
            json!({"ports":[{"name":"eth0","enabled":true},{"name":"eth1","enabled":false}]}),
        )
        .unwrap();
        assert_eq!(
            value["blocks"],
            json!([{"name":"eth0-1","command":"eth0"},{"name":"disabled"},{"name":"end"}])
        );
    }

    #[test]
    fn counted_loops_keep_scope_and_empty_paths() {
        let value = render(
            json!([
                {"kind":"loop","iterations":"2","blocks":[{"name":"{{ item }}"}]},
                {"name":"{{ vars.item }}"},
                {"kind":"loop","iterations":"0","blocks":[{"name":"{{ missing }}"}]},
                {"kind":"choice","condition":"false","then":[]}
            ]),
            json!({"item":"outside"}),
        )
        .unwrap();
        assert_eq!(
            value["blocks"],
            json!([{"name":0},{"name":1},{"name":"outside"}])
        );
    }

    #[test]
    fn nested_loops_restore_parent_items_and_loop_metadata() {
        let value = render(json!([{"kind":"loop","iterations":"2","blocks":[
            {"name":"before-{{ item }}-{{ loop.index }}"},
            {"kind":"loop","iterations":"2","blocks":[{"name":"inner-{{ item }}-{{ loop.index }}"}]},
            {"name":"after-{{ item }}-{{ loop.index }}"}
        ]}]), json!({})).unwrap();
        let names = value["blocks"]
            .as_array()
            .unwrap()
            .iter()
            .map(|block| block["name"].as_str().unwrap())
            .collect::<Vec<_>>();
        assert_eq!(
            names,
            [
                "before-0-1",
                "inner-0-1",
                "inner-1-2",
                "after-0-1",
                "before-1-2",
                "inner-0-1",
                "inner-1-2",
                "after-1-2"
            ]
        );
    }

    #[test]
    fn choices_use_the_first_matching_condition_and_skip_unused_expressions() {
        let blocks = json!([{"kind":"choice","branches":[
            {"condition":"vars.role == 'edge'", "blocks":[{"name":"edge"}]},
            {"condition":"vars.enabled", "blocks":[{"name":"enabled"}]},
            {"condition":"missing.condition", "blocks":[{"name":"{{ missing }}"}]}
        ],"else":[{"name":"{{ missing }}"}]}]);
        for (vars, expected) in [
            (json!({"role":"edge","enabled":true}), "edge"),
            (json!({"role":"core","enabled":true}), "enabled"),
        ] {
            assert_eq!(
                render(blocks.clone(), vars).unwrap()["blocks"],
                json!([{"name":expected}])
            );
        }
        assert!(render(blocks, json!({"role":"core","enabled":false})).is_err());
    }

    #[test]
    fn choices_default_and_nest_in_loop_scope() {
        let value = render(json!([{"kind":"loop","iterations":"3","blocks":[
            {"kind":"choice","branches":[
                {"condition":"item == 0", "blocks":[{"name":"first-{{ loop.index }}"}]},
                {"condition":"item == 1", "blocks":[{"kind":"loop","iterations":"2","blocks":[{"name":"nested-{{ item }}"}]}]}
            ],"else":[{"name":"default-{{ item }}"}]}
        ]}]), json!({})).unwrap();
        assert_eq!(
            value["blocks"],
            json!([{"name":"first-1"},{"name":"nested-0"},{"name":"nested-1"},{"name":"default-2"}])
        );
        assert_eq!(
            render(
                json!([{"kind":"choice","branches":[{"condition":"false","blocks":[]}]}]),
                json!({})
            )
            .unwrap()["blocks"],
            json!([])
        );
        // A matching empty branch must not fall through to a later branch or the default.
        assert_eq!(render(json!([{"kind":"choice","branches":[{"condition":"true","blocks":[]},{"condition":"missing","blocks":[]}],"else":[{"name":"unexpected"}]}]), json!({})).unwrap()["blocks"], json!([]));
    }

    #[test]
    fn rejects_invalid_multi_condition_choices() {
        for blocks in [
            json!([{"kind":"choice","branches":[]}]),
            json!([{"kind":"choice","branches":[{"condition":" ","blocks":[]}]}]),
            json!([{"kind":"choice","branches":[{"condition":"1","blocks":[]}]}]),
            json!([{"kind":"choice","branches":[{"condition":"true","blocks":[],"typo":true}]}]),
            json!([{"kind":"choice","branches":[{"condition":"true"}]}]),
            json!([{"kind":"choice","branches":[{"condition":"true","blocks":[]}],"condition":"true","then":[]}]),
            json!([{"kind":"choice","branches":vec![json!({"condition":"false","blocks":[]}); MAX_EXPANSIONS + 1]}]),
        ] {
            assert!(render(blocks, json!({})).is_err());
        }
    }

    #[test]
    fn rejects_invalid_controls_and_bounds_work() {
        for blocks in [
            json!([{"kind":"loop","iterations":"-1","blocks":[]}]),
            json!([{"kind":"loop","iterations":"1001","blocks":[]}]),
            json!([{"kind":"loop","iterations":"range(1001)","blocks":[]}]),
            json!([{"kind":"loop","iterations":"1.5","blocks":[]}]),
            json!([{"kind":"loop","iterations":"2","item_variable":"vars","blocks":[]}]),
            json!([{"kind":"loop","iterations":"missing","blocks":[]}]),
            json!([{"kind":"choice","condition":"'false'","then":[]}]),
            json!([{"kind":"choice","condition":"true","then":[],"typo":true}]),
            json!([{"kind":"loop","iterations":"40","blocks":[{"kind":"loop","iterations":"40","blocks":[{"name":"test"}]}]}]),
        ] {
            assert!(render(blocks, json!({})).is_err());
        }
        let mut nested = json!({"name":"leaf"});
        for _ in 0..18 {
            nested = json!({"kind":"choice","condition":"true","then":[nested]});
        }
        assert!(render(json!([nested]), json!({})).is_err());
    }
}
