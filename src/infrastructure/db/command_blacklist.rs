use crate::domain::execution::tx_operation::operation_commands;
use crate::infrastructure::db;
use anyhow::{Result, anyhow};
use rneter::session::{RollbackPolicy, TxBlock, TxWorkflow};
use sqlx::Row;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

pub use crate::domain::execution::command_policy::BlockedCommand;
use crate::domain::execution::command_policy::{
    find_blocked_command as match_blocked_command, normalize_match_text, normalize_pattern,
};

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
    let normalized = normalize_pattern(pattern)?;
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
    let normalized = normalize_pattern(pattern)?;
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
    let patterns = list_patterns()?;
    Ok(match_blocked_command(
        command,
        patterns.iter().map(String::as_str),
    ))
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
        let commands = operation_commands(&step.run)?;
        ensure_commands_allowed(
            commands.iter().map(String::as_str),
            &format!("{} step {} command", context, idx),
        )?;
        if let Some(rollback) = &step.rollback {
            let rollback_commands = operation_commands(rollback)?;
            ensure_commands_allowed(
                rollback_commands.iter().map(String::as_str),
                &format!("{} step {} rollback_command", context, idx),
            )?;
        }
    }

    if let RollbackPolicy::WholeResource { rollback, .. } = &tx_block.rollback_policy {
        let rollback_commands = operation_commands(rollback)?;
        ensure_commands_allowed(
            rollback_commands.iter().map(String::as_str),
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

fn now_epoch_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::db;
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    #[test]
    fn tx_block_validation_checks_commands_and_rollbacks() {
        let _env_guard = TestEnvGuard::new().expect("temp env");
        db::init_sync().expect("db");
        add_pattern("reload").expect("insert reload");

        let tx_block = TxBlock {
            name: "demo".to_string(),
            rollback_policy: crate::domain::execution::tx_operation::whole_resource_rollback_policy(
                "Config", "reload", None, 0,
            ),
            steps: vec![crate::domain::execution::tx_operation::command_tx_step(
                "Config",
                "configure terminal",
                None,
                Some("write erase".to_string()),
                false,
            )],
            fail_fast: true,
        };

        let err = ensure_tx_block_allowed(&tx_block, "test").expect_err("should block");
        assert!(err.to_string().contains("reload") || err.to_string().contains("write erase"));
    }

    struct TestEnvGuard {
        original_home: Option<std::ffi::OsString>,
        _root: PathBuf,
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
                _root: root,
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
        }
    }
}
