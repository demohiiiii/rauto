use crate::config::connection_store::{self, SavedConnection};
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::ssh_security::SshSecurityProfile;
use anyhow::{Context, Result, anyhow};
use calamine::{Data, Reader, open_workbook_auto_from_rs};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Cursor;
use std::path::Path;

mod parsing;
use self::parsing::{ImportFormat, detect_format, parse_csv, parse_excel};

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
    ConnectTimeoutSecs,
    EnablePassword,
    SshSecurity,
    LinuxShellFlavor,
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
        password_ref: if incoming_password.is_some() {
            None
        } else {
            existing.and_then(|item| item.password_ref.clone())
        },
        port: incoming
            .port
            .or_else(|| existing.and_then(|item| item.port)),
        connect_timeout_secs: incoming
            .connect_timeout_secs
            .or_else(|| existing.and_then(|item| item.connect_timeout_secs)),
        enable_password: incoming.enable_password,
        enable_password_ref: if incoming_enable_password.is_some() {
            None
        } else {
            existing.and_then(|item| item.enable_password_ref.clone())
        },
        enable_password_empty_enter: incoming.enable_password_empty_enter
            || existing.is_some_and(|item| item.enable_password_empty_enter),
        ssh_security: incoming
            .ssh_security
            .or_else(|| existing.and_then(|item| item.ssh_security)),
        linux_shell_flavor: incoming
            .linux_shell_flavor
            .or_else(|| existing.and_then(|item| item.linux_shell_flavor)),
        device_profile: incoming
            .device_profile
            .or_else(|| existing.and_then(|item| item.device_profile.clone())),
        template_dir: incoming
            .template_dir
            .or_else(|| existing.and_then(|item| item.template_dir.clone())),
        enabled: incoming.enabled,
        labels: if incoming.labels.is_empty() {
            existing.map(|item| item.labels.clone()).unwrap_or_default()
        } else {
            incoming.labels
        },
        vars: if incoming.vars.is_object()
            && incoming.vars.as_object().is_none_or(|map| map.is_empty())
        {
            existing
                .map(|item| item.vars.clone())
                .unwrap_or_else(|| serde_json::json!({}))
        } else {
            incoming.vars
        },
        groups: if incoming.groups.is_empty() {
            existing.map(|item| item.groups.clone()).unwrap_or_default()
        } else {
            incoming.groups
        },
    }
}

#[cfg(test)]
mod tests {
    use super::parsing::{build_header_mapping, derive_connection_name, parse_row};
    use super::{ColumnKey, merge_with_existing};
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
    fn connection_timeout_header_and_value_are_parsed() {
        let mapping =
            build_header_mapping(&["host".to_string(), "connect_timeout_secs".to_string()])
                .expect("headers should be recognized");
        assert_eq!(mapping.get(&1), Some(&ColumnKey::ConnectTimeoutSecs));

        let row = parse_row(
            2,
            &mapping,
            &["10.0.0.2".to_string(), "45".to_string()],
            &mut HashSet::new(),
        )
        .expect("row parses")
        .expect("row exists");
        assert_eq!(row.connection.connect_timeout_secs, Some(45));
    }

    #[test]
    fn zero_connection_timeout_is_rejected() {
        let mapping =
            build_header_mapping(&["host".to_string(), "connect_timeout_secs".to_string()])
                .expect("headers should be recognized");
        let error = parse_row(
            2,
            &mapping,
            &["10.0.0.3".to_string(), "0".to_string()],
            &mut HashSet::new(),
        )
        .expect_err("zero timeout should be rejected");
        assert!(error.to_string().contains("invalid connect_timeout_secs"));
    }

    #[test]
    fn host_can_derive_safe_connection_name() {
        assert_eq!(
            derive_connection_name("192.0.2.10").expect("derived name"),
            "192-0-2-10"
        );
    }

    #[test]
    fn merge_preserves_existing_secret_refs_when_missing_in_import() {
        let existing = SavedConnection {
            host: Some("192.0.2.1".to_string()),
            username: Some("admin".to_string()),
            password: None,
            password_ref: Some("enc:v1:AAAA".to_string()),
            port: Some(22),
            connect_timeout_secs: Some(30),
            enable_password: None,
            enable_password_ref: Some("enc:v1:BBBB".to_string()),
            enable_password_empty_enter: false,
            ssh_security: Some(SshSecurityProfile::Balanced),
            linux_shell_flavor: None,
            device_profile: Some("cisco".to_string()),
            template_dir: None,
            enabled: true,
            labels: vec!["edge".to_string()],
            vars: serde_json::json!({"site":"lab-a"}),
            groups: vec!["core".to_string()],
        };
        let merged = merge_with_existing(
            Some(&existing),
            SavedConnection {
                host: None,
                username: Some("ops".to_string()),
                password: None,
                password_ref: None,
                port: None,
                connect_timeout_secs: None,
                enable_password: None,
                enable_password_ref: None,
                enable_password_empty_enter: false,
                ssh_security: None,
                linux_shell_flavor: None,
                device_profile: None,
                template_dir: None,
                enabled: true,
                labels: vec![],
                vars: serde_json::json!({}),
                groups: vec![],
            },
        );
        assert_eq!(merged.username.as_deref(), Some("ops"));
        assert_eq!(merged.password_ref.as_deref(), Some("enc:v1:AAAA"));
        assert_eq!(merged.enable_password_ref.as_deref(), Some("enc:v1:BBBB"));
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
