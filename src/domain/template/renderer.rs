use anyhow::{Result, anyhow};
use minijinja::{Environment, Error, UndefinedBehavior};
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
}

impl Default for Renderer<'static> {
    fn default() -> Self {
        Self::new()
    }
}

fn strict_environment<'source>() -> Environment<'source> {
    let mut env = Environment::new();
    env.set_undefined_behavior(UndefinedBehavior::Strict);
    env
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
