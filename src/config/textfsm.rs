use anyhow::{Context, Result};
use rust_embed::RustEmbed;
use serde_json::Value;
use std::borrow::ToOwned;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::OnceLock;

#[derive(RustEmbed)]
#[folder = "assets/ntc_templates/templates"]
struct NtcTemplates;

static CLI_TABLE: OnceLock<Option<textfsm_rust::CliTable>> = OnceLock::new();

#[derive(Debug, Clone, Default)]
pub struct AutoParseAttributes {
    pub command: Option<String>,
    pub platform: Option<String>,
    pub vendor: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct ParseOptions {
    pub template_file: Option<std::path::PathBuf>,
    pub template_content: Option<String>,
    pub enabled: bool,
    pub platform: Option<String>,
    pub device_profile: Option<String>,
    pub vendor: Option<String>,
}

impl AutoParseAttributes {
    pub fn to_map(&self) -> HashMap<String, String> {
        let mut attrs = HashMap::new();
        if let Some(value) = self.command.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
            attrs.insert("Command".to_string(), value.to_string());
        }
        if let Some(value) = self.platform.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
            attrs.insert("Platform".to_string(), value.to_string());
        }
        if let Some(value) = self.vendor.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
            attrs.insert("Vendor".to_string(), value.to_string());
        }
        attrs
    }
}

pub fn parse_output_with_template_content(template_content: &str, output: &str) -> Result<Value> {
    let template = textfsm_rust::Template::parse_str(template_content)
        .context("failed to parse TextFSM template")?;
    let mut parser = template.parser();
    let records = parser
        .parse_text_to_dicts(output)
        .context("failed to parse command output with TextFSM")?;
    serde_json::to_value(records).context("failed to serialize TextFSM records")
}

pub fn parse_output_with_template_file(template_file: &Path, output: &str) -> Result<Value> {
    let template_content = fs::read_to_string(template_file).with_context(|| {
        format!(
            "failed to read TextFSM template '{}'",
            template_file.display()
        )
    })?;
    parse_output_with_template_content(&template_content, output)
}

pub fn parse_output_with_auto_selection(
    output: &str,
    attrs: AutoParseAttributes,
) -> Result<Value> {
    let table = cli_table()?.parse_cmd(output, &attrs.to_map())?;
    table_to_json(&table)
}

pub fn parse_command_output(
    output: &str,
    command: &str,
    options: &ParseOptions,
) -> Result<Value> {
    if let Some(template_content) = options
        .template_content
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return parse_output_with_template_content(template_content, output);
    }
    if let Some(template_file) = options.template_file.as_deref() {
        return parse_output_with_template_file(template_file, output);
    }
    let platform = effective_platform(options);
    parse_output_with_auto_selection(
        output,
        AutoParseAttributes {
            command: Some(command.to_string()),
            platform,
            vendor: options.vendor.clone(),
        },
    )
}

pub fn parse_command_output_optional(
    output: &str,
    command: &str,
    options: &ParseOptions,
) -> (Option<Value>, Option<String>) {
    if options.template_file.is_none()
        && options
            .template_content
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .is_none()
        && !options.enabled
        && options
            .platform
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .is_none()
        && options
            .device_profile
            .as_deref()
            .and_then(ntc_platform_for_device_profile)
            .is_none()
    {
        return (None, None);
    }
    match parse_command_output(output, command, options) {
        Ok(value) => (Some(value), None),
        Err(err) => (None, Some(err.to_string())),
    }
}

pub fn ntc_platform_for_device_profile(device_profile: &str) -> Option<String> {
    let canonical = crate::config::template_loader::canonical_builtin_profile_name(device_profile)?;
    let platform = match canonical {
        "cisco_ios" | "cisco_asa" | "cisco_nxos" | "arista_eos" | "aruba_aoscx"
        | "fortinet" | "juniper_junos" | "linux" | "paloalto_panos" | "zte_zxros"
        | "checkpoint_gaia" => canonical,
        "cisco_xe" => "cisco_ios",
        "huawei" => "huawei_vrp",
        "h3c_comware" | "hp_comware" => "hp_comware",
        _ => return None,
    };
    Some(platform.to_string())
}

pub fn format_parsed_output_table(value: &Value) -> String {
    let Some(rows) = value.as_array() else {
        return serde_json::to_string_pretty(value).unwrap_or_else(|_| value.to_string());
    };
    if rows.is_empty() {
        return "(no parsed rows)".to_string();
    }

    let mut columns = Vec::new();
    for row in rows {
        let Some(object) = row.as_object() else {
            return serde_json::to_string_pretty(value).unwrap_or_else(|_| value.to_string());
        };
        for key in object.keys() {
            if !columns.iter().any(|column| column == key) {
                columns.push(key.clone());
            }
        }
    }
    if columns.is_empty() {
        return "(no parsed columns)".to_string();
    }

    let table_rows = rows
        .iter()
        .map(|row| {
            let object = row.as_object().expect("validated object row");
            columns
                .iter()
                .map(|column| {
                    object
                        .get(column)
                        .map(format_cell_value)
                        .unwrap_or_default()
                })
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();

    let mut widths = columns.iter().map(|column| column.len()).collect::<Vec<_>>();
    for row in &table_rows {
        for (index, cell) in row.iter().enumerate() {
            widths[index] = widths[index].max(cell.len());
        }
    }

    let border = format!(
        "+{}+",
        widths
            .iter()
            .map(|width| "-".repeat(width + 2))
            .collect::<Vec<_>>()
            .join("+")
    );
    let mut output = Vec::new();
    output.push(border.clone());
    output.push(format_table_row(&columns, &widths));
    output.push(border.clone());
    for row in table_rows {
        output.push(format_table_row(&row, &widths));
    }
    output.push(border);
    output.join("\n")
}

fn format_cell_value(value: &Value) -> String {
    let raw = match value {
        Value::Null => String::new(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        Value::String(value) => value.clone(),
        Value::Array(values) => values
            .iter()
            .map(format_cell_value)
            .collect::<Vec<_>>()
            .join(", "),
        Value::Object(_) => serde_json::to_string(value).unwrap_or_else(|_| value.to_string()),
    };
    truncate_cell(raw)
}

fn truncate_cell(value: String) -> String {
    const MAX_CELL_CHARS: usize = 80;
    let mut chars = value.chars();
    let truncated = chars.by_ref().take(MAX_CELL_CHARS).collect::<String>();
    if chars.next().is_some() {
        format!("{truncated}...")
    } else {
        truncated
    }
}

fn format_table_row(cells: &[String], widths: &[usize]) -> String {
    let padded = cells
        .iter()
        .enumerate()
        .map(|(index, cell)| format!(" {:width$} ", cell, width = widths[index]))
        .collect::<Vec<_>>()
        .join("|");
    format!("|{padded}|")
}

fn effective_platform(options: &ParseOptions) -> Option<String> {
    options
        .platform
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            options
                .device_profile
                .as_deref()
                .and_then(ntc_platform_for_device_profile)
        })
}

fn cli_table() -> Result<&'static textfsm_rust::CliTable> {
    let table = CLI_TABLE.get_or_init(|| {
        let root = embedded_ntc_template_root().ok()?;
        textfsm_rust::CliTable::new(root.join("index"), &root).ok()
    });
    table.as_ref().context("ntc templates CliTable is not available")
}

fn table_to_json(table: &textfsm_rust::TextTable) -> Result<Value> {
    let rows = table
        .iter()
        .map(|row| {
            let map = row
                .to_map()
                .into_iter()
                .map(|(key, value)| {
                    (
                        key.to_lowercase(),
                        serde_json::to_value(value).unwrap_or(Value::Null),
                    )
                })
                .collect::<serde_json::Map<String, Value>>();
            Value::Object(map)
        })
        .collect::<Vec<_>>();
    serde_json::to_value(rows).context("failed to serialize CliTable rows")
}

fn embedded_ntc_template_root() -> Result<std::path::PathBuf> {
    let cache_root = std::env::temp_dir().join("rauto-embedded-ntc-templates");
    if cache_root.exists() {
        return Ok(cache_root);
    }
    fs::create_dir_all(&cache_root).context("failed to create embedded ntc template cache")?;
    for path in NtcTemplates::iter() {
        let rel = std::path::Path::new(path.as_ref());
        let target = cache_root.join(rel);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!("failed to create ntc template cache dir '{}'", parent.display())
            })?;
        }
        let Some(content) = NtcTemplates::get(path.as_ref()) else {
            continue;
        };
        fs::write(&target, content.data.as_ref()).with_context(|| {
            format!(
                "failed to write embedded ntc template cache '{}'",
                target.display()
            )
        })?;
    }
    Ok(cache_root)
}

#[cfg(test)]
mod tests {
    use super::ntc_platform_for_device_profile;

    #[test]
    fn maps_builtin_profile_to_ntc_platform() {
        assert_eq!(
            ntc_platform_for_device_profile("cisco_xe").as_deref(),
            Some("cisco_ios")
        );
        assert_eq!(
            ntc_platform_for_device_profile("huawei").as_deref(),
            Some("huawei_vrp")
        );
        assert_eq!(
            ntc_platform_for_device_profile("hp_comware").as_deref(),
            Some("hp_comware")
        );
        assert_eq!(
            ntc_platform_for_device_profile("checkpoint_gaia").as_deref(),
            Some("checkpoint_gaia")
        );
    }

    #[test]
    fn returns_none_for_unmapped_profiles() {
        assert_eq!(ntc_platform_for_device_profile("array"), None);
    }
}
