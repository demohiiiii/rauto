#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CatalogSource {
    Builtin,
    Custom,
}

impl CatalogSource {
    pub fn label(self) -> &'static str {
        match self {
            Self::Builtin => "builtin",
            Self::Custom => "custom",
        }
    }
}

pub type ShowCommandSource = CatalogSource;
pub type ConfigCommandSource = CatalogSource;

#[derive(Debug, Clone)]
pub struct ShowCommand {
    pub object: String,
    pub platform: String,
    pub command: String,
    pub mode: Option<String>,
    pub textfsm_mapping_command: Option<String>,
    pub textfsm_template_name: Option<String>,
    pub source: ShowCommandSource,
}

#[derive(Debug, Clone)]
pub struct ConfigFetchCommand {
    pub profile: String,
    pub kind: String,
    pub command: String,
    pub mode: Option<String>,
    pub source: ConfigCommandSource,
}

#[derive(Debug, Clone)]
pub struct VolatilePatternEntry {
    pub profile: String,
    pub pattern: String,
    pub source: ConfigCommandSource,
}

#[derive(Debug, Clone)]
pub struct ConfigCommandOverride {
    pub device_profile: String,
    pub kind: String,
    pub command: String,
    pub mode: Option<String>,
}

#[derive(Debug, Clone)]
pub struct VolatilePatternOverride {
    pub device_profile: String,
    pub pattern: String,
}

#[derive(Debug, Clone)]
pub struct CustomShowObject {
    pub device_profile: String,
    pub object: String,
    pub command: String,
    pub mode: Option<String>,
    pub textfsm_mapping_command: Option<String>,
    pub textfsm_template_name: Option<String>,
    pub enabled: bool,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

pub fn normalize_show_object(raw: &str) -> Option<String> {
    let normalized = normalize_object_text(raw);
    match normalized.as_str() {
        "ver" | "version" => Some("version".to_string()),
        "int" | "ints" | "interface" | "interfaces" => Some("interfaces".to_string()),
        "brief" | "interface-brief" | "interfaces-brief" | "ip-interface-brief" => {
            Some("interface-brief".to_string())
        }
        "route" | "routes" | "routing" => Some("route".to_string()),
        "policy" | "security-policy" => Some("policy".to_string()),
        "nat" | "nat-policy" => Some("nat-policy".to_string()),
        "arp" | "lldp" | "mac" | "vlan" => Some(normalized),
        "vlans" => Some("vlan".to_string()),
        _ if !normalized.is_empty() => Some(normalized),
        _ => None,
    }
}

fn normalize_object_text(raw: &str) -> String {
    let mut output = String::new();
    let mut last_dash = false;
    for ch in raw.trim().to_ascii_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            output.push(ch);
            last_dash = false;
        } else if !last_dash {
            output.push('-');
            last_dash = true;
        }
    }
    output.trim_matches('-').to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn show_object_aliases_are_canonicalized() {
        assert_eq!(normalize_show_object(" VER ").as_deref(), Some("version"));
        assert_eq!(
            normalize_show_object("ip interface brief").as_deref(),
            Some("interface-brief")
        );
        assert_eq!(normalize_show_object(" "), None);
    }
}
