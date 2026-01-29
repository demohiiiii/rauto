use anyhow::{Result, anyhow};
use dirs;
use minijinja::Environment;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

pub struct Renderer<'a> {
    env: Environment<'a>,
}

impl<'a> Renderer<'a> {
    pub fn new(custom_template_dir: Option<PathBuf>) -> Self {
        let mut env = Environment::new();

        // Configure lazy loader
        env.set_loader(move |name| {
            // Define search paths
            let mut search_paths = Vec::new();

            // 1. Custom directory
            if let Some(ref dir) = custom_template_dir {
                search_paths.push(dir.join("commands").join(name));
                search_paths.push(dir.join(name));
            }

            // 2. Local templates/commands
            search_paths.push(PathBuf::from("templates").join("commands").join(name));
            search_paths.push(PathBuf::from("templates").join(name));

            // 3. User config
            if let Some(config_dir) = dirs::config_dir() {
                search_paths.push(
                    config_dir
                        .join("rauto")
                        .join("templates")
                        .join("commands")
                        .join(name),
                );
            }

            // Also check absolute path if name looks like one
            if Path::new(name).is_absolute() {
                search_paths.insert(0, PathBuf::from(name));
            }

            for path in search_paths {
                if path.exists() {
                    return fs::read_to_string(path).map(Some).map_err(|e| {
                        minijinja::Error::new(minijinja::ErrorKind::TemplateNotFound, e.to_string())
                    });
                }
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
