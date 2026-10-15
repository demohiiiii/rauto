use serde_json::Value;
use std::cmp::Reverse;

fn is_sensitive_key_name(key: &str) -> bool {
    let normalized = key.trim().to_ascii_lowercase().replace('-', "_");
    normalized.contains("password")
        || normalized.contains("passwd")
        || normalized == "pass"
        || normalized.ends_with("_pass")
        || normalized.contains("secret")
        || normalized.contains("token")
        || normalized == "enable_password"
        || normalized.contains("private_key")
}

fn collect_sensitive_strings(value: &Value, parent_key: Option<&str>, out: &mut Vec<String>) {
    match value {
        Value::Object(map) => {
            for (key, item) in map {
                collect_sensitive_strings(item, Some(key), out);
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_sensitive_strings(item, parent_key, out);
            }
        }
        Value::String(text) => {
            if let Some(key) = parent_key
                && is_sensitive_key_name(key)
                && !text.trim().is_empty()
            {
                out.push(text.clone());
            }
        }
        _ => {}
    }
}

pub fn sanitize_rendered_output(rendered: &str, context: &Value) -> String {
    let mut secrets = Vec::new();
    collect_sensitive_strings(context, None, &mut secrets);
    if secrets.is_empty() {
        return rendered.to_string();
    }
    secrets.sort_by_key(|value| Reverse(value.len()));
    secrets.dedup();
    let mut masked = rendered.to_string();
    for secret in secrets {
        if secret.trim().is_empty() {
            continue;
        }
        masked = masked.replace(&secret, "******");
    }
    masked
}

pub fn redact_preview_json(value: &mut Value, context: &Value) {
    let mut secrets = Vec::new();
    collect_sensitive_strings(context, None, &mut secrets);
    collect_sensitive_strings(value, None, &mut secrets);
    redact_preview_json_with_secrets(value, &secrets, "******");
}

pub(crate) fn redact_preview_json_with_secrets(value: &mut Value, secrets: &[String], mask: &str) {
    let mut secrets = secrets
        .iter()
        .filter(|secret| !secret.is_empty())
        .collect::<Vec<_>>();
    secrets.sort_by_key(|secret| Reverse(secret.len()));
    secrets.dedup();
    redact_preview_strings(value, &secrets, mask, false);
}

fn is_preview_structure_field(key: &str, value: &Value) -> bool {
    matches!(
        (key, value.as_str()),
        (
            "kind",
            Some("command" | "flow" | "tx_workflow" | "loop" | "choice")
        ) | ("rollback_policy", Some("none" | "per_step"))
            | ("multiline_mode", Some("split_lines" | "whole"))
            | ("strategy", Some("serial" | "parallel"))
            | ("mode", Some(_))
    )
}

fn redact_preview_strings(
    value: &mut Value,
    secrets: &[&String],
    mask: &str,
    parameter_data: bool,
) {
    match value {
        Value::String(text) => {
            for secret in secrets {
                *text = text.replace(secret.as_str(), mask);
            }
        }
        Value::Array(values) => values
            .iter_mut()
            .for_each(|value| redact_preview_strings(value, secrets, mask, parameter_data)),
        Value::Object(values) => {
            for (key, value) in values {
                // Parameter maps may use the same keys as protocol selectors.
                // Preserve selectors only in the surrounding preview structure.
                let parameter_data = parameter_data
                    || matches!(
                        key.as_str(),
                        "vars" | "workflow_vars" | "tx_block_template_vars" | "dyn_params"
                    );
                if !parameter_data && is_preview_structure_field(key, value) {
                    continue;
                }
                redact_preview_strings(value, secrets, mask, parameter_data);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn preview_preserves_structure_when_secrets_match_type_and_mode_values() {
        let context = json!({"vars":{"api_token":[
            "command", "flow", "none", "per_step", "whole", "split_lines",
            "tx_workflow", "serial", "parallel", "User"
        ]}});
        let mut value = json!({"name":"plan", "stages":[{
            "name":"stage", "strategy":"serial", "jobs":[{
                "strategy":"parallel", "action":{"kind":"tx_workflow", "workflow_vars":{
                    "kind":"command", "mode":"User", "strategy":"serial"
                }, "workflow":{"name":"workflow", "fail_fast":true, "blocks":[{
                    "name":"block", "fail_fast":true, "rollback_policy":"per_step", "steps":[{
                        "run":{"kind":"command", "mode":"User", "multiline_mode":"whole",
                            "command":"echo command User", "dyn_params":{"kind":"command", "mode":"User"},
                            "interaction":{"prompts":[{"patterns":["User"],"response":"command"}]}},
                        "rollback":{"kind":"flow", "steps":[{
                            "mode":"User", "multiline_mode":"split_lines", "command":"undo command"
                        }]}
                    }]
                }, {"name":"other", "rollback_policy":"none", "steps":[]}]}}
            }]
        }]});
        redact_preview_json(&mut value, &context);
        let job = &value["stages"][0]["jobs"][0];
        assert_eq!(value["stages"][0]["strategy"], "serial");
        assert_eq!(job["strategy"], "parallel");
        assert_eq!(job["action"]["kind"], "tx_workflow");
        assert_eq!(job["action"]["workflow_vars"]["kind"], "******");
        assert_eq!(job["action"]["workflow_vars"]["mode"], "******");
        assert_eq!(job["action"]["workflow_vars"]["strategy"], "******");
        let blocks = &job["action"]["workflow"]["blocks"];
        assert_eq!(blocks[0]["rollback_policy"], "per_step");
        assert_eq!(blocks[1]["rollback_policy"], "none");
        let run = &blocks[0]["steps"][0]["run"];
        assert_eq!(run["kind"], "command");
        assert_eq!(run["mode"], "User");
        assert_eq!(run["multiline_mode"], "whole");
        assert_eq!(run["command"], "echo ****** ******");
        assert_eq!(run["dyn_params"]["kind"], "******");
        assert_eq!(run["dyn_params"]["mode"], "******");
        assert_eq!(run["interaction"]["prompts"][0]["patterns"][0], "******");
        assert_eq!(run["interaction"]["prompts"][0]["response"], "******");
        let rollback = &blocks[0]["steps"][0]["rollback"];
        assert_eq!(rollback["kind"], "flow");
        assert_eq!(rollback["steps"][0]["mode"], "User");
        assert_eq!(rollback["steps"][0]["multiline_mode"], "split_lines");
        assert_eq!(rollback["steps"][0]["command"], "undo ******");
    }

    #[test]
    fn previews_mask_context_secrets_without_changing_json_shape() {
        let context = json!({"vars":{"token":"long-secret", "password":"secret", "addresses":["192.0.2.1"]}, "connections":{"peer":{"private_key":"key\nbody"}}});
        let mut value = json!({"blocks":[{"command":"echo long-secret secret key\nbody embedded-key", "prompts":["secret\n"], "dyn_params":{"enable_password":"embedded-key"}}], "count":2, "enabled":true});
        redact_preview_json(&mut value, &context);
        assert_eq!(
            value["blocks"][0]["command"],
            "echo ****** ****** ****** ******"
        );
        assert_eq!(
            value["blocks"][0]["dyn_params"]["enable_password"],
            "******"
        );
        assert_eq!(value["blocks"][0]["prompts"][0], "******\n");
        assert_eq!(value["count"], 2);
        assert_eq!(value["enabled"], true);
    }
}
