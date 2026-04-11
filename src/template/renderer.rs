use crate::config::content_store;
use anyhow::{Result, anyhow};
use minijinja::{Environment, UndefinedBehavior};
use serde_json::Value;

pub struct Renderer<'a> {
    env: Environment<'a>,
}

impl<'a> Renderer<'a> {
    pub fn new() -> Self {
        let mut env = Environment::new();
        // Fail fast when required variables are missing instead of silently rendering empty strings.
        env.set_undefined_behavior(UndefinedBehavior::Strict);

        env.set_loader(move |name| {
            if let Some(stored) = content_store::load_command_template(name).map_err(|e| {
                minijinja::Error::new(minijinja::ErrorKind::InvalidOperation, e.to_string())
            })? {
                return Ok(Some(stored.content));
            }

            Ok(None)
        });

        // Add custom filters here
        // env.add_filter("ipaddr", ...);

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

    #[allow(dead_code)]
    pub fn render_string(&self, template_str: &str, context: Value) -> Result<String> {
        let rendered = self
            .env
            .render_str(template_str, context)
            .map_err(|e| anyhow!("Failed to render string template: {}", e))?;

        Ok(rendered)
    }
}

#[cfg(test)]
mod tests {
    use super::Renderer;

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
}
