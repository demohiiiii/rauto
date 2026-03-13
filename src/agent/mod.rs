pub mod config;
pub mod registration;

use crate::config::{connection_store, template_loader};
use crate::web::{error::ApiError, storage};

pub fn default_agent_name() -> String {
    hostname::get()
        .ok()
        .and_then(|value| value.into_string().ok())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "rauto-agent".to_string())
}

pub fn list_agent_capabilities(
    template_dir: Option<&std::path::PathBuf>,
) -> Result<Vec<String>, anyhow::Error> {
    template_loader::list_available_profiles(template_dir)
}

pub fn count_connections() -> Result<u32, anyhow::Error> {
    Ok(connection_store::list_connections()?.len() as u32)
}

pub fn count_templates(template_dir: Option<&std::path::PathBuf>) -> Result<u32, ApiError> {
    let commands_dir = storage::resolve_commands_dir(template_dir);
    Ok(storage::list_templates(&commands_dir)?.len() as u32)
}

pub fn count_custom_profiles(template_dir: Option<&std::path::PathBuf>) -> Result<u32, ApiError> {
    let profiles_dir = storage::resolve_profiles_dir(template_dir);
    Ok(storage::list_custom_profiles(&profiles_dir)?.len() as u32)
}
