use crate::config::connection_store::{self, SavedConnection};
use anyhow::Result;
use serde_json::{Value, json};
use std::collections::BTreeSet;

const RESERVED_ROOTS: &[&str] = &[
    "vars",
    "connection",
    "now",
    "defaults",
    "loop",
    "self",
    "super",
    "true",
    "false",
    "none",
];

pub fn enrich_context_with_connection_refs_from_template(
    context: &mut Value,
    template_text: &str,
) -> Result<()> {
    let roots = extract_connection_roots_from_template(template_text);
    enrich_context_with_connection_roots(context, &roots)
}

pub fn enrich_context_with_connection_refs_from_value(
    context: &mut Value,
    template_value: &Value,
) -> Result<()> {
    let mut roots = BTreeSet::new();
    collect_connection_roots_from_value(template_value, &mut roots);
    enrich_context_with_connection_roots(context, &roots)
}

fn enrich_context_with_connection_roots(
    context: &mut Value,
    roots: &BTreeSet<String>,
) -> Result<()> {
    let Some(map) = context.as_object_mut() else {
        return Ok(());
    };
    for root in roots {
        if map.contains_key(root) {
            continue;
        }
        let Ok(saved) = connection_store::load_connection(root) else {
            continue;
        };
        map.insert(root.to_string(), saved_connection_to_value(root, &saved));
    }
    Ok(())
}

fn saved_connection_to_value(name: &str, saved: &SavedConnection) -> Value {
    json!({
        "name": name,
        "connection_name": name,
        "host": saved.host,
        "username": saved.username,
        "password": saved.password,
        "port": saved.port,
        "enable_password": saved.enable_password,
        "ssh_security": saved.ssh_security,
        "linux_shell_flavor": saved.linux_shell_flavor,
        "device_profile": saved.device_profile,
        "enabled": saved.enabled,
        "labels": saved.labels,
        "groups": saved.groups,
        "vars": saved.vars
    })
}

fn collect_connection_roots_from_value(value: &Value, out: &mut BTreeSet<String>) {
    match value {
        Value::Object(map) => {
            for item in map.values() {
                collect_connection_roots_from_value(item, out);
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_connection_roots_from_value(item, out);
            }
        }
        Value::String(text) => {
            if text.contains("{{") || text.contains("{%") {
                let roots = extract_connection_roots_from_template(text);
                out.extend(roots);
            }
        }
        _ => {}
    }
}

fn extract_connection_roots_from_template(template_text: &str) -> BTreeSet<String> {
    let mut roots = BTreeSet::new();
    let mut pos = 0;
    while pos < template_text.len() {
        let rest = &template_text[pos..];
        let open_expr = rest.find("{{");
        let open_stmt = rest.find("{%");
        let (open_idx, close_token) = match (open_expr, open_stmt) {
            (Some(a), Some(b)) => {
                if a <= b {
                    (a, "}}")
                } else {
                    (b, "%}")
                }
            }
            (Some(a), None) => (a, "}}"),
            (None, Some(b)) => (b, "%}"),
            (None, None) => break,
        };
        let expr_start = pos + open_idx + 2;
        let rest_expr = &template_text[expr_start..];
        let Some(close_idx) = rest_expr.find(close_token) else {
            break;
        };
        let expr = &rest_expr[..close_idx];
        collect_roots_from_expression(expr, &mut roots);
        pos = expr_start + close_idx + 2;
    }
    roots
}

fn collect_roots_from_expression(expr: &str, out: &mut BTreeSet<String>) {
    let mut token = String::new();
    let flush = |token: &mut String, out: &mut BTreeSet<String>| {
        if token.is_empty() {
            return;
        }
        if let Some((root, _)) = token.split_once('.')
            && !root.is_empty()
            && is_safe_root(root)
            && !is_reserved_root(root)
        {
            out.insert(root.to_string());
        }
        token.clear();
    };

    for ch in expr.chars() {
        if ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.') {
            token.push(ch);
        } else {
            flush(&mut token, out);
        }
    }
    flush(&mut token, out);
}

fn is_safe_root(root: &str) -> bool {
    root.chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-'))
}

fn is_reserved_root(root: &str) -> bool {
    RESERVED_ROOTS.contains(&root)
}

#[cfg(test)]
mod tests {
    use super::extract_connection_roots_from_template;

    #[test]
    fn extracts_named_connection_roots() {
        let roots = extract_connection_roots_from_template(
            r#"
            {{ edge94.host }}
            {% if vars.peer_host %}{{ edge95.password }}{% endif %}
            {{ connection.host }}
            "#,
        );
        assert!(roots.contains("edge94"));
        assert!(roots.contains("edge95"));
        assert!(!roots.contains("vars"));
        assert!(!roots.contains("connection"));
    }
}
