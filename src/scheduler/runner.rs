use super::executor::execute_claimed_run;
use crate::domain::scheduling::ScheduleRunStatus;
use crate::infrastructure::db::schedule_store;
use crate::web::state::AppState;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::Semaphore;
use tokio::task::{JoinHandle, JoinSet};
use tracing::{error, info, warn};

const MAX_CONCURRENCY: usize = 4;
const MAX_SLEEP: Duration = Duration::from_secs(30);

pub fn spawn_scheduler(state: Arc<AppState>) -> JoinHandle<()> {
    tokio::spawn(run_scheduler(state))
}

async fn run_scheduler(state: Arc<AppState>) {
    let owner = format!("scheduler-{:016x}", rand::random::<u64>());
    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENCY));
    let mut executions = JoinSet::new();
    let mut shutdown = state.subscribe_shutdown();
    info!(owner = %owner, "cron scheduler started");

    loop {
        reap_finished(&mut executions);
        let now = now_ms();
        if let Err(error) = schedule_store::enqueue_due_runs(now, 100).await {
            error!("failed to enqueue due cron schedules: {error:#}");
        }

        let available = semaphore.available_permits();
        if available > 0 {
            match schedule_store::claim_pending_runs(&owner, now, available).await {
                Ok(claimed_runs) => {
                    for claimed in claimed_runs {
                        let permit = semaphore
                            .clone()
                            .acquire_owned()
                            .await
                            .expect("scheduler semaphore must remain open");
                        let execution_state = state.clone();
                        let execution_owner = owner.clone();
                        executions.spawn(async move {
                            let result = execute_claimed_run(execution_state, &claimed).await;
                            let (status, error) = match result {
                                Ok(()) => (ScheduleRunStatus::Success, None),
                                Err(error) => (ScheduleRunStatus::Failed, Some(error)),
                            };
                            if let Err(store_error) = schedule_store::finish_run(
                                &claimed.run.id,
                                &execution_owner,
                                status,
                                error.as_deref(),
                            )
                            .await
                            {
                                error!(
                                    run_id = %claimed.run.id,
                                    "failed to finish cron run: {store_error:#}"
                                );
                            }
                            drop(permit);
                        });
                    }
                }
                Err(error) => error!("failed to claim pending cron runs: {error:#}"),
            }
        }

        let sleep_duration = next_sleep_duration().await;
        tokio::select! {
            _ = tokio::time::sleep(sleep_duration) => {}
            _ = state.wait_for_schedule_change() => {}
            changed = shutdown.changed() => {
                if changed.is_err() || *shutdown.borrow() {
                    break;
                }
            }
            joined = executions.join_next(), if !executions.is_empty() => {
                if let Some(Err(error)) = joined {
                    warn!("cron execution task failed to join: {error}");
                }
            }
        }
    }

    info!("cron scheduler stopping; waiting for active executions");
    while let Some(result) = executions.join_next().await {
        if let Err(error) = result {
            warn!("cron execution task failed to join during shutdown: {error}");
        }
    }
    info!("cron scheduler stopped");
}

fn reap_finished(executions: &mut JoinSet<()>) {
    while let Some(result) = executions.try_join_next() {
        if let Err(error) = result {
            warn!("cron execution task failed to join: {error}");
        }
    }
}

async fn next_sleep_duration() -> Duration {
    let Ok(Some(next_due)) = schedule_store::next_due_at_ms().await else {
        return MAX_SLEEP;
    };
    Duration::from_millis(next_due.saturating_sub(now_ms()).max(0) as u64).min(MAX_SLEEP)
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
