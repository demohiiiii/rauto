use super::*;
use super::mapping::{
    map_recording_entry_to_task_event, parse_task_event_level, parse_task_event_type,
    recording_entry_occurred_at,
};
use super::types::{
    RecordingEventForwarder, RecordingEventPlan, TaskEventInput, TaskReportContext,
};

pub(crate) fn spawn_recording_event_forwarder(
    state: &Arc<AppState>,
    task_ctx: &Option<TaskReportContext>,
    recorder: &SessionRecorder,
    plan: RecordingEventPlan,
) -> Option<RecordingEventForwarder> {
    let task_ctx = task_ctx.clone()?;
    let registrar = state.registrar()?;
    let agent_name = current_agent_name(state);
    // The recorder may already contain connection setup entries before we subscribe.
    // The forwarder only observes entries emitted after subscription, so finish()
    // must wait for the delta, not the absolute recorder length.
    let initial_entries = recorder.entries().ok().map_or(0, |entries| entries.len());
    let mut rx = recorder.subscribe();
    let (finish_tx, mut finish_rx) = oneshot::channel::<usize>();

    let join_handle = tokio::spawn(async move {
        let mut processed_entries = 0usize;
        let mut expected_entries: Option<usize> = None;

        loop {
            tokio::select! {
                result = &mut finish_rx, if expected_entries.is_none() => {
                    match result {
                        Ok(expected) => expected_entries = Some(expected),
                        Err(_) => break,
                    }
                }
                result = rx.recv() => {
                    match result {
                        Ok(entry) => {
                            processed_entries += 1;
                            if let Some(event_input) = map_recording_entry_to_task_event(&entry, &plan) {
                                let event = TaskEvent {
                                    task_id: task_ctx.task_id.clone(),
                                    agent_name: agent_name.clone(),
                                    event_type: parse_task_event_type(&event_input.event_type),
                                    message: event_input.message,
                                    level: parse_task_event_level(&event_input.level),
                                    stage: event_input.stage,
                                    progress: event_input.progress,
                                    details: event_input.details,
                                    occurred_at: recording_entry_occurred_at(entry.ts_ms),
                                };
                                registrar.report_task_event_best_effort(event).await;
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(skipped)) => {
                            processed_entries += skipped as usize;
                            let event = TaskEvent {
                                task_id: task_ctx.task_id.clone(),
                                agent_name: agent_name.clone(),
                                event_type: TaskEventType::Warning,
                                message: format!(
                                    "Live task event stream lagged, skipped {} recorder events",
                                    skipped
                                ),
                                level: TaskEventLevel::Warning,
                                stage: Some(task_ctx.operation.to_string()),
                                progress: None,
                                details: Some(json!({ "skipped_events": skipped })),
                                occurred_at: Utc::now().to_rfc3339(),
                            };
                            registrar.report_task_event_best_effort(event).await;
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                    }
                }
            }

            if let Some(expected) = expected_entries
                && processed_entries >= expected
            {
                break;
            }
        }
    });

    Some(RecordingEventForwarder {
        initial_entries,
        finish_tx,
        join_handle,
    })
}

pub(crate) fn emit_task_event(
    state: &Arc<AppState>,
    task_ctx: &Option<TaskReportContext>,
    event: TaskEventInput,
) {
    let Some(task_ctx) = task_ctx.clone() else {
        return;
    };
    let Some(registrar) = state.registrar() else {
        return;
    };
    let state = state.clone();
    tokio::spawn(async move {
        let event = TaskEvent {
            task_id: task_ctx.task_id,
            agent_name: current_agent_name(&state),
            event_type: parse_task_event_type(&event.event_type),
            message: event.message,
            level: parse_task_event_level(&event.level),
            stage: event.stage,
            progress: event.progress,
            details: event.details,
            occurred_at: Utc::now().to_rfc3339(),
        };
        if let Err(err) = task_store::append_task_event(&event.task_id, task_ctx.operation, &event)
        {
            warn!("failed to persist task event {}: {}", event.task_id, err);
        }
        registrar.report_task_event_best_effort(event).await;
    });
}
