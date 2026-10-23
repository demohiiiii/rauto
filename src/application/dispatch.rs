use super::execution;
use super::state::AppState;
use crate::interfaces::api::models::*;
use std::sync::Arc;

pub fn execute(
    state: Arc<AppState>,
    request: ExecutionRequest,
) -> impl std::future::Future<Output = ExecutionReply> + Send {
    Box::pin(async move {
        state
            .run_until_shutdown(async { Ok(execute_request(state.clone(), request).await) })
            .await
            .unwrap_or_else(execution_failure)
    })
}

async fn execute_request(state: Arc<AppState>, request: ExecutionRequest) -> ExecutionReply {
    let options = request.options;
    let mut connection = options.connection;
    if let Some(selector) = options.credential.as_deref() {
        let metadata = crate::config::device_credential_store::find_credential_by_name(selector)
            .or_else(|_| crate::config::device_credential_store::get_credential(selector));
        match metadata {
            Ok(metadata) => connection.credential_id = Some(metadata.id),
            Err(_) => {
                return ExecutionReply::Failed(ExecutionFailure {
                    code: "invalid_request".into(),
                    message: format!("device credential '{selector}' was not found"),
                });
            }
        }
    }
    let overrides = connection.clone();
    // A CLI request carries its own defaults; service startup flags belong only
    // to the service's other adapters, regardless of where this request executes.
    let defaults = crate::cli::GlobalOpts::default();
    let defaults = crate::cli::GlobalOpts {
        connection: connection.connection_name,
        host: connection.host,
        credential: connection.credential_id,
        device_profile: connection.device_profile,
        port: connection.port,
        ssh_security: connection.ssh_security,
        linux_shell_flavor: connection.linux_shell_flavor,
        force_autodetect: options.force_autodetect,
        save_connection: options.save_device,
        session_retries: options
            .retry
            .max_retries
            .unwrap_or(defaults.session_retries),
        retry_initial_backoff_ms: options
            .retry
            .initial_backoff_ms
            .unwrap_or(defaults.retry_initial_backoff_ms),
        retry_max_backoff_ms: options
            .retry
            .max_backoff_ms
            .unwrap_or(defaults.retry_max_backoff_ms),
        retry_authentication_errors: options
            .retry
            .retry_authentication_errors
            .unwrap_or(defaults.retry_authentication_errors),
    };
    let mut scoped = (*state).clone();
    scoped.defaults = defaults;
    scoped.connection_overrides = Some(overrides);
    let state = Arc::new(scoped);
    let result = match request.action {
        ExecutionAction::Exec(req) => Box::pin(execution::exec_command(state.clone(), req))
            .await
            .and_then(execution_data)
            .map(ExecutionOutput::Exec),
        ExecutionAction::Show(req) => Box::pin(execution::execute_show(state.clone(), req))
            .await
            .and_then(execution_data)
            .map(ExecutionOutput::Show),
        ExecutionAction::ExecBatch(req) => {
            Box::pin(execution::execute_exec_batch(state.clone(), req))
                .await
                .and_then(execution_data)
                .map(ExecutionOutput::ExecBatch)
        }
        ExecutionAction::ShowBatch(req) => {
            Box::pin(execution::execute_show_batch(state.clone(), req))
                .await
                .and_then(execution_data)
                .map(ExecutionOutput::ShowBatch)
        }
        ExecutionAction::Template(req) => Box::pin(execution::execute_template_with_error_policy(
            state.clone(),
            req,
            options.template_error_policy,
        ))
        .await
        .and_then(execution_data)
        .map(ExecutionOutput::Template),
        ExecutionAction::Interactive(req) => {
            Box::pin(execution::execute_interactive(state.clone(), req))
                .await
                .and_then(execution_data)
                .map(ExecutionOutput::Interactive)
        }
        ExecutionAction::InteractiveBatch(req) => {
            Box::pin(execution::execute_interactive_batch(state.clone(), req))
                .await
                .and_then(execution_data)
                .map(ExecutionOutput::InteractiveBatch)
        }
        ExecutionAction::Workflow(req) => Box::pin(execution::execute_tx_workflow_with_input_mode(
            state.clone(),
            req,
            options.json_input_mode,
        ))
        .await
        .and_then(execution_data)
        .map(ExecutionOutput::Workflow),
        ExecutionAction::Orchestration(req) => {
            Box::pin(execution::execute_orchestration_with_input_mode(
                state.clone(),
                req,
                options.json_input_mode,
            ))
            .await
            .and_then(execution_data)
            .map(ExecutionOutput::Orchestration)
        }
        ExecutionAction::Config(req) => Box::pin(execution::fetch_config(state.clone(), req))
            .await
            .and_then(execution_data)
            .map(ExecutionOutput::Config),
        ExecutionAction::ConfigBatch(req) => {
            Box::pin(execution::fetch_config_batch(state.clone(), req))
                .await
                .and_then(execution_data)
                .map(ExecutionOutput::ConfigBatch)
        }
        ExecutionAction::Upload {
            mut request,
            content_base64,
        } => execute_upload_content(state.clone(), &mut request, &content_base64)
            .await
            .map(ExecutionOutput::Upload),
    };
    match result {
        Ok(mut output) => {
            apply_textfsm(
                &mut output,
                &request.textfsm_templates,
                request.textfsm_strict_errors,
            );
            ExecutionReply::Completed(Box::new(output))
        }
        Err(error) => execution_failure(error),
    }
}

fn execution_failure(error: super::error::ApiError) -> ExecutionReply {
    ExecutionReply::Failed(ExecutionFailure {
        code: if error.status == axum::http::StatusCode::SERVICE_UNAVAILABLE {
            "service_unavailable"
        } else if error.status.is_client_error() {
            "invalid_request"
        } else {
            "execution_failed"
        }
        .into(),
        message: error.message,
    })
}

async fn execute_upload_content(
    state: Arc<AppState>,
    request: &mut ExecuteUploadRequest,
    content: &str,
) -> Result<ExecuteUploadResponse, super::error::ApiError> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(content)
        .map_err(|_| super::error::ApiError::bad_request("invalid upload content"))?;
    let upload = crate::infrastructure::upload::StagedUpload::create(
        &crate::config::paths::rauto_home_dir().join("uploads"),
        &bytes,
    )?;
    request.local_path = upload
        .path()
        .file_name()
        .expect("upload filename")
        .to_string_lossy()
        .into_owned();
    execution::execute_upload(state, request.clone())
        .await?
        .data
        .ok_or_else(|| super::error::ApiError::internal("missing upload result"))
}

fn apply_textfsm(output: &mut ExecutionOutput, templates: &[String], strict: bool) {
    if templates.is_empty() {
        return;
    }
    let parse = |result: &mut CommandResult, index: usize| {
        let template = &templates[index.min(templates.len() - 1)];
        let (parsed, error) = crate::config::textfsm::parse_command_output_optional(
            result.output.as_deref().unwrap_or_default(),
            &result.command,
            &crate::config::textfsm::ParseOptions {
                template_content: Some(template.clone()),
                enabled: true,
                filter_error_rules: !strict,
                ..Default::default()
            },
        );
        result.parsed_output = parsed;
        result.parse_error = error;
    };
    let parse_all = |results: &mut [CommandResult]| {
        for (index, result) in results.iter_mut().enumerate() {
            parse(result, index);
        }
    };
    match output {
        ExecutionOutput::Exec(result) => {
            parse_all(&mut result.outputs);
            if let Some(first) = result.outputs.first() {
                result.parsed_output = first.parsed_output.clone();
                result.parse_error = first.parse_error.clone();
            }
        }
        ExecutionOutput::Template(result) => parse_all(&mut result.executed),
        ExecutionOutput::Interactive(result) => parse_all(&mut result.outputs),
        ExecutionOutput::ExecBatch(result) => {
            for target in &mut result.results {
                parse_all(&mut target.outputs);
            }
        }
        ExecutionOutput::InteractiveBatch(result) => {
            for target in &mut result.results {
                parse_all(&mut target.outputs);
            }
        }
        _ => {}
    }
}

fn execution_data<T>(response: ApiResponse<T>) -> Result<T, super::error::ApiError> {
    response
        .data
        .ok_or_else(|| super::error::ApiError::internal("missing execution data"))
}
