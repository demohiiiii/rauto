use crate::config::paths::rauto_home_dir;
use anyhow::{Result, anyhow};
use rneter::session::{RollbackPolicy, TxBlock, TxWorkflow};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlockedCommand {
    pub command: String,
    pub pattern: String,
}

pub fn blacklist_file() -> PathBuf {
    rauto_home_dir().join("command_blacklist.txt")
}

pub fn list_patterns() -> Result<Vec<String>> {
    let path = blacklist_file();
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path)?;
    Ok(parse_patterns(&content))
}

pub fn add_pattern(pattern: &str) -> Result<(bool, PathBuf)> {
    let normalized = validate_pattern(pattern)?;
    let mut patterns = list_patterns()?;
    let exists = patterns
        .iter()
        .any(|item| normalize_match_text(item) == normalize_match_text(&normalized));
    if exists {
        return Ok((false, blacklist_file()));
    }
    patterns.push(normalized);
    patterns.sort_by_key(|item| item.to_ascii_lowercase());
    write_patterns(&patterns)?;
    Ok((true, blacklist_file()))
}

pub fn delete_pattern(pattern: &str) -> Result<bool> {
    let normalized = validate_pattern(pattern)?;
    let mut patterns = list_patterns()?;
    let before = patterns.len();
    patterns.retain(|item| normalize_match_text(item) != normalize_match_text(&normalized));
    if patterns.len() == before {
        return Ok(false);
    }
    write_patterns(&patterns)?;
    Ok(true)
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

fn write_patterns(patterns: &[String]) -> Result<()> {
    let path = blacklist_file();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut content = patterns.join("\n");
    if !content.is_empty() {
        content.push('\n');
    }
    fs::write(path, content.as_bytes())?;
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

fn parse_patterns(content: &str) -> Vec<String> {
    content
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .collect()
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

#[cfg(test)]
mod tests {
    use super::*;
    use rneter::session::{CommandBlockKind, RollbackPolicy, TxStep};

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
                command: "show version".to_string(),
                timeout_secs: None,
                rollback_command: Some("write erase".to_string()),
                rollback_on_failure: false,
            }],
            fail_fast: true,
        };

        let blocked = ["show *".to_string(), "reload".to_string()];
        let err = tx_block
            .steps
            .iter()
            .map(|step| step.command.as_str())
            .chain(
                tx_block
                    .steps
                    .iter()
                    .filter_map(|step| step.rollback_command.as_deref()),
            )
            .chain(match &tx_block.rollback_policy {
                RollbackPolicy::WholeResource { undo_command, .. } => Some(undo_command.as_str()),
                _ => None,
            })
            .find_map(|command| {
                blocked.iter().find_map(|pattern| {
                    if wildcard_match(
                        &normalize_match_text(pattern),
                        &normalize_match_text(command),
                    ) {
                        Some((command.to_string(), pattern.clone()))
                    } else {
                        None
                    }
                })
            });

        assert_eq!(
            err,
            Some(("show version".to_string(), "show *".to_string()))
        );
    }
}
