use anyhow::{Result, anyhow};
use clap::ValueEnum;
use rneter::session::TextEncoding;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ValueEnum, Default)]
#[serde(rename_all = "snake_case")]
pub enum DeviceEncoding {
    #[default]
    #[value(alias = "utf-8")]
    Utf8,
    #[value(alias = "gb-2312")]
    Gb2312,
    Gbk,
    #[value(alias = "gb-18030")]
    Gb18030,
}

impl DeviceEncoding {
    pub fn to_text_encoding(self) -> TextEncoding {
        match self {
            Self::Utf8 => TextEncoding::Utf8,
            Self::Gb2312 => TextEncoding::Gb2312,
            Self::Gbk => TextEncoding::Gbk,
            Self::Gb18030 => TextEncoding::Gb18030,
        }
    }
}

impl Display for DeviceEncoding {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Utf8 => "utf8",
            Self::Gb2312 => "gb2312",
            Self::Gbk => "gbk",
            Self::Gb18030 => "gb18030",
        })
    }
}

impl FromStr for DeviceEncoding {
    type Err = anyhow::Error;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "utf8" | "utf-8" => Ok(Self::Utf8),
            "gb2312" | "gb-2312" => Ok(Self::Gb2312),
            "gbk" => Ok(Self::Gbk),
            "gb18030" | "gb-18030" => Ok(Self::Gb18030),
            other => Err(anyhow!(
                "invalid device encoding '{}', expected utf8|gb2312|gbk|gb18030",
                other
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aliases_parse_to_supported_encodings() {
        assert_eq!(
            "utf-8".parse::<DeviceEncoding>().unwrap(),
            DeviceEncoding::Utf8
        );
        assert_eq!(
            "GB-2312".parse::<DeviceEncoding>().unwrap(),
            DeviceEncoding::Gb2312
        );
        assert_eq!(
            "gbk".parse::<DeviceEncoding>().unwrap(),
            DeviceEncoding::Gbk
        );
        assert_eq!(
            "gb-18030".parse::<DeviceEncoding>().unwrap(),
            DeviceEncoding::Gb18030
        );
    }

    #[test]
    fn maps_to_rneter_text_encoding() {
        assert_eq!(DeviceEncoding::Utf8.to_text_encoding(), TextEncoding::Utf8);
        assert_eq!(
            DeviceEncoding::Gb18030.to_text_encoding(),
            TextEncoding::Gb18030
        );
    }
}
