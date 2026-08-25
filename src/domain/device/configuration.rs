use regex::Regex;
use sha2::{Digest, Sha256};

pub fn normalize_config(content: &str, patterns: &[String]) -> String {
    let compiled: Vec<Regex> = patterns
        .iter()
        .filter_map(|pattern| Regex::new(pattern).ok())
        .collect();
    if compiled.is_empty() {
        return content.to_string();
    }
    let mut normalized = String::with_capacity(content.len());
    for line in content.lines() {
        if compiled.iter().any(|regex| regex.is_match(line)) {
            continue;
        }
        normalized.push_str(line);
        normalized.push('\n');
    }
    normalized
}

pub fn sha256_hex(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    let digest = hasher.finalize();
    let mut hex = String::with_capacity(digest.len() * 2);
    for byte in digest {
        let _ = std::fmt::Write::write_fmt(&mut hex, format_args!("{:02x}", byte));
    }
    hex
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn volatile_lines_do_not_affect_normalized_hash() {
        let patterns = vec![r"^Last changed: ".to_string()];
        let monday = "hostname edge\nLast changed: Monday\n";
        let tuesday = "hostname edge\nLast changed: Tuesday\n";

        assert_ne!(sha256_hex(monday), sha256_hex(tuesday));
        assert_eq!(
            sha256_hex(&normalize_config(monday, &patterns)),
            sha256_hex(&normalize_config(tuesday, &patterns))
        );
    }
}
