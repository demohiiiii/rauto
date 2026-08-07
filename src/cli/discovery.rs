use crate::cli::discovery_tui::run_discovery_tui;
use crate::cli::{
    DeviceDiscoveryArgs, DeviceDiscoveryCommands, DeviceDiscoveryFilterArgs,
    DeviceDiscoveryListArgs, DeviceDiscoverySaveArgs, DiscoveryStatusFilter, GlobalOpts,
};
use crate::config::device_credential_store;
use crate::config::device_discovery_store::{self, DiscoveryResultRecord};
use crate::web::handlers::{import_device_discovery_run_results, start_device_discovery_run};
use crate::web::models::{
    CreateDiscoveryRunRequest, DiscoveryRunDetailResponse, ImportDiscoveryResultItem,
    ImportDiscoveryResultsRequest, ImportDiscoveryResultsResponse,
};
use crate::web::state::AppState;
use anyhow::{Context, Result, anyhow};
use indicatif::{ProgressBar, ProgressStyle};
use std::collections::HashSet;
use std::io::{self, IsTerminal};
use std::net::{IpAddr, SocketAddr};
use std::time::Duration;

pub(crate) async fn run_device_discovery_command(
    command: DeviceDiscoveryCommands,
    global_opts: &GlobalOpts,
) -> Result<()> {
    match command {
        DeviceDiscoveryCommands::List(args) => list_latest_discovery(args).await,
        DeviceDiscoveryCommands::Save(args) => save_latest_discovery(args, global_opts).await,
    }
}

pub(crate) async fn run_device_discovery(
    args: DeviceDiscoveryArgs,
    global_opts: &GlobalOpts,
) -> Result<()> {
    let use_tui =
        !args.json && !args.no_tui && io::stdin().is_terminal() && io::stdout().is_terminal();
    let show_progress = !args.json && io::stderr().is_terminal();
    let credential_ids = resolve_probe_credentials(&args, global_opts)?;
    let state = AppState::new(global_opts.clone(), None, None);
    let started = start_device_discovery_run(
        state.clone(),
        CreateDiscoveryRunRequest {
            targets: args.targets,
            ports: args.ports,
            credential_ids,
            default_groups: Vec::new(),
            default_labels: Vec::new(),
            concurrency: args.concurrency,
            tcp_timeout_ms: args.tcp_timeout_ms,
            probe_timeout_secs: args.probe_timeout_secs,
        },
    )
    .await
    .map_err(|error| anyhow!(error.message))?;
    let run_id = started.run.id.clone();
    let progress = show_progress.then(|| discovery_progress_bar(&started));

    if !args.json && progress.is_none() {
        println!("Discovery started: {run_id}");
    }

    let mut cancellation_requested = false;
    let mut detail = loop {
        let run = device_discovery_store::get_run(&run_id)
            .await?
            .ok_or_else(|| anyhow!("device discovery run '{run_id}' disappeared"))?;
        if let Some(progress) = &progress {
            update_discovery_progress(progress, &run);
        }
        if matches!(run.status.as_str(), "completed" | "cancelled" | "failed") {
            let results = device_discovery_store::list_results(&run_id).await?;
            break DiscoveryRunDetailResponse { run, results };
        }

        tokio::select! {
            _ = tokio::time::sleep(Duration::from_millis(250)) => {}
            signal = tokio::signal::ctrl_c(), if !cancellation_requested => {
                signal.context("failed to listen for Ctrl+C")?;
                cancellation_requested = true;
                let _ = state.cancel_discovery_run(&run_id).await;
                if let Some(progress) = &progress {
                    progress.set_message("cancelling...");
                } else if !args.json {
                    eprintln!("Cancelling discovery run {run_id}...");
                }
            }
        }
    };

    if let Some(progress) = progress {
        progress.finish_and_clear();
    }
    let final_status = detail.run.status.clone();
    let final_error = detail.run.error.clone();
    let mut auto_saved = 0;
    let mut auto_save_failures = 0;
    if args.auto_save && final_status == "completed" {
        let report = save_discovery_results(
            state.clone(),
            &detail,
            detail
                .results
                .iter()
                .filter(|result| discovery_result_can_import(result)),
            None,
            false,
        )
        .await?;
        auto_saved = report.created + report.updated;
        auto_save_failures = report.failed;
        if !args.json {
            eprintln!(
                "Auto-save: {} created, {} updated, {} skipped, {} failed",
                report.created, report.updated, report.skipped, report.failed
            );
        }
        detail = load_discovery_run(&run_id)
            .await?
            .ok_or_else(|| anyhow!("device discovery run '{run_id}' disappeared"))?;
    }
    let display_filter = if args.auto_save && args.status == DiscoveryStatusFilter::Identified {
        DiscoveryStatusFilter::Imported
    } else {
        args.status
    };
    if use_tui {
        let outcome = run_discovery_tui(state, detail, display_filter).await?;
        println!(
            "Discovery run {run_id} complete; {} connection(s) saved",
            auto_saved + outcome.saved
        );
    } else {
        detail
            .results
            .retain(|result| result_matches_filter(result, display_filter));
        if args.json {
            normalize_discovery_statuses_for_json(&mut detail.results);
            println!("{}", serde_json::to_string_pretty(&detail)?);
        } else {
            print_discovery_results(&detail, display_filter);
        }
    }

    if auto_save_failures > 0 {
        return Err(anyhow!(
            "device discovery auto-save completed with {auto_save_failures} failed connection(s)"
        ));
    }

    match final_status.as_str() {
        "failed" => Err(anyhow!(
            "device discovery failed: {}",
            final_error.as_deref().unwrap_or("unknown error")
        )),
        "cancelled" => Err(anyhow!("device discovery was cancelled")),
        _ => Ok(()),
    }
}

async fn list_latest_discovery(args: DeviceDiscoveryListArgs) -> Result<()> {
    let mut detail = require_latest_discovery().await?;
    detail
        .results
        .retain(|result| result_matches_cli_filters(result, &args.filters));
    if args.json {
        normalize_discovery_statuses_for_json(&mut detail.results);
        println!("{}", serde_json::to_string_pretty(&detail)?);
    } else {
        print_discovery_results(&detail, args.filters.status);
    }
    Ok(())
}

async fn save_latest_discovery(
    args: DeviceDiscoverySaveArgs,
    global_opts: &GlobalOpts,
) -> Result<()> {
    let detail = require_latest_discovery().await?;
    let selectors = args
        .endpoints
        .iter()
        .map(|value| parse_endpoint_selector(value))
        .collect::<Result<Vec<_>>>()?;
    let filters = DeviceDiscoveryFilterArgs {
        status: DiscoveryStatusFilter::All,
        profiles: args.profiles,
        ports: args.ports,
        search: args.search,
    };
    let matched = detail
        .results
        .iter()
        .filter(|result| result_matches_cli_filters(result, &filters))
        .filter(|result| {
            selectors.is_empty() || selectors.iter().any(|selector| selector.matches(result))
        })
        .collect::<Vec<_>>();

    if !selectors.is_empty() {
        let unmatched = selectors
            .iter()
            .filter(|selector| !matched.iter().any(|result| selector.matches(result)))
            .map(EndpointSelector::display)
            .collect::<Vec<_>>();
        if !unmatched.is_empty() {
            return Err(anyhow!(
                "no latest discovery result matched endpoint(s): {}",
                unmatched.join(", ")
            ));
        }
    }

    let importable = matched
        .into_iter()
        .filter(|result| discovery_result_can_import(result))
        .collect::<Vec<_>>();
    if importable.is_empty() {
        return Err(anyhow!(
            "no newly identified devices match the requested discovery filters"
        ));
    }
    validate_connection_name_match_count(args.connection_name.as_deref(), importable.len())?;

    let state = AppState::new(global_opts.clone(), None, None);
    let response = save_discovery_results(
        state,
        &detail,
        importable,
        args.connection_name.as_deref(),
        args.overwrite,
    )
    .await?;
    if args.json {
        println!("{}", serde_json::to_string_pretty(&response)?);
    } else {
        print_save_report(&response);
    }
    if response.failed > 0 {
        return Err(anyhow!(
            "saving discovered devices completed with {} failure(s)",
            response.failed
        ));
    }
    Ok(())
}

async fn require_latest_discovery() -> Result<DiscoveryRunDetailResponse> {
    load_latest_discovery().await?.ok_or_else(|| {
        anyhow!("no device discovery result is available; run 'rauto device discover' first")
    })
}

async fn load_latest_discovery() -> Result<Option<DiscoveryRunDetailResponse>> {
    let Some(run) = device_discovery_store::list_runs(1)
        .await?
        .into_iter()
        .next()
    else {
        return Ok(None);
    };
    load_discovery_run(&run.id).await
}

async fn load_discovery_run(run_id: &str) -> Result<Option<DiscoveryRunDetailResponse>> {
    let Some(run) = device_discovery_store::get_run(run_id).await? else {
        return Ok(None);
    };
    let results = device_discovery_store::list_results(run_id).await?;
    Ok(Some(DiscoveryRunDetailResponse { run, results }))
}

async fn save_discovery_results<'a>(
    state: std::sync::Arc<AppState>,
    detail: &DiscoveryRunDetailResponse,
    results: impl IntoIterator<Item = &'a DiscoveryResultRecord>,
    connection_name: Option<&str>,
    overwrite: bool,
) -> Result<ImportDiscoveryResultsResponse> {
    let items = results
        .into_iter()
        .map(|result| ImportDiscoveryResultItem {
            host: result.host.clone(),
            port: result.port,
            connection_name: connection_name
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| default_discovery_connection_name(result)),
            credential_id: result.credential_id.clone(),
            groups: None,
            labels: None,
            overwrite,
        })
        .collect::<Vec<_>>();
    import_device_discovery_run_results(
        state,
        detail.run.id.clone(),
        ImportDiscoveryResultsRequest { items },
    )
    .await
    .map_err(|error| anyhow!(error.message))
}

fn print_save_report(report: &ImportDiscoveryResultsResponse) {
    println!("total: {}", report.total);
    println!("created: {}", report.created);
    println!("updated: {}", report.updated);
    println!("skipped: {}", report.skipped);
    println!("failed: {}", report.failed);
    if report.results.is_empty() {
        return;
    }
    println!("HOST\tPORT\tCONNECTION\tSTATUS\tERROR");
    for result in &report.results {
        println!(
            "{}\t{}\t{}\t{}\t{}",
            clean_cell(Some(&result.host)),
            result.port,
            clean_cell(Some(&result.connection_name)),
            result.status,
            clean_cell(result.error.as_deref())
        );
    }
}

fn discovery_progress_bar(detail: &DiscoveryRunDetailResponse) -> ProgressBar {
    let view = discovery_progress_view(&detail.run);
    let progress = ProgressBar::new(view.total);
    progress.set_style(
        ProgressStyle::with_template(
            "{spinner:.cyan} {prefix:.bold.cyan} [{bar:36.cyan/blue}] {pos}/{len} {msg}",
        )
        .expect("static discovery progress template must be valid")
        .progress_chars("=>-"),
    );
    progress.enable_steady_tick(Duration::from_millis(100));
    update_discovery_progress(&progress, &detail.run);
    progress
}

fn update_discovery_progress(
    progress: &ProgressBar,
    run: &device_discovery_store::DiscoveryRunRecord,
) {
    let view = discovery_progress_view(run);
    progress.set_prefix(view.label);
    progress.set_length(view.total);
    progress.set_position(view.current.min(view.total));
    progress.set_message(view.message);
}

#[derive(Debug, PartialEq, Eq)]
struct DiscoveryProgressView {
    label: &'static str,
    current: u64,
    total: u64,
    message: String,
}

fn discovery_progress_view(
    run: &device_discovery_store::DiscoveryRunRecord,
) -> DiscoveryProgressView {
    let tcp_failed = run.scanned_targets.saturating_sub(run.reachable_count);
    let probe_failed = run.failed_count.saturating_sub(tcp_failed);
    match run.phase.as_str() {
        "ssh_probe" => DiscoveryProgressView {
            label: "Stage 2/2 SSH probe",
            current: run.probed_targets as u64,
            total: run.reachable_count as u64,
            message: format!(
                "identified {}  probe failed {}",
                run.identified_count, probe_failed
            ),
        },
        "completed" => DiscoveryProgressView {
            label: "Complete",
            current: run.reachable_count as u64,
            total: run.reachable_count as u64,
            message: format!(
                "identified {}  failed {}",
                run.identified_count, run.failed_count
            ),
        },
        _ => DiscoveryProgressView {
            label: "Stage 1/2 TCP scan",
            current: run.scanned_targets as u64,
            total: run.total_targets as u64,
            message: format!(
                "SSH candidates {}  rejected {}",
                run.reachable_count, tcp_failed
            ),
        },
    }
}

fn resolve_probe_credentials(
    args: &DeviceDiscoveryArgs,
    global_opts: &GlobalOpts,
) -> Result<Vec<String>> {
    let selectors = if args.probe_credentials.is_empty() {
        global_opts.credential.iter().cloned().collect::<Vec<_>>()
    } else {
        args.probe_credentials.clone()
    };
    if selectors.is_empty() {
        return Err(anyhow!(
            "device discovery requires --credential or --probe-credential"
        ));
    }

    let mut ids = Vec::new();
    let mut seen = HashSet::new();
    for selector in selectors {
        let credential = device_credential_store::find_credential_by_name(&selector)
            .or_else(|_| device_credential_store::get_credential(&selector))
            .with_context(|| format!("device credential '{selector}' not found"))?;
        if seen.insert(credential.id.clone()) {
            ids.push(credential.id);
        }
    }
    Ok(ids)
}

pub(crate) fn displayed_result_status(result: &DiscoveryResultRecord) -> &str {
    if result.imported_connection_name.is_some() {
        "imported"
    } else if result.existing_connection_name.is_some() {
        "existing"
    } else {
        &result.status
    }
}

fn normalize_discovery_statuses_for_json(results: &mut [DiscoveryResultRecord]) {
    for result in results {
        result.status = displayed_result_status(result).to_string();
    }
}

pub(crate) fn result_matches_filter(
    result: &DiscoveryResultRecord,
    filter: DiscoveryStatusFilter,
) -> bool {
    match filter {
        DiscoveryStatusFilter::All => true,
        DiscoveryStatusFilter::Identified => displayed_result_status(result) == "identified",
        DiscoveryStatusFilter::Existing => displayed_result_status(result) == "existing",
        DiscoveryStatusFilter::Imported => displayed_result_status(result) == "imported",
        DiscoveryStatusFilter::Reachable => {
            matches!(
                result.status.as_str(),
                "reachable" | "identified" | "probe_failed"
            )
        }
        DiscoveryStatusFilter::Failed => matches!(
            result.status.as_str(),
            "unreachable" | "not_ssh" | "probe_failed"
        ),
        DiscoveryStatusFilter::NotSsh => displayed_result_status(result) == "not_ssh",
        DiscoveryStatusFilter::ProbeFailed => displayed_result_status(result) == "probe_failed",
        DiscoveryStatusFilter::Unreachable => displayed_result_status(result) == "unreachable",
        DiscoveryStatusFilter::Cancelled => displayed_result_status(result) == "cancelled",
    }
}

pub(crate) fn discovery_result_key(result: &DiscoveryResultRecord) -> String {
    format!("{}:{}", result.host, result.port)
}

pub(crate) fn discovery_result_can_import(result: &DiscoveryResultRecord) -> bool {
    displayed_result_status(result) == "identified"
}

pub(crate) fn discovery_result_matches_query(result: &DiscoveryResultRecord, query: &str) -> bool {
    let query = query.trim().to_ascii_lowercase();
    query.is_empty()
        || [
            Some(result.host.as_str()),
            result.device_profile.as_deref(),
            result.device_model.as_deref(),
            result.software_version.as_deref(),
            result.existing_connection_name.as_deref(),
            result.imported_connection_name.as_deref(),
            result.error.as_deref(),
        ]
        .into_iter()
        .flatten()
        .any(|value| value.to_ascii_lowercase().contains(&query))
        || result.port.to_string().contains(&query)
}

pub(crate) fn default_discovery_connection_name(result: &DiscoveryResultRecord) -> String {
    let mut platform = String::new();
    let mut previous_dash = false;
    for character in result.device_profile.as_deref().unwrap_or("device").chars() {
        if character.is_ascii_alphanumeric() || character == '_' {
            platform.push(character.to_ascii_lowercase());
            previous_dash = false;
        } else if !previous_dash {
            platform.push('-');
            previous_dash = true;
        }
    }
    let mut platform = platform.trim_matches('-').to_string();
    if platform.is_empty() {
        platform.push_str("device");
    }

    let mut host = String::with_capacity(result.host.len());
    let mut previous_dash = false;
    for character in result.host.chars() {
        if character.is_ascii_alphanumeric() {
            host.push(character.to_ascii_lowercase());
            previous_dash = false;
        } else if !previous_dash {
            host.push('-');
            previous_dash = true;
        }
    }
    let host = host.trim_matches('-');
    let mut endpoint = if host.is_empty() {
        "device".to_string()
    } else {
        host.to_string()
    };
    if result.port != 22 {
        endpoint.push_str(&format!("-{}", result.port));
    }
    let max_platform_len = 96usize.saturating_sub(endpoint.len() + 1);
    platform.truncate(max_platform_len);
    format!("{platform}-{endpoint}")
}

fn result_matches_cli_filters(
    result: &DiscoveryResultRecord,
    filters: &DeviceDiscoveryFilterArgs,
) -> bool {
    result_matches_filter(result, filters.status)
        && (filters.profiles.is_empty()
            || result.device_profile.as_deref().is_some_and(|profile| {
                filters
                    .profiles
                    .iter()
                    .any(|candidate| candidate.trim().eq_ignore_ascii_case(profile))
            }))
        && (filters.ports.is_empty() || filters.ports.contains(&result.port))
        && filters
            .search
            .as_deref()
            .is_none_or(|query| discovery_result_matches_query(result, query))
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum EndpointSelector {
    Host(IpAddr),
    Socket(SocketAddr),
}

impl EndpointSelector {
    fn matches(&self, result: &DiscoveryResultRecord) -> bool {
        let Ok(host) = result.host.parse::<IpAddr>() else {
            return false;
        };
        match self {
            Self::Host(address) => host == *address,
            Self::Socket(endpoint) => host == endpoint.ip() && result.port == endpoint.port(),
        }
    }

    fn display(&self) -> String {
        match self {
            Self::Host(address) => address.to_string(),
            Self::Socket(endpoint) => endpoint.to_string(),
        }
    }
}

fn parse_endpoint_selector(value: &str) -> Result<EndpointSelector> {
    let value = value.trim();
    if let Ok(address) = value.parse::<IpAddr>() {
        return Ok(EndpointSelector::Host(address));
    }
    if let Ok(endpoint) = value.parse::<SocketAddr>() {
        return Ok(EndpointSelector::Socket(endpoint));
    }
    Err(anyhow!(
        "invalid discovery endpoint selector '{value}'; use an IP address or IP:port"
    ))
}

fn validate_connection_name_match_count(
    connection_name: Option<&str>,
    matches: usize,
) -> Result<()> {
    if connection_name.is_some() && matches != 1 {
        return Err(anyhow!(
            "--connection-name requires exactly one matched device (matched {matches})"
        ));
    }
    Ok(())
}

fn print_discovery_results(detail: &DiscoveryRunDetailResponse, filter: DiscoveryStatusFilter) {
    println!("status: {}", detail.run.status);
    println!("scanned: {}", detail.run.scanned_targets);
    println!("ssh_reachable: {}", detail.run.reachable_count);
    println!("identified_total: {}", detail.run.identified_count);
    println!("failed: {}", detail.run.failed_count);
    println!("filter: {:?}", filter);
    println!("results: {}", detail.results.len());
    if detail.results.is_empty() {
        return;
    }

    println!("HOST\tPORT\tSTATUS\tPROFILE\tMODEL\tVERSION\tCREDENTIAL\tCONNECTION\tERROR");
    for result in &detail.results {
        println!(
            "{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}",
            clean_cell(Some(&result.host)),
            result.port,
            displayed_result_status(result),
            clean_cell(result.device_profile.as_deref()),
            clean_cell(result.device_model.as_deref()),
            clean_cell(result.software_version.as_deref()),
            clean_cell(result.credential_id.as_deref()),
            clean_cell(
                result
                    .imported_connection_name
                    .as_deref()
                    .or(result.existing_connection_name.as_deref())
            ),
            clean_cell(result.error.as_deref()),
        );
    }
}

fn clean_cell(value: Option<&str>) -> String {
    value
        .filter(|value| !value.is_empty())
        .unwrap_or("-")
        .replace(['\t', '\r', '\n'], " ")
}

#[cfg(test)]
mod tests {
    use super::{
        default_discovery_connection_name, discovery_progress_view, discovery_result_can_import,
        displayed_result_status, normalize_discovery_statuses_for_json, parse_endpoint_selector,
        result_matches_cli_filters, result_matches_filter, validate_connection_name_match_count,
    };
    use crate::cli::{DeviceDiscoveryFilterArgs, DiscoveryStatusFilter};
    use crate::config::device_discovery_store::DiscoveryResultRecord;
    use crate::config::device_discovery_store::DiscoveryRunRecord;

    fn result(status: &str) -> DiscoveryResultRecord {
        DiscoveryResultRecord {
            run_id: "run-1".to_string(),
            host: "192.0.2.10".to_string(),
            port: 22,
            status: status.to_string(),
            latency_ms: Some(1),
            credential_id: None,
            device_profile: None,
            device_model: None,
            software_version: None,
            existing_connection_name: None,
            imported_connection_name: None,
            error: None,
            updated_at_ms: 1,
        }
    }

    #[test]
    fn discovery_filters_keep_existing_and_identified_statuses_exclusive() {
        let identified = result("identified");
        let mut existing = result("identified");
        existing.existing_connection_name = Some("edge-10".to_string());

        assert_eq!(displayed_result_status(&identified), "identified");
        assert_eq!(displayed_result_status(&existing), "existing");
        assert!(result_matches_filter(
            &identified,
            DiscoveryStatusFilter::Identified
        ));
        assert!(!result_matches_filter(
            &existing,
            DiscoveryStatusFilter::Identified
        ));
        assert!(result_matches_filter(
            &existing,
            DiscoveryStatusFilter::Existing
        ));
        assert!(result_matches_filter(
            &existing,
            DiscoveryStatusFilter::Reachable
        ));
        assert!(!discovery_result_can_import(&existing));
    }

    #[test]
    fn discovery_json_status_matches_displayed_status() {
        let mut existing = result("identified");
        existing.existing_connection_name = Some("edge-10".to_string());
        let mut imported = result("identified");
        imported.imported_connection_name = Some("edge-11".to_string());
        let mut results = vec![existing, imported];

        normalize_discovery_statuses_for_json(&mut results);

        assert_eq!(results[0].status, "existing");
        assert_eq!(results[1].status, "imported");
    }

    #[test]
    fn latest_discovery_filters_combine_status_profile_port_and_search() {
        let mut identified = result("identified");
        identified.device_profile = Some("fortinet".to_string());
        identified.device_model = Some("FortiGate 60F".to_string());
        let filters = DeviceDiscoveryFilterArgs {
            status: DiscoveryStatusFilter::Identified,
            profiles: vec!["FORTINET".to_string()],
            ports: vec![22],
            search: Some("60f".to_string()),
        };

        assert!(result_matches_cli_filters(&identified, &filters));

        identified.port = 2222;
        assert!(!result_matches_cli_filters(&identified, &filters));
    }

    #[test]
    fn endpoint_selectors_support_host_and_host_with_port() {
        let mut discovered = result("identified");
        discovered.port = 2222;

        assert!(
            parse_endpoint_selector("192.0.2.10")
                .expect("host selector")
                .matches(&discovered)
        );
        assert!(
            parse_endpoint_selector("192.0.2.10:2222")
                .expect("socket selector")
                .matches(&discovered)
        );
        assert!(
            !parse_endpoint_selector("192.0.2.10:22")
                .expect("different port selector")
                .matches(&discovered)
        );
        assert!(parse_endpoint_selector("not-an-endpoint").is_err());
    }

    #[test]
    fn explicit_connection_name_requires_one_result() {
        assert!(validate_connection_name_match_count(Some("branch-fw"), 0).is_err());
        assert!(validate_connection_name_match_count(Some("branch-fw"), 2).is_err());
        assert!(validate_connection_name_match_count(Some("branch-fw"), 1).is_ok());
        assert!(validate_connection_name_match_count(None, 2).is_ok());
    }

    #[test]
    fn automatic_names_match_web_import_names() {
        let without_platform = result("identified");
        assert_eq!(
            default_discovery_connection_name(&without_platform),
            "device-192-0-2-10"
        );

        let mut discovered = without_platform;
        discovered.device_profile = Some("cisco_ios".to_string());
        assert_eq!(
            default_discovery_connection_name(&discovered),
            "cisco_ios-192-0-2-10"
        );

        let mut alternate_port = discovered;
        alternate_port.port = 2222;
        assert_eq!(
            default_discovery_connection_name(&alternate_port),
            "cisco_ios-192-0-2-10-2222"
        );
    }

    fn run(phase: &str) -> DiscoveryRunRecord {
        DiscoveryRunRecord {
            id: "run-1".to_string(),
            status: "running".to_string(),
            phase: phase.to_string(),
            targets: vec!["192.0.2.0/24".to_string()],
            ports: vec![22],
            credential_ids: vec!["credential-1".to_string()],
            default_groups: Vec::new(),
            default_labels: Vec::new(),
            concurrency: 32,
            tcp_timeout_ms: 1_000,
            probe_timeout_secs: 15,
            total_targets: 254,
            scanned_targets: 254,
            reachable_count: 11,
            probed_targets: 4,
            identified_count: 2,
            failed_count: 245,
            error: None,
            created_at_ms: 1,
            started_at_ms: Some(1),
            completed_at_ms: None,
        }
    }

    #[test]
    fn discovery_progress_switches_to_ssh_probe_work() {
        let tcp = discovery_progress_view(&run("tcp_scan"));
        assert_eq!(tcp.label, "Stage 1/2 TCP scan");
        assert_eq!((tcp.current, tcp.total), (254, 254));

        let ssh = discovery_progress_view(&run("ssh_probe"));
        assert_eq!(ssh.label, "Stage 2/2 SSH probe");
        assert_eq!((ssh.current, ssh.total), (4, 11));
        assert!(ssh.message.contains("probe failed 2"));
    }
}
