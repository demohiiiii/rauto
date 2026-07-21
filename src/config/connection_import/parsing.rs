use super::*;

pub(super) fn parse_csv(file_name: &str, bytes: &[u8]) -> Result<ParsedRows> {
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

pub(super) fn parse_excel(file_name: &str, bytes: &[u8]) -> Result<ParsedRows> {
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

pub(super) fn build_header_mapping(headers: &[String]) -> Result<HashMap<usize, ColumnKey>> {
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

pub(super) fn parse_row(
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
    let mut connect_timeout_secs = None;
    let mut device_model = None;
    let mut software_version = None;
    let mut enable_password = None;
    let mut ssh_security = None;
    let mut linux_shell_flavor = None;
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
            ColumnKey::ConnectTimeoutSecs => {
                connect_timeout_secs = parse_connect_timeout_secs(raw).with_context(|| {
                    format!(
                        "row {} has invalid connect_timeout_secs '{}'",
                        row_number, raw
                    )
                })?
            }
            ColumnKey::DeviceModel => device_model = normalize_text(raw),
            ColumnKey::SoftwareVersion => software_version = normalize_text(raw),
            ColumnKey::EnablePassword => enable_password = normalize_secret(raw),
            ColumnKey::SshSecurity => {
                ssh_security = parse_ssh_security(raw).with_context(|| {
                    format!("row {} has invalid ssh_security '{}'", row_number, raw)
                })?
            }
            ColumnKey::LinuxShellFlavor => {
                linux_shell_flavor = parse_linux_shell_flavor(raw).with_context(|| {
                    format!(
                        "row {} has invalid linux_shell_flavor '{}'",
                        row_number, raw
                    )
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
            password_ref: None,
            port,
            connect_timeout_secs,
            device_model,
            software_version,
            enable_password,
            enable_password_ref: None,
            enable_password_empty_enter: false,
            ssh_security,
            linux_shell_flavor,
            device_profile,
            template_dir,
            enabled: true,
            labels: vec![],
            vars: serde_json::json!({}),
            groups: vec![],
        },
    }))
}

pub(super) fn detect_format(file_name: &str) -> Result<ImportFormat> {
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
        "connecttimeoutsecs"
        | "connectiontimeoutsecs"
        | "connecttimeout"
        | "connectiontimeout"
        | "连接超时"
        | "连接超时秒" => Some(ColumnKey::ConnectTimeoutSecs),
        "devicemodel" | "model" | "hardware" | "设备型号" | "型号" => {
            Some(ColumnKey::DeviceModel)
        }
        "softwareversion" | "osversion" | "version" | "软件版本" | "系统版本" | "版本" => {
            Some(ColumnKey::SoftwareVersion)
        }
        "enablepassword" | "enablepass" | "enablepasswd" | "privilegepassword"
        | "privilegedpassword" | "特权密码" | "enable密码" => Some(ColumnKey::EnablePassword),
        "sshsecurity" | "security" | "securityprofile" | "ssh安全" | "ssh安全级别" | "安全级别" => {
            Some(ColumnKey::SshSecurity)
        }
        "linuxshellflavor" | "shellflavor" | "linuxshell" | "shell" | "linuxshell类型"
        | "linuxshell风格" | "shell类型" | "shell风格" => Some(ColumnKey::LinuxShellFlavor),
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

fn parse_connect_timeout_secs(raw: &str) -> Result<Option<u64>> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let parsed = trimmed.parse::<u64>()?;
    if parsed == 0 || parsed > i64::MAX as u64 {
        return Err(anyhow!(
            "connection timeout must be between 1 and {} seconds",
            i64::MAX
        ));
    }
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

fn parse_linux_shell_flavor(raw: &str) -> Result<Option<LinuxShellFlavor>> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    Ok(Some(trimmed.parse::<LinuxShellFlavor>()?))
}

pub(super) fn derive_connection_name(host: &str) -> Result<String> {
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

pub(super) enum ImportFormat {
    Csv,
    Excel,
}
