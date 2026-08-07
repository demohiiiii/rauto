use super::detect_connection_facts;
use crate::config::connection_store::{self, SavedConnection};
use crate::config::device_credential_store;
use crate::config::device_discovery_store::{
    self, DiscoveryResultRecord, DiscoveryRunRecord, DiscoveryRunStateUpdate,
};
use crate::config::task_store;
use crate::task::{
    TaskCallback, TaskOperation, TaskResultOutcome, TaskStatus, build_result_summary,
    result_counts, task_result_with_counts, task_result_with_details,
};
use crate::web::error::ApiError;
use crate::web::models::{
    ConnectionRequest, ConnectionTestRequest, CreateDiscoveryRunRequest,
    DiscoveryRunDetailResponse, ImportDiscoveryResultResponse, ImportDiscoveryResultsRequest,
    ImportDiscoveryResultsResponse,
};
use crate::web::state::AppState;
use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use futures_util::stream::{self, StreamExt};
use ipnet::IpNet;
use std::collections::{BTreeSet, HashSet};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::str::FromStr;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::watch;
use tokio::time::timeout;
use tracing::warn;

const MAX_DISCOVERY_ADDRESSES: usize = 4_096;
const MAX_DISCOVERY_PORTS: usize = 16;
const MAX_DISCOVERY_CREDENTIALS: usize = 3;
const MAX_DISCOVERY_CONCURRENCY: usize = 256;
const MAX_TCP_TIMEOUT_MS: u64 = 30_000;
const MAX_PROBE_TIMEOUT_SECS: u64 = 120;
const SSH_DISCOVERY_IDENTIFICATION: &[u8] = b"SSH-2.0-rauto-discovery\r\n";
const MAX_SSH_IDENTIFICATION_BYTES: usize = 4_096;

#[derive(Debug, PartialEq, Eq)]
enum SshPortProbe {
    Reachable { latency_ms: u64 },
    NotSsh { latency_ms: u64, error: String },
    Unreachable { error: String },
}

impl SshPortProbe {
    fn is_reachable(&self) -> bool {
        matches!(self, Self::Reachable { .. })
    }

    fn latency_ms(&self) -> Option<u64> {
        match self {
            Self::Reachable { latency_ms } | Self::NotSsh { latency_ms, .. } => Some(*latency_ms),
            Self::Unreachable { .. } => None,
        }
    }

    fn status(&self) -> &'static str {
        match self {
            Self::Reachable { .. } => "reachable",
            Self::NotSsh { .. } => "not_ssh",
            Self::Unreachable { .. } => "unreachable",
        }
    }

    fn error(&self) -> Option<String> {
        match self {
            Self::Reachable { .. } => None,
            Self::NotSsh { error, .. } | Self::Unreachable { error } => Some(error.clone()),
        }
    }
}

pub async fn create_device_discovery_run(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateDiscoveryRunRequest>,
) -> Result<Json<DiscoveryRunDetailResponse>, ApiError> {
    start_device_discovery_run(state, request).await.map(Json)
}

pub(crate) async fn start_device_discovery_run(
    state: Arc<AppState>,
    request: CreateDiscoveryRunRequest,
) -> Result<DiscoveryRunDetailResponse, ApiError> {
    let addresses = parse_discovery_targets(&request.targets).map_err(ApiError::bad_request)?;
    let ports = normalize_ports(&request.ports).map_err(ApiError::bad_request)?;
    let credential_ids = normalize_names(&request.credential_ids);
    validate_discovery_options(&request, &credential_ids)?;
    for credential_id in &credential_ids {
        device_credential_store::get_credential(credential_id)
            .map_err(|error| ApiError::bad_request(error.to_string()))?;
    }

    let total_targets = addresses
        .len()
        .checked_mul(ports.len())
        .ok_or_else(|| ApiError::bad_request("discovery target count overflow"))?;
    let run_id = format!("discovery-{}-{:08x}", now_ms(), rand::random::<u32>());
    let run = DiscoveryRunRecord {
        id: run_id.clone(),
        status: "queued".to_string(),
        phase: "queued".to_string(),
        targets: request.targets.clone(),
        ports: ports.clone(),
        credential_ids: credential_ids.clone(),
        default_groups: normalize_names(&request.default_groups),
        default_labels: normalize_names(&request.default_labels),
        concurrency: request.concurrency,
        tcp_timeout_ms: request.tcp_timeout_ms,
        probe_timeout_secs: request.probe_timeout_secs,
        total_targets,
        scanned_targets: 0,
        reachable_count: 0,
        probed_targets: 0,
        identified_count: 0,
        failed_count: 0,
        error: None,
        created_at_ms: now_ms(),
        started_at_ms: None,
        completed_at_ms: None,
    };
    if !device_discovery_store::replace_latest_run(&run)
        .await
        .map_err(ApiError::from)?
    {
        return Err(ApiError::conflict(
            "a device discovery run is already active",
        ));
    }
    if let Err(error) = task_store::save_task_accepted(&run_id, TaskOperation::DeviceDiscovery) {
        warn!(
            "failed to register device discovery task '{}': {}",
            run_id, error
        );
    }
    let cancel_rx = state.register_discovery_run(&run_id).await;
    let task_state = state.clone();
    let task_run = run.clone();
    tokio::spawn(async move {
        let (lease_stop_tx, lease_stop_rx) = watch::channel(false);
        let lease_task = tokio::spawn(maintain_discovery_lease(
            task_state.clone(),
            run_id.clone(),
            lease_stop_rx,
        ));
        let result = execute_discovery_run(
            task_state.clone(),
            task_run,
            addresses,
            ports,
            credential_ids,
            cancel_rx,
        )
        .await;
        let _ = lease_stop_tx.send(true);
        let _ = lease_task.await;
        if let Err(error) = result {
            warn!("device discovery run '{}' failed: {}", run_id, error);
            let persisted_run = match device_discovery_store::get_run(&run_id).await {
                Ok(run) => run,
                Err(load_error) => {
                    warn!(
                        "failed to load device discovery progress '{}': {}",
                        run_id, load_error
                    );
                    None
                }
            };
            let error_message = error.to_string();
            let _ = device_discovery_store::update_run_state(
                &run_id,
                failed_discovery_run_state(persisted_run.as_ref(), &error_message, now_ms()),
            )
            .await;
        }
        if let Err(error) = record_discovery_task(&task_state, &run_id).await {
            warn!(
                "failed to record device discovery task '{}': {}",
                run_id, error
            );
        }
        if let Err(error) = device_discovery_store::release_run_lease(&run_id).await {
            warn!(
                "failed to release device discovery lease '{}': {}",
                run_id, error
            );
        }
        task_state.unregister_discovery_run(&run_id).await;
    });

    Ok(DiscoveryRunDetailResponse {
        run,
        results: Vec::new(),
    })
}

async fn maintain_discovery_lease(
    state: Arc<AppState>,
    run_id: String,
    mut stop_rx: watch::Receiver<bool>,
) {
    let mut interval = tokio::time::interval(Duration::from_secs(2));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        tokio::select! {
            changed = stop_rx.changed() => {
                if changed.is_err() || *stop_rx.borrow() {
                    return;
                }
            }
            _ = interval.tick() => {
                match device_discovery_store::refresh_run_lease(&run_id).await {
                    Ok(true) => {}
                    Ok(false) => {
                        warn!("device discovery lease '{}' was replaced", run_id);
                        let _ = state.cancel_discovery_run(&run_id).await;
                        return;
                    }
                    Err(error) => {
                        warn!("failed to refresh device discovery lease '{}': {}", run_id, error);
                    }
                }
            }
        }
    }
}

pub async fn list_device_discovery_runs() -> Result<Json<Vec<DiscoveryRunRecord>>, ApiError> {
    Ok(Json(
        device_discovery_store::list_runs(1)
            .await
            .map_err(ApiError::from)?,
    ))
}

pub async fn get_device_discovery_run(
    Path(run_id): Path<String>,
) -> Result<Json<DiscoveryRunDetailResponse>, ApiError> {
    discovery_run_detail(&run_id).await.map(Json)
}

pub async fn cancel_device_discovery_run(
    State(state): State<Arc<AppState>>,
    Path(run_id): Path<String>,
) -> Result<Json<DiscoveryRunDetailResponse>, ApiError> {
    let run = require_run(&run_id).await?;
    if matches!(run.status.as_str(), "completed" | "cancelled" | "failed") {
        return discovery_run_detail(&run_id).await.map(Json);
    }
    if state.cancel_discovery_run(&run_id).await {
        device_discovery_store::update_run_state(
            &run_id,
            DiscoveryRunStateUpdate {
                status: "cancelling",
                phase: &run.phase,
                scanned_targets: run.scanned_targets,
                reachable_count: run.reachable_count,
                probed_targets: run.probed_targets,
                identified_count: run.identified_count,
                failed_count: run.failed_count,
                error: None,
                started_at_ms: run.started_at_ms,
                completed_at_ms: None,
            },
        )
        .await
        .map_err(ApiError::from)?;
    } else {
        device_discovery_store::update_run_state(
            &run_id,
            DiscoveryRunStateUpdate {
                status: "cancelled",
                phase: "cancelled",
                scanned_targets: run.scanned_targets,
                reachable_count: run.reachable_count,
                probed_targets: run.probed_targets,
                identified_count: run.identified_count,
                failed_count: run.failed_count,
                error: Some("discovery worker is no longer running"),
                started_at_ms: run.started_at_ms,
                completed_at_ms: Some(now_ms()),
            },
        )
        .await
        .map_err(ApiError::from)?;
    }
    discovery_run_detail(&run_id).await.map(Json)
}

pub async fn import_device_discovery_results(
    State(state): State<Arc<AppState>>,
    Path(run_id): Path<String>,
    Json(request): Json<ImportDiscoveryResultsRequest>,
) -> Result<Json<ImportDiscoveryResultsResponse>, ApiError> {
    import_device_discovery_run_results(state, run_id, request)
        .await
        .map(Json)
}

pub(crate) async fn import_device_discovery_run_results(
    state: Arc<AppState>,
    run_id: String,
    request: ImportDiscoveryResultsRequest,
) -> Result<ImportDiscoveryResultsResponse, ApiError> {
    let run = require_run(&run_id).await?;
    let mut response = ImportDiscoveryResultsResponse {
        total: request.items.len(),
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        results: Vec::with_capacity(request.items.len()),
    };

    for item in request.items {
        let result = import_discovery_result(&run, &item).await;
        match result {
            Ok(status) => {
                match status.as_str() {
                    "created" => response.created += 1,
                    "updated" => response.updated += 1,
                    _ => response.skipped += 1,
                }
                response.results.push(ImportDiscoveryResultResponse {
                    host: item.host,
                    port: item.port,
                    connection_name: item.connection_name,
                    status,
                    error: None,
                });
            }
            Err(error) => {
                response.failed += 1;
                response.results.push(ImportDiscoveryResultResponse {
                    host: item.host,
                    port: item.port,
                    connection_name: item.connection_name,
                    status: "failed".to_string(),
                    error: Some(error.to_string()),
                });
            }
        }
    }

    if response.created + response.updated > 0
        && let Some(registrar) = state.registrar()
        && let Err(error) = registrar.trigger_device_inventory_sync_if_changed(5).await
    {
        warn!(
            "failed to schedule device inventory sync after discovery import: {}",
            error
        );
    }
    Ok(response)
}

async fn execute_discovery_run(
    state: Arc<AppState>,
    run: DiscoveryRunRecord,
    addresses: Vec<IpAddr>,
    ports: Vec<u16>,
    credential_ids: Vec<String>,
    cancel_rx: watch::Receiver<bool>,
) -> anyhow::Result<()> {
    let started_at_ms = now_ms();
    let mut scanned_targets = 0;
    let mut reachable_count = 0;
    let mut probed_targets = 0;
    let mut identified_count = 0;
    let mut failed_count = 0;
    device_discovery_store::update_run_state(
        &run.id,
        DiscoveryRunStateUpdate {
            status: "running",
            phase: "tcp_scan",
            scanned_targets: 0,
            reachable_count: 0,
            probed_targets: 0,
            identified_count: 0,
            failed_count: 0,
            error: None,
            started_at_ms: Some(started_at_ms),
            completed_at_ms: None,
        },
    )
    .await?;

    let scan_targets = addresses
        .into_iter()
        .flat_map(|address| ports.iter().copied().map(move |port| (address, port)))
        .collect::<Vec<_>>();
    let tcp_timeout = Duration::from_millis(run.tcp_timeout_ms);
    let mut scans = stream::iter(scan_targets)
        .map(|(address, port)| async move {
            let probe = probe_ssh_port(address, port, tcp_timeout).await;
            (address, port, probe)
        })
        .buffer_unordered(run.concurrency);
    let mut reachable = Vec::new();
    while let Some((address, port, probe)) = scans.next().await {
        if *cancel_rx.borrow() {
            return finish_cancelled(
                &run.id,
                scanned_targets,
                reachable_count,
                probed_targets,
                identified_count,
                failed_count,
                started_at_ms,
            )
            .await;
        }
        scanned_targets += 1;
        let host = address.to_string();
        let existing_connection_name = connection_store::list_connections_by_endpoint(&host, port)?
            .into_iter()
            .next();
        if probe.is_reachable() {
            reachable_count += 1;
            reachable.push((
                address,
                port,
                probe.latency_ms().unwrap_or_default(),
                existing_connection_name.clone(),
            ));
        } else {
            failed_count += 1;
        }
        device_discovery_store::upsert_result(&DiscoveryResultRecord {
            run_id: run.id.clone(),
            host,
            port,
            status: probe.status().to_string(),
            latency_ms: probe.latency_ms(),
            credential_id: None,
            device_profile: None,
            device_model: None,
            software_version: None,
            existing_connection_name,
            imported_connection_name: None,
            error: probe.error(),
            updated_at_ms: now_ms(),
        })
        .await?;
        device_discovery_store::update_run_state(
            &run.id,
            DiscoveryRunStateUpdate {
                status: "running",
                phase: "tcp_scan",
                scanned_targets,
                reachable_count,
                probed_targets,
                identified_count,
                failed_count,
                error: None,
                started_at_ms: Some(started_at_ms),
                completed_at_ms: None,
            },
        )
        .await?;
    }

    device_discovery_store::update_run_state(
        &run.id,
        DiscoveryRunStateUpdate {
            status: "running",
            phase: "ssh_probe",
            scanned_targets,
            reachable_count,
            probed_targets,
            identified_count,
            failed_count,
            error: None,
            started_at_ms: Some(started_at_ms),
            completed_at_ms: None,
        },
    )
    .await?;
    let mut probes = stream::iter(reachable)
        .map(|target| {
            probe_reachable_target(
                state.clone(),
                run.id.clone(),
                target,
                credential_ids.clone(),
                run.probe_timeout_secs,
                cancel_rx.clone(),
            )
        })
        .buffer_unordered(run.concurrency.min(32));
    while let Some(result) = probes.next().await {
        if *cancel_rx.borrow() {
            return finish_cancelled(
                &run.id,
                scanned_targets,
                reachable_count,
                probed_targets,
                identified_count,
                failed_count,
                started_at_ms,
            )
            .await;
        }
        let result = result?;
        probed_targets += 1;
        if result.status == "identified" {
            identified_count += 1;
        } else if result.status == "probe_failed" {
            failed_count += 1;
        }
        device_discovery_store::upsert_result(&result).await?;
        device_discovery_store::update_run_state(
            &run.id,
            DiscoveryRunStateUpdate {
                status: "running",
                phase: "ssh_probe",
                scanned_targets,
                reachable_count,
                probed_targets,
                identified_count,
                failed_count,
                error: None,
                started_at_ms: Some(started_at_ms),
                completed_at_ms: None,
            },
        )
        .await?;
    }

    device_discovery_store::update_run_state(
        &run.id,
        DiscoveryRunStateUpdate {
            status: "completed",
            phase: "completed",
            scanned_targets,
            reachable_count,
            probed_targets,
            identified_count,
            failed_count,
            error: None,
            started_at_ms: Some(started_at_ms),
            completed_at_ms: Some(now_ms()),
        },
    )
    .await?;
    Ok(())
}

async fn probe_ssh_port(address: IpAddr, port: u16, probe_timeout: Duration) -> SshPortProbe {
    let started = Instant::now();
    let mut stream = match timeout(
        probe_timeout,
        tokio::net::TcpStream::connect(SocketAddr::new(address, port)),
    )
    .await
    {
        Ok(Ok(stream)) => stream,
        Ok(Err(error)) => {
            return SshPortProbe::Unreachable {
                error: format!("TCP connection failed: {error}"),
            };
        }
        Err(_) => {
            return SshPortProbe::Unreachable {
                error: format!(
                    "TCP connection timed out after {} ms",
                    probe_timeout.as_millis()
                ),
            };
        }
    };

    let identification_result = timeout(probe_timeout, async {
        stream.write_all(SSH_DISCOVERY_IDENTIFICATION).await?;
        let mut received = Vec::with_capacity(256);
        let mut buffer = [0_u8; 256];
        loop {
            let read_count = stream.read(&mut buffer).await?;
            if read_count == 0 {
                return Ok::<bool, std::io::Error>(false);
            }
            received.extend_from_slice(&buffer[..read_count]);
            if contains_ssh_identification(&received) {
                return Ok(true);
            }
            if received.len() >= MAX_SSH_IDENTIFICATION_BYTES {
                return Ok(false);
            }
        }
    })
    .await;
    let latency_ms = started.elapsed().as_millis() as u64;
    match identification_result {
        Ok(Ok(true)) => SshPortProbe::Reachable { latency_ms },
        Ok(Ok(false)) => SshPortProbe::NotSsh {
            latency_ms,
            error: "TCP connection succeeded but the peer closed without an SSH identification"
                .to_string(),
        },
        Ok(Err(error)) => SshPortProbe::NotSsh {
            latency_ms,
            error: format!("TCP connection succeeded but SSH identification failed: {error}"),
        },
        Err(_) => SshPortProbe::NotSsh {
            latency_ms,
            error: format!(
                "TCP connection succeeded but no SSH identification was received within {} ms",
                probe_timeout.as_millis()
            ),
        },
    }
}

fn contains_ssh_identification(received: &[u8]) -> bool {
    received.split(|byte| *byte == b'\n').any(|line| {
        let line = line.strip_suffix(b"\r").unwrap_or(line);
        line.starts_with(b"SSH-2.0-") || line.starts_with(b"SSH-1.99-")
    })
}

async fn probe_reachable_target(
    state: Arc<AppState>,
    run_id: String,
    target: (IpAddr, u16, u64, Option<String>),
    credential_ids: Vec<String>,
    probe_timeout_secs: u64,
    mut cancel_rx: watch::Receiver<bool>,
) -> anyhow::Result<DiscoveryResultRecord> {
    let (address, port, latency_ms, existing_connection_name) = target;
    let host = address.to_string();
    let mut last_error = None;
    for credential_id in credential_ids {
        if *cancel_rx.borrow() {
            break;
        }
        let request = ConnectionTestRequest {
            connection: Some(ConnectionRequest {
                host: Some(host.clone()),
                credential_id: Some(credential_id.clone()),
                port: Some(port),
                connect_timeout_secs: Some(probe_timeout_secs),
                device_profile: Some("autodetect".to_string()),
                ..Default::default()
            }),
        };
        let detect = detect_connection_facts(State(state.clone()), Json(request));
        let result = tokio::select! {
            _ = cancel_rx.changed() => None,
            result = timeout(Duration::from_secs(probe_timeout_secs), detect) => Some(result),
        };
        match result {
            Some(Ok(Ok(Json(facts)))) => {
                return Ok(DiscoveryResultRecord {
                    run_id,
                    host,
                    port,
                    status: "identified".to_string(),
                    latency_ms: Some(latency_ms),
                    credential_id: Some(credential_id),
                    device_profile: Some(facts.device_profile),
                    device_model: facts.device_model,
                    software_version: facts.software_version,
                    existing_connection_name,
                    imported_connection_name: None,
                    error: facts.warning,
                    updated_at_ms: now_ms(),
                });
            }
            Some(Ok(Err(error))) => last_error = Some(error.message),
            Some(Err(_)) => {
                last_error = Some(format!(
                    "device probe timed out after {} seconds",
                    probe_timeout_secs
                ));
            }
            None => break,
        }
    }
    Ok(DiscoveryResultRecord {
        run_id,
        host,
        port,
        status: if *cancel_rx.borrow() {
            "cancelled"
        } else {
            "probe_failed"
        }
        .to_string(),
        latency_ms: Some(latency_ms),
        credential_id: None,
        device_profile: None,
        device_model: None,
        software_version: None,
        existing_connection_name,
        imported_connection_name: None,
        error: last_error,
        updated_at_ms: now_ms(),
    })
}

async fn finish_cancelled(
    run_id: &str,
    scanned_targets: usize,
    reachable_count: usize,
    probed_targets: usize,
    identified_count: usize,
    failed_count: usize,
    started_at_ms: u64,
) -> anyhow::Result<()> {
    device_discovery_store::update_run_state(
        run_id,
        DiscoveryRunStateUpdate {
            status: "cancelled",
            phase: "cancelled",
            scanned_targets,
            reachable_count,
            probed_targets,
            identified_count,
            failed_count,
            error: None,
            started_at_ms: Some(started_at_ms),
            completed_at_ms: Some(now_ms()),
        },
    )
    .await
}

fn failed_discovery_run_state<'a>(
    run: Option<&DiscoveryRunRecord>,
    error: &'a str,
    completed_at_ms: u64,
) -> DiscoveryRunStateUpdate<'a> {
    DiscoveryRunStateUpdate {
        status: "failed",
        phase: "failed",
        scanned_targets: run.map_or(0, |run| run.scanned_targets),
        reachable_count: run.map_or(0, |run| run.reachable_count),
        probed_targets: run.map_or(0, |run| run.probed_targets),
        identified_count: run.map_or(0, |run| run.identified_count),
        failed_count: run.map_or(0, |run| run.failed_count),
        error: Some(error),
        started_at_ms: run.and_then(|run| run.started_at_ms),
        completed_at_ms: Some(completed_at_ms),
    }
}

async fn import_discovery_result(
    run: &DiscoveryRunRecord,
    item: &crate::web::models::ImportDiscoveryResultItem,
) -> anyhow::Result<String> {
    let result = device_discovery_store::get_result(&run.id, item.host.trim(), item.port)
        .await?
        .ok_or_else(|| anyhow::anyhow!("discovery result not found"))?;
    if result.status != "identified" {
        anyhow::bail!("only identified devices can be imported");
    }
    let connection_name = connection_store::safe_connection_name(&item.connection_name)?;
    let credential_id = item
        .credential_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or(result.credential_id.clone())
        .ok_or_else(|| anyhow::anyhow!("device credential is required"))?;
    device_credential_store::get_credential(&credential_id)?;

    let endpoint_connections =
        connection_store::list_connections_by_endpoint(&result.host, item.port)?;
    if !endpoint_connections.is_empty() {
        anyhow::bail!(
            "endpoint is already saved as '{}'",
            endpoint_connections.join(", ")
        );
    }
    let existing = connection_store::load_connection_raw(&connection_name).ok();
    if existing.is_some() && !item.overwrite {
        return Ok("skipped".to_string());
    }
    let data = SavedConnection {
        host: Some(result.host.clone()),
        credential_id: Some(credential_id),
        port: Some(item.port),
        connect_timeout_secs: existing
            .as_ref()
            .and_then(|connection| connection.connect_timeout_secs),
        device_model: result.device_model.clone(),
        software_version: result.software_version.clone(),
        ssh_security: existing
            .as_ref()
            .and_then(|connection| connection.ssh_security),
        linux_shell_flavor: existing
            .as_ref()
            .and_then(|connection| connection.linux_shell_flavor),
        device_profile: result.device_profile.clone(),
        template_dir: existing
            .as_ref()
            .and_then(|connection| connection.template_dir.clone()),
        enabled: true,
        labels: item
            .labels
            .clone()
            .unwrap_or_else(|| run.default_labels.clone()),
        vars: existing
            .as_ref()
            .map(|connection| connection.vars.clone())
            .unwrap_or_else(|| serde_json::json!({})),
        groups: item
            .groups
            .clone()
            .unwrap_or_else(|| run.default_groups.clone()),
    };
    connection_store::save_connection(&connection_name, &data)?;
    device_discovery_store::upsert_result(&DiscoveryResultRecord {
        imported_connection_name: Some(connection_name.clone()),
        updated_at_ms: now_ms(),
        ..result
    })
    .await?;
    Ok(if existing.is_some() {
        "updated"
    } else {
        "created"
    }
    .to_string())
}

async fn require_run(run_id: &str) -> Result<DiscoveryRunRecord, ApiError> {
    device_discovery_store::get_run(run_id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| ApiError {
            status: StatusCode::NOT_FOUND,
            message: format!("device discovery run '{}' not found", run_id),
        })
}

async fn discovery_run_detail(run_id: &str) -> Result<DiscoveryRunDetailResponse, ApiError> {
    Ok(DiscoveryRunDetailResponse {
        run: require_run(run_id).await?,
        results: device_discovery_store::list_results(run_id)
            .await
            .map_err(ApiError::from)?,
    })
}

fn validate_discovery_options(
    request: &CreateDiscoveryRunRequest,
    credential_ids: &[String],
) -> Result<(), ApiError> {
    if credential_ids.is_empty() {
        return Err(ApiError::bad_request(
            "at least one device credential is required",
        ));
    }
    if credential_ids.len() > MAX_DISCOVERY_CREDENTIALS {
        return Err(ApiError::bad_request(format!(
            "at most {} credentials can be tried per discovery run",
            MAX_DISCOVERY_CREDENTIALS
        )));
    }
    if request.concurrency == 0 || request.concurrency > MAX_DISCOVERY_CONCURRENCY {
        return Err(ApiError::bad_request(format!(
            "concurrency must be between 1 and {}",
            MAX_DISCOVERY_CONCURRENCY
        )));
    }
    if request.tcp_timeout_ms == 0 || request.tcp_timeout_ms > MAX_TCP_TIMEOUT_MS {
        return Err(ApiError::bad_request(format!(
            "tcp_timeout_ms must be between 1 and {}",
            MAX_TCP_TIMEOUT_MS
        )));
    }
    if request.probe_timeout_secs == 0 || request.probe_timeout_secs > MAX_PROBE_TIMEOUT_SECS {
        return Err(ApiError::bad_request(format!(
            "probe_timeout_secs must be between 1 and {}",
            MAX_PROBE_TIMEOUT_SECS
        )));
    }
    Ok(())
}

fn normalize_ports(ports: &[u16]) -> Result<Vec<u16>, String> {
    let mut normalized = ports
        .iter()
        .copied()
        .filter(|port| *port > 0)
        .collect::<Vec<_>>();
    normalized.sort_unstable();
    normalized.dedup();
    if normalized.is_empty() {
        return Err("at least one valid TCP port is required".to_string());
    }
    if normalized.len() > MAX_DISCOVERY_PORTS {
        return Err(format!(
            "at most {} TCP ports can be scanned",
            MAX_DISCOVERY_PORTS
        ));
    }
    Ok(normalized)
}

fn normalize_names(values: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();
    let mut seen = HashSet::new();
    for value in values {
        let value = value.trim();
        if !value.is_empty() && seen.insert(value.to_string()) {
            normalized.push(value.to_string());
        }
    }
    normalized
}

fn parse_discovery_targets(values: &[String]) -> Result<Vec<IpAddr>, String> {
    let tokens = values
        .iter()
        .flat_map(|value| value.split([',', '\n', '\r']))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    if tokens.is_empty() {
        return Err("at least one IP address, range, or CIDR is required".to_string());
    }
    let mut addresses = BTreeSet::new();
    for token in tokens {
        append_target(token, &mut addresses)?;
        if addresses.len() > MAX_DISCOVERY_ADDRESSES {
            return Err(format!(
                "discovery scope exceeds {} unique addresses",
                MAX_DISCOVERY_ADDRESSES
            ));
        }
    }
    Ok(addresses.into_iter().collect())
}

fn append_target(token: &str, addresses: &mut BTreeSet<IpAddr>) -> Result<(), String> {
    if let Ok(network) = IpNet::from_str(token) {
        for address in network.hosts() {
            addresses.insert(address);
            if addresses.len() > MAX_DISCOVERY_ADDRESSES {
                break;
            }
        }
        return Ok(());
    }
    if let Some((start, end)) = token.split_once('-') {
        let start_address = IpAddr::from_str(start.trim())
            .map_err(|_| format!("invalid discovery target '{}'", token))?;
        let end_address = parse_range_end(start_address, end.trim())
            .map_err(|error| format!("invalid discovery target '{}': {}", token, error))?;
        append_range(start_address, end_address, addresses)?;
        return Ok(());
    }
    addresses.insert(
        IpAddr::from_str(token).map_err(|_| format!("invalid discovery target '{}'", token))?,
    );
    Ok(())
}

fn parse_range_end(start: IpAddr, raw_end: &str) -> Result<IpAddr, String> {
    if let Ok(end) = IpAddr::from_str(raw_end) {
        return Ok(end);
    }
    if let (IpAddr::V4(start), Ok(last_octet)) = (start, raw_end.parse::<u8>()) {
        let [a, b, c, _] = start.octets();
        return Ok(IpAddr::V4(Ipv4Addr::new(a, b, c, last_octet)));
    }
    Err("range end must be a complete IP or IPv4 last octet".to_string())
}

fn append_range(
    start: IpAddr,
    end: IpAddr,
    addresses: &mut BTreeSet<IpAddr>,
) -> Result<(), String> {
    match (start, end) {
        (IpAddr::V4(start), IpAddr::V4(end)) => {
            let (start, end) = (u32::from(start), u32::from(end));
            if start > end {
                return Err("range start must not exceed range end".to_string());
            }
            for value in start..=end {
                addresses.insert(IpAddr::V4(Ipv4Addr::from(value)));
                if addresses.len() > MAX_DISCOVERY_ADDRESSES {
                    break;
                }
            }
        }
        (IpAddr::V6(start), IpAddr::V6(end)) => {
            let (start, end) = (u128::from(start), u128::from(end));
            if start > end {
                return Err("range start must not exceed range end".to_string());
            }
            if end - start >= MAX_DISCOVERY_ADDRESSES as u128 {
                return Err(format!(
                    "IPv6 range exceeds {} addresses",
                    MAX_DISCOVERY_ADDRESSES
                ));
            }
            for value in start..=end {
                addresses.insert(IpAddr::V6(value.into()));
            }
        }
        _ => return Err("range cannot mix IPv4 and IPv6 addresses".to_string()),
    }
    Ok(())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

async fn record_discovery_task(state: &AppState, run_id: &str) -> anyhow::Result<()> {
    let run = device_discovery_store::get_run(run_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("device discovery run not found"))?;
    let completed = run.status == "completed";
    let outcome = if !completed {
        TaskResultOutcome::Failed
    } else if run.identified_count > 0 && run.failed_count > 0 {
        TaskResultOutcome::PartialSuccess
    } else {
        TaskResultOutcome::Success
    };
    let summary = format!(
        "Discovered {} device(s) from {} scanned target(s)",
        run.identified_count, run.scanned_targets
    );
    let result_summary = task_result_with_details(
        task_result_with_counts(
            build_result_summary(TaskOperation::DeviceDiscovery, outcome, summary),
            result_counts(
                run.total_targets as u64,
                run.identified_count as u64,
                run.failed_count as u64,
            ),
        ),
        serde_json::json!({
            "run_id": run.id,
            "phase": run.phase,
            "reachable_count": run.reachable_count,
        }),
    );
    let started_at_ms = run.started_at_ms.unwrap_or(run.created_at_ms);
    let completed_at_ms = run.completed_at_ms.unwrap_or_else(now_ms);
    let callback = TaskCallback {
        task_id: run.id.clone(),
        agent_name: state.agent_name().unwrap_or_else(|| "local".to_string()),
        status: if completed {
            TaskStatus::Success
        } else {
            TaskStatus::Failed
        },
        started_at: timestamp_rfc3339(started_at_ms),
        completed_at: timestamp_rfc3339(completed_at_ms),
        execution_time_ms: completed_at_ms.saturating_sub(started_at_ms),
        result_summary: Some(result_summary),
        result: Some(serde_json::json!({
            "run_id": run.id,
            "status": run.status,
            "identified_count": run.identified_count,
            "reachable_count": run.reachable_count,
            "failed_count": run.failed_count,
        })),
        error: (!completed).then(|| {
            run.error
                .unwrap_or_else(|| "device discovery was cancelled".to_string())
        }),
    };
    task_store::save_task_callback(&callback, TaskOperation::DeviceDiscovery)
}

fn timestamp_rfc3339(timestamp_ms: u64) -> String {
    chrono::DateTime::from_timestamp_millis(timestamp_ms as i64)
        .unwrap_or_else(chrono::Utc::now)
        .to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpListener;

    async fn spawn_identification_peer(response: Option<&'static [u8]>) -> SocketAddr {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
            .await
            .expect("bind discovery test listener");
        let address = listener.local_addr().expect("listener address");
        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.expect("accept discovery probe");
            if let Some(response) = response {
                socket
                    .write_all(response)
                    .await
                    .expect("write identification");
            } else {
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        });
        address
    }

    #[test]
    fn parses_and_deduplicates_single_range_and_cidr_targets() {
        let targets = parse_discovery_targets(&[
            "192.0.2.1, 192.0.2.2-3".to_string(),
            "192.0.2.0/30".to_string(),
        ])
        .expect("targets");
        assert_eq!(
            targets,
            vec![
                IpAddr::from_str("192.0.2.1").unwrap(),
                IpAddr::from_str("192.0.2.2").unwrap(),
                IpAddr::from_str("192.0.2.3").unwrap(),
            ]
        );
    }

    #[test]
    fn rejects_oversized_discovery_scopes() {
        let error = parse_discovery_targets(&["10.0.0.0/16".to_string()])
            .expect_err("scope should be rejected");
        assert!(error.contains("4096"));
    }

    #[test]
    fn normalizes_ports_and_rejects_large_lists() {
        assert_eq!(normalize_ports(&[22, 2222, 22]).unwrap(), vec![22, 2222]);
        assert!(normalize_ports(&(1..=17).collect::<Vec<_>>()).is_err());
    }

    #[test]
    fn normalizes_names_without_reordering_probe_credentials() {
        assert_eq!(
            normalize_names(&[
                " fallback ".to_string(),
                "primary".to_string(),
                "fallback".to_string(),
            ]),
            vec!["fallback".to_string(), "primary".to_string()]
        );
    }

    #[test]
    fn failed_run_state_preserves_persisted_progress() {
        let run = DiscoveryRunRecord {
            id: "run-1".to_string(),
            status: "running".to_string(),
            phase: "ssh_probe".to_string(),
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
            reachable_count: 12,
            probed_targets: 7,
            identified_count: 5,
            failed_count: 247,
            error: None,
            created_at_ms: 100,
            started_at_ms: Some(110),
            completed_at_ms: None,
        };

        let update = failed_discovery_run_state(Some(&run), "database unavailable", 200);

        assert_eq!(update.status, "failed");
        assert_eq!(update.phase, "failed");
        assert_eq!(update.scanned_targets, 254);
        assert_eq!(update.reachable_count, 12);
        assert_eq!(update.probed_targets, 7);
        assert_eq!(update.identified_count, 5);
        assert_eq!(update.failed_count, 247);
        assert_eq!(update.error, Some("database unavailable"));
        assert_eq!(update.started_at_ms, Some(110));
        assert_eq!(update.completed_at_ms, Some(200));
    }

    #[test]
    fn recognizes_supported_ssh_identification_lines() {
        assert!(contains_ssh_identification(b"SSH-2.0-OpenSSH_9.6\r\n"));
        assert!(contains_ssh_identification(
            b"authorized access only\r\nSSH-1.99-network-os\r\n"
        ));
        assert!(!contains_ssh_identification(
            b"HTTP/1.1 400 Bad Request\r\n"
        ));
    }

    #[tokio::test]
    async fn ssh_port_probe_requires_an_ssh_identification() {
        let ssh_address =
            spawn_identification_peer(Some(b"SSH-2.0-OpenSSH_discovery-test\r\n")).await;
        let ssh_result = probe_ssh_port(
            ssh_address.ip(),
            ssh_address.port(),
            Duration::from_millis(100),
        )
        .await;
        assert!(matches!(ssh_result, SshPortProbe::Reachable { .. }));

        let http_address =
            spawn_identification_peer(Some(b"HTTP/1.1 400 Bad Request\r\n\r\n")).await;
        let http_result = probe_ssh_port(
            http_address.ip(),
            http_address.port(),
            Duration::from_millis(100),
        )
        .await;
        assert!(matches!(http_result, SshPortProbe::NotSsh { .. }));

        let silent_address = spawn_identification_peer(None).await;
        let silent_result = probe_ssh_port(
            silent_address.ip(),
            silent_address.port(),
            Duration::from_millis(20),
        )
        .await;
        assert!(matches!(silent_result, SshPortProbe::NotSsh { .. }));
    }
}
