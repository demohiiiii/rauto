use crate::domain::task::{TaskResultOutcome, TaskResultSummary};
use serde::ser::SerializeStruct;
use serde::{Deserialize, Serialize, Serializer};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiResponseError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub error: Option<ApiResponseError>,
    pub result_summary: Option<TaskResultSummary>,
    pub data: Option<T>,
}

impl<T: Serialize> Serialize for ApiResponse<T> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("ApiResponse", 4)?;
        state.serialize_field("success", &self.success)?;
        state.serialize_field("error", &self.error)?;
        state.serialize_field("result_summary", &self.result_summary)?;
        let data = self
            .data
            .as_ref()
            .map(serde_json::to_value)
            .transpose()
            .map_err(serde::ser::Error::custom)?;
        let data = data.map(|mut value| {
            if let serde_json::Value::Object(map) = &mut value {
                map.remove("result_summary");
            }
            value
        });
        state.serialize_field("data", &data)?;
        state.end()
    }
}

impl<T> ApiResponse<T> {
    pub fn completed(data: T, result_summary: TaskResultSummary) -> Self {
        let success = result_summary.success;
        let error = (!success).then(|| ApiResponseError {
            code: match result_summary.outcome {
                TaskResultOutcome::PartialSuccess => "partial_failure",
                TaskResultOutcome::Failed => "execution_failed",
                TaskResultOutcome::Success | TaskResultOutcome::DryRun => "execution_failed",
            }
            .to_string(),
            message: result_summary.summary.clone(),
        });
        Self {
            success,
            error,
            result_summary: Some(result_summary),
            data: Some(data),
        }
    }

    pub fn accepted(data: T) -> Self {
        Self {
            success: true,
            error: None,
            result_summary: None,
            data: Some(data),
        }
    }
}

impl ApiResponse<serde_json::Value> {
    pub fn failure(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            success: false,
            error: Some(ApiResponseError {
                code: code.into(),
                message: message.into(),
            }),
            result_summary: None,
            data: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::task::{
        TaskOperation, TaskResultOutcome, build_result_summary, result_counts,
        task_result_with_counts,
    };
    use serde_json::{Value, json};

    #[test]
    fn completed_success_wraps_business_data() {
        let summary = build_result_summary(
            TaskOperation::Exec,
            TaskResultOutcome::Success,
            "Command completed successfully",
        );
        let response = ApiResponse::completed(
            json!({ "output": "ok", "result_summary": summary.clone() }),
            summary,
        );
        let value = serde_json::to_value(response).expect("serialize response");

        assert_eq!(value["success"], json!(true));
        assert!(value["error"].is_null());
        assert_eq!(value["result_summary"]["outcome"], json!("success"));
        assert_eq!(value["data"]["output"], json!("ok"));
        assert!(value["data"].get("result_summary").is_none());
        assert!(value.get("output").is_none());
    }

    #[test]
    fn completed_partial_failure_keeps_data_and_exposes_error() {
        let summary = task_result_with_counts(
            build_result_summary(
                TaskOperation::Exec,
                TaskResultOutcome::PartialSuccess,
                "One target failed",
            ),
            result_counts(2, 1, 1),
        );
        let response = ApiResponse::completed(json!({ "results": [1, 2] }), summary);
        let value = serde_json::to_value(response).expect("serialize response");

        assert_eq!(value["success"], json!(false));
        assert_eq!(value["error"]["code"], json!("partial_failure"));
        assert_eq!(value["error"]["message"], json!("One target failed"));
        assert_eq!(value["data"]["results"], json!([1, 2]));
    }

    #[test]
    fn completed_failure_uses_execution_failure_code() {
        let summary = build_result_summary(
            TaskOperation::CommandFlow,
            TaskResultOutcome::Failed,
            "Flow failed",
        );
        let response = ApiResponse::completed(Value::Null, summary);
        let value = serde_json::to_value(response).expect("serialize response");

        assert_eq!(value["success"], json!(false));
        assert_eq!(value["error"]["code"], json!("execution_failed"));
        assert_eq!(value["error"]["message"], json!("Flow failed"));
    }

    #[test]
    fn accepted_has_no_result_summary() {
        let response = ApiResponse::accepted(json!({ "accepted": true }));
        let value = serde_json::to_value(response).expect("serialize response");

        assert_eq!(value["success"], json!(true));
        assert!(value["error"].is_null());
        assert!(value["result_summary"].is_null());
        assert_eq!(value["data"]["accepted"], json!(true));
    }
}
