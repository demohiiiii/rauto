use crate::config::ssh_security::SshSecurityProfile;
use crate::{manager_connection_request, manager_execution_context_with_security};
use anyhow::{Result, anyhow};
use rneter::{
    device::DeviceHandler,
    session::{CmdJob, Command, MANAGER, Output, SessionRecordLevel, SessionRecorder},
};
use tokio::sync::mpsc::Sender;
use tokio::sync::oneshot;
use tracing::{debug, error, info};

pub struct DeviceClient {
    sender: Sender<CmdJob>,
    default_timeout: u64,
    default_mode: String,
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
            recorder: Some(recorder),
        })
    }

    pub async fn execute_output(
        &self,
        command_str: &str,
        target_mode: Option<&str>,
    ) -> Result<Output> {
        let (tx, rx) = oneshot::channel();

        let mode = target_mode.unwrap_or(&self.default_mode).to_string();

        let cmd = CmdJob {
            data: Command {
                mode,
                command: command_str.to_string(),
                timeout: Some(self.default_timeout),
            },
            sys: None, // Optional system name check
            responder: tx,
        };

        debug!("Sending command: {}", command_str);
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
            Some(r) => Ok(Some(
                r.to_jsonl()
                    .map_err(|e| anyhow!("record export failed: {}", e))?,
            )),
            None => Ok(None),
        }
    }
}
