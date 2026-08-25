use rneter::session::ConnectionSecurityOptions;

pub use crate::domain::connection::SshSecurityProfile;

pub fn connection_security_options(profile: SshSecurityProfile) -> ConnectionSecurityOptions {
    match profile {
        SshSecurityProfile::Secure => ConnectionSecurityOptions::secure_default(),
        SshSecurityProfile::Balanced => ConnectionSecurityOptions::balanced(),
        SshSecurityProfile::LegacyCompatible => ConnectionSecurityOptions::legacy_compatible(),
        #[cfg(test)]
        SshSecurityProfile::TestNoCheck => ConnectionSecurityOptions {
            level: rneter::session::SecurityLevel::Secure,
            server_check: async_ssh2_tokio::ServerCheckMethod::NoCheck,
        },
    }
}
