use crate::config::device_credential_store::{self, DeviceCredentialInput, DeviceCredentialMeta};
use anyhow::{Context, Result, anyhow};
use calamine::{Data, Reader, open_workbook_auto_from_rs};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Cursor;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct DeviceCredentialImportFailure {
    pub row: usize,
    pub name: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeviceCredentialImportReport {
    pub file_name: String,
    pub total_rows: usize,
    pub imported: usize,
    pub created: usize,
    pub updated: usize,
    pub failed: usize,
    pub failures: Vec<DeviceCredentialImportFailure>,
}

struct ImportedCredentialRow {
    row: usize,
    name: String,
    login_username: Option<String>,
    login_secret: Option<String>,
    enable_secret: Option<String>,
    enable_enabled: Option<bool>,
}

#[derive(Default)]
struct ParsedRows {
    rows: Vec<ImportedCredentialRow>,
    failures: Vec<DeviceCredentialImportFailure>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum ColumnKey {
    Name,
    LoginUsername,
    LoginSecret,
    EnableSecret,
    EnableEnabled,
}

#[derive(Debug, Clone, Copy)]
enum ImportFormat {
    Csv,
    Excel,
}

pub fn import_credentials_from_path(path: &Path) -> Result<DeviceCredentialImportReport> {
    let bytes = fs::read(path)
        .with_context(|| format!("failed to read credential import file '{}'", path.display()))?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| anyhow!("credential import file name is invalid"))?;
    import_credentials_from_bytes(file_name, &bytes)
}

pub fn import_credentials_from_bytes(
    file_name: &str,
    bytes: &[u8],
) -> Result<DeviceCredentialImportReport> {
    let parsed = match detect_format(file_name)? {
        ImportFormat::Csv => parse_csv(file_name, bytes)?,
        ImportFormat::Excel => parse_excel(file_name, bytes)?,
    };
    apply_import_rows(file_name, parsed)
}

fn apply_import_rows(file_name: &str, parsed: ParsedRows) -> Result<DeviceCredentialImportReport> {
    let total_rows = parsed.rows.len() + parsed.failures.len();
    let mut imported = 0usize;
    let mut created = 0usize;
    let mut updated = 0usize;
    let mut failures = parsed.failures;

    for row in parsed.rows {
        let existing = device_credential_store::find_credential_by_name(&row.name).ok();
        let input = match build_input(existing.as_ref(), &row) {
            Ok(input) => input,
            Err(error) => {
                failures.push(DeviceCredentialImportFailure {
                    row: row.row,
                    name: Some(row.name),
                    message: error.to_string(),
                });
                continue;
            }
        };
        let result = if let Some(existing) = existing.as_ref() {
            device_credential_store::update_credential(&existing.id, &input)
        } else {
            device_credential_store::create_credential(&input)
        };
        match result {
            Ok(_) => {
                imported += 1;
                if existing.is_some() {
                    updated += 1;
                } else {
                    created += 1;
                }
            }
            Err(error) => failures.push(DeviceCredentialImportFailure {
                row: row.row,
                name: Some(row.name),
                message: error.to_string(),
            }),
        }
    }

    Ok(DeviceCredentialImportReport {
        file_name: file_name.to_string(),
        total_rows,
        imported,
        created,
        updated,
        failed: failures.len(),
        failures,
    })
}

fn build_input(
    existing: Option<&DeviceCredentialMeta>,
    row: &ImportedCredentialRow,
) -> Result<DeviceCredentialInput> {
    let username = row
        .login_username
        .clone()
        .or_else(|| existing.map(|item| item.username.clone()))
        .ok_or_else(|| anyhow!("login_username is required for new credentials"))?;
    if existing.is_none() && row.login_secret.is_none() {
        return Err(anyhow!("login_secret is required for new credentials"));
    }

    let enable_enabled = row.enable_enabled.unwrap_or(row.enable_secret.is_some());

    Ok(DeviceCredentialInput {
        name: row.name.clone(),
        username,
        password: row.login_secret.clone(),
        enable_password: row.enable_secret.clone(),
        enable_enabled,
    })
}

fn parse_csv(file_name: &str, bytes: &[u8]) -> Result<ParsedRows> {
    let mut reader = csv::ReaderBuilder::new().flexible(true).from_reader(bytes);
    let headers = reader
        .headers()
        .with_context(|| format!("failed to read CSV header from '{}'", file_name))?
        .iter()
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    let mapping = build_header_mapping(&headers)?;
    let mut parsed = ParsedRows::default();
    let mut seen_names = HashSet::new();
    for (record_index, record) in reader.records().enumerate() {
        let row_number = record_index + 2;
        let record = record.with_context(|| {
            format!("failed to read CSV row {} from '{}'", row_number, file_name)
        })?;
        let values = record.iter().map(ToOwned::to_owned).collect::<Vec<_>>();
        parse_values(row_number, &mapping, &values, &mut seen_names, &mut parsed);
    }
    Ok(parsed)
}

fn parse_excel(file_name: &str, bytes: &[u8]) -> Result<ParsedRows> {
    let cursor = Cursor::new(bytes.to_vec());
    let mut workbook = open_workbook_auto_from_rs(cursor)
        .with_context(|| format!("failed to open Excel file '{}'", file_name))?;
    let mut last_error = None;

    for sheet_name in workbook.sheet_names().to_owned() {
        let range = match workbook.worksheet_range(&sheet_name) {
            Ok(range) => range,
            Err(error) => {
                last_error = Some(anyhow!(
                    "failed to read worksheet '{}': {}",
                    sheet_name,
                    error
                ));
                continue;
            }
        };
        let Some((header_index, headers)) = range
            .rows()
            .enumerate()
            .map(|(index, row)| (index, row.iter().map(cell_to_string).collect::<Vec<_>>()))
            .find(|(_, values)| !row_is_blank(values))
        else {
            continue;
        };
        let mapping = build_header_mapping(&headers)?;
        let mut parsed = ParsedRows::default();
        let mut seen_names = HashSet::new();
        for (row_index, row) in range.rows().enumerate().skip(header_index + 1) {
            let values = row.iter().map(cell_to_string).collect::<Vec<_>>();
            parse_values(
                row_index + 1,
                &mapping,
                &values,
                &mut seen_names,
                &mut parsed,
            );
        }
        return Ok(parsed);
    }

    Err(last_error.unwrap_or_else(|| anyhow!("no readable worksheet found in '{}'", file_name)))
}

fn parse_values(
    row_number: usize,
    mapping: &HashMap<usize, ColumnKey>,
    values: &[String],
    seen_names: &mut HashSet<String>,
    parsed: &mut ParsedRows,
) {
    if row_is_blank(values) {
        return;
    }
    match parse_row(row_number, mapping, values, seen_names) {
        Ok(row) => parsed.rows.push(row),
        Err(error) => parsed.failures.push(DeviceCredentialImportFailure {
            row: row_number,
            name: None,
            message: error.to_string(),
        }),
    }
}

fn build_header_mapping(headers: &[String]) -> Result<HashMap<usize, ColumnKey>> {
    let mapping = headers
        .iter()
        .enumerate()
        .filter_map(|(index, header)| map_header(header).map(|key| (index, key)))
        .collect::<HashMap<_, _>>();
    if !mapping.values().any(|key| *key == ColumnKey::Name) {
        return Err(anyhow!(
            "credential import file must include a recognizable name or credential_name header"
        ));
    }
    Ok(mapping)
}

fn parse_row(
    row_number: usize,
    mapping: &HashMap<usize, ColumnKey>,
    values: &[String],
    seen_names: &mut HashSet<String>,
) -> Result<ImportedCredentialRow> {
    let mut name = None;
    let mut login_username = None;
    let mut login_secret = None;
    let mut enable_secret = None;
    let mut enable_enabled = None;

    for (index, key) in mapping {
        let raw = values.get(*index).map(String::as_str).unwrap_or_default();
        match key {
            ColumnKey::Name => name = normalize_text(raw),
            ColumnKey::LoginUsername => login_username = normalize_text(raw),
            ColumnKey::LoginSecret => login_secret = normalize_text(raw),
            ColumnKey::EnableSecret => enable_secret = normalize_text(raw),
            ColumnKey::EnableEnabled => {
                enable_enabled = parse_optional_bool(raw).with_context(|| {
                    format!("row {} has invalid enable_enabled value", row_number)
                })?
            }
        }
    }

    let name = name.ok_or_else(|| anyhow!("row {} is missing credential name", row_number))?;
    if !seen_names.insert(name.clone()) {
        return Err(anyhow!(
            "row {} contains duplicated credential name '{}'",
            row_number,
            name
        ));
    }
    if enable_secret.is_some() && enable_enabled == Some(false) {
        return Err(anyhow!(
            "row {} cannot provide enable_secret when enable_enabled is false",
            row_number
        ));
    }

    Ok(ImportedCredentialRow {
        row: row_number,
        name,
        login_username,
        login_secret,
        enable_secret,
        enable_enabled,
    })
}

fn detect_format(file_name: &str) -> Result<ImportFormat> {
    let lower = file_name.trim().to_ascii_lowercase();
    if lower.ends_with(".csv") {
        return Ok(ImportFormat::Csv);
    }
    if lower.ends_with(".xlsx")
        || lower.ends_with(".xls")
        || lower.ends_with(".xlsm")
        || lower.ends_with(".xlsb")
    {
        return Ok(ImportFormat::Excel);
    }
    Err(anyhow!(
        "unsupported credential import file '{}'; use .csv, .xlsx, .xls, .xlsm, or .xlsb",
        file_name
    ))
}

fn map_header(header: &str) -> Option<ColumnKey> {
    match normalize_header(header).as_str() {
        "name" | "credentialname" | "devicecredential" | "凭证名称" | "设备凭证" | "名称" => {
            Some(ColumnKey::Name)
        }
        "loginusername" | "loginuser" | "sshusername" | "登录用户名" | "ssh用户名" | "用户名" => {
            Some(ColumnKey::LoginUsername)
        }
        "loginsecret" | "loginpassword" | "登录密钥" | "登录密码" => {
            Some(ColumnKey::LoginSecret)
        }
        "enablesecret" | "enablepassword" | "enable密钥" | "enable密码" => {
            Some(ColumnKey::EnableSecret)
        }
        "enableenabled" | "enable" | "useenable" | "启用enable" | "是否启用enable" => {
            Some(ColumnKey::EnableEnabled)
        }
        _ => None,
    }
}

fn normalize_header(header: &str) -> String {
    header
        .trim()
        .trim_start_matches('\u{feff}')
        .to_lowercase()
        .chars()
        .filter(|ch| {
            !matches!(
                ch,
                ' ' | '_' | '-' | '.' | '/' | '\\' | '(' | ')' | '[' | ']'
            )
        })
        .collect()
}

fn normalize_text(value: &str) -> Option<String> {
    let value = value.trim();
    (!value.is_empty()).then(|| value.to_string())
}

fn parse_optional_bool(raw: &str) -> Result<Option<bool>> {
    let value = raw.trim().to_lowercase();
    if value.is_empty() {
        return Ok(None);
    }
    match value.as_str() {
        "true" | "1" | "yes" | "y" | "是" => Ok(Some(true)),
        "false" | "0" | "no" | "n" | "否" => Ok(Some(false)),
        _ => Err(anyhow!("expected true/false, 1/0, yes/no, or 是/否")),
    }
}

fn row_is_blank(values: &[String]) -> bool {
    values.iter().all(|value| value.trim().is_empty())
}

fn cell_to_string(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        _ => cell.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_xlsxwriter::Workbook;

    #[test]
    fn recognizes_english_and_chinese_credential_headers() {
        let english = build_header_mapping(&[
            "credential_name".to_string(),
            "login_username".to_string(),
            "login_secret".to_string(),
        ])
        .expect("English headers should parse");
        assert_eq!(english.get(&0), Some(&ColumnKey::Name));
        assert_eq!(english.get(&1), Some(&ColumnKey::LoginUsername));
        assert_eq!(english.get(&2), Some(&ColumnKey::LoginSecret));

        let chinese = build_header_mapping(&[
            "凭证名称".to_string(),
            "登录用户名".to_string(),
            "启用 Enable".to_string(),
        ])
        .expect("Chinese headers should parse");
        assert_eq!(chinese.get(&0), Some(&ColumnKey::Name));
        assert_eq!(chinese.get(&1), Some(&ColumnKey::LoginUsername));
        assert_eq!(chinese.get(&2), Some(&ColumnKey::EnableEnabled));
    }

    #[test]
    fn parses_credential_rows_without_exposing_secrets_in_reports() {
        let report = parse_csv(
            "credentials.csv",
            b"name,login_username,login_secret,enable_enabled\nops,admin,secret,yes\nops,other,second,no\n",
        )
        .expect("CSV should parse");
        assert_eq!(report.rows.len(), 1);
        assert_eq!(report.rows[0].name, "ops");
        assert_eq!(report.rows[0].enable_enabled, Some(true));
        assert_eq!(report.failures.len(), 1);
        assert!(!report.failures[0].message.contains("secret"));
    }

    #[test]
    fn rejects_enable_secret_when_enable_is_disabled() {
        let mapping = build_header_mapping(&[
            "name".to_string(),
            "enable_secret".to_string(),
            "enable_enabled".to_string(),
        ])
        .expect("headers should parse");
        let error = parse_row(
            2,
            &mapping,
            &["ops".to_string(), "secret".to_string(), "false".to_string()],
            &mut HashSet::new(),
        )
        .err()
        .expect("conflicting modes should fail");
        assert!(error.to_string().contains("cannot provide"));
    }

    #[test]
    fn parses_excel_credential_rows() -> Result<()> {
        let mut workbook = Workbook::new();
        let worksheet = workbook.add_worksheet();
        worksheet.write_string(0, 0, "name")?;
        worksheet.write_string(0, 1, "login_username")?;
        worksheet.write_string(0, 2, "login_secret")?;
        worksheet.write_string(1, 0, "network-admin")?;
        worksheet.write_string(1, 1, "admin")?;
        worksheet.write_string(1, 2, "login-secret")?;
        let bytes = workbook.save_to_buffer()?;

        let parsed = parse_excel("credentials.xlsx", &bytes)?;
        assert_eq!(parsed.rows.len(), 1);
        assert_eq!(parsed.rows[0].name, "network-admin");
        assert_eq!(parsed.rows[0].login_username.as_deref(), Some("admin"));
        assert!(parsed.failures.is_empty());
        Ok(())
    }

    #[test]
    fn update_input_preserves_login_values_and_disables_blank_enable_stage() {
        let existing = DeviceCredentialMeta {
            id: "cred-1".to_string(),
            name: "ops".to_string(),
            username: "admin".to_string(),
            has_password: true,
            has_enable_password: true,
            enable_enabled: true,
            connection_count: 0,
        };
        let input = build_input(
            Some(&existing),
            &ImportedCredentialRow {
                row: 2,
                name: "ops".to_string(),
                login_username: None,
                login_secret: None,
                enable_secret: None,
                enable_enabled: None,
            },
        )
        .expect("existing fields should be preserved");
        assert_eq!(input.username, "admin");
        assert_eq!(input.password, None);
        assert_eq!(input.enable_password, None);
        assert!(!input.enable_enabled);
    }
}
