use crate::config::content_store;
use crate::config::device_profile::DeviceProfile;
use crate::config::template_loader;
use crate::web::error::ApiError;
use crate::web::models::{
    BuiltinProfileDetail, CustomProfileDetail, DeviceProfileModesResponse, DeviceProfilesOverview,
    ProfileDiagnoseRequest, ProfileDiagnoseResponse, UpsertCustomProfileRequest,
};
use crate::web::state::AppState;
use crate::web::storage;
use axum::extract::{Path, State};
use axum::Json;
use serde_json::{Value, json};
use std::sync::Arc;

pub async fn list_profiles(State(state): State<Arc<AppState>>) -> Result<Json<Vec<String>>, ApiError> {
    let _ = state;
    let profiles = crate::config::template_loader::list_available_profiles()?;
    Ok(Json(profiles))
}

pub async fn profiles_overview(
    State(state): State<Arc<AppState>>,
) -> Result<Json<DeviceProfilesOverview>, ApiError> {
    let _ = state;
    let custom = storage::list_custom_profiles()?;
    Ok(Json(DeviceProfilesOverview {
        builtins: storage::builtin_profiles(),
        custom,
    }))
}

pub async fn get_builtin_profile_detail(
    Path(name): Path<String>,
) -> Result<Json<BuiltinProfileDetail>, ApiError> {
    let detail = storage::builtin_profile_detail(&name)
        .ok_or_else(|| ApiError::bad_request("builtin profile not found"))?;
    Ok(Json(detail))
}

pub async fn get_builtin_profile_form(Path(name): Path<String>) -> Result<Json<DeviceProfile>, ApiError> {
    let profile = storage::builtin_profile_form(&name)
        .ok_or_else(|| ApiError::bad_request("builtin profile not found"))?;
    Ok(Json(profile))
}

pub async fn get_custom_profile(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<CustomProfileDetail>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    let Some(stored) = content_store::load_custom_profile(&safe_name).map_err(ApiError::from)? else {
        return Err(ApiError::bad_request("custom profile not found"));
    };
    Ok(Json(CustomProfileDetail {
        name: safe_name,
        path: stored.locator,
        content: stored.content,
    }))
}

pub async fn create_or_update_custom_profile(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<UpsertCustomProfileRequest>,
) -> Result<Json<CustomProfileDetail>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    let updated =
        content_store::update_custom_profile(&safe_name, &req.content).map_err(ApiError::from)?;
    if !updated {
        content_store::create_custom_profile(&safe_name, &req.content).map_err(ApiError::from)?;
    }
    let locator = content_store::custom_profile_locator(&safe_name);
    Ok(Json(CustomProfileDetail {
        name: safe_name,
        path: locator,
        content: req.content,
    }))
}

pub async fn get_custom_profile_form(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<DeviceProfile>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    let Some(stored) = content_store::load_custom_profile(&safe_name).map_err(ApiError::from)? else {
        return Err(ApiError::bad_request("custom profile not found"));
    };
    let mut profile: DeviceProfile = toml::from_str(&stored.content).map_err(ApiError::from)?;
    profile.name = safe_name;
    Ok(Json(profile))
}

pub async fn upsert_custom_profile_form(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(mut profile): Json<DeviceProfile>,
) -> Result<Json<CustomProfileDetail>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    profile.name = safe_name.clone();
    let toml_content = toml::to_string_pretty(&profile).map_err(ApiError::from)?;
    let updated =
        content_store::update_custom_profile(&safe_name, &toml_content).map_err(ApiError::from)?;
    if !updated {
        content_store::create_custom_profile(&safe_name, &toml_content).map_err(ApiError::from)?;
    }
    let locator = content_store::custom_profile_locator(&safe_name);
    Ok(Json(CustomProfileDetail {
        name: safe_name,
        path: locator,
        content: toml_content,
    }))
}

pub async fn delete_custom_profile(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let safe_name = storage::safe_profile_name(&name)?;
    content_store::delete_custom_profile(&safe_name).map_err(ApiError::from)?;
    Ok(Json(json!({"ok": true})))
}

pub async fn diagnose_profile(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ProfileDiagnoseRequest>,
) -> Result<Json<ProfileDiagnoseResponse>, ApiError> {
    let name = req.name.trim();
    if name.is_empty() {
        return Err(ApiError::bad_request("profile name is required"));
    }

    let _ = state;
    let _ = req.template_dir.as_ref();
    let handler = template_loader::load_device_profile(name)?;

    let diagnostics = handler.diagnose_state_machine();

    Ok(Json(ProfileDiagnoseResponse {
        name: name.to_string(),
        diagnostics,
    }))
}

pub async fn get_profile_modes(
    Path(name): Path<String>,
) -> Result<Json<DeviceProfileModesResponse>, ApiError> {
    let safe_name = name.trim();
    if safe_name.is_empty() {
        return Err(ApiError::bad_request("profile name is required"));
    }
    let modes = template_loader::list_profile_modes(safe_name).map_err(ApiError::from)?;
    let default_mode = template_loader::default_profile_mode(safe_name).map_err(ApiError::from)?;
    Ok(Json(DeviceProfileModesResponse {
        name: safe_name.to_string(),
        default_mode,
        modes,
    }))
}
