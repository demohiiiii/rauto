use crate::config::{config_catalog, connection_store, content_store};
use crate::domain::scheduling::{ScheduleDefinition, ScheduledAction};
use anyhow::anyhow;
use std::collections::BTreeSet;
use std::error::Error;
use std::fmt;

#[derive(Debug)]
pub(crate) enum ScheduleDefinitionValidationError {
    Invalid(anyhow::Error),
    Infrastructure(anyhow::Error),
}

impl fmt::Display for ScheduleDefinitionValidationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Invalid(error) | Self::Infrastructure(error) => error.fmt(formatter),
        }
    }
}

impl Error for ScheduleDefinitionValidationError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Invalid(error) | Self::Infrastructure(error) => Some(error.as_ref()),
        }
    }
}

type ValidationResult<T> = std::result::Result<T, ScheduleDefinitionValidationError>;

pub(crate) fn validate_schedule_definition(
    definition: &ScheduleDefinition,
) -> ValidationResult<()> {
    definition
        .validate()
        .map_err(|error| ScheduleDefinitionValidationError::Invalid(error.into()))?;
    match &definition.action {
        ScheduledAction::Orchestrate { template_name, .. } => {
            if content_store::load_orchestration_template(template_name)
                .map_err(ScheduleDefinitionValidationError::Infrastructure)?
                .is_none()
            {
                return Err(ScheduleDefinitionValidationError::Invalid(anyhow!(
                    "orchestration template '{}' was not found",
                    template_name.trim()
                )));
            }
        }
        ScheduledAction::ConfigFetch {
            connection_name,
            targets,
            groups,
            labels,
            kind,
        } => {
            let connection_names =
                resolve_target_names(connection_name.as_deref(), targets, groups, labels)?;
            if connection_names.is_empty() {
                return Err(ScheduleDefinitionValidationError::Invalid(anyhow!(
                    "configuration fetch resolved no saved connections"
                )));
            }
            for connection_name in connection_names {
                let connection = load_connection(&connection_name)?;
                if let Some(profile) = connection
                    .device_profile
                    .as_deref()
                    .filter(|profile| *profile != "autodetect")
                {
                    config_catalog::resolve_config_command(profile, kind)
                        .map_err(classify_lookup_error)?;
                }
            }
        }
        ScheduledAction::TxWorkflow {
            connection_name,
            template_name,
            ..
        } => {
            load_connection(connection_name)?;
            if content_store::load_tx_workflow_template(template_name)
                .map_err(ScheduleDefinitionValidationError::Infrastructure)?
                .is_none()
            {
                return Err(ScheduleDefinitionValidationError::Invalid(anyhow!(
                    "tx workflow template '{}' was not found",
                    template_name.trim()
                )));
            }
        }
    }
    Ok(())
}

fn resolve_target_names(
    legacy_connection_name: Option<&str>,
    targets: &[String],
    groups: &[String],
    labels: &[String],
) -> ValidationResult<Vec<String>> {
    let mut names = BTreeSet::new();
    for target in targets
        .iter()
        .map(String::as_str)
        .chain(legacy_connection_name)
    {
        let target = target.trim();
        if !target.is_empty() {
            names.insert(
                connection_store::safe_connection_name(target)
                    .map_err(ScheduleDefinitionValidationError::Invalid)?,
            );
        }
    }
    names.extend(
        connection_store::list_connections_by_groups_any(groups)
            .map_err(ScheduleDefinitionValidationError::Infrastructure)?,
    );
    names.extend(
        connection_store::list_connections_by_labels_any(labels)
            .map_err(ScheduleDefinitionValidationError::Infrastructure)?,
    );
    Ok(names.into_iter().collect())
}

fn load_connection(connection_name: &str) -> ValidationResult<connection_store::SavedConnection> {
    let safe_name = connection_store::safe_connection_name(connection_name)
        .map_err(ScheduleDefinitionValidationError::Invalid)?;
    connection_store::load_connection_raw(&safe_name).map_err(classify_lookup_error)
}

fn classify_lookup_error(error: anyhow::Error) -> ScheduleDefinitionValidationError {
    if error.downcast_ref::<sqlx::Error>().is_some() {
        ScheduleDefinitionValidationError::Infrastructure(error)
    } else {
        ScheduleDefinitionValidationError::Invalid(error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lookup_errors_preserve_infrastructure_failures() {
        assert!(matches!(
            classify_lookup_error(anyhow!("saved connection 'edge-1' not found")),
            ScheduleDefinitionValidationError::Invalid(_)
        ));
        assert!(matches!(
            classify_lookup_error(sqlx::Error::PoolClosed.into()),
            ScheduleDefinitionValidationError::Infrastructure(_)
        ));
    }
}
