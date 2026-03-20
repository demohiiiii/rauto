use crate::manager_grpc::rauto::manager::v1::agent_reporting_service_client::AgentReportingServiceClient;
use crate::manager_grpc::rauto::manager::v1::{
    AckResponse, HeartbeatRequest, OfflineRequest, RegisterAgentRequest, RegisterAgentResponse,
    ReportDevicesRequest, ReportDevicesResponse, ReportErrorRequest, TaskCallbackRequest,
    TaskEventRequest, UpdateDeviceStatusRequest, UpdateDeviceStatusResponse,
};
use anyhow::{Context, Result};
use tonic::Request;
use tonic::metadata::MetadataValue;
use tonic::transport::{Channel, Endpoint};

const DEFAULT_GRPC_MAX_MESSAGE_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug, Clone)]
pub struct ManagerGrpcClient {
    endpoint: String,
    token: Option<String>,
}

impl ManagerGrpcClient {
    pub fn new(endpoint: String, token: Option<String>) -> Self {
        Self { endpoint, token }
    }

    pub async fn register_agent(
        &self,
        payload: RegisterAgentRequest,
    ) -> Result<RegisterAgentResponse> {
        Ok(self
            .connect()
            .await?
            .register_agent(self.authed_request(payload)?)
            .await?
            .into_inner())
    }

    pub async fn send_heartbeat(&self, payload: HeartbeatRequest) -> Result<AckResponse> {
        Ok(self
            .connect()
            .await?
            .send_heartbeat(self.authed_request(payload)?)
            .await?
            .into_inner())
    }

    pub async fn notify_offline(&self, payload: OfflineRequest) -> Result<AckResponse> {
        Ok(self
            .connect()
            .await?
            .notify_offline(self.authed_request(payload)?)
            .await?
            .into_inner())
    }

    pub async fn report_devices(
        &self,
        payload: ReportDevicesRequest,
    ) -> Result<ReportDevicesResponse> {
        Ok(self
            .connect()
            .await?
            .report_devices(self.authed_request(payload)?)
            .await?
            .into_inner())
    }

    pub async fn update_device_status(
        &self,
        payload: UpdateDeviceStatusRequest,
    ) -> Result<UpdateDeviceStatusResponse> {
        Ok(self
            .connect()
            .await?
            .update_device_status(self.authed_request(payload)?)
            .await?
            .into_inner())
    }

    pub async fn report_error(&self, payload: ReportErrorRequest) -> Result<AckResponse> {
        Ok(self
            .connect()
            .await?
            .report_error(self.authed_request(payload)?)
            .await?
            .into_inner())
    }

    pub async fn report_task_callback(&self, payload: TaskCallbackRequest) -> Result<AckResponse> {
        Ok(self
            .connect()
            .await?
            .report_task_callback(self.authed_request(payload)?)
            .await?
            .into_inner())
    }

    pub async fn report_task_event(&self, payload: TaskEventRequest) -> Result<AckResponse> {
        Ok(self
            .connect()
            .await?
            .report_task_event(self.authed_request(payload)?)
            .await?
            .into_inner())
    }

    fn authed_request<T>(&self, payload: T) -> Result<Request<T>> {
        let mut request = Request::new(payload);
        if let Some(token) = self
            .token
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            let bearer = MetadataValue::try_from(format!("Bearer {}", token))
                .context("invalid bearer token metadata")?;
            let api_key = MetadataValue::try_from(token).context("invalid x-api-key metadata")?;
            request.metadata_mut().insert("authorization", bearer);
            request.metadata_mut().insert("x-api-key", api_key);
        }
        Ok(request)
    }

    fn max_message_bytes(&self) -> usize {
        std::env::var("RAUTO_MANAGER_GRPC_MAX_MESSAGE_BYTES")
            .ok()
            .or_else(|| std::env::var("MANAGER_GRPC_MAX_MESSAGE_BYTES").ok())
            .and_then(|raw| raw.trim().parse::<usize>().ok())
            .filter(|value| *value > 0)
            .unwrap_or(DEFAULT_GRPC_MAX_MESSAGE_BYTES)
    }

    async fn connect(&self) -> Result<AgentReportingServiceClient<Channel>> {
        let endpoint = Endpoint::from_shared(self.endpoint.clone())
            .with_context(|| format!("invalid manager gRPC endpoint '{}'", self.endpoint))?;
        let channel = endpoint.connect().await.with_context(|| {
            format!(
                "failed to connect to manager gRPC endpoint '{}'",
                self.endpoint
            )
        })?;
        let max_message_bytes = self.max_message_bytes();
        Ok(AgentReportingServiceClient::new(channel)
            .max_decoding_message_size(max_message_bytes)
            .max_encoding_message_size(max_message_bytes))
    }
}
