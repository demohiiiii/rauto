use crate::config::connection_store::{self, SavedConnection};
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::ssh_security::SshSecurityProfile;
use anyhow::{Context, Result, anyhow};
use calamine::{Data, Reader, open_workbook_auto_from_rs};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Cursor;
use std::path::Path;

mod parsing;
use self::parsing::{ImportFormat, detect_format, parse_csv, parse_excel};

pub use crate::domain::connection::{ConnectionImportFailure, ConnectionImportReport};

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
    Credential,
    Port,
    ConnectTimeoutSecs,
    DeviceModel,
    SoftwareVersion,
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

pub fn import_connections_from_web_bytes(
    file_name: &str,
    bytes: &[u8],
) -> Result<ConnectionImportReport> {
    let mut parsed = match detect_format(file_name)? {
        ImportFormat::Csv => parse_csv(file_name, bytes)?,
        ImportFormat::Excel => parse_excel(file_name, bytes)?,
    };
    let mut accepted = Vec::with_capacity(parsed.rows.len());
    for row in parsed.rows {
        if row.connection.template_dir.is_some() {
            parsed.failures.push(ConnectionImportFailure {
                row: row.row,
                name: Some(row.name),
                message: "template_dir is not supported by Web imports".to_string(),
            });
        } else {
            accepted.push(row);
        }
    }
    parsed.rows = accepted;
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
        if merged.credential_id.is_none() {
            failures.push(ConnectionImportFailure {
                row: row.row,
                name: Some(row.name),
                message: "credential is required for imported connections".to_string(),
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
    SavedConnection {
        credential_id: incoming
            .credential_id
            .or_else(|| existing.and_then(|item| item.credential_id.clone())),
        host: incoming
            .host
            .or_else(|| existing.and_then(|item| item.host.clone())),
        port: incoming
            .port
            .or_else(|| existing.and_then(|item| item.port)),
        connect_timeout_secs: incoming
            .connect_timeout_secs
            .or_else(|| existing.and_then(|item| item.connect_timeout_secs)),
        device_model: incoming
            .device_model
            .or_else(|| existing.and_then(|item| item.device_model.clone())),
        software_version: incoming
            .software_version
            .or_else(|| existing.and_then(|item| item.software_version.clone())),
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
    use super::parsing::{
        build_header_mapping, derive_connection_name, parse_row, resolve_credential_id,
    };
    use super::{ColumnKey, import_connections_from_web_bytes, merge_with_existing};
    use crate::config::connection_store::SavedConnection;
    use crate::config::ssh_security::SshSecurityProfile;
    use std::collections::{HashMap, HashSet};

    #[test]
    fn header_aliases_are_recognized() {
        let mapping = build_header_mapping(&[
            "设备名".to_string(),
            "IP地址".to_string(),
            "设备凭证".to_string(),
        ])
        .expect("headers should be recognized");
        assert_eq!(mapping.get(&0), Some(&ColumnKey::Name));
        assert_eq!(mapping.get(&1), Some(&ColumnKey::Host));
        assert_eq!(mapping.get(&2), Some(&ColumnKey::Credential));
    }

    #[test]
    fn credential_name_resolves_to_existing_credential_id() {
        let id = resolve_credential_id(" network-admin ", 2, |name| {
            assert_eq!(name, "network-admin");
            Ok("credential-1".to_string())
        })
        .expect("known credential should resolve");

        assert_eq!(id.as_deref(), Some("credential-1"));
    }

    #[test]
    fn unknown_credential_name_is_rejected_with_row_context() {
        let error = resolve_credential_id("missing", 7, |_| {
            Err(anyhow::anyhow!("credential not found"))
        })
        .expect_err("unknown credentials must fail import parsing");

        assert!(error.to_string().contains("row 7"));
        assert!(error.to_string().contains("unknown credential"));
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
    fn device_fact_headers_and_values_are_parsed() {
        let mapping = build_header_mapping(&[
            "host".to_string(),
            "device_model".to_string(),
            "software_version".to_string(),
        ])
        .expect("headers should be recognized");
        assert_eq!(mapping.get(&1), Some(&ColumnKey::DeviceModel));
        assert_eq!(mapping.get(&2), Some(&ColumnKey::SoftwareVersion));

        let row = parse_row(
            2,
            &mapping,
            &[
                "10.0.0.2".to_string(),
                "WS-C2960X-48FPS-L".to_string(),
                "15.2(7)E10".to_string(),
            ],
            &mut HashSet::new(),
        )
        .expect("row parses")
        .expect("row exists");
        assert_eq!(
            row.connection.device_model.as_deref(),
            Some("WS-C2960X-48FPS-L")
        );
        assert_eq!(
            row.connection.software_version.as_deref(),
            Some("15.2(7)E10")
        );
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
    fn merge_preserves_existing_credential_when_missing_in_import() {
        let existing = SavedConnection {
            credential_id: Some("cred-existing".to_string()),
            host: Some("192.0.2.1".to_string()),
            port: Some(22),
            connect_timeout_secs: Some(30),
            device_model: Some("C9300-48P".to_string()),
            software_version: Some("17.9.5".to_string()),
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
                credential_id: None,
                host: None,
                port: None,
                connect_timeout_secs: None,
                device_model: None,
                software_version: None,
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
        assert_eq!(merged.credential_id.as_deref(), Some("cred-existing"));
        assert_eq!(merged.host.as_deref(), Some("192.0.2.1"));
        assert_eq!(merged.device_model.as_deref(), Some("C9300-48P"));
        assert_eq!(merged.software_version.as_deref(), Some("17.9.5"));
    }

    #[test]
    fn parse_row_can_derive_name_from_host() {
        let mut mapping = HashMap::new();
        mapping.insert(0, ColumnKey::Host);
        let row = parse_row(2, &mapping, &["10.0.0.1".to_string()], &mut HashSet::new())
            .expect("row parses")
            .expect("row exists");
        assert_eq!(row.name, "10-0-0-1");
    }

    #[test]
    fn web_import_rejects_server_template_directories() {
        let report = import_connections_from_web_bytes(
            "connections.csv",
            b"name,host,template_dir\nedge,192.0.2.10,/etc\n",
        )
        .expect("Web import should return a row failure");

        assert_eq!(report.imported, 0);
        assert_eq!(report.failed, 1);
        assert!(report.failures[0].message.contains("template_dir"));
    }
}
