use anyhow::Result;
use rneter::session::{SessionEvent, SessionRecordLevel, SessionRecorder, SshAuthMethod};

pub fn redacting_recorder(
    level: SessionRecordLevel,
    auth: &SshAuthMethod,
    enable_password: Option<&str>,
) -> SessionRecorder {
    let mut secrets = authentication_secrets(auth);
    if let Some(secret) = enable_password.filter(|value| !value.is_empty()) {
        secrets.push(secret.to_string());
    }
    secrets.sort_by_key(|value| std::cmp::Reverse(value.len()));
    secrets.dedup();
    SessionRecorder::new(level).with_redactor(move |event| redact_event(event, &secrets))
}

fn authentication_secrets(auth: &SshAuthMethod) -> Vec<String> {
    match auth {
        SshAuthMethod::Password(password) => vec![password.clone()],
        SshAuthMethod::PrivateKey {
            key_data,
            passphrase,
        } => std::iter::once(key_data.clone())
            .chain(passphrase.iter().cloned())
            .collect(),
        SshAuthMethod::PrivateKeyFile { passphrase, .. } => passphrase.iter().cloned().collect(),
        _ => Vec::new(),
    }
}

fn redact_event(event: SessionEvent, secrets: &[String]) -> SessionEvent {
    if secrets.is_empty() {
        return event;
    }
    let Ok(mut value) = serde_json::to_value(&event) else {
        return event;
    };
    redact_json_strings(&mut value, secrets);
    serde_json::from_value(value).unwrap_or(event)
}

fn redact_json_strings(value: &mut serde_json::Value, secrets: &[String]) {
    match value {
        serde_json::Value::String(text) => {
            for secret in secrets {
                *text = text.replace(secret, "***");
            }
        }
        serde_json::Value::Array(values) => {
            for value in values {
                redact_json_strings(value, secrets);
            }
        }
        serde_json::Value::Object(values) => {
            for value in values.values_mut() {
                redact_json_strings(value, secrets);
            }
        }
        _ => {}
    }
}

pub fn command_output_only_jsonl(jsonl: &str) -> Result<String> {
    if jsonl.trim().is_empty() {
        return Ok(String::new());
    }
    let recorder = SessionRecorder::from_jsonl(jsonl)?;
    let entries = recorder.entries()?;
    let mut lines = Vec::new();
    for entry in entries {
        if !matches!(entry.event, SessionEvent::CommandOutput { .. }) {
            continue;
        }
        lines.push(serde_json::to_string(&entry)?);
    }
    Ok(lines.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacting_recorder_scrubs_authentication_material_before_storage() {
        let recorder = redacting_recorder(
            SessionRecordLevel::Full,
            &SshAuthMethod::password("login-secret"),
            Some("enable-secret"),
        );
        recorder
            .record_event(SessionEvent::CommandOutput {
                command: "username admin password login-secret".to_string(),
                mode: "config".to_string(),
                prompt_before: None,
                prompt_after: None,
                fsm_prompt_before: None,
                fsm_prompt_after: None,
                success: true,
                exit_code: None,
                content: "enable-secret accepted".to_string(),
                all: "login-secret enable-secret".to_string(),
            })
            .expect("record event");

        let jsonl = recorder.to_jsonl().expect("serialize recording");
        assert!(!jsonl.contains("login-secret"));
        assert!(!jsonl.contains("enable-secret"));
        assert!(jsonl.contains("***"));
    }

    #[test]
    fn redacting_recorder_scrubs_every_secret_bearing_auth_method() {
        let methods = [
            SshAuthMethod::private_key(
                "private-key-material",
                Some("private-key-passphrase".to_string()),
            ),
            SshAuthMethod::private_key_file(
                "/run/secrets/id_ed25519",
                Some("file-key-passphrase".to_string()),
            ),
        ];
        let secrets = [
            ["private-key-material", "private-key-passphrase"].as_slice(),
            ["file-key-passphrase"].as_slice(),
        ];

        for (auth, auth_secrets) in methods.iter().zip(secrets) {
            let recorder = redacting_recorder(SessionRecordLevel::Full, auth, None);
            recorder
                .record_event(SessionEvent::CommandOutput {
                    command: auth_secrets.join(" "),
                    mode: "exec".to_string(),
                    prompt_before: None,
                    prompt_after: None,
                    fsm_prompt_before: None,
                    fsm_prompt_after: None,
                    success: true,
                    exit_code: None,
                    content: auth_secrets.join(" "),
                    all: auth_secrets.join(" "),
                })
                .expect("record event");
            let jsonl = recorder.to_jsonl().expect("serialize recording");
            for secret in auth_secrets {
                assert!(!jsonl.contains(secret));
            }
        }
    }
}
