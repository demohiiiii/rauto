use super::*;

pub(super) fn parse_ssh_security_profile(value: &str) -> Result<SshSecurityProfile> {
    match value.trim() {
        "secure" => Ok(SshSecurityProfile::Secure),
        "balanced" => Ok(SshSecurityProfile::Balanced),
        "legacy-compatible" => Ok(SshSecurityProfile::LegacyCompatible),
        #[cfg(test)]
        "test-no-check" => Ok(SshSecurityProfile::TestNoCheck),
        other => Err(anyhow!("invalid ssh security profile '{}'", other)),
    }
}

pub(super) fn parse_linux_shell_flavor(value: &str) -> Result<LinuxShellFlavor> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("invalid linux shell flavor ''"));
    }
    trimmed.parse::<LinuxShellFlavor>()
}
