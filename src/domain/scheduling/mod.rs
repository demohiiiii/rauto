#![forbid(unsafe_code)]

use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use cron::Schedule as CronSchedule;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::error::Error;
use std::fmt;
use std::str::FromStr;

pub const DEFAULT_TIMEZONE: &str = "Asia/Shanghai";
pub const DEFAULT_MAX_RUNTIME_SECONDS: u64 = 3_600;
pub const MAX_RUNTIME_SECONDS: u64 = 86_400;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OverlapPolicy {
    #[default]
    Skip,
    Allow,
}

impl OverlapPolicy {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Skip => "skip",
            Self::Allow => "allow",
        }
    }
}

impl FromStr for OverlapPolicy {
    type Err = ScheduleValidationError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "skip" => Ok(Self::Skip),
            "allow" => Ok(Self::Allow),
            _ => Err(ScheduleValidationError::InvalidOverlapPolicy),
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MisfirePolicy {
    #[default]
    FireOnce,
    Skip,
}

impl MisfirePolicy {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::FireOnce => "fire_once",
            Self::Skip => "skip",
        }
    }
}

impl FromStr for MisfirePolicy {
    type Err = ScheduleValidationError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "fire_once" => Ok(Self::FireOnce),
            "skip" => Ok(Self::Skip),
            _ => Err(ScheduleValidationError::InvalidMisfirePolicy),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ScheduledAction {
    Orchestrate {
        template_name: String,
        #[serde(default)]
        vars: Value,
    },
    ConfigFetch {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        connection_name: Option<String>,
        #[serde(default)]
        targets: Vec<String>,
        #[serde(default)]
        groups: Vec<String>,
        #[serde(default, alias = "tags")]
        labels: Vec<String>,
        kind: String,
    },
    TxWorkflow {
        connection_name: String,
        template_name: String,
        #[serde(default)]
        vars: Value,
    },
}

impl ScheduledAction {
    pub const fn action_type(&self) -> &'static str {
        match self {
            Self::Orchestrate { .. } => "orchestrate",
            Self::ConfigFetch { .. } => "config_fetch",
            Self::TxWorkflow { .. } => "tx_workflow",
        }
    }

    fn validate(&self) -> Result<(), ScheduleValidationError> {
        match self {
            Self::Orchestrate { template_name, .. } if template_name.trim().is_empty() => {
                Err(ScheduleValidationError::EmptyTemplateName)
            }
            Self::Orchestrate { .. } => Ok(()),
            Self::TxWorkflow {
                connection_name, ..
            } if connection_name.trim().is_empty() => {
                Err(ScheduleValidationError::EmptyConnectionName)
            }
            Self::ConfigFetch {
                connection_name,
                targets,
                groups,
                labels,
                ..
            } if connection_name
                .as_deref()
                .is_none_or(|name| name.trim().is_empty())
                && !has_nonempty_value(targets)
                && !has_nonempty_value(groups)
                && !has_nonempty_value(labels) =>
            {
                Err(ScheduleValidationError::EmptyConfigTargets)
            }
            Self::ConfigFetch { kind, .. } if kind.trim().is_empty() => {
                Err(ScheduleValidationError::EmptyConfigKind)
            }
            Self::TxWorkflow { template_name, .. } if template_name.trim().is_empty() => {
                Err(ScheduleValidationError::EmptyTemplateName)
            }
            Self::ConfigFetch { .. } | Self::TxWorkflow { .. } => Ok(()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleDefinition {
    pub name: String,
    pub cron_expression: String,
    #[serde(default = "default_timezone")]
    pub timezone: String,
    pub action: ScheduledAction,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub overlap_policy: OverlapPolicy,
    #[serde(default)]
    pub misfire_policy: MisfirePolicy,
    #[serde(default = "default_max_runtime_seconds")]
    pub max_runtime_seconds: u64,
}

impl ScheduleDefinition {
    pub fn validate(&self) -> Result<(), ScheduleValidationError> {
        if self.name.trim().is_empty() {
            return Err(ScheduleValidationError::EmptyName);
        }
        if self.name.chars().count() > 120 {
            return Err(ScheduleValidationError::NameTooLong);
        }
        parse_cron(&self.cron_expression)?;
        parse_timezone(&self.timezone)?;
        if self.max_runtime_seconds == 0 || self.max_runtime_seconds > MAX_RUNTIME_SECONDS {
            return Err(ScheduleValidationError::InvalidMaxRuntime);
        }
        self.action.validate()
    }

    pub fn normalized(mut self) -> Self {
        self.name = self.name.trim().to_string();
        self.cron_expression = self.cron_expression.trim().to_string();
        self.timezone = self.timezone.trim().to_string();
        match &mut self.action {
            ScheduledAction::Orchestrate { template_name, .. } => {
                *template_name = template_name.trim().to_string();
            }
            ScheduledAction::ConfigFetch {
                connection_name,
                targets,
                groups,
                labels,
                kind,
            } => {
                if let Some(legacy_name) = connection_name.take() {
                    targets.push(legacy_name);
                }
                normalize_string_list(targets);
                normalize_string_list(groups);
                normalize_string_list(labels);
                *kind = kind.trim().to_string();
            }
            ScheduledAction::TxWorkflow {
                connection_name,
                template_name,
                ..
            } => {
                *connection_name = connection_name.trim().to_string();
                *template_name = template_name.trim().to_string();
            }
        }
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredSchedule {
    pub id: String,
    #[serde(flatten)]
    pub definition: ScheduleDefinition,
    pub next_run_at: Option<String>,
    pub last_run_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScheduleRunStatus {
    Queued,
    Running,
    Success,
    Failed,
    Skipped,
}

impl ScheduleRunStatus {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Running => "running",
            Self::Success => "success",
            Self::Failed => "failed",
            Self::Skipped => "skipped",
        }
    }
}

impl FromStr for ScheduleRunStatus {
    type Err = ScheduleValidationError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "queued" => Ok(Self::Queued),
            "running" => Ok(Self::Running),
            "success" => Ok(Self::Success),
            "failed" => Ok(Self::Failed),
            "skipped" => Ok(Self::Skipped),
            _ => Err(ScheduleValidationError::InvalidRunStatus),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleRun {
    pub id: String,
    pub schedule_id: String,
    pub schedule_name: String,
    pub task_id: Option<String>,
    pub trigger_type: String,
    pub scheduled_for: String,
    pub status: ScheduleRunStatus,
    pub skip_reason: Option<String>,
    pub error: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ScheduleValidationError {
    EmptyName,
    NameTooLong,
    EmptyConnectionName,
    EmptyConfigTargets,
    EmptyConfigKind,
    EmptyTemplateName,
    InvalidCron(String),
    InvalidTimezone(String),
    InvalidMaxRuntime,
    InvalidOverlapPolicy,
    InvalidMisfirePolicy,
    InvalidRunStatus,
    NoFutureOccurrence,
}

impl fmt::Display for ScheduleValidationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyName => f.write_str("schedule name must not be empty"),
            Self::NameTooLong => f.write_str("schedule name must not exceed 120 characters"),
            Self::EmptyConnectionName => f.write_str("connection name must not be empty"),
            Self::EmptyConfigTargets => {
                f.write_str("configuration fetch must select a device, group, or label")
            }
            Self::EmptyConfigKind => f.write_str("configuration kind must not be empty"),
            Self::EmptyTemplateName => f.write_str("template name must not be empty"),
            Self::InvalidCron(error) => write!(f, "invalid cron expression: {error}"),
            Self::InvalidTimezone(timezone) => write!(f, "invalid timezone: {timezone}"),
            Self::InvalidMaxRuntime => write!(
                f,
                "max_runtime_seconds must be between 1 and {MAX_RUNTIME_SECONDS}"
            ),
            Self::InvalidOverlapPolicy => f.write_str("invalid schedule overlap policy"),
            Self::InvalidMisfirePolicy => f.write_str("invalid schedule misfire policy"),
            Self::InvalidRunStatus => f.write_str("invalid schedule run status"),
            Self::NoFutureOccurrence => f.write_str("cron expression has no future occurrence"),
        }
    }
}

impl Error for ScheduleValidationError {}

pub fn next_run_after_ms(
    cron_expression: &str,
    timezone: &str,
    after_ms: i64,
) -> Result<i64, ScheduleValidationError> {
    next_runs_after_ms(cron_expression, timezone, after_ms, 1)?
        .into_iter()
        .next()
        .ok_or(ScheduleValidationError::NoFutureOccurrence)
}

pub fn next_runs_after_ms(
    cron_expression: &str,
    timezone: &str,
    after_ms: i64,
    count: usize,
) -> Result<Vec<i64>, ScheduleValidationError> {
    let schedule = parse_cron(cron_expression)?;
    let timezone = parse_timezone(timezone)?;
    let after = DateTime::<Utc>::from_timestamp_millis(after_ms)
        .ok_or_else(|| ScheduleValidationError::InvalidCron("invalid reference time".into()))?
        .with_timezone(&timezone);
    let occurrences = schedule
        .after(&after)
        .map(|next| next.with_timezone(&Utc).timestamp_millis())
        .take(count)
        .collect::<Vec<_>>();
    if count > 0 && occurrences.is_empty() {
        return Err(ScheduleValidationError::NoFutureOccurrence);
    }
    Ok(occurrences)
}

pub fn timestamp_ms_in_timezone(
    value: i64,
    timezone: &str,
) -> Result<String, ScheduleValidationError> {
    let timezone = parse_timezone(timezone)?;
    let value = DateTime::<Utc>::from_timestamp_millis(value)
        .ok_or_else(|| ScheduleValidationError::InvalidCron("invalid timestamp".into()))?;
    Ok(value
        .with_timezone(&timezone)
        .format("%Y-%m-%d %H:%M:%S %Z")
        .to_string())
}

pub fn timestamp_ms_to_rfc3339(value: i64) -> String {
    DateTime::<Utc>::from_timestamp_millis(value)
        .unwrap_or(DateTime::<Utc>::UNIX_EPOCH)
        .to_rfc3339()
}

fn parse_cron(expression: &str) -> Result<CronSchedule, ScheduleValidationError> {
    let fields = expression.split_whitespace().count();
    if fields != 5 {
        return Err(ScheduleValidationError::InvalidCron(
            "expected 5 fields: minute hour day-of-month month day-of-week".to_string(),
        ));
    }
    let normalized = format!("0 {} *", expression.trim());
    CronSchedule::from_str(&normalized)
        .map_err(|error| ScheduleValidationError::InvalidCron(error.to_string()))
}

fn parse_timezone(value: &str) -> Result<Tz, ScheduleValidationError> {
    value
        .trim()
        .parse::<Tz>()
        .map_err(|_| ScheduleValidationError::InvalidTimezone(value.trim().to_string()))
}

fn default_timezone() -> String {
    DEFAULT_TIMEZONE.to_string()
}

const fn default_enabled() -> bool {
    true
}

const fn default_max_runtime_seconds() -> u64 {
    DEFAULT_MAX_RUNTIME_SECONDS
}

fn has_nonempty_value(values: &[String]) -> bool {
    values.iter().any(|value| !value.trim().is_empty())
}

fn normalize_string_list(values: &mut Vec<String>) {
    *values = values
        .drain(..)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect();
    values.sort();
    values.dedup();
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn definition() -> ScheduleDefinition {
        ScheduleDefinition {
            name: "nightly deployment".to_string(),
            cron_expression: "0 2 * * *".to_string(),
            timezone: "Asia/Shanghai".to_string(),
            action: ScheduledAction::Orchestrate {
                template_name: "nightly".to_string(),
                vars: json!({"site": "shanghai"}),
            },
            enabled: true,
            overlap_policy: OverlapPolicy::Skip,
            misfire_policy: MisfirePolicy::FireOnce,
            max_runtime_seconds: 3600,
        }
    }

    #[test]
    fn validates_five_field_cron_and_timezone() {
        definition().validate().expect("valid schedule");
    }

    #[test]
    fn rejects_six_field_cron() {
        let mut value = definition();
        value.cron_expression = "0 0 2 * * *".to_string();
        assert!(matches!(
            value.validate(),
            Err(ScheduleValidationError::InvalidCron(_))
        ));
    }

    #[test]
    fn calculates_next_run_in_configured_timezone() {
        let after = DateTime::parse_from_rfc3339("2026-08-25T17:59:00+08:00")
            .expect("reference time")
            .timestamp_millis();
        let next =
            next_run_after_ms("0 18 * * *", "Asia/Shanghai", after).expect("next occurrence");
        assert_eq!(timestamp_ms_to_rfc3339(next), "2026-08-25T10:00:00+00:00");
    }

    #[test]
    fn scheduled_action_variants_use_stable_tagged_payloads() {
        let config_fetch = ScheduledAction::ConfigFetch {
            connection_name: None,
            targets: vec![" edge-2 ".to_string(), "edge-1".to_string()],
            groups: vec![" core ".to_string()],
            labels: vec![" production ".to_string()],
            kind: " running ".to_string(),
        };
        assert_eq!(config_fetch.action_type(), "config_fetch");
        assert_eq!(
            serde_json::to_value(&config_fetch).expect("serialize config action"),
            json!({
                "type": "config_fetch",
                "targets": [" edge-2 ", "edge-1"],
                "groups": [" core "],
                "labels": [" production "],
                "kind": " running "
            })
        );

        let mut tx_definition = definition();
        tx_definition.action = ScheduledAction::TxWorkflow {
            connection_name: " edge-1 ".to_string(),
            template_name: " deploy ".to_string(),
            vars: json!({"vlan": 100}),
        };
        tx_definition.validate().expect("valid tx workflow action");
        let normalized = tx_definition.normalized();
        assert!(matches!(
            normalized.action,
            ScheduledAction::TxWorkflow {
                connection_name,
                template_name,
                ..
            } if connection_name == "edge-1" && template_name == "deploy"
        ));
    }

    #[test]
    fn config_fetch_requires_a_device_group_or_label() {
        let mut value = definition();
        value.action = ScheduledAction::ConfigFetch {
            connection_name: None,
            targets: Vec::new(),
            groups: Vec::new(),
            labels: Vec::new(),
            kind: "running".to_string(),
        };
        assert_eq!(
            value.validate(),
            Err(ScheduleValidationError::EmptyConfigTargets)
        );
    }

    #[test]
    fn legacy_config_fetch_connection_is_normalized_into_targets() {
        let mut value = definition();
        value.action = serde_json::from_value(json!({
            "type": "config_fetch",
            "connection_name": " edge-1 ",
            "kind": "running"
        }))
        .expect("deserialize legacy config fetch action");

        let normalized = value.normalized();
        assert!(matches!(
            normalized.action,
            ScheduledAction::ConfigFetch {
                connection_name: None,
                targets,
                ..
            } if targets == vec!["edge-1"]
        ));
    }

    #[test]
    fn calculates_next_five_runs_in_configured_timezone() {
        let after = DateTime::parse_from_rfc3339("2026-08-25T17:59:00+08:00")
            .expect("reference time")
            .timestamp_millis();
        let runs =
            next_runs_after_ms("0 18 * * *", "Asia/Shanghai", after, 5).expect("next occurrences");

        assert_eq!(runs.len(), 5);
        assert_eq!(
            timestamp_ms_in_timezone(runs[0], "Asia/Shanghai").expect("local timestamp"),
            "2026-08-25 18:00:00 CST"
        );
        assert_eq!(
            timestamp_ms_in_timezone(runs[4], "Asia/Shanghai").expect("local timestamp"),
            "2026-08-29 18:00:00 CST"
        );
    }
}
