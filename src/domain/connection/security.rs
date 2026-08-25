use clap::ValueEnum;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, ValueEnum)]
#[serde(rename_all = "kebab-case")]
pub enum SshSecurityProfile {
    Secure,
    Balanced,
    #[default]
    LegacyCompatible,
    #[cfg(test)]
    #[value(skip)]
    TestNoCheck,
}

impl SshSecurityProfile {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Secure => "secure",
            Self::Balanced => "balanced",
            Self::LegacyCompatible => "legacy-compatible",
            #[cfg(test)]
            Self::TestNoCheck => "test-no-check",
        }
    }
}

impl std::fmt::Display for SshSecurityProfile {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}
