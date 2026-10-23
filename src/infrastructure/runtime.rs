//! Process ownership is tied to the open file, never to a PID or file existence.
use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, Write};
use std::path::{Path, PathBuf};

pub const PROTOCOL_VERSION: u32 = 1;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RuntimeInfo {
    pub protocol: u32,
    pub instance_id: String,
    pub endpoint: String,
    pub token: String,
}

pub struct RuntimeLock {
    _file: File,
    home: PathBuf,
}

impl RuntimeLock {
    pub fn try_acquire(home: &Path) -> Result<Option<Self>> {
        std::fs::create_dir_all(home).context("create runtime directory")?;
        let file = private_options()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(home.join("runtime.lock"))
            .context("open runtime lock")?;
        match file.try_lock() {
            Ok(()) => Ok(Some(Self {
                _file: file,
                home: home.to_owned(),
            })),
            Err(std::fs::TryLockError::WouldBlock) => Ok(None),
            Err(std::fs::TryLockError::Error(error)) => Err(error).context("lock runtime"),
        }
    }

    pub fn publish(&self, info: &RuntimeInfo) -> Result<()> {
        // Readers may observe a partial write during startup and retry. Keeping
        // one inode also avoids Windows rename/delete sharing constraints.
        let mut file = private_options()
            .write(true)
            .create(true)
            .truncate(true)
            .open(self.home.join("runtime.json"))?;
        restrict_permissions(&file)?;
        serde_json::to_writer(&mut file, info)?;
        file.flush()?;
        Ok(())
    }

    pub fn read(home: &Path) -> Result<RuntimeInfo> {
        let mut file = File::open(home.join("runtime.json"))?;
        let mut data = String::new();
        Read::by_ref(&mut file)
            .take(16 * 1024)
            .read_to_string(&mut data)?;
        let info: RuntimeInfo = serde_json::from_str(&data)?;
        if info.protocol != PROTOCOL_VERSION {
            bail!(
                "background service protocol differs; restart the service with this rauto version"
            );
        }
        let url = reqwest::Url::parse(&info.endpoint)?;
        if url.scheme() != "http" || url.host_str() != Some("127.0.0.1") || url.port().is_none() {
            bail!("invalid local runtime endpoint");
        }
        Ok(info)
    }
}

impl Drop for RuntimeLock {
    fn drop(&mut self) {
        // Clear stale credentials while still holding ownership. The lock inode
        // must remain in place: unlinking it would allow a second owner.
        if let Ok(mut file) = private_options()
            .write(true)
            .open(self.home.join("runtime.json"))
        {
            let _ = file.rewind();
            let _ = file.set_len(0);
        }
    }
}

fn private_options() -> OpenOptions {
    let mut options = OpenOptions::new();
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options
}

fn restrict_permissions(file: &File) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(std::fs::Permissions::from_mode(0o600))?;
    }
    #[cfg(not(unix))]
    let _ = file;
    Ok(())
}

pub fn new_id() -> String {
    use rand::RngExt;
    format!("{:032x}", rand::rng().random::<u128>())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ownership_follows_file_lock_and_ignores_stale_metadata() {
        let dir = std::env::temp_dir().join(format!("rauto-runtime-{}", new_id()));
        let owner = RuntimeLock::try_acquire(&dir).unwrap().unwrap();
        assert!(RuntimeLock::try_acquire(&dir).unwrap().is_none());
        owner
            .publish(&RuntimeInfo {
                protocol: PROTOCOL_VERSION,
                instance_id: new_id(),
                endpoint: "http://127.0.0.1:32123".into(),
                token: new_id(),
            })
            .unwrap();
        assert!(RuntimeLock::read(&dir).is_ok());
        drop(owner);
        assert!(RuntimeLock::read(&dir).is_err());
        assert!(RuntimeLock::try_acquire(&dir).unwrap().is_some());
        assert!(dir.join("runtime.lock").exists());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
