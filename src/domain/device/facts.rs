use serde_json::Value;

const DEVICE_MODEL_FACT_KEYS: &[&str] = &[
    "HARDWARE",
    "MODEL",
    "MODEL_NAME",
    "CHASSIS",
    "PRODUCT",
    "PLATFORM",
];
const SOFTWARE_VERSION_FACT_KEYS: &[&str] = &[
    "VERSION",
    "SOFTWARE_VERSION",
    "OS_VERSION",
    "JUNOS_VERSION",
    "VRP_VERSION",
    "PRODUCT_VERSION",
    "IMAGE",
    "RELEASE",
];

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DeviceFacts {
    pub device_model: Option<String>,
    pub software_version: Option<String>,
}

pub fn extract_device_facts(parsed_output: &Value) -> DeviceFacts {
    DeviceFacts {
        device_model: extract_fact_value(parsed_output, DEVICE_MODEL_FACT_KEYS),
        software_version: extract_fact_value(parsed_output, SOFTWARE_VERSION_FACT_KEYS),
    }
}

fn extract_fact_value(parsed_output: &Value, candidate_keys: &[&str]) -> Option<String> {
    match parsed_output {
        Value::Array(rows) => rows
            .iter()
            .find_map(|row| fact_value_from_record(row, candidate_keys)),
        Value::Object(_) => fact_value_from_record(parsed_output, candidate_keys),
        _ => None,
    }
}

fn fact_value_from_record(record: &Value, candidate_keys: &[&str]) -> Option<String> {
    let fields = record.as_object()?;
    candidate_keys.iter().find_map(|candidate| {
        fields
            .iter()
            .find(|(field, _)| field.eq_ignore_ascii_case(candidate))
            .and_then(|(_, value)| fact_scalar_text(value))
    })
}

fn fact_scalar_text(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => {
            let normalized = text.trim();
            (!normalized.is_empty()).then(|| normalized.to_string())
        }
        Value::Number(number) => Some(number.to_string()),
        Value::Bool(boolean) => Some(boolean.to_string()),
        Value::Array(values) => values.iter().find_map(fact_scalar_text),
        Value::Null | Value::Object(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn extracts_facts_case_insensitively() {
        let facts = extract_device_facts(&json!([{
            "model": "C9300-24T",
            "software_version": "17.9.4"
        }]));

        assert_eq!(facts.device_model.as_deref(), Some("C9300-24T"));
        assert_eq!(facts.software_version.as_deref(), Some("17.9.4"));
    }

    #[test]
    fn ignores_unrelated_or_empty_values() {
        assert_eq!(extract_device_facts(&Value::Null), DeviceFacts::default());
        assert_eq!(
            extract_device_facts(&json!([{"HOSTNAME": "edge-01", "MODEL": "  "}])),
            DeviceFacts::default()
        );
    }
}
