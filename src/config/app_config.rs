use crate::config::paths::rauto_home_dir;
use anyhow::{Context, Result, anyhow};
use rand::distributions::{Alphanumeric, DistString};
use rand::rngs::OsRng;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use toml::Value;

const GENERATED_PASSWORD_LEN: usize = 24;

#[derive(Debug, Clone)]
pub struct WebPasswordConfig {
    pub password: String,
    pub path: PathBuf,
    pub generated: bool,
}

pub fn config_path() -> PathBuf {
    rauto_home_dir().join("config.toml")
}

pub fn load_or_create_web_password() -> Result<WebPasswordConfig> {
    load_or_create_web_password_at(&config_path())
}

fn load_or_create_web_password_at(path: &Path) -> Result<WebPasswordConfig> {
    let mut config = if path.exists() {
        let content = fs::read_to_string(path)
            .with_context(|| format!("failed to read rauto config: {}", path.display()))?;
        toml::from_str::<Value>(&content)
            .with_context(|| format!("failed to parse rauto config: {}", path.display()))?
    } else {
        Value::Table(Default::default())
    };

    let root = config
        .as_table_mut()
        .ok_or_else(|| anyhow!("rauto config root must be a TOML table"))?;
    let web = root
        .entry("web")
        .or_insert_with(|| Value::Table(Default::default()))
        .as_table_mut()
        .ok_or_else(|| anyhow!("rauto config [web] must be a TOML table"))?;

    if let Some(password) = web.get("password") {
        let password = password
            .as_str()
            .ok_or_else(|| anyhow!("rauto config web.password must be a string"))?
            .trim();
        if !password.is_empty() {
            secure_existing_path(path)?;
            return Ok(WebPasswordConfig {
                password: password.to_string(),
                path: path.to_path_buf(),
                generated: false,
            });
        }
    }

    let password = Alphanumeric.sample_string(&mut OsRng, GENERATED_PASSWORD_LEN);
    web.insert("password".to_string(), Value::String(password.clone()));
    write_private_config(path, &toml::to_string_pretty(&config)?)?;

    Ok(WebPasswordConfig {
        password,
        path: path.to_path_buf(),
        generated: true,
    })
}

fn write_private_config(path: &Path, content: &str) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| anyhow!("rauto config path has no parent: {}", path.display()))?;
    fs::create_dir_all(parent)?;
    set_private_dir_permissions(parent)?;

    let mut options = OpenOptions::new();
    options.create(true).truncate(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(path)
        .with_context(|| format!("failed to write rauto config: {}", path.display()))?;
    file.write_all(content.as_bytes())?;
    file.sync_all()?;
    set_private_file_permissions(path)?;
    Ok(())
}

fn secure_existing_path(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        set_private_dir_permissions(parent)?;
    }
    set_private_file_permissions(path)
}

#[cfg(unix)]
fn set_private_dir_permissions(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    Ok(())
}

#[cfg(not(unix))]
fn set_private_dir_permissions(_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(unix)]
fn set_private_file_permissions(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    Ok(())
}

#[cfg(not(unix))]
fn set_private_file_permissions(_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::RngCore;

    fn test_path(name: &str) -> PathBuf {
        let mut suffix = [0_u8; 8];
        OsRng.fill_bytes(&mut suffix);
        std::env::temp_dir()
            .join(format!(
                "rauto-app-config-{name}-{:016x}",
                u64::from_le_bytes(suffix)
            ))
            .join("config.toml")
    }

    #[test]
    fn generates_and_reuses_web_password() -> Result<()> {
        let path = test_path("generate");
        let generated = load_or_create_web_password_at(&path)?;
        assert!(generated.generated);
        assert_eq!(generated.password.len(), GENERATED_PASSWORD_LEN);

        let loaded = load_or_create_web_password_at(&path)?;
        assert!(!loaded.generated);
        assert_eq!(loaded.password, generated.password);

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(fs::metadata(&path)?.permissions().mode() & 0o777, 0o600);
            assert_eq!(
                fs::metadata(path.parent().expect("config parent"))?
                    .permissions()
                    .mode()
                    & 0o777,
                0o700
            );
        }
        fs::remove_dir_all(path.parent().expect("config parent"))?;
        Ok(())
    }

    #[test]
    fn preserves_existing_config_sections() -> Result<()> {
        let path = test_path("preserve");
        fs::create_dir_all(path.parent().expect("config parent"))?;
        fs::write(&path, "[custom]\nenabled = true\n")?;

        let generated = load_or_create_web_password_at(&path)?;
        let value = toml::from_str::<Value>(&fs::read_to_string(&path)?)?;
        assert!(generated.generated);
        assert_eq!(value["custom"]["enabled"].as_bool(), Some(true));
        assert_eq!(
            value["web"]["password"].as_str(),
            Some(generated.password.as_str())
        );

        fs::remove_dir_all(path.parent().expect("config parent"))?;
        Ok(())
    }
}
