use anyhow::{Result, anyhow};
use rneter::{
    device::DeviceHandler,
    session::{CmdJob, Command, MANAGER, SessionRecordLevel, SessionRecorder},
};
use tokio::sync::mpsc::Sender;
use tokio::sync::oneshot;
use tracing::{debug, error, info};

pub struct DeviceClient {
    sender: Sender<CmdJob>,
    default_timeout: u64,
    recorder: Option<SessionRecorder>,
}

impl DeviceClient {
    pub async fn connect(
        host: String,
        port: u16,
        username: String,
        password: String,
        enable_password: Option<String>,
        handler: DeviceHandler,
    ) -> Result<Self> {
        info!("Connecting to {}:{} as {}", host, port, username);

        // MANAGER.get returns a Sender<CmdJob>
        // It handles connection pooling internally
        let sender = MANAGER
            .get(username, host, port, password, enable_password, handler)
            .await
            .map_err(|e| anyhow!("Failed to connect: {}", e))?;

        Ok(Self {
            sender,
            default_timeout: 60,
            recorder: None,
        })
    }

    pub async fn connect_with_recording(
        host: String,
        port: u16,
        username: String,
        password: String,
        enable_password: Option<String>,
        handler: DeviceHandler,
        level: SessionRecordLevel,
    ) -> Result<Self> {
        info!(
            "Connecting with recording to {}:{} as {}",
            host, port, username
        );

        let (sender, recorder) = MANAGER
            .get_with_recording_level(
                username,
                host,
                port,
                password,
                enable_password,
                handler,
                level,
            )
            .await
            .map_err(|e| anyhow!("Failed to connect: {}", e))?;

        Ok(Self {
            sender,
            default_timeout: 60,
            recorder: Some(recorder),
        })
    }

    pub async fn execute(&self, command_str: &str, target_mode: Option<&str>) -> Result<String> {
        let (tx, rx) = oneshot::channel();

        // Default to "Enable" mode if not specified,
        // as most useful commands are run there (including entering config mode if needed by state machine)
        // actually rneter expects specific state names defined in DeviceHandler
        let mode = target_mode.unwrap_or("Enable").to_string();

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

        Ok(output.content)
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
