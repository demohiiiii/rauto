use anyhow::{Context, Result};
use rust_embed::RustEmbed;
use serde_json::Value;
use std::borrow::{Cow, ToOwned};
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

#[derive(Debug, Clone)]
pub struct ParseOptions {
    pub template_file: Option<std::path::PathBuf>,
    pub template_content: Option<String>,
    pub enabled: bool,
    pub platform: Option<String>,
    pub device_profile: Option<String>,
    pub vendor: Option<String>,
    pub filter_error_rules: bool,
}

#[cfg(test)]
pub use crate::domain::device::DeviceFacts;
pub use crate::domain::device::extract_device_facts;

impl Default for ParseOptions {
    fn default() -> Self {
        Self {
            template_file: None,
            template_content: None,
            enabled: false,
            platform: None,
            device_profile: None,
            vendor: None,
            filter_error_rules: true,
        }
    }
}

#[derive(Debug, Clone)]
struct TextfsmTemplateDebugContext {
    name: String,
    content: String,
    index_line: Option<usize>,
}

impl AutoParseAttributes {
    pub fn to_map(&self) -> HashMap<String, String> {
        let mut attrs = HashMap::new();
        if let Some(value) = self
            .command
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
        {
            attrs.insert("Command".to_string(), value.to_string());
        }
        if let Some(value) = self
            .platform
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
        {
            attrs.insert("Platform".to_string(), value.to_string());
        }
        if let Some(value) = self
            .vendor
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
        {
            attrs.insert("Vendor".to_string(), value.to_string());
        }
        attrs
    }
}

pub fn parse_output_with_template_content(template_content: &str, output: &str) -> Result<Value> {
    parse_output_with_template_content_named("<inline>", template_content, output, true)
}

fn parse_output_with_template_content_inner(
    template_content: &str,
    output: &str,
    filter_error_rules: bool,
) -> Result<Value> {
    let effective_content = maybe_filter_textfsm_error_rules(template_content, filter_error_rules);
    let template = textfsm_rust::Template::parse_str(&effective_content)
        .context("failed to parse TextFSM template")?;
    let mut parser = template.parser();
    let records = parser
        .parse_text_to_dicts(output)
        .context("failed to parse command output with TextFSM")?;
    serde_json::to_value(records).context("failed to serialize TextFSM records")
}

fn parse_output_with_template_content_named(
    template_name: &str,
    template_content: &str,
    output: &str,
    filter_error_rules: bool,
) -> Result<Value> {
    parse_output_with_template_content_inner(template_content, output, filter_error_rules).map_err(
        |err| {
            let effective_content =
                maybe_filter_textfsm_error_rules(template_content, filter_error_rules).into_owned();
            textfsm_error_with_template_contexts(
                err,
                &[TextfsmTemplateDebugContext {
                    name: template_name.to_string(),
                    content: effective_content,
                    index_line: None,
                }],
            )
        },
    )
}

pub fn parse_output_with_template_file(template_file: &Path, output: &str) -> Result<Value> {
    let template_content = fs::read_to_string(template_file).with_context(|| {
        format!(
            "failed to read TextFSM template '{}'",
            template_file.display()
        )
    })?;
    parse_output_with_template_content_named(
        &template_file.display().to_string(),
        &template_content,
        output,
        true,
    )
}

pub fn parse_output_with_auto_selection(output: &str, attrs: AutoParseAttributes) -> Result<Value> {
    parse_output_with_auto_selection_filtered(output, attrs, true)
}

fn parse_output_with_auto_selection_filtered(
    output: &str,
    attrs: AutoParseAttributes,
    filter_error_rules: bool,
) -> Result<Value> {
    let table = cli_table()?;
    let attrs = attrs.to_map();
    let template_contexts = selected_ntc_template_contexts(table, &attrs);
    if filter_error_rules && !template_contexts.is_empty() {
        let effective_contexts = filtered_template_contexts(&template_contexts);
        let mut last_error = None;
        for context in &effective_contexts {
            match parse_output_with_template_content_inner(&context.content, output, false) {
                Ok(value) => return Ok(value),
                Err(err) => last_error = Some(err),
            }
        }
        if let Some(err) = last_error {
            return Err(textfsm_error_with_template_contexts(
                err,
                &effective_contexts,
            ));
        }
    }
    let parsed = table
        .parse_cmd(output, &attrs)
        .map_err(|err| textfsm_error_with_template_contexts(err, &template_contexts))?;
    table_to_json(&parsed)
}

pub fn parse_command_output(output: &str, command: &str, options: &ParseOptions) -> Result<Value> {
    if let Some(template_content) = options
        .template_content
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if options.filter_error_rules {
            return parse_output_with_template_content(template_content, output);
        }
        return parse_output_with_template_content_named(
            "<inline>",
            template_content,
            output,
            options.filter_error_rules,
        );
    }
    if let Some(template_file) = options.template_file.as_deref() {
        if options.filter_error_rules {
            return parse_output_with_template_file(template_file, output);
        }
        let template_content = fs::read_to_string(template_file).with_context(|| {
            format!(
                "failed to read TextFSM template '{}'",
                template_file.display()
            )
        })?;
        return parse_output_with_template_content_named(
            &template_file.display().to_string(),
            &template_content,
            output,
            options.filter_error_rules,
        );
    }
    if let Some(custom_template) =
        crate::config::custom_textfsm_store::resolve_template_for_command(
            options.device_profile.as_deref(),
            command,
        )?
    {
        return parse_output_with_template_content_named(
            &format!(
                "db://custom-textfsm/{}/{}?template={}",
                custom_template.device_profile,
                custom_template.command,
                custom_template.template_name
            ),
            &custom_template.template_content,
            output,
            options.filter_error_rules,
        );
    }
    let platform = effective_platform(options);
    let attrs = AutoParseAttributes {
        command: Some(command.to_string()),
        platform,
        vendor: options.vendor.clone(),
    };
    if options.filter_error_rules {
        return parse_output_with_auto_selection(output, attrs);
    }
    parse_output_with_auto_selection_filtered(output, attrs, false)
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
        "cisco_ios" | "cisco_asa" | "cisco_nxos" | "arista_eos" | "aruba_aoscx" | "fortinet"
        | "juniper_junos" | "linux" | "paloalto_panos" | "zte_zxros" | "checkpoint_gaia" => {
            canonical
        }
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

    let mut widths = columns
        .iter()
        .map(|column| column.len())
        .collect::<Vec<_>>();
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

fn selected_ntc_template_contexts(
    table: &textfsm_rust::CliTable,
    attrs: &HashMap<String, String>,
) -> Vec<TextfsmTemplateDebugContext> {
    table
        .index()
        .find_match(attrs)
        .map(|entry| {
            entry
                .templates()
                .iter()
                .map(|template_name| TextfsmTemplateDebugContext {
                    name: template_name.clone(),
                    content: embedded_ntc_template_content(template_name)
                        .unwrap_or_else(|| "<template content unavailable>".to_string()),
                    index_line: Some(entry.line_num()),
                })
                .collect()
        })
        .unwrap_or_default()
}

fn filtered_template_contexts(
    contexts: &[TextfsmTemplateDebugContext],
) -> Vec<TextfsmTemplateDebugContext> {
    contexts
        .iter()
        .map(|context| TextfsmTemplateDebugContext {
            name: context.name.clone(),
            content: maybe_filter_textfsm_error_rules(&context.content, true).into_owned(),
            index_line: context.index_line,
        })
        .collect()
}

fn embedded_ntc_template_content(template_name: &str) -> Option<String> {
    NtcTemplates::get(template_name)
        .map(|content| String::from_utf8_lossy(content.data.as_ref()).into_owned())
}

fn maybe_filter_textfsm_error_rules(content: &str, filter_error_rules: bool) -> Cow<'_, str> {
    if !filter_error_rules {
        return Cow::Borrowed(content);
    }
    let mut changed = false;
    let mut filtered = content
        .lines()
        .filter(|line| {
            let keep = !is_textfsm_error_rule(line);
            changed |= !keep;
            keep
        })
        .collect::<Vec<_>>()
        .join("\n");
    if !changed {
        return Cow::Borrowed(content);
    }
    if content.ends_with('\n') {
        filtered.push('\n');
    }
    Cow::Owned(filtered)
}

fn is_textfsm_error_rule(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed == "^. -> Error"
        || trimmed.starts_with("^. -> Error ")
        || trimmed == "^.* -> Error"
        || trimmed.starts_with("^.* -> Error ")
}

fn textfsm_error_with_template_contexts<E>(
    err: E,
    contexts: &[TextfsmTemplateDebugContext],
) -> anyhow::Error
where
    E: std::fmt::Display,
{
    anyhow::anyhow!(
        "{}",
        format_textfsm_error_with_template_contexts(err, contexts)
    )
}

fn format_textfsm_error_with_template_contexts<E>(
    err: E,
    contexts: &[TextfsmTemplateDebugContext],
) -> String
where
    E: std::fmt::Display,
{
    let mut message = err.to_string();
    if contexts.is_empty() {
        return message;
    }

    message.push_str("\n\nTextFSM template context:");
    for context in contexts {
        let index_line = context
            .index_line
            .map(|line| format!("; index line {line}"))
            .unwrap_or_default();
        message.push_str(&format!(
            "\n\n--- template: {}{} ---\n{}",
            context.name,
            index_line,
            line_numbered_template_content(&context.content)
        ));
    }
    message
}

fn line_numbered_template_content(content: &str) -> String {
    content
        .lines()
        .enumerate()
        .map(|(index, line)| format!("{:>4}: {}", index + 1, line))
        .collect::<Vec<_>>()
        .join("\n")
}

fn cli_table() -> Result<&'static textfsm_rust::CliTable> {
    let table = CLI_TABLE.get_or_init(|| {
        let root = embedded_ntc_template_root().ok()?;
        textfsm_rust::CliTable::new(root.join("index"), &root).ok()
    });
    table
        .as_ref()
        .context("ntc templates CliTable is not available")
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
                format!(
                    "failed to create ntc template cache dir '{}'",
                    parent.display()
                )
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
    use super::*;

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

    #[test]
    fn optional_parse_stays_disabled_when_device_profile_is_available() {
        let result = parse_command_output_optional(
            "uid=0(root) gid=0(root)",
            "id",
            &ParseOptions {
                device_profile: Some("linux".to_string()),
                ..ParseOptions::default()
            },
        );

        assert_eq!(result, (None, None));
    }

    #[test]
    fn device_profile_selects_platform_when_parsing_is_enabled() {
        let platform = effective_platform(&ParseOptions {
            enabled: true,
            device_profile: Some("linux".to_string()),
            ..ParseOptions::default()
        });

        assert_eq!(platform.as_deref(), Some("linux"));
    }

    #[test]
    fn textfsm_errors_include_template_context() {
        let message = format_textfsm_error_with_template_contexts(
            "failed to parse TextFSM template",
            &[TextfsmTemplateDebugContext {
                name: "cisco_ios_show_version.textfsm".to_string(),
                content: "Value VERSION (\\S+)\n\nStart\n  ^Version ${VERSION} -> Record"
                    .to_string(),
                index_line: Some(42),
            }],
        );

        assert!(message.contains("failed to parse TextFSM template"));
        assert!(message.contains("template: cisco_ios_show_version.textfsm; index line 42"));
        assert!(message.contains("   1: Value VERSION"));
        assert!(message.contains("   4:   ^Version ${VERSION} -> Record"));
    }

    #[test]
    fn filters_textfsm_error_rules_by_default() {
        let content = "Value NAME (\\S+)\n\nStart\n  ^Name: ${NAME} -> Record\n  ^. -> Error\n";

        let filtered = maybe_filter_textfsm_error_rules(content, true);

        assert!(!filtered.contains("^. -> Error"));
        assert!(filtered.ends_with('\n'));
        assert!(maybe_filter_textfsm_error_rules(content, false).contains("^. -> Error"));
    }

    #[test]
    fn parses_output_after_filtering_error_rule() {
        let template = "Value NAME (\\S+)\n\nStart\n  ^Name: ${NAME} -> Record\n  ^. -> Error\n";
        let output = "Name: rauto\nignored line\n";

        let parsed =
            parse_output_with_template_content_inner(template, output, true).expect("parse output");

        assert_eq!(parsed.as_array().map(Vec::len), Some(1));
    }

    #[test]
    fn extracts_first_device_model_and_version_from_ntc_rows() {
        let facts = extract_device_facts(&serde_json::json!([
            {
                "hardware": ["WS-C3850-48P", "WS-C3850-24T"],
                "version": "16.12.10"
            }
        ]));

        assert_eq!(facts.device_model.as_deref(), Some("WS-C3850-48P"));
        assert_eq!(facts.software_version.as_deref(), Some("16.12.10"));
    }

    #[test]
    fn extracts_vendor_specific_version_fields_and_skips_empty_values() {
        let facts = extract_device_facts(&serde_json::json!([
            {"MODEL": "", "JUNOS_VERSION": []},
            {"MODEL": "MX204", "JUNOS_VERSION": "23.4R1-S2.1"}
        ]));

        assert_eq!(facts.device_model.as_deref(), Some("MX204"));
        assert_eq!(facts.software_version.as_deref(), Some("23.4R1-S2.1"));
    }

    #[test]
    fn parses_h3c_comware_display_version_facts() {
        let output = r#"H3C Comware Software, Version 7.1.064, ESS 5113
Copyright (c) 2004-2016 Hangzhou H3C Tech. Co., Ltd. All rights reserved.

H3C WX5860H uptime is 0 weeks, 0 days, 1 hour, 50 minutes
Last reboot reason : Power on

Boot image: flash:/wx5860h-boot.bin
Boot image version: 7.1.064, ESS 5113
Compiled Jan  1 2016 16:00:00

System image: flash:/wx5860h-system.bin
System image version: 7.1.064, ESS 5113
Compiled Jan  1 2016 16:00:00

Slot 1
  with 1 RMI XLP 432 1400MHz Processor
  32736M bytes DDR3
  16M bytes NorFlash Memory
  4002M bytes CFCard Memory
Hardware Version is Ver.A
CPLD 1 Version is 001
"#;
        let parsed = parse_command_output(
            output,
            "display version",
            &ParseOptions {
                enabled: true,
                platform: Some("hp_comware".to_string()),
                ..ParseOptions::default()
            },
        )
        .expect("H3C Comware display version should parse");
        let facts = extract_device_facts(&parsed);

        assert_eq!(facts.device_model.as_deref(), Some("WX5860H"));
        assert_eq!(facts.software_version.as_deref(), Some("7.1.064"));
    }

    #[test]
    fn parses_hp_comware_display_version_facts() {
        let output = r#"HP Comware Platform Software
Comware Software, Version 5.20.105, Release 1808P27
Copyright (c) 2010-2014 Hewlett-Packard Development Company, L.P.

HP A5800-48G Switch with 1 Interface Slot uptime is 19 weeks, 4 days, 4 hours, 6 minutes

 Last reboot reason : Power on
 Boot image: flash:/A5800_5800_CMW520-R1808P27.bin
 System image: flash:/A5800_5800_CMW520-R1808P27.bin
  CPLD Version: 001
  BootRom Version: 113
Hardware Version is Ver.A
"#;
        let parsed = parse_command_output(
            output,
            "display version",
            &ParseOptions {
                enabled: true,
                platform: Some("hp_comware".to_string()),
                ..ParseOptions::default()
            },
        )
        .expect("HP Comware display version should parse");
        let facts = extract_device_facts(&parsed);

        assert_eq!(facts.device_model.as_deref(), Some("A5800-48G"));
        assert_eq!(facts.software_version.as_deref(), Some("5.20.105"));
    }

    #[test]
    fn parses_hpe_comware_display_version_facts() {
        let output = r#"HPE Comware Software, Version 7.1.070, Release 2612P01
Copyright (c) 2010-2024 Hewlett Packard Enterprise Development LP

HPE 5130-24G-4SFP+ EI Switch uptime is 12 weeks, 1 day
"#;
        let parsed = parse_command_output(
            output,
            "display version",
            &ParseOptions {
                enabled: true,
                platform: Some("hp_comware".to_string()),
                ..ParseOptions::default()
            },
        )
        .expect("HPE Comware display version should parse");
        let facts = extract_device_facts(&parsed);

        assert_eq!(facts.device_model.as_deref(), Some("5130-24G-4SFP+"));
        assert_eq!(facts.software_version.as_deref(), Some("7.1.070"));
    }

    #[test]
    fn parses_linux_os_release_facts() {
        let cases = [
            (
                "Ubuntu",
                r#"PRETTY_NAME="Ubuntu 22.04.4 LTS"
NAME="Ubuntu"
VERSION_ID="22.04"
VERSION="22.04.4 LTS (Jammy Jellyfish)"
ID=ubuntu
ID_LIKE=debian
"#,
                "Ubuntu",
                "22.04",
            ),
            (
                "CentOS",
                r#"NAME="CentOS Linux"
VERSION="7 (Core)"
ID="centos"
ID_LIKE="rhel fedora"
VERSION_ID="7"
PRETTY_NAME="CentOS Linux 7 (Core)"
"#,
                "CentOS Linux",
                "7",
            ),
            (
                "Debian",
                r#"PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"
NAME="Debian GNU/Linux"
VERSION_ID="12"
VERSION="12 (bookworm)"
ID=debian
"#,
                "Debian GNU/Linux",
                "12",
            ),
        ];

        for (distribution, output, expected_model, expected_version) in cases {
            let parsed = parse_command_output(
                output,
                "cat /etc/os-release",
                &ParseOptions {
                    enabled: true,
                    platform: Some("linux".to_string()),
                    ..ParseOptions::default()
                },
            )
            .unwrap_or_else(|error| panic!("{distribution} os-release should parse: {error}"));
            let facts = extract_device_facts(&parsed);

            assert_eq!(
                facts.device_model.as_deref(),
                Some(expected_model),
                "unexpected {distribution} model"
            );
            assert_eq!(
                facts.software_version.as_deref(),
                Some(expected_version),
                "unexpected {distribution} version"
            );
        }
    }

    #[test]
    fn returns_empty_facts_for_unstructured_or_empty_ntc_output() {
        assert_eq!(extract_device_facts(&Value::Null), DeviceFacts::default());
        assert_eq!(
            extract_device_facts(&serde_json::json!([{"HOSTNAME": "edge-01"}])),
            DeviceFacts::default()
        );
    }
}
