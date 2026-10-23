use crate::cli::InteractiveTemplateCommands;
use crate::config::content_store;
use crate::config::interactive_template::normalize_interactive_template_body;
use anyhow::Result;
use std::path::PathBuf;

pub(crate) fn run_interactive_template_command(cmd: InteractiveTemplateCommands) -> Result<()> {
    match cmd {
        InteractiveTemplateCommands::List => {
            let names = content_store::list_interactive_template_names()?;
            if names.is_empty() {
                println!("-");
            } else {
                for name in names {
                    println!("- {}", name);
                }
            }
        }
        InteractiveTemplateCommands::Show { name } => {
            let safe_name = safe_interactive_template_name(&name)?;
            let stored =
                content_store::load_interactive_template(&safe_name)?.ok_or_else(|| {
                    anyhow::anyhow!("interactive command template '{}' not found", safe_name)
                })?;
            println!("{}", stored.content);
        }
        InteractiveTemplateCommands::Create {
            name,
            file,
            content,
        } => {
            let safe_name = safe_interactive_template_name(&name)?;
            let body = normalize_interactive_template_body_from_input(&safe_name, file, content)?;
            let created = content_store::create_interactive_template(&safe_name, &body)?;
            if !created {
                return Err(anyhow::anyhow!(
                    "interactive command template '{}' already exists",
                    safe_name
                ));
            }
            println!("Created interactive command template '{}'", safe_name);
        }
        InteractiveTemplateCommands::Update {
            name,
            file,
            content,
        } => {
            let safe_name = safe_interactive_template_name(&name)?;
            let body = normalize_interactive_template_body_from_input(&safe_name, file, content)?;
            let updated = content_store::update_interactive_template(&safe_name, &body)?;
            if !updated {
                return Err(anyhow::anyhow!(
                    "interactive command template '{}' not found",
                    safe_name
                ));
            }
            println!("Updated interactive command template '{}'", safe_name);
        }
        InteractiveTemplateCommands::Delete { name } => {
            let safe_name = safe_interactive_template_name(&name)?;
            let deleted = content_store::delete_interactive_template(&safe_name)?;
            if !deleted {
                return Err(anyhow::anyhow!(
                    "interactive command template '{}' not found",
                    safe_name
                ));
            }
            println!("Deleted interactive command template '{}'", safe_name);
        }
    }
    Ok(())
}

fn normalize_interactive_template_body_from_input(
    name: &str,
    file: Option<PathBuf>,
    content: Option<String>,
) -> Result<String> {
    let body = crate::cli::exec::read_text_body("interactive command template", file, content)?;
    normalize_interactive_template_body(name, &body)
}

fn safe_interactive_template_name(raw: &str) -> Result<String> {
    let normalized = raw.trim();
    if normalized.is_empty()
        || normalized.contains('/')
        || normalized.contains('\\')
        || normalized.contains("..")
        || !normalized
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
    {
        return Err(anyhow::anyhow!("invalid interactive command template name"));
    }
    Ok(normalized.to_string())
}
