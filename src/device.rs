use crate::config::ssh_security::SshSecurityProfile;
use crate::{manager_connection_request, manager_execution_context_with_security};
use anyhow::{Result, anyhow};
use rneter::{
    device::DeviceHandler,
    session::{
        Command, CommandFlow, CommandFlowOutput, ConnectionRequest, ExecutionContext, MANAGER,
        MultilineMode, Output, RetryPolicy, SessionRecordLevel, SessionRecorder, SshAuthMethod,
    },
};
use tracing::{debug, error, info, warn};

fn connection_retry_delay(policy: RetryPolicy, retry_index: usize) -> std::time::Duration {
    let mut delay = policy.initial_backoff.min(policy.max_backoff);
    for _ in 1..retry_index.min(128) {
        delay = delay.saturating_mul(2).min(policy.max_backoff);
        if delay == policy.max_backoff {
            break;
        }
    }
    delay
}

fn connection_error_is_retryable(policy: RetryPolicy, error: &rneter::error::ConnectError) -> bool {
    error.is_transient()
        || (policy.retry_authentication_errors && error.is_authentication_failure())
}

fn validate_retry_policy(policy: RetryPolicy) -> Result<()> {
    if policy.max_retries > 0 && policy.initial_backoff > policy.max_backoff {
        return Err(anyhow!(
            "Invalid retry policy: initial backoff must not exceed maximum backoff"
        ));
    }
    Ok(())
}

async fn wait_before_connection_retry(
    policy: RetryPolicy,
    retry_index: usize,
    error: &rneter::error::ConnectError,
) {
    let delay = connection_retry_delay(policy, retry_index);
    warn!(
        "Retrying SSH connection after attempt {} failed: {}; backoff={:?}",
        retry_index, error, delay
    );
    if !delay.is_zero() {
        tokio::time::sleep(delay).await;
    }
}

pub struct DeviceClient {
    request: ConnectionRequest,
    context: ExecutionContext,
    default_timeout: u64,
    default_mode: String,
    recording_level: Option<SessionRecordLevel>,
    recorder: Option<SessionRecorder>,
}

impl DeviceClient {
    #[allow(clippy::too_many_arguments)]
    pub async fn connect_with_retry(
        host: String,
        port: u16,
        username: String,
        auth: SshAuthMethod,
        enable_password: Option<String>,
        handler: DeviceHandler,
        default_mode: String,
        ssh_security: SshSecurityProfile,
        connect_timeout_secs: Option<u64>,
        retry_policy: RetryPolicy,
    ) -> Result<Self> {
        validate_retry_policy(retry_policy)?;
        info!("Connecting to {}:{} as {}", host, port, username);

        let request =
            manager_connection_request(username, host, port, auth, enable_password, handler);
        let context =
            manager_execution_context_with_security(None, ssh_security, connect_timeout_secs)
                .with_retry_policy(retry_policy);
        let mut retries_used = 0;
        loop {
            match MANAGER
                .get_with_context(request.clone(), context.clone())
                .await
            {
                Ok(_) => break,
                Err(error)
                    if retries_used < retry_policy.max_retries
                        && connection_error_is_retryable(retry_policy, &error) =>
                {
                    retries_used += 1;
                    wait_before_connection_retry(retry_policy, retries_used, &error).await;
                }
                Err(error) => return Err(anyhow!("Failed to connect: {}", error)),
            }
        }

        Ok(Self {
            request,
            context,
            default_timeout: 60,
            default_mode,
            recording_level: None,
            recorder: None,
        })
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn connect_with_recording_and_retry(
        host: String,
        port: u16,
        username: String,
        auth: SshAuthMethod,
        enable_password: Option<String>,
        handler: DeviceHandler,
        default_mode: String,
        level: SessionRecordLevel,
        ssh_security: SshSecurityProfile,
        connect_timeout_secs: Option<u64>,
        retry_policy: RetryPolicy,
    ) -> Result<Self> {
        validate_retry_policy(retry_policy)?;
        info!(
            "Connecting with recording to {}:{} as {}",
            host, port, username
        );

        let request = manager_connection_request(
            username,
            host,
            port,
            auth.clone(),
            enable_password.clone(),
            handler,
        );
        let recorder = crate::config::session_recording::redacting_recorder(
            level,
            &auth,
            enable_password.as_deref(),
        );
        let context =
            manager_execution_context_with_security(None, ssh_security, connect_timeout_secs)
                .with_retry_policy(retry_policy);
        let mut retries_used = 0;
        loop {
            match MANAGER
                .get_with_recorder_and_context(request.clone(), context.clone(), recorder.clone())
                .await
            {
                Ok(_) => break,
                Err(error)
                    if retries_used < retry_policy.max_retries
                        && connection_error_is_retryable(retry_policy, &error) =>
                {
                    retries_used += 1;
                    wait_before_connection_retry(retry_policy, retries_used, &error).await;
                }
                Err(error) => return Err(anyhow!("Failed to connect: {}", error)),
            }
        }

        Ok(Self {
            request,
            context,
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
            multiline_mode: MultilineMode::SplitLines,
            timeout: Some(self.default_timeout),
            dyn_params: Default::default(),
            interaction: Default::default(),
        })
        .await
    }

    pub async fn execute_command_structured(&self, command: Command) -> Result<Output> {
        debug!("Sending command: {}", command.command);
        let result = match &self.recorder {
            Some(recorder) => {
                MANAGER
                    .execute_command_with_recorder_and_context(
                        self.request.clone(),
                        command,
                        self.context.clone(),
                        recorder.clone(),
                    )
                    .await
            }
            None => {
                MANAGER
                    .execute_command_with_context(
                        self.request.clone(),
                        command,
                        self.context.clone(),
                    )
                    .await
            }
        };
        let output = result.map_err(|e| anyhow!("Command execution failed: {}", e))?;

        if !output.success {
            // Even if success is false, we might want the content to see why
            // But usually this means something went wrong with the state machine or device error
            error!("Command failed on device. Output: {}", output.content);
        }

        Ok(output)
    }

    pub async fn execute_multiline_command_structured(
        &self,
        command: Command,
    ) -> Result<CommandFlowOutput> {
        self.execute_command_flow(command.into_flow()?).await
    }

    pub async fn execute_command_flow(&self, flow: CommandFlow) -> Result<CommandFlowOutput> {
        let result = match &self.recorder {
            Some(recorder) => {
                MANAGER
                    .execute_command_flow_with_recorder_and_context(
                        self.request.clone(),
                        flow,
                        self.context.clone(),
                        recorder.clone(),
                    )
                    .await
            }
            None => {
                MANAGER
                    .execute_command_flow_with_context(
                        self.request.clone(),
                        flow,
                        self.context.clone(),
                    )
                    .await
            }
        };
        result.map_err(|error| anyhow!("Command flow execution failed: {}", error))
    }

    pub async fn execute(&self, command_str: &str, target_mode: Option<&str>) -> Result<String> {
        Ok(self.execute_output(command_str, target_mode).await?.content)
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

#[cfg(test)]
mod tests {
    use super::*;
    use rneter::session::SshAuthMethod;
    use rneter::testkit::{DevicePersona, FakeSshDevice, FaultInjection};
    use std::time::Duration;

    #[tokio::test]
    async fn device_client_executes_against_rneter_virtual_device() -> Result<()> {
        let persona = DevicePersona::builtin("linux")?;
        let handler = persona.config.clone().build()?;
        let username = persona.username.clone();
        let password = persona.password.clone();
        let device = FakeSshDevice::spawn(persona).await?;

        let client = DeviceClient::connect_with_retry(
            device.addr().ip().to_string(),
            device.port(),
            username,
            SshAuthMethod::password(password),
            device.persona().enable_password.clone(),
            handler,
            "User".to_string(),
            SshSecurityProfile::TestNoCheck,
            Some(10),
            RetryPolicy::default(),
        )
        .await?;
        let output = client.execute_output("uname -a", Some("User")).await?;

        assert!(output.success);
        assert!(output.content.contains("Linux debian"));
        assert!(
            device
                .received_commands()
                .iter()
                .any(|command| command == "uname -a")
        );
        Ok(())
    }

    #[tokio::test]
    async fn device_client_retries_a_transient_disconnect() -> Result<()> {
        let persona = DevicePersona::builtin("linux")?
            .with_faults(FaultInjection::new().with_disconnect_command("uname -a", 1));
        let handler = persona.config.clone().build()?;
        let username = persona.username.clone();
        let password = persona.password.clone();
        let device = FakeSshDevice::spawn(persona).await?;
        let retry_policy = RetryPolicy::new(1).with_backoff(Duration::ZERO, Duration::ZERO);

        let client = DeviceClient::connect_with_retry(
            device.addr().ip().to_string(),
            device.port(),
            username,
            SshAuthMethod::password(password),
            device.persona().enable_password.clone(),
            handler,
            "User".to_string(),
            SshSecurityProfile::TestNoCheck,
            Some(10),
            retry_policy,
        )
        .await?;
        let output = client.execute_output("uname -a", Some("User")).await?;

        assert!(output.success);
        assert_eq!(device.received_commands(), ["uname -a", "uname -a"]);
        Ok(())
    }

    #[tokio::test]
    async fn recorded_client_restores_recorder_after_retry_reconnect() -> Result<()> {
        let persona = DevicePersona::builtin("linux")?
            .with_faults(FaultInjection::new().with_disconnect_command("uname -a", 1));
        let handler = persona.config.clone().build()?;
        let username = persona.username.clone();
        let password = persona.password.clone();
        let device = FakeSshDevice::spawn(persona).await?;
        let retry_policy = RetryPolicy::new(1).with_backoff(Duration::ZERO, Duration::ZERO);

        let client = DeviceClient::connect_with_recording_and_retry(
            device.addr().ip().to_string(),
            device.port(),
            username,
            SshAuthMethod::password(password),
            device.persona().enable_password.clone(),
            handler,
            "User".to_string(),
            SessionRecordLevel::Full,
            SshSecurityProfile::TestNoCheck,
            Some(10),
            retry_policy,
        )
        .await?;
        client.execute_output("uname -a", Some("User")).await?;
        client.execute_output("hostname", Some("User")).await?;

        let recording = client
            .recording_jsonl()?
            .expect("recording should be available");
        assert!(recording.contains("hostname"));
        Ok(())
    }

    #[tokio::test]
    async fn device_client_collects_paged_output_from_virtual_device() -> Result<()> {
        let persona = DevicePersona::builtin("cisco_ios")?.with_paged_reply(
            "show inventory",
            "<--- More --->",
            ["NAME: first", "NAME: second", "NAME: third"],
        );
        let handler = persona.config.clone().build()?;
        let username = persona.username.clone();
        let password = persona.password.clone();
        let device = FakeSshDevice::spawn(persona).await?;

        let client = DeviceClient::connect_with_retry(
            device.addr().ip().to_string(),
            device.port(),
            username,
            SshAuthMethod::password(password),
            device.persona().enable_password.clone(),
            handler,
            "User".to_string(),
            SshSecurityProfile::TestNoCheck,
            Some(10),
            RetryPolicy::default(),
        )
        .await?;
        let output = client
            .execute_output("show inventory", Some("Enable"))
            .await?;

        assert!(output.content.contains("NAME: first"));
        assert!(output.content.contains("NAME: second"));
        assert!(output.content.contains("NAME: third"));
        assert!(!output.content.contains("<--- More --->"));
        Ok(())
    }

    #[test]
    fn invalid_retry_backoff_is_rejected_before_connecting() {
        let policy =
            RetryPolicy::new(1).with_backoff(Duration::from_millis(20), Duration::from_millis(10));
        let error = validate_retry_policy(policy).expect_err("invalid backoff must fail");
        assert!(error.to_string().contains("initial backoff"));
    }
}
