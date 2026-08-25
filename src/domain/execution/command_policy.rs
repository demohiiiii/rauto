use std::error::Error;
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlockedCommand {
    pub command: String,
    pub pattern: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommandPolicyError {
    EmptyPattern,
    MultilinePattern,
}

impl fmt::Display for CommandPolicyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyPattern => f.write_str("blacklist pattern must not be empty"),
            Self::MultilinePattern => f.write_str("blacklist pattern must be a single line"),
        }
    }
}

impl Error for CommandPolicyError {}

pub fn normalize_pattern(pattern: &str) -> Result<String, CommandPolicyError> {
    let normalized = pattern.trim();
    if normalized.is_empty() {
        return Err(CommandPolicyError::EmptyPattern);
    }
    if normalized.contains('\n') || normalized.contains('\r') {
        return Err(CommandPolicyError::MultilinePattern);
    }
    Ok(normalized.to_string())
}

pub fn normalize_match_text(input: &str) -> String {
    input.trim().to_ascii_lowercase()
}

pub fn find_blocked_command<'a>(
    command: &str,
    patterns: impl IntoIterator<Item = &'a str>,
) -> Option<BlockedCommand> {
    let normalized_command = normalize_match_text(command);
    if normalized_command.is_empty() {
        return None;
    }

    patterns.into_iter().find_map(|pattern| {
        wildcard_match(&normalize_match_text(pattern), &normalized_command).then(|| {
            BlockedCommand {
                command: command.trim().to_string(),
                pattern: pattern.to_string(),
            }
        })
    })
}

fn wildcard_match(pattern: &str, text: &str) -> bool {
    let pattern_bytes = pattern.as_bytes();
    let text_bytes = text.as_bytes();
    let mut pattern_index = 0usize;
    let mut text_index = 0usize;
    let mut last_star = None;
    let mut star_text_index = 0usize;

    while text_index < text_bytes.len() {
        if pattern_index < pattern_bytes.len()
            && pattern_bytes[pattern_index] == text_bytes[text_index]
        {
            pattern_index += 1;
            text_index += 1;
        } else if pattern_index < pattern_bytes.len() && pattern_bytes[pattern_index] == b'*' {
            last_star = Some(pattern_index);
            pattern_index += 1;
            star_text_index = text_index;
        } else if let Some(star_index) = last_star {
            pattern_index = star_index + 1;
            star_text_index += 1;
            text_index = star_text_index;
        } else {
            return false;
        }
    }

    while pattern_index < pattern_bytes.len() && pattern_bytes[pattern_index] == b'*' {
        pattern_index += 1;
    }

    pattern_index == pattern_bytes.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matching_is_case_insensitive_and_supports_stars() {
        let patterns = ["reload", "SHOW *", "* erase", "conf*terminal"];

        assert!(find_blocked_command("reload", patterns).is_some());
        assert!(find_blocked_command("show version", patterns).is_some());
        assert!(find_blocked_command("write erase", patterns).is_some());
        assert!(find_blocked_command("configure terminal", patterns).is_some());
        assert!(find_blocked_command("reload in", patterns).is_none());
    }

    #[test]
    fn patterns_are_trimmed_and_single_line() {
        assert_eq!(normalize_pattern(" reload ").expect("pattern"), "reload");
        assert_eq!(
            normalize_pattern("  "),
            Err(CommandPolicyError::EmptyPattern)
        );
        assert_eq!(
            normalize_pattern("show *\nreload"),
            Err(CommandPolicyError::MultilinePattern)
        );
    }
}
