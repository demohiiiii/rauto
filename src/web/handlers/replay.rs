use crate::web::error::ApiError;
use crate::web::models::{ReplayContextDto, ReplayOutputDto, ReplayRequest, ReplayResponse};
use axum::Json;
use rneter::session::{SessionRecorder, SessionReplayer};

pub async fn replay_session(
    Json(req): Json<ReplayRequest>,
) -> Result<Json<ReplayResponse>, ApiError> {
    let mut replayer = SessionReplayer::from_jsonl(&req.jsonl).map_err(ApiError::from)?;
    let context = replayer.initial_context().map(|ctx| ReplayContextDto {
        device_addr: ctx.device_addr,
        prompt: ctx.prompt,
        fsm_prompt: ctx.fsm_prompt,
    });

    let entries = if req.list {
        let recorder = SessionRecorder::from_jsonl(&req.jsonl).map_err(ApiError::from)?;
        recorder.entries().map_err(ApiError::from)?
    } else {
        Vec::new()
    };

    let output = if let Some(command) = req.command.as_deref() {
        let out = if let Some(mode) = req.mode.as_deref() {
            replayer.replay_next_in_mode(command, mode)
        } else {
            replayer.replay_next(command)
        }
        .map_err(ApiError::from)?;
        Some(ReplayOutputDto {
            success: out.success,
            content: out.content,
            all: out.all,
            prompt: out.prompt,
        })
    } else {
        None
    };

    Ok(Json(ReplayResponse {
        context,
        entries,
        output,
    }))
}
