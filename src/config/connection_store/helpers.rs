use super::*;

pub(super) fn parse_ssh_security_profile(value: &str) -> Result<SshSecurityProfile> {
    match value.trim() {
        "secure" => Ok(SshSecurityProfile::Secure),
        "balanced" => Ok(SshSecurityProfile::Balanced),
        "legacy-compatible" => Ok(SshSecurityProfile::LegacyCompatible),
        #[cfg(test)]
        "test-no-check" => Ok(SshSecurityProfile::TestNoCheck),
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
