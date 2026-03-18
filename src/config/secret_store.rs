use crate::config::paths::default_master_key_path;
use anyhow::{Context, Result, anyhow};
use base64::Engine as _;
use base64::engine::general_purpose::STANDARD_NO_PAD;
use ring::aead::{AES_256_GCM, Aad, LessSafeKey, Nonce, UnboundKey};
use ring::rand::{SecureRandom, SystemRandom};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

const MASTER_KEY_LEN: usize = 32;
const NONCE_LEN: usize = 12;
const SECRET_FORMAT_VERSION: u8 = 1;
const SECRET_AAD: &[u8] = b"rauto/secret/v1";

#[derive(Debug, Serialize, Deserialize)]
struct EncryptedSecretEnvelope {
    version: u8,
    nonce: String,
    ciphertext: String,
}

pub fn encrypt_secret(value: &str) -> Result<Option<String>> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let key = load_or_create_master_key()?;
    let cipher = build_cipher(&key)?;
    let mut nonce_bytes = [0_u8; NONCE_LEN];
    SystemRandom::new()
        .fill(&mut nonce_bytes)
        .map_err(|_| anyhow!("failed to generate nonce for secret encryption"))?;

    let mut in_out = trimmed.as_bytes().to_vec();
    cipher
        .seal_in_place_append_tag(
            Nonce::assume_unique_for_key(nonce_bytes),
            Aad::from(SECRET_AAD),
            &mut in_out,
        )
        .map_err(|_| anyhow!("failed to encrypt saved secret"))?;

    Ok(Some(serde_json::to_string(&EncryptedSecretEnvelope {
        version: SECRET_FORMAT_VERSION,
        nonce: STANDARD_NO_PAD.encode(nonce_bytes),
        ciphertext: STANDARD_NO_PAD.encode(in_out),
    })?))
}

pub fn decrypt_secret(encrypted: Option<&str>) -> Result<Option<String>> {
    let Some(encrypted) = encrypted.filter(|value| !value.trim().is_empty()) else {
        return Ok(None);
    };

    let envelope: EncryptedSecretEnvelope =
        serde_json::from_str(encrypted).context("invalid encrypted secret payload")?;
    if envelope.version != SECRET_FORMAT_VERSION {
        return Err(anyhow!(
            "unsupported saved secret format version '{}'",
            envelope.version
        ));
    }

    let nonce = STANDARD_NO_PAD
        .decode(envelope.nonce.as_bytes())
        .context("invalid encrypted secret nonce")?;
    if nonce.len() != NONCE_LEN {
        return Err(anyhow!(
            "invalid encrypted secret nonce length '{}'",
            nonce.len()
        ));
    }
    let mut nonce_bytes = [0_u8; NONCE_LEN];
    nonce_bytes.copy_from_slice(&nonce);

    let mut in_out = STANDARD_NO_PAD
        .decode(envelope.ciphertext.as_bytes())
        .context("invalid encrypted secret ciphertext")?;
    let key = load_master_key()?;
    let cipher = build_cipher(&key)?;
    let decrypted = cipher
        .open_in_place(
            Nonce::assume_unique_for_key(nonce_bytes),
            Aad::from(SECRET_AAD),
            &mut in_out,
        )
        .map_err(|_| anyhow!("failed to decrypt saved secret"))?;

    Ok(Some(
        String::from_utf8(decrypted.to_vec()).context("decrypted secret is not valid UTF-8")?,
    ))
}

pub fn has_encrypted_secret(encrypted: Option<&str>) -> bool {
    encrypted.is_some_and(|value| !value.trim().is_empty())
}

fn load_or_create_master_key() -> Result<[u8; MASTER_KEY_LEN]> {
    let path = default_master_key_path();
    if path.exists() {
        return read_master_key(&path);
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| {
            format!(
                "failed to create parent directory for master key '{}'",
                parent.display()
            )
        })?;
    }

    let mut key = [0_u8; MASTER_KEY_LEN];
    SystemRandom::new()
        .fill(&mut key)
        .map_err(|_| anyhow!("failed to generate master encryption key"))?;
    write_master_key(&path, &STANDARD_NO_PAD.encode(key))?;
    read_master_key(&path)
}

fn load_master_key() -> Result<[u8; MASTER_KEY_LEN]> {
    let path = default_master_key_path();
    if !path.exists() {
        return Err(anyhow!(
            "master key '{}' is missing; saved passwords cannot be decrypted",
            path.display()
        ));
    }
    read_master_key(&path)
}

fn read_master_key(path: &Path) -> Result<[u8; MASTER_KEY_LEN]> {
    let encoded = fs::read_to_string(path)
        .with_context(|| format!("failed to read master key '{}'", path.display()))?;
    let bytes = STANDARD_NO_PAD
        .decode(encoded.trim().as_bytes())
        .with_context(|| format!("invalid master key encoding '{}'", path.display()))?;
    if bytes.len() != MASTER_KEY_LEN {
        return Err(anyhow!(
            "invalid master key length '{}' in '{}'",
            bytes.len(),
            path.display()
        ));
    }

    let mut key = [0_u8; MASTER_KEY_LEN];
    key.copy_from_slice(&bytes);
    Ok(key)
}

fn write_master_key(path: &Path, encoded: &str) -> Result<()> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }

    match options.open(path) {
        Ok(mut file) => {
            file.write_all(encoded.as_bytes())
                .with_context(|| format!("failed to write master key '{}'", path.display()))?;
            file.write_all(b"\n")
                .with_context(|| format!("failed to finalize master key '{}'", path.display()))?;
        }
        Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => return Ok(()),
        Err(err) => {
            return Err(err)
                .with_context(|| format!("failed to create master key '{}'", path.display()));
        }
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600)).with_context(|| {
            format!(
                "failed to set secure permissions on master key '{}'",
                path.display()
            )
        })?;
    }

    Ok(())
}

fn build_cipher(master_key: &[u8; MASTER_KEY_LEN]) -> Result<LessSafeKey> {
    let key = UnboundKey::new(&AES_256_GCM, master_key)
        .map_err(|_| anyhow!("failed to initialize AES-256-GCM key"))?;
    Ok(LessSafeKey::new(key))
}

#[cfg(test)]
mod tests {
    use super::{decrypt_secret, encrypt_secret};
    use anyhow::Result;
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    struct TestEnvGuard {
        original_home: Option<std::ffi::OsString>,
        _root: PathBuf,
        _guard: std::sync::MutexGuard<'static, ()>,
    }

    impl TestEnvGuard {
        fn new() -> Result<Self> {
            let guard = TEST_ENV_LOCK
                .get_or_init(|| Mutex::new(()))
                .lock()
                .expect("test env lock poisoned");
            let root = std::env::temp_dir().join(format!(
                "rauto-secret-store-test-{}",
                SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos()
            ));
            let original_home = std::env::var_os("RAUTO_HOME");
            unsafe {
                std::env::set_var("RAUTO_HOME", &root);
            }
            Ok(Self {
                original_home,
                _root: root,
                _guard: guard,
            })
        }
    }

    impl Drop for TestEnvGuard {
        fn drop(&mut self) {
            if let Some(value) = &self.original_home {
                unsafe {
                    std::env::set_var("RAUTO_HOME", value);
                }
            } else {
                unsafe {
                    std::env::remove_var("RAUTO_HOME");
                }
            }
        }
    }

    #[test]
    fn encrypt_and_decrypt_secret_round_trip() -> Result<()> {
        let _guard = TestEnvGuard::new()?;
        let encrypted = encrypt_secret("secret-value")?;
        let decrypted = decrypt_secret(encrypted.as_deref())?;
        assert_eq!(decrypted.as_deref(), Some("secret-value"));
        Ok(())
    }
}
