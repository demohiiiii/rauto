use crate::cli::{
    BlacklistCommands, CredentialCommands, DeviceCommands, GlobalOpts, HistoryCommands,
    InventoryCommands, InventoryGroupCommands, ProfileCommands,
};
use crate::config::connection_import::{self, ConnectionImportReport};
use crate::config::connection_store::{
    self, delete_connection, list_connections, load_connection_raw,
};
use crate::config::device_credential_import::{self, DeviceCredentialImportReport};
use crate::config::history_store;
use crate::config::{command_blacklist, content_store, inventory_store, template_loader};
use crate::device::DeviceClient;
use anyhow::{Result, anyhow};
use rneter::session::DetectRequest;
use rneter::session::SessionRecorder;
use rneter::templates::{
    DetectConnectPolicy, DetectFactKind, TemplateDetectCandidate, TemplateDetectFact,
    TemplateDetectReport, autodetect_with_builtin_and_templates_and_context,
};
use serde::Serialize;
use std::io::{self, Write};

fn truncate_autodetect_sample(sample: &str) -> String {
    const MAX_LEN: usize = 160;
    let compact = sample.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut truncated = String::new();
    for ch in compact.chars().take(MAX_LEN) {
        truncated.push(ch);
    }
    if compact.chars().count() > MAX_LEN {
        truncated.push('…');
    }
    truncated
}

fn print_autodetect_fact_summary(fact: &TemplateDetectFact) {
    let sample = truncate_autodetect_sample(&fact.sample);
    println!(
        "  - {:?} from {:?}: command=\"{}\" weight={} pattern=\"{}\" sample=\"{}\"",
        fact.kind, fact.source, fact.command, fact.weight, fact.pattern, sample
    );
}

fn print_autodetect_candidate_summary(
    candidate: &TemplateDetectCandidate,
    policy: DetectConnectPolicy,
) {
    println!(
        "- {}: score={} confidence={:?} accepted={}",
        candidate.template_name,
        candidate.score,
        candidate.confidence,
        candidate
            .confidence
            .satisfies_minimum(policy.minimum_confidence)
    );
    let positive_facts: Vec<_> = candidate
        .matched_facts
        .iter()
        .filter(|fact| fact.kind == DetectFactKind::PositiveMatch)
        .collect();
    if positive_facts.is_empty() {
        println!("  matched_facts: -");
    } else {
        println!("  why:");
        for fact in positive_facts.into_iter().take(3) {
            print_autodetect_fact_summary(fact);
        }
    }
}

fn print_autodetect_report(
    report: &TemplateDetectReport,
    policy: DetectConnectPolicy,
    verbose: u8,
) {
    if let Some(best) = report.best_match.as_ref() {
        println!("best_match: {}", best.template_name);
        println!("confidence: {:?}", best.confidence);
        println!("score: {}", best.score);
        println!(
            "accepted: {}",
            best.confidence.satisfies_minimum(policy.minimum_confidence)
        );
        println!("why:");
        let positive_facts: Vec<_> = best
            .matched_facts
            .iter()
            .filter(|fact| fact.kind == DetectFactKind::PositiveMatch)
            .collect();
        if positive_facts.is_empty() {
            println!("  -");
        } else {
            for fact in positive_facts.into_iter().take(5) {
                print_autodetect_fact_summary(fact);
            }
        }
    } else {
        println!("best_match: -");
        println!("accepted: false");
    }

    if verbose >= 1 {
        println!("candidates:");
        let mut printed = false;
        for candidate in report
            .candidates
            .iter()
            .filter(|candidate| candidate.score > 0 || !candidate.matched_facts.is_empty())
        {
            printed = true;
            print_autodetect_candidate_summary(candidate, policy);
        }
        if !printed {
            println!("-");
        }
    }

    if verbose >= 2 {
        println!("details:\n{:#?}", report);
    }
}

pub(crate) async fn run_profile_command(
    cmd: ProfileCommands,
    global_opts: &GlobalOpts,
) -> Result<()> {
    match cmd {
        ProfileCommands::List => {
            let mut profiles = template_loader::list_available_profiles()?;
            profiles.sort();
            profiles.dedup();
            println!("Available Device Profiles (builtin + custom):");
            for p in profiles {
                println!("- {}", p);
            }
        }
        ProfileCommands::Autodetect { verbose } => {
            let conn = crate::resolve_effective_connection(global_opts)?;
            let request = DetectRequest::new(
                conn.username.clone(),
                conn.host.clone(),
                conn.port,
                conn.password.clone(),
            );
            let context = crate::manager_execution_context_with_security(
                None,
                conn.ssh_security,
                conn.connect_timeout_secs,
            );
            let report = autodetect_with_builtin_and_templates_and_context(
                request,
                context,
                template_loader::custom_detect_template_definitions()?,
            )
            .await?;
            let policy = DetectConnectPolicy::default();
            println!("# device profile autodetect");
            println!("target: {}@{}:{}", conn.username, conn.host, conn.port);
            println!("minimum_confidence: {:?}", policy.minimum_confidence);
            print_autodetect_report(&report, policy, verbose);
        }
        ProfileCommands::Show { name } => {
            if let Some(mut profile) = crate::web::storage::builtin_profile_form(&name) {
                println!("# built-in profile: {}", name);
                println!("# source: rneter built-in");
                profile.name = name.clone();
                println!("{}", toml::to_string_pretty(&profile)?);
                return Ok(());
            }
            if let Some(detail) = crate::web::storage::builtin_profile_detail(&name) {
                println!("# built-in profile: {}", detail.name);
                println!("# source: {}", detail.source);
                println!("# summary: {}", detail.summary);
                if !detail.aliases.is_empty() {
                    println!("# aliases: {}", detail.aliases.join(", "));
                }
                for note in detail.notes {
                    println!("- {}", note);
                }
                return Ok(());
            }

            let safe_name = name.trim().trim_end_matches(".toml");
            let stored = content_store::load_custom_profile(safe_name)?;
            let Some(stored) = stored else {
                return Err(anyhow!("profile '{}' not found", name));
            };
            println!("# custom profile: {}", safe_name);
            println!("# path: {}", stored.locator);
            println!("{}", stored.content);
        }
        ProfileCommands::CopyBuiltin {
            source,
            name,
            overwrite,
        } => {
            let mut profile =
                if let Some(profile) = crate::web::storage::builtin_profile_form(&source) {
                    profile
                } else {
                    let builtin_names = crate::web::storage::builtin_profiles()
                        .into_iter()
                        .map(|profile| profile.name)
                        .collect::<Vec<_>>()
                        .join(", ");
                    return Err(anyhow!(
                        "Built-in profile '{}' not found. Try one of: {}",
                        source,
                        builtin_names
                    ));
                };

            let normalized = name.trim().trim_end_matches(".toml");
            if normalized.is_empty()
                || !normalized
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
            {
                return Err(anyhow!(
                    "Invalid custom profile name '{}'. Use only letters, numbers, '_' or '-'.",
                    name
                ));
            }

            profile.name = normalized.to_string();
            let content = toml::to_string_pretty(&profile)?;
            let exists = content_store::load_custom_profile(normalized)?.is_some();
            if exists && !overwrite {
                return Err(anyhow!(
                    "Target profile already exists: {} (use --overwrite to replace)",
                    normalized
                ));
            }
            if exists {
                content_store::update_custom_profile(normalized, &content)?;
            } else {
                content_store::create_custom_profile(normalized, &content)?;
            }
            println!("Copied built-in profile '{}' to '{}'", source, normalized);
        }
        ProfileCommands::DeleteCustom { name } => {
            let safe_name = name.trim().trim_end_matches(".toml");
            if safe_name.is_empty()
                || !safe_name
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
            {
                return Err(anyhow!(
                    "Invalid custom profile name '{}'. Use only letters, numbers, '_' or '-'.",
                    name
                ));
            }
            let deleted = content_store::delete_custom_profile(safe_name)?;
            if !deleted {
                return Err(anyhow!("Custom profile not found: {}", safe_name));
            }
            println!("Deleted custom profile '{}'", safe_name);
        }
        ProfileCommands::Diagnose { name, json } => {
            let handler = template_loader::load_device_profile(&name)?;
            let report = handler.diagnose_state_machine();

            if json {
                println!("{}", serde_json::to_string_pretty(&report)?);
                return Ok(());
            }

            println!("# profile: {}", name);
            println!("# has_issues: {}", report.has_issues());
            println!("total_states: {}", report.total_states);
            print_list("entry_states", &report.entry_states);
            print_list("missing_edge_sources", &report.missing_edge_sources);
            print_list("missing_edge_targets", &report.missing_edge_targets);
            print_list("unreachable_states", &report.unreachable_states);
            print_list("dead_end_states", &report.dead_end_states);
            print_list(
                "duplicate_prompt_patterns",
                &report.duplicate_prompt_patterns,
            );
            print_list(
                "potentially_ambiguous_prompt_states",
                &report.potentially_ambiguous_prompt_states,
            );
            print_list("self_loop_only_states", &report.self_loop_only_states);
        }
    }

    Ok(())
}

pub(crate) async fn run_device_command(
    cmd: DeviceCommands,
    global_opts: &GlobalOpts,
) -> Result<()> {
    match cmd {
        DeviceCommands::Test => {
            let conn = crate::resolve_autodetect_connection(crate::resolve_effective_connection(
                global_opts,
            )?)
            .await?;
            let handler = template_loader::load_device_profile_for_connection(
                &conn.device_profile,
                conn.linux_shell_flavor,
            )?;
            let default_mode = template_loader::default_profile_mode(&conn.device_profile)?;
            let _client = DeviceClient::connect(
                conn.host.clone(),
                conn.port,
                conn.username.clone(),
                conn.password.clone(),
                conn.enable_password.clone(),
                handler,
                default_mode,
                conn.ssh_security,
                conn.connect_timeout_secs,
            )
            .await?;
            crate::maybe_save_connection_profile(global_opts, &conn)?;
            println!(
                "Connection OK: {}@{}:{} ({}, ssh_security={}, linux_shell_flavor={})",
                conn.username,
                conn.host,
                conn.port,
                conn.device_profile,
                conn.ssh_security,
                conn.linux_shell_flavor
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "-".to_string())
            );
        }
        DeviceCommands::List => {
            let names = list_connections()?;
            if names.is_empty() {
                println!("-");
            } else {
                for name in names {
                    println!("- {}", name);
                }
            }
        }
        DeviceCommands::Show { name } => {
            let safe = connection_store::safe_connection_name(&name)?;
            let data = load_connection_raw(&safe)?;
            let credential_name = data
                .credential_id
                .as_deref()
                .and_then(|id| crate::config::device_credential_store::get_credential(id).ok())
                .map(|item| item.name);
            let output = ConnectionShowOutput {
                host: data.host.clone(),
                credential: credential_name,
                port: data.port,
                ssh_security: data.ssh_security,
                linux_shell_flavor: data.linux_shell_flavor,
                device_profile: data.device_profile.clone(),
                template_dir: data.template_dir.clone(),
                enabled: data.enabled,
                labels: data.labels.clone(),
                groups: data.groups.clone(),
                vars: data.vars.clone(),
                has_password: connection_store::has_saved_password(&data),
                has_enable_password: connection_store::has_saved_enable_password(&data),
            };
            println!("# saved device: {}", safe);
            println!("{}", toml::to_string_pretty(&output)?);
        }
        DeviceCommands::Delete { name } => {
            let deleted = delete_connection(&name)?;
            if deleted {
                println!("Deleted saved device '{}'", name);
            } else {
                println!("Saved device '{}' not found", name);
            }
        }
        DeviceCommands::Add { name } => {
            let conn = crate::resolve_effective_connection(global_opts)?;
            let path = crate::save_named_connection(&name, &conn)?;
            println!("Saved device '{}' to '{}'", name, path.to_string_lossy());
        }
        DeviceCommands::Import { file, json } => {
            let report = connection_import::import_connections_from_path(&file)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&report)?);
            } else {
                print_connection_import_report(&report);
            }
            if report.failed > 0 {
                return Err(anyhow!(
                    "connection import completed with {} failed row(s)",
                    report.failed
                ));
            }
        }
    }

    Ok(())
}

pub(crate) fn run_credential_command(cmd: CredentialCommands) -> Result<()> {
    use crate::config::device_credential_store as credentials;

    match cmd {
        CredentialCommands::List { json } => {
            let items = credentials::list_credentials()?;
            let output = items
                .into_iter()
                .map(|item| CredentialCliOutput::from_meta(item, Vec::new()))
                .collect::<Vec<_>>();
            if json {
                println!("{}", serde_json::to_string_pretty(&output)?);
            } else if output.is_empty() {
                println!("-");
            } else {
                for item in output {
                    println!(
                        "- {} (id={}, username={}, login={}, enable={}, connections={})",
                        item.name,
                        item.id,
                        item.username,
                        secret_presence(item.has_password),
                        enable_presence(&item),
                        item.connection_count
                    );
                }
            }
        }
        CredentialCommands::Show { selector, json } => {
            let item = resolve_credential_selector(&selector)?;
            let references = credentials::referencing_connections(&item.id)?;
            let output = CredentialCliOutput::from_meta(item, references);
            if json {
                println!("{}", serde_json::to_string_pretty(&output)?);
            } else {
                println!("# device credential: {}", output.name);
                println!("{}", toml::to_string_pretty(&output)?);
            }
        }
        CredentialCommands::Add {
            name,
            login_username,
            login_secret,
            enable_secret,
            enable,
            json,
        } => {
            let username =
                value_or_prompt(login_username.map(|value| value.trim().to_string()), || {
                    prompt_required("Login username", None)
                })?;
            let password = value_or_prompt(login_secret, || prompt_secret("Login password", true))?;
            let item = credentials::create_credential(&credentials::DeviceCredentialInput {
                name,
                username,
                password: Some(password),
                enable_enabled: enable || enable_secret.is_some(),
                enable_password: enable_secret,
            })?;
            let output = CredentialCliOutput::from_meta(item, Vec::new());
            if json {
                println!("{}", serde_json::to_string_pretty(&output)?);
            } else {
                println!("Added device credential '{}'", output.name);
            }
        }
        CredentialCommands::Update {
            selector,
            name,
            login_username,
            login_secret,
            enable_secret,
            enable,
            disable_enable,
            json,
        } => {
            let current = resolve_credential_selector(&selector)?;

            let has_explicit_update = name.is_some()
                || login_username.is_some()
                || login_secret.is_some()
                || enable_secret.is_some()
                || enable
                || disable_enable;

            let input = if has_explicit_update {
                let enable_enabled = if disable_enable {
                    false
                } else if enable || enable_secret.is_some() {
                    true
                } else {
                    current.enable_enabled
                };
                credentials::DeviceCredentialInput {
                    name: name.unwrap_or(current.name),
                    username: login_username.unwrap_or(current.username),
                    password: login_secret,
                    enable_password: enable_secret,
                    enable_enabled,
                }
            } else {
                let next_name = prompt_required("Credential name", Some(&current.name))?;
                let next_username = prompt_required("Login username", Some(&current.username))?;
                let next_password = prompt_secret(
                    "Login password (leave blank to keep the current value)",
                    false,
                )?;
                let next_enable_password = prompt_secret(
                    "Enable password (leave blank to clear the current value)",
                    false,
                )?;
                let next_enable_password = non_empty_option(next_enable_password);
                credentials::DeviceCredentialInput {
                    name: next_name,
                    username: next_username,
                    password: non_empty_option(next_password),
                    enable_enabled: current.enable_enabled || next_enable_password.is_some(),
                    enable_password: next_enable_password,
                }
            };

            let item = credentials::update_credential(&current.id, &input)?;
            let output = CredentialCliOutput::from_meta(item, Vec::new());
            if json {
                println!("{}", serde_json::to_string_pretty(&output)?);
            } else {
                println!("Updated device credential '{}'", output.name);
            }
        }
        CredentialCommands::Import { file, json } => {
            let report = device_credential_import::import_credentials_from_path(&file)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&report)?);
            } else {
                print_credential_import_report(&report);
            }
            if report.failed > 0 {
                return Err(anyhow!(
                    "credential import completed with {} failed row(s)",
                    report.failed
                ));
            }
        }
        CredentialCommands::Delete { selector } => {
            let item = resolve_credential_selector(&selector)?;
            let references = credentials::referencing_connections(&item.id)?;
            if !references.is_empty() {
                return Err(anyhow!(
                    "device credential '{}' is referenced by connections: {}",
                    item.name,
                    references.join(", ")
                ));
            }
            credentials::delete_credential(&item.id)?;
            println!("Deleted device credential '{}'", item.name);
        }
    }

    Ok(())
}

fn resolve_credential_selector(
    selector: &str,
) -> Result<crate::config::device_credential_store::DeviceCredentialMeta> {
    crate::config::device_credential_store::find_credential_by_name(selector).or_else(|_| {
        crate::config::device_credential_store::get_credential(selector)
            .map_err(|_| anyhow!("device credential '{}' not found", selector))
    })
}

fn prompt_required(label: &str, default: Option<&str>) -> Result<String> {
    loop {
        let suffix = default
            .map(|value| format!(" [{}]", value))
            .unwrap_or_default();
        print!("{}{}: ", label, suffix);
        io::stdout().flush()?;
        let mut value = String::new();
        io::stdin().read_line(&mut value)?;
        let value = value.trim();
        if value.is_empty() {
            if let Some(default) = default {
                return Ok(default.to_string());
            }
            eprintln!("{} is required", label);
            continue;
        }
        return Ok(value.to_string());
    }
}

fn value_or_prompt<F>(value: Option<String>, prompt: F) -> Result<String>
where
    F: FnOnce() -> Result<String>,
{
    match value {
        Some(value) => Ok(value),
        None => prompt(),
    }
}

fn prompt_secret(label: &str, required: bool) -> Result<String> {
    loop {
        let value = rpassword::prompt_password(format!("{}: ", label))?;
        if !required || !value.trim().is_empty() {
            return Ok(value);
        }
        eprintln!("{} is required", label);
    }
}

fn non_empty_option(value: String) -> Option<String> {
    (!value.trim().is_empty()).then_some(value)
}

fn secret_presence(present: bool) -> &'static str {
    if present { "configured" } else { "missing" }
}

fn enable_presence(item: &CredentialCliOutput) -> &'static str {
    if item.has_enable_password {
        "configured"
    } else if item.enable_enabled {
        "enabled-without-password"
    } else {
        "none"
    }
}

pub(crate) fn run_history_command(cmd: HistoryCommands) -> Result<()> {
    match cmd {
        HistoryCommands::List { name, limit, json } => {
            let safe = connection_store::safe_connection_name(&name)?;
            let items = history_store::list_history_by_connection_name(&safe, limit)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&items)?);
                return Ok(());
            }
            println!("# connection: {}", safe);
            if items.is_empty() {
                println!("-");
                return Ok(());
            }
            for item in items {
                println!(
                    "- [{}] {} mode={} level={} file={}",
                    item.ts_ms,
                    item.command_label,
                    item.mode.unwrap_or_else(|| "-".to_string()),
                    item.record_level,
                    item.record_path
                );
            }
        }
        HistoryCommands::Show { name, id, json } => {
            let safe = connection_store::safe_connection_name(&name)?;
            let items = history_store::list_history_by_connection_name(&safe, 0)?;
            let item = items
                .into_iter()
                .find(|entry| entry.id == id)
                .ok_or_else(|| anyhow!("history record not found"))?;
            let jsonl = history_store::load_recording_jsonl_by_key(&item.connection_key, &item.id)?
                .ok_or_else(|| anyhow!("history record body not found"))?;
            let recorder = SessionRecorder::from_jsonl(&jsonl)?;
            let entries = recorder.entries()?;
            if json {
                let value = serde_json::json!({ "meta": item, "entries": entries });
                println!("{}", serde_json::to_string_pretty(&value)?);
                return Ok(());
            }
            println!("id: {}", item.id);
            println!("ts_ms: {}", item.ts_ms);
            println!(
                "connection: {}",
                item.connection_name.clone().unwrap_or("-".to_string())
            );
            println!("host: {}", item.host);
            println!("port: {}", item.port);
            println!("username: {}", item.username);
            println!("device_profile: {}", item.device_profile);
            println!("operation: {}", item.operation);
            println!("command_label: {}", item.command_label);
            println!("mode: {}", item.mode.clone().unwrap_or("-".to_string()));
            println!("record_level: {}", item.record_level);
            println!("record_path: {}", item.record_path);
            println!("entries: {}", entries.len());
        }
        HistoryCommands::Delete { name, id } => {
            let safe = connection_store::safe_connection_name(&name)?;
            let deleted = history_store::delete_history_by_connection_name(&safe, &id)?;
            if deleted {
                println!("Deleted history record '{}'", id);
            } else {
                println!("History record '{}' not found", id);
            }
        }
    }
    Ok(())
}

pub(crate) fn run_blacklist_command(cmd: BlacklistCommands) -> Result<()> {
    match cmd {
        BlacklistCommands::List => {
            let patterns = command_blacklist::list_patterns()?;
            if patterns.is_empty() {
                println!("-");
            } else {
                for pattern in patterns {
                    println!("- {}", pattern);
                }
            }
            println!(
                "# file: {}",
                command_blacklist::storage_path().to_string_lossy()
            );
        }
        BlacklistCommands::Add { pattern } => {
            let (added, path) = command_blacklist::add_pattern(&pattern)?;
            if added {
                println!(
                    "Added blacklist pattern '{}' to '{}'",
                    pattern,
                    path.to_string_lossy()
                );
            } else {
                println!("Blacklist pattern '{}' already exists", pattern);
            }
        }
        BlacklistCommands::Delete { pattern } => {
            let deleted = command_blacklist::delete_pattern(&pattern)?;
            if deleted {
                println!("Deleted blacklist pattern '{}'", pattern);
            } else {
                println!("Blacklist pattern '{}' not found", pattern);
            }
        }
        BlacklistCommands::Check { command } => {
            if let Some(blocked) = command_blacklist::find_blocked_command(&command)? {
                println!(
                    "blocked: pattern='{}' command='{}'",
                    blocked.pattern, blocked.command
                );
            } else {
                println!("allowed");
            }
        }
    }

    Ok(())
}

pub(crate) fn run_inventory_command(cmd: InventoryCommands) -> Result<()> {
    match cmd {
        InventoryCommands::Group(cmd) => run_inventory_group_command(cmd),
    }
}

fn run_inventory_group_command(cmd: InventoryGroupCommands) -> Result<()> {
    match cmd {
        InventoryGroupCommands::List { json } => {
            let groups = inventory_store::list_groups()?;
            if json {
                println!("{}", serde_json::to_string_pretty(&groups)?);
            } else if groups.is_empty() {
                println!("-");
            } else {
                for group in groups {
                    println!(
                        "- {} [hosts={}] {}",
                        group.name,
                        group.hosts.len(),
                        group.description.as_deref().unwrap_or("")
                    );
                }
            }
            Ok(())
        }
        InventoryGroupCommands::Show { name, json } => {
            let group = inventory_store::get_group(&name)?
                .ok_or_else(|| anyhow!("inventory group '{}' not found", name))?;
            if json {
                println!("{}", serde_json::to_string_pretty(&group)?);
            } else {
                println!("name: {}", group.name);
                println!(
                    "description: {}",
                    group.description.as_deref().unwrap_or("-")
                );
                print_list("hosts", &group.hosts);
            }
            Ok(())
        }
        InventoryGroupCommands::Upsert {
            name,
            file,
            content,
        } => {
            let body = crate::read_required_text_input(file.as_ref(), content.as_deref())?;
            let mut group: inventory_store::InventoryGroup = serde_json::from_str(&body)?;
            group.name = name.clone();
            inventory_store::upsert_group(&name, &group)?;
            println!("Upserted inventory group '{}'", name);
            Ok(())
        }
        InventoryGroupCommands::Delete { name } => {
            let deleted = inventory_store::delete_group(&name)?;
            if !deleted {
                return Err(anyhow!("inventory group '{}' not found", name));
            }
            println!("Deleted inventory group '{}'", name);
            Ok(())
        }
    }
}

#[derive(Debug, Serialize)]
struct CredentialCliOutput {
    id: String,
    name: String,
    username: String,
    has_password: bool,
    has_enable_password: bool,
    enable_enabled: bool,
    connection_count: u64,
    referencing_connections: Vec<String>,
}

impl CredentialCliOutput {
    fn from_meta(
        item: crate::config::device_credential_store::DeviceCredentialMeta,
        referencing_connections: Vec<String>,
    ) -> Self {
        Self {
            id: item.id,
            name: item.name,
            username: item.username,
            has_password: item.has_password,
            has_enable_password: item.has_enable_password,
            enable_enabled: item.enable_enabled,
            connection_count: item.connection_count,
            referencing_connections,
        }
    }
}

#[derive(Debug, Serialize)]
struct ConnectionShowOutput {
    host: Option<String>,
    credential: Option<String>,
    port: Option<u16>,
    ssh_security: Option<crate::config::ssh_security::SshSecurityProfile>,
    linux_shell_flavor: Option<crate::config::linux_shell::LinuxShellFlavor>,
    device_profile: Option<String>,
    template_dir: Option<String>,
    enabled: bool,
    labels: Vec<String>,
    groups: Vec<String>,
    vars: serde_json::Value,
    has_password: bool,
    has_enable_password: bool,
}

fn print_list(label: &str, values: &[String]) {
    if values.is_empty() {
        println!("{}: -", label);
    } else {
        println!("{}: {}", label, values.join(", "));
    }
}

fn print_connection_import_report(report: &ConnectionImportReport) {
    println!(
        "Imported connections from '{}' (total={}, imported={}, created={}, updated={}, failed={})",
        report.file_name,
        report.total_rows,
        report.imported,
        report.created,
        report.updated,
        report.failed
    );
    if report.failures.is_empty() {
        return;
    }
    println!("# failed rows");
    for failure in &report.failures {
        if let Some(name) = failure.name.as_deref() {
            println!("- row {} [{}]: {}", failure.row, name, failure.message);
        } else {
            println!("- row {}: {}", failure.row, failure.message);
        }
    }
}

fn print_credential_import_report(report: &DeviceCredentialImportReport) {
    println!(
        "Imported credentials from '{}' (total={}, imported={}, created={}, updated={}, failed={})",
        report.file_name,
        report.total_rows,
        report.imported,
        report.created,
        report.updated,
        report.failed
    );
    if report.failures.is_empty() {
        return;
    }
    println!("# failed rows");
    for failure in &report.failures {
        if let Some(name) = failure.name.as_deref() {
            println!("- row {} [{}]: {}", failure.row, name, failure.message);
        } else {
            println!("- row {}: {}", failure.row, failure.message);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::value_or_prompt;
    use anyhow::Result;

    #[test]
    fn explicit_credential_login_values_do_not_prompt() -> Result<()> {
        let value = value_or_prompt(Some("admin".to_string()), || -> Result<String> {
            panic!("prompt must not run when an explicit value is present")
        })?;
        assert_eq!(value, "admin");
        Ok(())
    }
}
