use super::*;

pub(super) fn resolve_secret_field(
    connection_name: &str,
    field_name: &str,
    field: &mut Option<String>,
    secret_ref: Option<&str>,
) -> Result<()> {
    if has_non_empty_value(field.as_deref()) || secret_ref.is_none() {
        return Ok(());
    }
    *field = load_saved_secret(secret_ref).map_err(|err| {
        anyhow!(
            "failed to load stored {} for connection '{}': {}",
            field_name,
            connection_name,
            err
        )
    })?;
    if field.is_none() {
        return Err(anyhow!(
            "saved connection '{}' is missing stored {}; re-save the connection to repair it",
            connection_name,
            field_name,
        ));
    }
    Ok(())
}

pub(super) fn sync_connection_secret(
    secret_value: Option<&str>,
    incoming_ref: Option<&str>,
) -> Result<Option<String>> {
    if let Some(secret_value) = secret_value.filter(|value| !value.is_empty()) {
        return keyring_store::store_secret(Some(secret_value));
    }

    if let Some(secret_ref) = incoming_ref.filter(|value| !value.is_empty()) {
        if !secret_ref.starts_with("enc:v1:") {
            return Err(anyhow!(
                "invalid stored secret reference format '{}': expected enc:v1",
                secret_ref
            ));
        }
        return Ok(Some(secret_ref.to_string()));
    }

    Ok(None)
}

pub(super) fn has_non_empty_value(value: Option<&str>) -> bool {
    value.is_some_and(|item| !item.is_empty())
}

pub(super) fn parse_ssh_security_profile(value: &str) -> Result<SshSecurityProfile> {
    match value.trim() {
        "secure" => Ok(SshSecurityProfile::Secure),
        "balanced" => Ok(SshSecurityProfile::Balanced),
        "legacy-compatible" => Ok(SshSecurityProfile::LegacyCompatible),
        other => Err(anyhow!("invalid ssh security profile '{}'", other)),
    }
}

pub(super) fn parse_linux_shell_flavor(value: &str) -> Result<LinuxShellFlavor> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("invalid linux shell flavor ''"));
    }
    trimmed.parse::<LinuxShellFlavor>()
}

pub(super) fn parse_labels_json(raw: String) -> Result<Vec<String>> {
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|err| anyhow!("failed to parse stored labels json: {}", err))?;
    let items = parsed
        .as_array()
        .ok_or_else(|| anyhow!("stored labels must be a JSON array"))?;
    let mut normalized = Vec::new();
    for item in items {
        let value = item
            .as_str()
            .ok_or_else(|| anyhow!("stored label values must be strings"))?;
        normalized.push(normalize_simple_name(value)?);
    }
    normalized.sort();
    normalized.dedup();
    Ok(normalized)
}

pub(super) fn normalize_labels_json(values: &[String]) -> Result<String> {
    serde_json::to_string(&normalize_name_list(values)?).map_err(|err| anyhow!(err))
}

pub(super) fn parse_vars_json(raw: String) -> Result<Value> {
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|err| anyhow!("failed to parse stored vars json: {}", err))?;
    ensure_json_object(&parsed)?;
    Ok(parsed)
}

pub(super) fn normalize_vars_json(value: Value) -> Result<String> {
    ensure_json_object(&value)?;
    serde_json::to_string(&value).map_err(|err| anyhow!(err))
}

fn ensure_json_object(value: &Value) -> Result<()> {
    if !value.is_object() {
        return Err(anyhow!("vars must be a JSON object"));
    }
    Ok(())
}

fn normalize_simple_name(raw: &str) -> Result<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("name is required"));
    }
    if !trimmed
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.'))
    {
        return Err(anyhow!(
            "invalid name '{}', use only letters/numbers/_/./-",
            raw
        ));
    }
    Ok(trimmed.to_string())
}

pub(super) fn normalize_name_list(values: &[String]) -> Result<Vec<String>> {
    let mut items = values
        .iter()
        .map(|value| normalize_simple_name(value))
        .collect::<Result<Vec<_>>>()?;
    items.sort();
    items.dedup();
    Ok(items)
}
