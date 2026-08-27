pub use crate::domain::device::{
    DeviceConfigSnapshot, DeviceConfigSnapshotSortOrder, DeviceConfigSnapshotSummary,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeviceConfigHistorySortOrder {
    Asc,
    #[default]
    Desc,
}

impl From<DeviceConfigHistorySortOrder> for DeviceConfigSnapshotSortOrder {
    fn from(value: DeviceConfigHistorySortOrder) -> Self {
        match value {
            DeviceConfigHistorySortOrder::Asc => Self::Ascending,
            DeviceConfigHistorySortOrder::Desc => Self::Descending,
        }
    }
}

#[derive(Debug, Default, Deserialize)]
pub struct DeviceConfigHistoryQuery {
    #[serde(default)]
    pub connection_name: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub fetched_from: Option<String>,
    #[serde(default)]
    pub fetched_to: Option<String>,
    #[serde(default)]
    pub sort_order: DeviceConfigHistorySortOrder,
    #[serde(default)]
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct DeviceConfigHistoryResponse {
    pub snapshots: Vec<DeviceConfigSnapshotSummary>,
    pub connection_names: Vec<String>,
    pub kinds: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct DeviceConfigSnapshotMutationResponse {
    pub id: String,
    pub deleted: bool,
}
