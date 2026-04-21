use crate::config::ssh_security::SshSecurityProfile;
use crate::{manager_connection_request, manager_execution_context_with_security};
use anyhow::{Result, anyhow};
use regex::RegexSet;
use rneter::{
    device::DeviceHandler,
    session::{
        CmdJob, Command, CommandBranchTarget, CommandFlow, CommandFlowOutput,
        CommandOutputBranchSource, MANAGER, Output, SessionRecordLevel, SessionRecorder,
    },
};
use std::borrow::Cow;
use tokio::sync::mpsc::Sender;
use tokio::sync::oneshot;
use tracing::{debug, error, info, warn};

fn branch_source_text<'a>(source: &CommandOutputBranchSource, output: &'a Output) -> Cow<'a, str> {
    match source {
        CommandOutputBranchSource::All => Cow::Borrowed(output.all.as_str()),
        CommandOutputBranchSource::Content => Cow::Borrowed(output.content.as_str()),
        CommandOutputBranchSource::Prompt => {
            Cow::Borrowed(output.prompt.as_deref().unwrap_or_default())
        }
    }
}

fn resolve_output_branch_target(command: &Command, output: &Output) -> Result<CommandBranchTarget> {
    for (rule_index, rule) in command.output_branches.iter().enumerate() {
        if rule.patterns.is_empty() {
            return Err(anyhow!(
                "command '{}' has an output branch rule with no patterns at index {}",
                command.command,
                rule_index
            ));
        }
        let patterns = RegexSet::new(&rule.patterns).map_err(|err| {
            anyhow!(
                "command '{}' has invalid output branch regex at index {}: {}",
                command.command,
                rule_index,
                err
            )
        })?;
        let source_text = branch_source_text(&rule.source, output);
        if patterns.is_match(source_text.as_ref()) {
            return Ok(rule.target.clone());
        }
    }
    Ok(command.output_fallback.clone())
}

pub struct DeviceClient {
    sender: Sender<CmdJob>,
    default_timeout: u64,
    default_mode: String,
    recording_level: Option<SessionRecordLevel>,
    recorder: Option<SessionRecorder>,
}

impl DeviceClient {
    #[allow(clippy::too_many_arguments)]
    pub async fn connect(
        host: String,
        port: u16,
        username: String,
        password: String,
        enable_password: Option<String>,
        handler: DeviceHandler,
        default_mode: String,
        ssh_security: SshSecurityProfile,
    ) -> Result<Self> {
        info!("Connecting to {}:{} as {}", host, port, username);

        let request =
            manager_connection_request(username, host, port, password, enable_password, handler);
        let sender = MANAGER
            .get_with_context(
                request,
                manager_execution_context_with_security(None, ssh_security),
            )
            .await
            .map_err(|e| anyhow!("Failed to connect: {}", e))?;

        Ok(Self {
            sender,
            default_timeout: 60,
            default_mode,
            recording_level: None,
            recorder: None,
        })
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn connect_with_recording(
        host: String,
        port: u16,
        username: String,
        password: String,
        enable_password: Option<String>,
        handler: DeviceHandler,
        default_mode: String,
        level: SessionRecordLevel,
        ssh_security: SshSecurityProfile,
    ) -> Result<Self> {
        info!(
            "Connecting with recording to {}:{} as {}",
            host, port, username
        );

        let request =
            manager_connection_request(username, host, port, password, enable_password, handler);
        let (sender, recorder) = MANAGER
            .get_with_recording_level_and_context(
                request,
                manager_execution_context_with_security(None, ssh_security),
                level,
            )
            .await
            .map_err(|e| anyhow!("Failed to connect: {}", e))?;

        Ok(Self {
            sender,
            default_timeout: 60,
            default_mode,
            recording_level: Some(level),
            recorder: Some(recorder),
        })
    }

    pub async fn execute_output(
        &self,
        command_str: &str,
        target_mode: Option<&str>,
    ) -> Result<Output> {
        let mode = target_mode.unwrap_or(&self.default_mode).to_string();
        self.execute_command_structured(Command {
            mode,
            command: command_str.to_string(),
            timeout: Some(self.default_timeout),
            dyn_params: Default::default(),
            interaction: Default::default(),
            output_branches: Default::default(),
            output_fallback: Default::default(),
        })
        .await
    }

    pub async fn execute_command_structured(&self, command: Command) -> Result<Output> {
        let (tx, rx) = oneshot::channel();

        let cmd = CmdJob {
            data: command.clone(),
            sys: None, // Optional system name check
            responder: tx,
        };

        debug!("Sending command: {}", command.command);
        self.sender
            .send(cmd)
            .await
            .map_err(|_| anyhow!("Failed to send command job (channel closed)"))?;

        let output = rx
            .await
            .map_err(|_| anyhow!("Failed to receive response (responder dropped)"))?
            .map_err(|e| anyhow!("Command execution failed: {}", e))?;

        if !output.success {
            // Even if success is false, we might want the content to see why
            // But usually this means something went wrong with the state machine or device error
            error!("Command failed on device. Output: {}", output.content);
        }

        Ok(output)
    }

    pub async fn execute_command_flow(&self, flow: CommandFlow) -> Result<CommandFlowOutput> {
        let CommandFlow {
            steps,
            stop_on_error,
            max_steps,
        } = flow;
        if steps.is_empty() {
            return Ok(CommandFlowOutput {
                success: true,
                outputs: Vec::new(),
            });
        }

        let mut outputs = Vec::with_capacity(steps.len());
        let mut cursor = 0usize;
        let mut executed_steps = 0usize;
        let limit = max_steps.unwrap_or_else(|| steps.len().saturating_mul(16).max(steps.len()));

        while cursor < steps.len() {
            if executed_steps >= limit {
                return Err(anyhow!(
                    "command flow exceeded max executed steps (limit: {})",
                    limit
                ));
            }

            let command = &steps[cursor];
            let output = self.execute_command_structured(command.clone()).await?;
            let step_success = output.success;
            let branch_target = resolve_output_branch_target(command, &output)?;
            outputs.push(output);
            executed_steps += 1;

            if stop_on_error && !step_success {
                return Ok(CommandFlowOutput {
                    success: false,
                    outputs,
                });
            }

            match branch_target {
                CommandBranchTarget::Next => {
                    cursor += 1;
                }
                CommandBranchTarget::StopSuccess => {
                    return Ok(CommandFlowOutput {
                        success: true,
                        outputs,
                    });
                }
                CommandBranchTarget::StopFailure => {
                    return Ok(CommandFlowOutput {
                        success: false,
                        outputs,
                    });
                }
                CommandBranchTarget::Jump { step_index } => {
                    if step_index >= steps.len() {
                        return Err(anyhow!(
                            "command flow branch target step {} is out of range (total steps: {})",
                            step_index,
                            steps.len()
                        ));
                    }
                    cursor = step_index;
                }
            }
        }

        let success = outputs.iter().all(|output| output.success);
        Ok(CommandFlowOutput { success, outputs })
    }

    pub async fn execute(&self, command_str: &str, target_mode: Option<&str>) -> Result<String> {
        Ok(self.execute_output(command_str, target_mode).await?.content)
    }

    pub fn default_mode(&self) -> &str {
        &self.default_mode
    }

    #[allow(dead_code)]
    pub async fn execute_batch(&self, commands: Vec<String>) -> Result<Vec<String>> {
        let mut results = Vec::new();
        for cmd in commands {
            let output = self.execute(&cmd, None).await?;
            results.push(output);
        }
        Ok(results)
    }

    pub fn recording_jsonl(&self) -> Result<Option<String>> {
        match &self.recorder {
            Some(r) => {
                let jsonl = r
                    .to_jsonl()
                    .map_err(|e| anyhow!("record export failed: {}", e))?;
                let filtered = if matches!(
                    self.recording_level,
                    Some(SessionRecordLevel::KeyEventsOnly)
                ) {
                    match crate::config::session_recording::command_output_only_jsonl(&jsonl) {
                        Ok(value) => value,
                        Err(err) => {
                            warn!(
                                "failed to apply audit recording filter, fallback to raw jsonl: {}",
                                err
                            );
                            jsonl
                        }
                    }
                } else {
                    jsonl
                };
                Ok(Some(filtered))
            }
            None => Ok(None),
        }
    }
}
