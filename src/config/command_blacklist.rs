use crate::db;
use anyhow::{Result, anyhow};
use rneter::session::{RollbackPolicy, TxBlock, TxWorkflow};
use sqlx::Row;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlockedCommand {
    pub command: String,
    pub pattern: String,
}

pub fn storage_path() -> PathBuf {
    db::db_path()
}

pub fn list_patterns() -> Result<Vec<String>> {
    db::run_sync(async {
        let rows =
            sqlx::query("SELECT pattern FROM blacklist_patterns ORDER BY normalized_pattern ASC")
                .fetch_all(db::pool())
                .await?;
        Ok(rows
            .into_iter()
            .map(|row| row.get::<String, _>("pattern"))
            .collect())
    })
}

pub fn add_pattern(pattern: &str) -> Result<(bool, PathBuf)> {
    let normalized = validate_pattern(pattern)?;
    let normalized_match = normalize_match_text(&normalized);
    let created_at_ms = now_epoch_ms() as i64;
    let added = db::run_sync(async move {
        let result = sqlx::query(
            r#"
            INSERT INTO blacklist_patterns (pattern, normalized_pattern, created_at_ms)
            VALUES (?, ?, ?)
            ON CONFLICT(normalized_pattern) DO NOTHING
            "#,
        )
        .bind(&normalized)
        .bind(&normalized_match)
        .bind(created_at_ms)
        .execute(db::pool())
        .await?;
        Ok(result.rows_affected() > 0)
    })?;
    Ok((added, db::db_path()))
}

pub fn delete_pattern(pattern: &str) -> Result<bool> {
    let normalized = validate_pattern(pattern)?;
    let normalized_match = normalize_match_text(&normalized);
    db::run_sync(async move {
        let result = sqlx::query("DELETE FROM blacklist_patterns WHERE normalized_pattern = ?")
            .bind(&normalized_match)
            .execute(db::pool())
            .await?;
        Ok(result.rows_affected() > 0)
    })
}

pub fn find_blocked_command(command: &str) -> Result<Option<BlockedCommand>> {
    let normalized_command = normalize_match_text(command);
    if normalized_command.is_empty() {
        return Ok(None);
    }

    for pattern in list_patterns()? {
        if wildcard_match(&normalize_match_text(&pattern), &normalized_command) {
            return Ok(Some(BlockedCommand {
                command: command.trim().to_string(),
                pattern,
            }));
        }
    }
    Ok(None)
}

pub fn ensure_command_allowed(command: &str, context: &str) -> Result<()> {
    if let Some(blocked) = find_blocked_command(command)? {
        return Err(anyhow!(
            "{} is blocked by blacklist pattern '{}': {}",
            context,
            blocked.pattern,
            blocked.command
        ));
    }
    Ok(())
}

pub fn ensure_commands_allowed<'a>(
    commands: impl IntoIterator<Item = &'a str>,
    context: &str,
) -> Result<()> {
    for command in commands {
        ensure_command_allowed(command, context)?;
    }
    Ok(())
}

pub fn ensure_tx_block_allowed(tx_block: &TxBlock, context: &str) -> Result<()> {
    for (idx, step) in tx_block.steps.iter().enumerate() {
        ensure_command_allowed(&step.command, &format!("{} step {} command", context, idx))?;
        if let Some(rollback) = step.rollback_command.as_deref() {
            ensure_command_allowed(
                rollback,
                &format!("{} step {} rollback_command", context, idx),
            )?;
        }
    }

    if let RollbackPolicy::WholeResource { undo_command, .. } = &tx_block.rollback_policy {
        ensure_command_allowed(
            undo_command,
            &format!("{} whole_resource rollback", context),
        )?;
    }

    Ok(())
}

pub fn ensure_tx_workflow_allowed(workflow: &TxWorkflow, context: &str) -> Result<()> {
    for (idx, block) in workflow.blocks.iter().enumerate() {
        let block_context = format!("{} block {} ({})", context, idx, block.name);
        ensure_tx_block_allowed(block, &block_context)?;
    }
    Ok(())
}

fn validate_pattern(pattern: &str) -> Result<String> {
    let normalized = pattern.trim();
    if normalized.is_empty() {
        return Err(anyhow!("blacklist pattern must not be empty"));
    }
    if normalized.contains('\n') || normalized.contains('\r') {
        return Err(anyhow!("blacklist pattern must be a single line"));
    }
    Ok(normalized.to_string())
}

fn normalize_match_text(input: &str) -> String {
    input.trim().to_ascii_lowercase()
}

fn wildcard_match(pattern: &str, text: &str) -> bool {
    let pattern_bytes = pattern.as_bytes();
    let text_bytes = text.as_bytes();
    let mut pattern_idx = 0usize;
    let mut text_idx = 0usize;
    let mut last_star = None;
    let mut star_text_idx = 0usize;

    while text_idx < text_bytes.len() {
        if pattern_idx < pattern_bytes.len() && pattern_bytes[pattern_idx] == text_bytes[text_idx] {
            pattern_idx += 1;
            text_idx += 1;
        } else if pattern_idx < pattern_bytes.len() && pattern_bytes[pattern_idx] == b'*' {
            last_star = Some(pattern_idx);
            pattern_idx += 1;
            star_text_idx = text_idx;
        } else if let Some(star_idx) = last_star {
            pattern_idx = star_idx + 1;
            star_text_idx += 1;
            text_idx = star_text_idx;
        } else {
            return false;
        }
    }

    while pattern_idx < pattern_bytes.len() && pattern_bytes[pattern_idx] == b'*' {
        pattern_idx += 1;
    }

    pattern_idx == pattern_bytes.len()
}

fn now_epoch_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use rneter::session::{CommandBlockKind, RollbackPolicy, TxStep};
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    #[test]
    fn wildcard_match_supports_exact_and_star_patterns() {
        assert!(wildcard_match("reload", "reload"));
        assert!(wildcard_match("show *", "show version"));
        assert!(wildcard_match("* erase", "write erase"));
        assert!(wildcard_match("conf*terminal", "configure terminal"));
        assert!(!wildcard_match("reload", "reload in"));
        assert!(!wildcard_match("show ip *", "show version"));
    }

    #[test]
    fn wildcard_match_is_case_insensitive_after_normalization() {
        assert!(wildcard_match(
            &normalize_match_text("SHOW *"),
            &normalize_match_text("show ip interface brief")
        ));
    }

    #[test]
    fn tx_block_validation_checks_commands_and_rollbacks() {
        let _env_guard = TestEnvGuard::new().expect("temp env");
        db::init_sync().expect("db");
        add_pattern("reload").expect("insert reload");

        let tx_block = TxBlock {
            name: "demo".to_string(),
            kind: CommandBlockKind::Config,
            rollback_policy: RollbackPolicy::WholeResource {
                mode: "Config".to_string(),
                undo_command: "reload".to_string(),
                timeout_secs: None,
                trigger_step_index: 0,
            },
            steps: vec![TxStep {
                mode: "Config".to_string(),
                command: "configure terminal".to_string(),
                timeout_secs: None,
                rollback_command: Some("write erase".to_string()),
                rollback_on_failure: false,
            }],
            fail_fast: true,
        };

        let err = ensure_tx_block_allowed(&tx_block, "test").expect_err("should block");
        assert!(err.to_string().contains("reload") || err.to_string().contains("write erase"));
    }

    struct TestEnvGuard {
        original_home: Option<std::ffi::OsString>,
        root: PathBuf,
        _guard: std::sync::MutexGuard<'static, ()>,
    }

    impl TestEnvGuard {
        fn new() -> Result<Self> {
            let guard = TEST_ENV_LOCK
                .get_or_init(|| Mutex::new(()))
                .lock()
                .expect("test env lock poisoned");
            let root = std::env::temp_dir().join(format!(
                "rauto-blacklist-test-{}",
                SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos()
            ));
            let original_home = std::env::var_os("RAUTO_HOME");
            unsafe {
                std::env::set_var("RAUTO_HOME", &root);
            }
            Ok(Self {
                original_home,
                root,
                _guard: guard,
            })
        }
    }

    impl Drop for TestEnvGuard {
        fn drop(&mut self) {
            if let Some(value) = &self.original_home {
                unsafe {
                    std::env::set_var("RAUTO_HOME", value);
                }
            } else {
                unsafe {
                    std::env::remove_var("RAUTO_HOME");
                }
            }
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }
}
