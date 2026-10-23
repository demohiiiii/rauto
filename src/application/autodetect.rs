use crate::application::limits::ExecutionLease;
use crate::config::autodetect_cache;
use crate::config::linux_shell::LinuxShellFlavor;
use crate::config::template_loader;
use anyhow::Result;
use rneter::session::{DetectRequest, ExecutionContext, MANAGER};
use rneter::templates::DetectConnectPolicy;
use tracing::{info, warn};

pub(crate) async fn resolve_connection_profile(
    request: DetectRequest,
    enable_password: Option<String>,
    context: ExecutionContext,
    mut device_profile: String,
    mut linux_shell_flavor: Option<LinuxShellFlavor>,
    force_autodetect: bool,
) -> Result<(String, Option<LinuxShellFlavor>)> {
    if !template_loader::is_autodetect_profile_name(&device_profile) {
        return Ok((device_profile, linux_shell_flavor));
    }

    let host = request.addr.clone();
    let port = request.port;
    if force_autodetect {
        info!("Bypassing autodetect cache and reprobe requested for {host}:{port}");
    } else {
        match autodetect_cache::load_cached_profile(&host, port) {
            Ok(Some(profile)) => {
                info!("Reusing cached autodetected device profile '{profile}' for {host}:{port}");
                device_profile = profile;
                // Older cache entries only contain the profile. Reprobe Linux
                // targets without an explicit shell so fish is handled correctly.
                if !device_profile.eq_ignore_ascii_case("linux") || linux_shell_flavor.is_some() {
                    return Ok((device_profile, linux_shell_flavor));
                }
                info!(
                    "Cached Linux profile for {host}:{port} has no shell flavor; reprobing shell"
                );
            }
            Ok(None) => {}
            Err(err) => warn!("failed to load autodetect cache for {host}:{port}: {err}"),
        }
    }

    let _lease = ExecutionLease::acquire(&host, port).await;
    let connected = MANAGER
        .autodetect_and_connect_with_templates_and_context(
            request,
            enable_password,
            context,
            DetectConnectPolicy::default(),
            template_loader::autodetect_template_definitions()?,
        )
        .await?;
    let best = connected
        .report
        .best_match
        .as_ref()
        .expect("rneter connected autodetect result must contain a best match");
    info!(
        "Device profile autodetected as '{}' (confidence={:?}, score={})",
        best.template_name, best.confidence, best.score
    );
    if let Err(err) = autodetect_cache::save_cached_profile(&host, port, &best.template_name) {
        warn!(
            "failed to save autodetect cache for {host}:{port} -> {}: {err}",
            best.template_name
        );
    }
    device_profile = best.template_name.clone();
    if device_profile.eq_ignore_ascii_case("linux") && linux_shell_flavor.is_none() {
        linux_shell_flavor = connected
            .report
            .linux_shell_flavor
            .map(LinuxShellFlavor::from_device_shell_flavor);
        info!(
            "Detected Linux shell flavor '{}' for {host}:{port}",
            linux_shell_flavor
                .map(|flavor| flavor.to_string())
                .unwrap_or_else(|| "posix".to_string())
        );
    }
    Ok((device_profile, linux_shell_flavor))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cli::runtime::EffectiveConnection;
    use crate::config::ssh_security::SshSecurityProfile;
    use crate::infrastructure::db;
    use rneter::testkit::{DevicePersona, FakeSshDevice};
    use std::time::Duration;

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn orchestration_autodetect_waits_for_device_lease_and_reuses_cache() -> Result<()> {
        let root = std::env::temp_dir().join(format!(
            "rauto-autodetect-{}",
            crate::infrastructure::runtime::new_id()
        ));
        std::fs::create_dir_all(&root)?;
        let path = root.join("test.db");
        let _db_guard = db::override_test_db_path(path.clone());
        db::init_sync()?;
        let persona = DevicePersona::builtin("huawei")?;
        let username = persona.username.clone();
        let password = persona.password.clone();
        let device = FakeSshDevice::spawn(persona).await?;
        let conn = EffectiveConnection {
            connection_name: None,
            credential_id: None,
            host: "127.0.0.1".into(),
            username,
            auth: rneter::session::SshAuthMethod::Password(password.clone()),
            password,
            port: device.port(),
            connect_timeout_secs: Some(5),
            enable_password: None,
            ssh_security: SshSecurityProfile::TestNoCheck,
            linux_shell_flavor: None,
            output_encoding: Default::default(),
            device_profile: "autodetect".into(),
            vars: serde_json::json!({}),
            force_autodetect: true,
            retry_policy: Default::default(),
        };
        let lease = ExecutionLease::acquire(&conn.host, conn.port).await;
        // Exercise the same entry point used by orchestration and compensation.
        let mut detect = Box::pin(crate::resolve_autodetect_connection(conn));
        assert!(
            tokio::time::timeout(Duration::from_millis(50), &mut detect)
                .await
                .is_err()
        );
        assert!(device.received_commands().is_empty());
        drop(lease);
        let mut resolved = tokio::time::timeout(Duration::from_secs(15), detect).await??;
        assert_eq!(resolved.device_profile, "huawei");
        let commands = device.received_commands();
        assert!(!commands.is_empty());

        let _lease = ExecutionLease::acquire(&resolved.host, resolved.port).await;
        resolved.device_profile = "autodetect".into();
        resolved.force_autodetect = false;
        let cached = tokio::time::timeout(
            Duration::from_secs(2),
            crate::resolve_autodetect_connection(resolved),
        )
        .await??;
        assert_eq!(cached.device_profile, "huawei");
        assert_eq!(device.received_commands(), commands);

        db::close_test_db(&path).await;
        std::fs::remove_dir_all(root)?;
        Ok(())
    }
}
