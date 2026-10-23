use anyhow::Result;
use serde_json::Value;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy)]
pub(crate) enum JsonTemplateKind {
    TxWorkflow,
    Orchestration,
}

impl JsonTemplateKind {
    fn label(self) -> &'static str {
        match self {
            Self::TxWorkflow => "tx workflow template",
            Self::Orchestration => "orchestration template",
        }
    }
}

pub(crate) fn safe_json_template_name(raw: &str) -> Result<String> {
    let normalized = raw.trim();
    if normalized.is_empty()
        || normalized.contains('/')
        || normalized.contains('\\')
        || normalized.contains("..")
        || !normalized
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' || ch == '.')
    {
        return Err(anyhow::anyhow!("invalid JSON template name"));
    }
    Ok(normalized.to_string())
}

pub(crate) fn read_json_template_body(
    kind: JsonTemplateKind,
    file: Option<PathBuf>,
    content: Option<String>,
) -> Result<String> {
    let body = crate::cli::exec::read_text_body(kind.label(), file, content)?;
    let value: Value = serde_json::from_str(&body)?;
    serde_json::to_string_pretty(&value).map_err(Into::into)
}

pub(crate) fn read_json_vars(vars_file: Option<&Path>, vars_json: Option<&str>) -> Result<Value> {
    match (
        vars_file,
        vars_json.map(str::trim).filter(|value| !value.is_empty()),
    ) {
        (Some(_), Some(_)) => Err(anyhow::anyhow!(
            "choose either --vars or --vars-json, not both"
        )),
        (Some(path), None) => {
            let text = std::fs::read_to_string(path)?;
            let value: Value = serde_json::from_str(&text)?;
            ensure_vars_object(value)
        }
        (None, Some(text)) => {
            let value: Value = serde_json::from_str(text)?;
            ensure_vars_object(value)
        }
        (None, None) => Ok(Value::Null),
    }
}

fn ensure_vars_object(value: Value) -> Result<Value> {
    if value.is_null() || value.is_object() {
        Ok(value)
    } else {
        Err(anyhow::anyhow!("template vars must be a JSON object"))
    }
}
