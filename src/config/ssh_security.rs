use clap::ValueEnum;
use rneter::session::ConnectionSecurityOptions;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, ValueEnum)]
#[serde(rename_all = "kebab-case")]
pub enum SshSecurityProfile {
    #[default]
    Secure,
    Balanced,
    LegacyCompatible,
}

impl SshSecurityProfile {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Secure => "secure",
            Self::Balanced => "balanced",
            Self::LegacyCompatible => "legacy-compatible",
        }
    }

    pub fn to_connection_security_options(self) -> ConnectionSecurityOptions {
        match self {
            Self::Secure => ConnectionSecurityOptions::secure_default(),
            Self::Balanced => ConnectionSecurityOptions::balanced(),
            Self::LegacyCompatible => ConnectionSecurityOptions::legacy_compatible(),
        }
    }
}

impl std::fmt::Display for SshSecurityProfile {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}
