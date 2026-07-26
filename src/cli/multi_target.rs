use crate::config::connection_store;
use anyhow::Result;
use std::collections::{BTreeSet, VecDeque};
use std::future::Future;
use tokio::task::JoinSet;

/// Default number of devices a multi-target CLI command executes concurrently
/// when `--max-parallel` is not specified. Matches the web batch default.
pub(crate) const DEFAULT_MULTI_TARGET_PARALLEL: usize = 4;

pub(crate) fn multi_target_concurrency(max_parallel: Option<usize>, total_targets: usize) -> usize {
    max_parallel
        .unwrap_or(DEFAULT_MULTI_TARGET_PARALLEL)
        .max(1)
        .min(total_targets.max(1))
}

/// Returns true when any multi-target selector (`--target`, `--group`,
/// `--label`) is present, switching the command into fan-out mode.
pub(crate) fn has_multi_target_selectors(
    targets: &[String],
    groups: &[String],
    labels: &[String],
) -> bool {
    !targets.is_empty() || !groups.is_empty() || !labels.is_empty()
}

/// Resolves the deduplicated, sorted set of saved connection names selected by
/// `--target`, `--group`, `--label`, and the global `-c` connection option.
pub(crate) fn resolve_multi_target_names(
    connection: Option<&str>,
    targets: &[String],
    groups: &[String],
    labels: &[String],
) -> Result<Vec<String>> {
    let mut names = BTreeSet::new();
    if let Some(connection) = connection {
        names.insert(connection_store::safe_connection_name(connection)?);
    }
    for target in targets {
        names.insert(connection_store::safe_connection_name(target)?);
    }
    for connection in connection_store::list_connections_by_groups_any(groups)? {
        names.insert(connection);
    }
    for connection in connection_store::list_connections_by_labels_any(labels)? {
        names.insert(connection);
    }
    Ok(names.into_iter().collect())
}

/// Outcome of one concurrently executed target: its buffered console output
/// plus the execution result carrying an optional parsed payload.
pub(crate) struct MultiTargetRun<P> {
    pub name: String,
    pub output: String,
    pub result: Result<Option<P>>,
}

/// Aggregated outcome of a multi-target run. Both vectors preserve the input
/// order of the resolved targets regardless of completion order.
pub(crate) struct MultiTargetOutcome<P> {
    pub parsed: Vec<P>,
    pub errors: Vec<String>,
}

/// Runs every resolved target through `execute` with bounded concurrency.
///
/// Each target's console output is buffered by `execute` and printed as one
/// atomic block when the target completes (completion order), so concurrent
/// targets never interleave on stdout. Failures are reported to stderr as they
/// happen and collected into the outcome in input order.
pub(crate) async fn run_buffered_multi_target<T, P, F, Fut>(
    resolved_targets: Vec<T>,
    concurrency: usize,
    execute: F,
) -> Result<MultiTargetOutcome<P>>
where
    T: Send + 'static,
    P: Send + 'static,
    F: Fn(T) -> Fut + Clone + Send + 'static,
    Fut: Future<Output = MultiTargetRun<P>> + Send + 'static,
{
    let total_targets = resolved_targets.len();
    let mut pending: VecDeque<(usize, T)> = resolved_targets.into_iter().enumerate().collect();
    let mut join_set = JoinSet::new();
    let mut parsed_slots: Vec<Option<P>> = std::iter::repeat_with(|| None)
        .take(total_targets)
        .collect();
    let mut error_slots: Vec<Option<String>> = vec![None; total_targets];
    while !pending.is_empty() || !join_set.is_empty() {
        while join_set.len() < concurrency && !pending.is_empty() {
            let (idx, target) = pending.pop_front().expect("pending multi target");
            let execute = execute.clone();
            join_set.spawn(async move { (idx, execute(target).await) });
        }
        let Some(joined) = join_set.join_next().await else {
            break;
        };
        let (idx, run) = joined.map_err(|e| anyhow::anyhow!("multi-target task failed: {}", e))?;
        if !run.output.is_empty() {
            print!("{}", run.output);
        }
        match run.result {
            Ok(Some(parsed)) => parsed_slots[idx] = Some(parsed),
            Ok(None) => {}
            Err(err) => {
                eprintln!("target '{}' failed: {err:#}", run.name);
                error_slots[idx] = Some(format!("{}: {err:#}", run.name));
            }
        }
    }
    Ok(MultiTargetOutcome {
        parsed: parsed_slots.into_iter().flatten().collect(),
        errors: error_slots.into_iter().flatten().collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn concurrency_clamps_to_valid_range() {
        assert_eq!(multi_target_concurrency(None, 10), 4);
        assert_eq!(multi_target_concurrency(None, 2), 2);
        assert_eq!(multi_target_concurrency(Some(0), 10), 1);
        assert_eq!(multi_target_concurrency(Some(8), 3), 3);
        assert_eq!(multi_target_concurrency(Some(5), 0), 1);
    }

    #[tokio::test]
    async fn driver_preserves_input_order_and_collects_errors() {
        let targets: Vec<usize> = (0..6).collect();
        let outcome = run_buffered_multi_target(targets, 3, |idx| async move {
            // Later targets finish first to exercise out-of-order completion.
            tokio::time::sleep(std::time::Duration::from_millis((6 - idx) as u64 * 5)).await;
            MultiTargetRun {
                name: format!("t{}", idx),
                output: String::new(),
                result: if idx % 2 == 0 {
                    Ok(Some(idx))
                } else {
                    Err(anyhow::anyhow!("boom {}", idx))
                },
            }
        })
        .await
        .expect("driver should not fail");

        assert_eq!(outcome.parsed, vec![0, 2, 4]);
        assert_eq!(
            outcome.errors,
            vec![
                "t1: boom 1".to_string(),
                "t3: boom 3".to_string(),
                "t5: boom 5".to_string()
            ]
        );
    }

    #[tokio::test]
    async fn driver_never_exceeds_requested_concurrency() {
        use std::sync::Arc;
        use std::sync::atomic::{AtomicUsize, Ordering};

        let active = Arc::new(AtomicUsize::new(0));
        let peak = Arc::new(AtomicUsize::new(0));
        let targets: Vec<usize> = (0..12).collect();
        let (active_ref, peak_ref) = (active.clone(), peak.clone());
        let outcome = run_buffered_multi_target(targets, 3, move |idx| {
            let active = active_ref.clone();
            let peak = peak_ref.clone();
            async move {
                let now = active.fetch_add(1, Ordering::SeqCst) + 1;
                peak.fetch_max(now, Ordering::SeqCst);
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
                active.fetch_sub(1, Ordering::SeqCst);
                MultiTargetRun {
                    name: format!("t{}", idx),
                    output: String::new(),
                    result: Ok(Some(idx)),
                }
            }
        })
        .await
        .expect("driver should not fail");

        assert_eq!(outcome.parsed.len(), 12);
        assert!(peak.load(Ordering::SeqCst) <= 3);
    }
}
