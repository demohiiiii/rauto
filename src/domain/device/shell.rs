use anyhow::{Result, anyhow};
use clap::ValueEnum;
use rneter::device::DeviceShellFlavor;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ValueEnum, Default)]
#[serde(rename_all = "snake_case")]
pub enum LinuxShellFlavor {
    #[default]
    #[value(alias = "bash", alias = "sh", alias = "zsh")]
    Posix,
    Fish,
}

impl LinuxShellFlavor {
    pub fn to_device_shell_flavor(self) -> DeviceShellFlavor {
        match self {
            Self::Posix => DeviceShellFlavor::Posix,
            Self::Fish => DeviceShellFlavor::Fish,
        }
    }
}

impl Display for LinuxShellFlavor {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let value = match self {
            Self::Posix => "posix",
            Self::Fish => "fish",
        };
        f.write_str(value)
    }
}

impl FromStr for LinuxShellFlavor {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_ascii_lowercase().as_str() {
            "" => Err(anyhow!("linux shell flavor is required")),
            "posix" | "bash" | "sh" | "zsh" => Ok(Self::Posix),
            "fish" => Ok(Self::Fish),
            other => Err(anyhow!(
                "invalid linux shell flavor '{}', expected posix|bash|fish",
                other
            )),
        }
    }
}
