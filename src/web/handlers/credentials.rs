use crate::config::device_credential_import;
use crate::config::device_credential_store::{self, DeviceCredentialInput, DeviceCredentialMeta};
use crate::web::error::ApiError;
use crate::web::models::{DeviceCredentialResponse, UpsertDeviceCredentialRequest};
use axum::Json;
use axum::extract::{Multipart, Path};
use serde_json::{Value, json};

pub(super) fn credential_response(
    credential: DeviceCredentialMeta,
    referencing_connections: Vec<String>,
) -> DeviceCredentialResponse {
    DeviceCredentialResponse {
        id: credential.id,
        name: credential.name,
        username: credential.username,
        auth_type: credential.auth_type,
        has_auth_secret: credential.has_auth_secret,
        has_password: credential.has_password,
        private_key_path: credential.private_key_path,
        has_passphrase: credential.has_passphrase,
        has_enable_password: credential.has_enable_password,
        enable_enabled: credential.enable_enabled,
        connection_count: credential.connection_count,
        referencing_connections,
    }
}

pub async fn list_credentials() -> Result<Json<Vec<DeviceCredentialResponse>>, ApiError> {
    let credentials = device_credential_store::list_credentials().map_err(ApiError::from)?;
    Ok(Json(
        credentials
            .into_iter()
            .map(|credential| credential_response(credential, Vec::new()))
            .collect(),
    ))
}

pub async fn create_credential(
    Json(request): Json<UpsertDeviceCredentialRequest>,
) -> Result<Json<DeviceCredentialResponse>, ApiError> {
    let credential = device_credential_store::create_credential(&credential_input(request)?)
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    Ok(Json(credential_response(credential, Vec::new())))
}

pub async fn get_credential(
    Path(id): Path<String>,
) -> Result<Json<DeviceCredentialResponse>, ApiError> {
    let credential = device_credential_store::get_credential(&id)
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    let connections =
        device_credential_store::referencing_connections(&id).map_err(ApiError::from)?;
    Ok(Json(credential_response(credential, connections)))
}

pub async fn update_credential(
    Path(id): Path<String>,
    Json(request): Json<UpsertDeviceCredentialRequest>,
) -> Result<Json<DeviceCredentialResponse>, ApiError> {
    let credential = device_credential_store::update_credential(&id, &credential_input(request)?)
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    let connections =
        device_credential_store::referencing_connections(&id).map_err(ApiError::from)?;
    Ok(Json(credential_response(credential, connections)))
}

pub async fn delete_credential(Path(id): Path<String>) -> Result<Json<Value>, ApiError> {
    let connections =
        device_credential_store::referencing_connections(&id).map_err(ApiError::from)?;
    if !connections.is_empty() {
        return Err(ApiError::conflict(format!(
            "device credential '{}' is referenced by connections: {}",
            id,
            connections.join(", ")
        )));
    }
    let deleted = device_credential_store::delete_credential(&id)
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    Ok(Json(json!({ "deleted": deleted })))
}

pub async fn import_credentials(
    mut multipart: Multipart,
) -> Result<Json<device_credential_import::DeviceCredentialImportReport>, ApiError> {
    let mut file_name = None;
    let mut file_bytes = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|error| ApiError::bad_request(format!("failed to read upload field: {}", error)))?
    {
        if field.name() != Some("file") {
            continue;
        }
        file_name = field.file_name().map(ToOwned::to_owned);
        file_bytes = Some(field.bytes().await.map_err(|error| {
            ApiError::bad_request(format!("failed to read upload file: {}", error))
        })?);
        break;
    }

    let file_name = file_name
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| ApiError::bad_request("upload file name is required"))?;
    let file_bytes = file_bytes.ok_or_else(|| ApiError::bad_request("upload file is required"))?;
    let report =
        device_credential_import::import_credentials_from_web_bytes(&file_name, &file_bytes)
            .map_err(|error| ApiError::bad_request(error.to_string()))?;
    Ok(Json(report))
}

fn credential_input(
    request: UpsertDeviceCredentialRequest,
) -> Result<DeviceCredentialInput, ApiError> {
    let private_key_path = request
        .private_key_path
        .as_deref()
        .map(crate::web::path_policy::resolve_private_key_file)
        .transpose()?
        .map(|path| path.to_string_lossy().to_string());
    Ok(DeviceCredentialInput {
        name: request.name,
        username: request.username,
        auth_type: request.auth_type,
        password: request.password,
        private_key: request.private_key,
        private_key_path,
        passphrase: request.passphrase,
        enable_password: request.enable_password,
        enable_enabled: request.enable_enabled,
    })
}
