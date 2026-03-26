use crate::config::connection_store::{self, SavedConnection};
use crate::config::ssh_security::SshSecurityProfile;
use anyhow::{Context, Result, anyhow};
use calamine::{Data, Reader, open_workbook_auto_from_rs};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Cursor;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionImportFailure {
    pub row: usize,
    pub name: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionImportReport {
    pub file_name: String,
    pub total_rows: usize,
    pub imported: usize,
    pub created: usize,
    pub updated: usize,
    pub failed: usize,
    pub failures: Vec<ConnectionImportFailure>,
}

#[derive(Debug, Clone)]
struct ImportedConnectionRow {
    row: usize,
    name: String,
    connection: SavedConnection,
}

#[derive(Debug, Default)]
struct ParsedRows {
    rows: Vec<ImportedConnectionRow>,
    failures: Vec<ConnectionImportFailure>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum ColumnKey {
    Name,
    Host,
    Username,
    Password,
    Port,
    EnablePassword,
    SshSecurity,
    DeviceProfile,
    TemplateDir,
}

pub fn import_connections_from_path(path: &Path) -> Result<ConnectionImportReport> {
    let bytes = fs::read(path)
        .with_context(|| format!("failed to read import file '{}'", path.display()))?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| anyhow!("import file name is invalid"))?;
    import_connections_from_bytes(file_name, &bytes)
}

pub fn import_connections_from_bytes(
    file_name: &str,
    bytes: &[u8],
) -> Result<ConnectionImportReport> {
    let parsed = match detect_format(file_name)? {
        ImportFormat::Csv => parse_csv(file_name, bytes)?,
        ImportFormat::Excel => parse_excel(file_name, bytes)?,
    };
    apply_import_rows(file_name, parsed)
}

fn apply_import_rows(file_name: &str, parsed: ParsedRows) -> Result<ConnectionImportReport> {
    let total_rows = parsed.rows.len() + parsed.failures.len();
    let mut created = 0usize;
    let mut updated = 0usize;
    let mut imported = 0usize;
    let mut failures = parsed.failures;

    for row in parsed.rows {
        let existing = connection_store::load_connection_raw(&row.name).ok();
        let merged = merge_with_existing(existing.as_ref(), row.connection);
        if merged
            .host
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .is_none()
        {
            failures.push(ConnectionImportFailure {
                row: row.row,
                name: Some(row.name),
                message: "host is required for new connections or must already exist".to_string(),
            });
            continue;
        }

        match connection_store::save_connection(&row.name, &merged) {
            Ok(_) => {
                imported += 1;
                if existing.is_some() {
                    updated += 1;
                } else {
                    created += 1;
                }
            }
            Err(err) => failures.push(ConnectionImportFailure {
                row: row.row,
                name: Some(row.name),
                message: err.to_string(),
            }),
        }
    }

    Ok(ConnectionImportReport {
        file_name: file_name.to_string(),
        total_rows,
        imported,
        created,
        updated,
        failed: failures.len(),
        failures,
    })
}

fn merge_with_existing(
    existing: Option<&SavedConnection>,
    incoming: SavedConnection,
) -> SavedConnection {
    let incoming_password = incoming.password.clone();
    let incoming_enable_password = incoming.enable_password.clone();
    SavedConnection {
        host: incoming
            .host
            .or_else(|| existing.and_then(|item| item.host.clone())),
        username: incoming
            .username
            .or_else(|| existing.and_then(|item| item.username.clone())),
        password: incoming.password,
        password_encrypted: if incoming_password.is_some() {
            None
        } else {
            incoming
                .password_encrypted
                .or_else(|| existing.and_then(|item| item.password_encrypted.clone()))
        },
        port: incoming
            .port
            .or_else(|| existing.and_then(|item| item.port)),
        enable_password: incoming.enable_password,
        enable_password_encrypted: if incoming_enable_password.is_some() {
            None
        } else {
            incoming
                .enable_password_encrypted
                .or_else(|| existing.and_then(|item| item.enable_password_encrypted.clone()))
        },
        ssh_security: incoming
            .ssh_security
            .or_else(|| existing.and_then(|item| item.ssh_security)),
        device_profile: incoming
            .device_profile
            .or_else(|| existing.and_then(|item| item.device_profile.clone())),
        template_dir: incoming
            .template_dir
            .or_else(|| existing.and_then(|item| item.template_dir.clone())),
    }
}

fn parse_csv(file_name: &str, bytes: &[u8]) -> Result<ParsedRows> {
    let mut reader = csv::ReaderBuilder::new().flexible(true).from_reader(bytes);
    let headers = reader
        .headers()
        .with_context(|| format!("failed to read CSV header from '{}'", file_name))?
        .iter()
        .map(|item| item.to_string())
        .collect::<Vec<_>>();
    let mapping = build_header_mapping(&headers)?;
    let mut rows = Vec::new();
    let mut failures = Vec::new();
    let mut seen_names = HashSet::new();
    for (record_index, record) in reader.records().enumerate() {
        let record = record.with_context(|| {
            format!(
                "failed to read CSV row {} from '{}'",
                record_index + 2,
                file_name
            )
        })?;
        let values = record
            .iter()
            .map(|item| item.to_string())
            .collect::<Vec<_>>();
        if row_is_blank(&values) {
            continue;
        }
        match parse_row(record_index + 2, &mapping, &values, &mut seen_names) {
            Ok(Some(row)) => rows.push(row),
            Ok(None) => {}
            Err(err) => failures.push(ConnectionImportFailure {
                row: record_index + 2,
                name: None,
                message: err.to_string(),
            }),
        }
    }
    Ok(ParsedRows { rows, failures })
}

fn parse_excel(file_name: &str, bytes: &[u8]) -> Result<ParsedRows> {
    let cursor = Cursor::new(bytes.to_vec());
    let mut workbook = open_workbook_auto_from_rs(cursor)
        .with_context(|| format!("failed to open Excel file '{}'", file_name))?;
    let mut last_error = None;

    for sheet_name in workbook.sheet_names().to_owned() {
        let range = match workbook.worksheet_range(&sheet_name) {
            Ok(range) => range,
            Err(err) => {
                last_error = Some(anyhow!(
                    "failed to read worksheet '{}': {}",
                    sheet_name,
                    err
                ));
                continue;
            }
        };
        let mut header_row = None;
        for (row_index, row) in range.rows().enumerate() {
            let values = row.iter().map(cell_to_string).collect::<Vec<_>>();
            if row_is_blank(&values) {
                continue;
            }
            header_row = Some((row_index, values));
            break;
        }
        let Some((header_index, headers)) = header_row else {
            continue;
        };
        let mapping = build_header_mapping(&headers)?;
        let mut seen_names = HashSet::new();
        let mut rows = Vec::new();
        let mut failures = Vec::new();
        for (row_index, row) in range.rows().enumerate().skip(header_index + 1) {
            let values = row.iter().map(cell_to_string).collect::<Vec<_>>();
            if row_is_blank(&values) {
                continue;
            }
            match parse_row(row_index + 1, &mapping, &values, &mut seen_names) {
                Ok(Some(import_row)) => rows.push(import_row),
                Ok(None) => {}
                Err(err) => failures.push(ConnectionImportFailure {
                    row: row_index + 1,
                    name: None,
                    message: err.to_string(),
                }),
            }
        }
        return Ok(ParsedRows { rows, failures });
    }

    Err(last_error.unwrap_or_else(|| anyhow!("no readable worksheet found in '{}'", file_name)))
}

fn build_header_mapping(headers: &[String]) -> Result<HashMap<usize, ColumnKey>> {
    let mut mapping = HashMap::new();
    for (index, header) in headers.iter().enumerate() {
        if let Some(key) = map_header(header) {
            mapping.insert(index, key);
        }
    }
    if mapping.is_empty() {
        return Err(anyhow!(
            "import file must include recognizable headers such as name/host/username/password/device_profile"
        ));
    }
    if !mapping
        .values()
        .any(|value| matches!(value, ColumnKey::Name | ColumnKey::Host))
    {
        return Err(anyhow!(
            "import file must include at least one of: name, connection_name, host, ip"
        ));
    }
    Ok(mapping)
}

fn parse_row(
    row_number: usize,
    mapping: &HashMap<usize, ColumnKey>,
    values: &[String],
    seen_names: &mut HashSet<String>,
) -> Result<Option<ImportedConnectionRow>> {
    let mut name = None;
    let mut host = None;
    let mut username = None;
    let mut password = None;
    let mut port = None;
    let mut enable_password = None;
    let mut ssh_security = None;
    let mut device_profile = None;
    let mut template_dir = None;

    for (index, key) in mapping {
        let raw = values
            .get(*index)
            .map(|item| item.as_str())
            .unwrap_or_default();
        match key {
            ColumnKey::Name => name = normalize_text(raw),
            ColumnKey::Host => host = normalize_text(raw),
            ColumnKey::Username => username = normalize_text(raw),
            ColumnKey::Password => password = normalize_secret(raw),
            ColumnKey::Port => {
                port = parse_port(raw)
                    .with_context(|| format!("row {} has invalid port '{}'", row_number, raw))?
            }
            ColumnKey::EnablePassword => enable_password = normalize_secret(raw),
            ColumnKey::SshSecurity => {
                ssh_security = parse_ssh_security(raw).with_context(|| {
                    format!("row {} has invalid ssh_security '{}'", row_number, raw)
                })?
            }
            ColumnKey::DeviceProfile => device_profile = normalize_text(raw),
            ColumnKey::TemplateDir => template_dir = normalize_text(raw),
        }
    }

    if name.is_none() && host.is_none() && username.is_none() && password.is_none() {
        return Ok(None);
    }

    let resolved_name = if let Some(explicit_name) = name {
        connection_store::safe_connection_name(&explicit_name)?
    } else if let Some(ref host_value) = host {
        derive_connection_name(host_value)?
    } else {
        return Err(anyhow!("row {} is missing both name and host", row_number));
    };

    if !seen_names.insert(resolved_name.clone()) {
        return Err(anyhow!(
            "row {} resolves to duplicated connection name '{}'",
            row_number,
            resolved_name
        ));
    }

    Ok(Some(ImportedConnectionRow {
        row: row_number,
        name: resolved_name,
        connection: SavedConnection {
            host,
            username,
            password,
            password_encrypted: None,
            port,
            enable_password,
            enable_password_encrypted: None,
            ssh_security,
            device_profile,
            template_dir,
        },
    }))
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
        "unsupported import file '{}'; use .csv, .xlsx, .xls, .xlsm, or .xlsb",
        file_name
    ))
}

fn map_header(header: &str) -> Option<ColumnKey> {
    let normalized = normalize_header(header);
    match normalized.as_str() {
        "name" | "connectionname" | "connection" | "devicename" | "alias" | "名称" | "连接名"
        | "设备名" | "设备名称" => Some(ColumnKey::Name),
        "host" | "hostname" | "ip" | "ipaddress" | "address" | "hostip" | "主机" | "主机地址"
        | "地址" | "ip地址" | "管理ip" | "管理地址" => Some(ColumnKey::Host),
        "username" | "user" | "login" | "用户名" | "用户" | "登录用户" => {
            Some(ColumnKey::Username)
        }
        "password" | "pass" | "passwd" | "密码" | "登录密码" => Some(ColumnKey::Password),
        "port" | "端口" => Some(ColumnKey::Port),
        "enablepassword" | "enablepass" | "enablepasswd" | "privilegepassword"
        | "privilegedpassword" | "特权密码" | "enable密码" => Some(ColumnKey::EnablePassword),
        "sshsecurity" | "security" | "securityprofile" | "ssh安全" | "ssh安全级别" | "安全级别" => {
            Some(ColumnKey::SshSecurity)
        }
        "deviceprofile" | "profile" | "templateprofile" | "设备模板" | "设备类型" => {
            Some(ColumnKey::DeviceProfile)
        }
        "templatedir" | "templatepath" | "模板目录" | "模板路径" => {
            Some(ColumnKey::TemplateDir)
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
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn normalize_secret(value: &str) -> Option<String> {
    if value.trim().is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn parse_port(raw: &str) -> Result<Option<u16>> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let parsed = trimmed.parse::<u16>()?;
    Ok(Some(parsed))
}

fn parse_ssh_security(raw: &str) -> Result<Option<SshSecurityProfile>> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    match trimmed.to_ascii_lowercase().as_str() {
        "secure" => Ok(Some(SshSecurityProfile::Secure)),
        "balanced" => Ok(Some(SshSecurityProfile::Balanced)),
        "legacy-compatible" | "legacycompatible" | "legacy" => {
            Ok(Some(SshSecurityProfile::LegacyCompatible))
        }
        other => Err(anyhow!(
            "expected secure, balanced, or legacy-compatible, got '{}'",
            other
        )),
    }
}

fn derive_connection_name(host: &str) -> Result<String> {
    let mut normalized = host
        .trim()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>();
    while normalized.contains("--") {
        normalized = normalized.replace("--", "-");
    }
    let normalized = normalized.trim_matches('-');
    if normalized.is_empty() {
        return Err(anyhow!(
            "unable to derive a valid connection name from host '{}'",
            host
        ));
    }
    connection_store::safe_connection_name(normalized)
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

enum ImportFormat {
    Csv,
    Excel,
}

#[cfg(test)]
mod tests {
    use super::{
        ColumnKey, build_header_mapping, derive_connection_name, merge_with_existing, parse_row,
    };
    use crate::config::connection_store::SavedConnection;
    use crate::config::ssh_security::SshSecurityProfile;
    use std::collections::{HashMap, HashSet};

    #[test]
    fn header_aliases_are_recognized() {
        let mapping = build_header_mapping(&[
            "设备名".to_string(),
            "IP地址".to_string(),
            "用户名".to_string(),
            "密码".to_string(),
        ])
        .expect("headers should be recognized");
        assert_eq!(mapping.get(&0), Some(&ColumnKey::Name));
        assert_eq!(mapping.get(&1), Some(&ColumnKey::Host));
        assert_eq!(mapping.get(&2), Some(&ColumnKey::Username));
        assert_eq!(mapping.get(&3), Some(&ColumnKey::Password));
    }

    #[test]
    fn host_can_derive_safe_connection_name() {
        assert_eq!(
            derive_connection_name("192.0.2.10").expect("derived name"),
            "192-0-2-10"
        );
    }

    #[test]
    fn merge_preserves_existing_encrypted_secrets_when_missing_in_import() {
        let existing = SavedConnection {
            host: Some("192.0.2.1".to_string()),
            username: Some("admin".to_string()),
            password: None,
            password_encrypted: Some("enc-1".to_string()),
            port: Some(22),
            enable_password: None,
            enable_password_encrypted: Some("enc-2".to_string()),
            ssh_security: Some(SshSecurityProfile::Balanced),
            device_profile: Some("cisco".to_string()),
            template_dir: None,
        };
        let merged = merge_with_existing(
            Some(&existing),
            SavedConnection {
                host: None,
                username: Some("ops".to_string()),
                password: None,
                password_encrypted: None,
                port: None,
                enable_password: None,
                enable_password_encrypted: None,
                ssh_security: None,
                device_profile: None,
                template_dir: None,
            },
        );
        assert_eq!(merged.username.as_deref(), Some("ops"));
        assert_eq!(merged.password_encrypted.as_deref(), Some("enc-1"));
        assert_eq!(merged.enable_password_encrypted.as_deref(), Some("enc-2"));
        assert_eq!(merged.host.as_deref(), Some("192.0.2.1"));
    }

    #[test]
    fn parse_row_can_derive_name_from_host() {
        let mut mapping = HashMap::new();
        mapping.insert(0, ColumnKey::Host);
        mapping.insert(1, ColumnKey::Username);
        let row = parse_row(
            2,
            &mapping,
            &["10.0.0.1".to_string(), "admin".to_string()],
            &mut HashSet::new(),
        )
        .expect("row parses")
        .expect("row exists");
        assert_eq!(row.name, "10-0-0-1");
        assert_eq!(row.connection.username.as_deref(), Some("admin"));
    }
}
