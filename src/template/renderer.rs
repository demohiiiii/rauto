use crate::config::content_store;
use crate::domain::template::renderer as core;
use anyhow::Result;
use minijinja::{Error, ErrorKind};
use serde_json::Value;

pub struct Renderer<'a> {
    inner: core::Renderer<'a>,
}

impl Renderer<'static> {
    pub fn new() -> Self {
        Self {
            inner: core::Renderer::new_with_loader(load_command_template),
        }
    }
}

impl<'a> Renderer<'a> {
    pub fn render_file(&self, template_name: &str, context: Value) -> Result<String> {
        self.inner.render_file(template_name, context)
    }

    pub fn render_string(&self, template_str: &str, context: Value) -> Result<String> {
        self.inner.render_string(template_str, context)
    }
}

fn load_command_template(name: &str) -> core::TemplateLoaderResult {
    if let Some(stored) = content_store::load_command_template(name)
        .map_err(|e| Error::new(ErrorKind::InvalidOperation, e.to_string()))?
    {
        return Ok(Some(stored.content));
    }

    Ok(None)
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
