use crate::cli::GlobalOpts;
use crate::web::error::ApiError;
use crate::web::models::ConnectionRequest;
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub defaults: GlobalOpts,
}

impl AppState {
    pub fn new(defaults: GlobalOpts) -> Arc<Self> {
        Arc::new(Self { defaults })
    }
}

pub struct ResolvedConnection {
    pub connection_name: Option<String>,
    pub host: String,
    pub username: String,
    pub password: String,
    pub port: u16,
    pub enable_password: Option<String>,
    pub device_profile: String,
    pub template_dir: Option<PathBuf>,
}

pub fn merge_connection_options(
    defaults: &GlobalOpts,
    incoming: Option<ConnectionRequest>,
) -> Result<ResolvedConnection, ApiError> {
    let incoming = incoming.unwrap_or(ConnectionRequest {
        connection_name: None,
        host: None,
        username: None,
        password: None,
        port: None,
        enable_password: None,
        device_profile: None,
        template_dir: None,
    });

    let host = incoming
        .host
        .or_else(|| defaults.host.clone())
        .ok_or_else(|| ApiError::bad_request("host is required"))?;

    let username = incoming
        .username
        .or_else(|| defaults.username.clone())
        .unwrap_or_else(|| "admin".to_string());

    let password = incoming
        .password
        .or_else(|| defaults.password.clone())
        .unwrap_or_default();

    let port = incoming.port.or(defaults.port).unwrap_or(22);
    let enable_password = incoming
        .enable_password
        .or_else(|| defaults.enable_password.clone());
    let device_profile = incoming
        .device_profile
        .or_else(|| defaults.device_profile.clone())
        .unwrap_or_else(|| "cisco".to_string());
    let template_dir = incoming
        .template_dir
        .map(PathBuf::from)
        .or_else(|| defaults.template_dir.clone());
    let connection_name = incoming.connection_name.or_else(|| defaults.connection.clone());

    Ok(ResolvedConnection {
        connection_name,
        host,
        username,
        password,
        port,
        enable_password,
        device_profile,
        template_dir,
    })
}
