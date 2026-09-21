use anyhow::{Result, anyhow};
use minijinja::value::ValueKind;
use minijinja::{AutoEscape, Environment, Error, UndefinedBehavior, escape_formatter};
use serde_json::Value;

pub type TemplateLoaderResult = std::result::Result<Option<String>, Error>;

pub struct Renderer<'source> {
    env: Environment<'source>,
}

impl<'source> Renderer<'source> {
    pub fn new() -> Self {
        Self::from_environment(strict_environment())
    }

    pub fn new_with_loader<L>(loader: L) -> Self
    where
        L: Fn(&str) -> TemplateLoaderResult + Send + Sync + 'source + 'static,
    {
        let mut env = strict_environment();
        env.set_loader(loader);
        Self::from_environment(env)
    }

    fn from_environment(env: Environment<'source>) -> Self {
        Self { env }
    }

    pub fn render_file(&self, template_name: &str, context: Value) -> Result<String> {
        let tmpl = self
            .env
            .get_template(template_name)
            .map_err(|e| anyhow!("Failed to load template '{}': {}", template_name, e))?;

        let rendered = tmpl
            .render(context)
            .map_err(|e| anyhow!("Failed to render template '{}': {}", template_name, e))?;

        Ok(rendered)
    }

    pub fn render_string(&self, template_str: &str, context: Value) -> Result<String> {
        let rendered = self
            .env
            .render_str(template_str, context)
            .map_err(|e| anyhow!("Failed to render string template: {}", e))?;

        Ok(rendered)
    }

    /// Returns external variable paths from this template, without rendering it.
    /// Nested attribute paths are retained so adapters can resolve context namespaces.
    /// Referenced templates and computed attribute names require runtime context
    /// and are not expanded by this source-level inspection.
    pub fn undeclared_variables(&self, template_str: &str) -> Result<Vec<String>> {
        let globals = self.env.globals().map(|(name, _)| name).collect::<Vec<_>>();
        let names = super::variables::undeclared_variables(template_str)
            .map_err(|e| anyhow!("Failed to inspect template: {}", e))?
            .into_iter()
            .filter(|name| {
                let root = name.split('.').next().unwrap_or(name);
                !globals.contains(&root)
            })
            .collect::<Vec<_>>();
        Ok(names)
    }
}

impl Default for Renderer<'static> {
    fn default() -> Self {
        Self::new()
    }
}

fn strict_environment<'source>() -> Environment<'source> {
    let mut env = Environment::new();
    env.set_undefined_behavior(UndefinedBehavior::Strict);
    // Keep existing command and JSON-template scalar spelling after MiniJinja's
    // switch to Python-style True/False/None output.
    env.set_formatter(|out, state, value| {
        if state.auto_escape() != AutoEscape::Json {
            let scalar = match value.kind() {
                ValueKind::Bool => Some(if value.is_true() { "true" } else { "false" }),
                ValueKind::None => Some("none"),
                _ => None,
            };
            if let Some(scalar) = scalar {
                return escape_formatter(out, state, &minijinja::Value::from(scalar));
            }
        }
        escape_formatter(out, state, value)
    });
    env
}

#[cfg(test)]
mod tests {
    use super::Renderer;

    #[test]
    fn rendering_preserves_scalar_spelling_and_strict_undefined_values() {
        let renderer = Renderer::new();
        let context = serde_json::json!({"enabled": true, "disabled": false, "empty": null});
        assert_eq!(
            renderer
                .render_string(
                    "{{ enabled }} {{ disabled }} {{ empty }} {{ true }}",
                    context
                )
                .unwrap(),
            "true false none true"
        );
        assert!(
            renderer
                .render_string("{{ missing }}", serde_json::json!({}))
                .is_err()
        );
        assert_eq!(
            renderer
                .render_string(
                    "{{ value | tojson }}",
                    serde_json::json!({"value": [true, false, null]})
                )
                .unwrap(),
            "[true,false,null]"
        );
    }

    #[test]
    fn inspection_finds_external_variables_across_jinja_expressions() {
        let variables = Renderer::new()
            .undeclared_variables(
                r#"
                interface {{ iface }}
                description {{ description | upper }}
                {% if enabled and role is equalto(expected_role) %}
                  {% for vlan in vlans if vlan.active %}
                    {{ loop.index }} vlan {{ vlan.id }} {{ prefix ~ vlan.name }}
                  {% else %}{{ fallback }}{% endfor %}
                {% elif backup_enabled %}{{ backup.name }}{% endif %}
                {{ mappings[key] | default(default_value) }}
                {{ base + offset }} {{ items[start:stop:step] }}
                "#,
            )
            .unwrap();
        assert_eq!(
            variables,
            vec![
                "backup.name",
                "backup_enabled",
                "base",
                "default_value",
                "description",
                "enabled",
                "expected_role",
                "fallback",
                "iface",
                "items",
                "key",
                "mappings",
                "offset",
                "prefix",
                "role",
                "start",
                "step",
                "stop",
                "vlans",
            ]
        );
    }

    #[test]
    fn inspection_excludes_locals_builtins_comments_and_literals() {
        let variables = Renderer::new()
            .undeclared_variables(
                r#"
                {# {{ comment_only }} #}
                {% raw %}{{ raw_only }}{% endraw %}
                {{ "literal_only" }}
                {% set local = source | upper %}{{ local }}
                {% with alias = peer %}{{ alias.name }}{% endwith %}
                {% macro describe(value, suffix=default_suffix) %}
                    {{ value }} {{ suffix }} {{ external }}
                {% endmacro %}
                {{ describe(input) }}
                {% set ns = namespace(total=initial) %}
                {% for index in range(count) %}{{ index }} {{ loop.index }}{% endfor %}
                {{ ns.total }} {{ dict(name=label).name }}
                "#,
            )
            .unwrap();
        assert_eq!(
            variables,
            vec![
                "count",
                "default_suffix",
                "external",
                "initial",
                "input",
                "label",
                "peer",
                "source"
            ]
        );
    }

    #[test]
    fn inspection_reports_invalid_syntax_instead_of_an_empty_schema() {
        let error = Renderer::new()
            .undeclared_variables("{% if enabled %}{{ value }}")
            .unwrap_err();
        assert!(error.to_string().contains("Failed to inspect template"));
    }

    #[test]
    fn inspection_finds_every_operand_in_chained_comparisons() {
        let renderer = Renderer::new();
        let source = "{% if lower < vlan.id <= upper and role not in excluded %}ok{% endif %}";
        assert_eq!(
            renderer.undeclared_variables(source).unwrap(),
            vec!["excluded", "lower", "role", "upper", "vlan.id"]
        );
        assert_eq!(
            renderer
                .render_string(
                    source,
                    serde_json::json!({
                        "lower": 1, "vlan": {"id": 10}, "upper": 20,
                        "role": "access", "excluded": ["core"]
                    })
                )
                .unwrap(),
            "ok"
        );
    }

    #[test]
    fn inspection_finds_block_parameters_and_assignment_inputs() {
        let variables = Renderer::new()
            .undeclared_variables(
                r#"
                {% set value = value | default(fallback) %}{{ value }}
                {% with alias = peer, other = alias %}{{ other }}{% endwith %}
                {% filter replace(old, new) %}{{ text }}{% endfilter %}
                {% set captured | replace(from_text, to_text) %}{{ body }}{% endset %}
                {% autoescape escape_enabled %}{{ html }}{% endautoescape %}
                {% if enabled %}{% set local = first %}{% else %}{% set local = second %}{% endif %}
                {{ local }} {{ vars['description'] }}
                {% include template_name ignore missing %}
                {% import macro_file as helpers %}{{ helpers.describe(input) }}
                "#,
            )
            .unwrap();
        assert_eq!(
            variables,
            vec![
                "body",
                "enabled",
                "escape_enabled",
                "fallback",
                "first",
                "from_text",
                "html",
                "input",
                "macro_file",
                "new",
                "old",
                "peer",
                "second",
                "template_name",
                "text",
                "to_text",
                "value",
                "vars.description",
            ]
        );
    }

    #[test]
    fn render_string_fails_on_missing_variables() {
        let renderer = Renderer::new();
        let err = renderer
            .render_string("{{ required_var }}", serde_json::json!({}))
            .expect_err("missing var should fail");
        let msg = format!("{err}");
        assert!(
            msg.contains("undefined") || msg.contains("Undefined") || msg.contains("required_var"),
            "unexpected error message: {msg}"
        );
    }

    #[test]
    fn render_file_uses_loader() {
        let renderer = Renderer::new_with_loader(|name| {
            Ok((name == "hello").then(|| "hello {{ name }}".to_string()))
        });

        let rendered = renderer
            .render_file("hello", serde_json::json!({ "name": "rauto" }))
            .expect("render template loaded by callback");

        assert_eq!(rendered, "hello rauto");
    }
}
