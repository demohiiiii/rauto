use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use anyhow::{Result, anyhow};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use rand::Rng;
use rand::rand_core::UnwrapErr;
use rand::rngs::SysRng;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use crate::config::paths::rauto_home_dir;

#[cfg(not(test))]
const SERVICE_NAME: &str = "rauto";

const MASTER_KEY_REF: &str = "master/encryption-key/v1";
const SECRET_FORMAT_PREFIX: &str = "enc:v1:";
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;
static MASTER_KEY_CACHE: OnceLock<Result<[u8; KEY_LEN], String>> = OnceLock::new();

pub fn store_secret(value: Option<&str>) -> Result<Option<String>> {
    let Some(value) = value.filter(|item| !item.trim().is_empty()) else {
        return Ok(None);
    };
    Ok(Some(encrypt_secret(value)?))
}

pub fn load_secret(secret_ref: Option<&str>) -> Result<Option<String>> {
    let Some(secret_ref) = secret_ref.filter(|item| !item.trim().is_empty()) else {
        return Ok(None);
    };
    if !secret_ref.starts_with(SECRET_FORMAT_PREFIX) {
        return Err(anyhow!("unsupported stored secret format '{}'", secret_ref));
    }
    Ok(Some(decrypt_secret(secret_ref)?))
}

fn encrypt_secret(value: &str) -> Result<String> {
    let key = load_or_create_master_key_cached()?;
    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|err| anyhow!("invalid master key: {}", err))?;
    let mut nonce_bytes = [0_u8; NONCE_LEN];
    UnwrapErr(SysRng).fill_bytes(&mut nonce_bytes);
    let ciphertext = cipher
        .encrypt(&Nonce::from(nonce_bytes), value.as_bytes())
        .map_err(|err| anyhow!("failed to encrypt secret: {}", err))?;
    let mut payload = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    payload.extend_from_slice(&nonce_bytes);
    payload.extend_from_slice(&ciphertext);
    Ok(format!(
        "{}{}",
        SECRET_FORMAT_PREFIX,
        BASE64_STANDARD.encode(payload)
    ))
}

fn decrypt_secret(stored: &str) -> Result<String> {
    let key = load_or_create_master_key_cached()?;
    decrypt_secret_with_key(stored, &key)
}

fn decrypt_secret_with_key(stored: &str, key: &[u8; KEY_LEN]) -> Result<String> {
    let encoded = stored
        .strip_prefix(SECRET_FORMAT_PREFIX)
        .ok_or_else(|| anyhow!("unsupported secret format"))?;
    let payload = BASE64_STANDARD
        .decode(encoded)
        .map_err(|err| anyhow!("invalid encrypted secret payload: {}", err))?;
    if payload.len() <= NONCE_LEN {
        return Err(anyhow!("invalid encrypted secret payload length"));
    }
    let (nonce, ciphertext) = payload.split_at(NONCE_LEN);
    let cipher =
        Aes256Gcm::new_from_slice(key).map_err(|err| anyhow!("invalid master key: {}", err))?;
    let nonce = Nonce::try_from(nonce).map_err(|err| anyhow!("invalid nonce: {}", err))?;
    let plaintext = cipher
        .decrypt(&nonce, ciphertext)
        .map_err(|err| anyhow!("failed to decrypt secret: {}", err))?;
    String::from_utf8(plaintext).map_err(|err| anyhow!("invalid utf-8 secret: {}", err))
}

fn load_or_create_master_key_cached() -> Result<[u8; KEY_LEN]> {
    let cached = MASTER_KEY_CACHE.get_or_init(|| {
        load_or_create_master_key()
            .map_err(|err| format!("failed to initialize master key: {}", err))
    });
    match cached {
        Ok(key) => Ok(*key),
        Err(err) => Err(anyhow!(err.clone())),
    }
}

fn load_or_create_master_key() -> Result<[u8; KEY_LEN]> {
    // keyring 4 requires a session Secret Service on Linux. Headless servers often
    // have no D-Bus session, so keep the encrypted database usable with a private
    // per-user key file when the OS store is unavailable.
    if !system_keyring_available() {
        tracing::warn!(
            "system credential store is unavailable; using the private local master-key file"
        );
        return load_or_create_file_master_key(&master_key_file_path());
    }

    if let Some(stored) = get_secret_by_ref(MASTER_KEY_REF)? {
        return decode_master_key(&stored);
    }

    // Migrate a key created during a headless run into the OS store when a
    // Secret Service session becomes available later. Keep this filesystem
    // lookup out of tests so they never inspect the user's real rauto home.
    #[cfg(not(test))]
    {
        let fallback_path = master_key_file_path();
        if fallback_path.is_file() {
            let key = load_file_master_key(&fallback_path)?;
            let encoded = BASE64_STANDARD.encode(key);
            set_secret_by_ref(MASTER_KEY_REF, &encoded)?;
            return Ok(key);
        }
    }

    let mut key = [0_u8; KEY_LEN];
    UnwrapErr(SysRng).fill_bytes(&mut key);
    let encoded = BASE64_STANDARD.encode(key);
    set_secret_by_ref(MASTER_KEY_REF, &encoded)?;
    Ok(key)
}

#[cfg(not(test))]
fn system_keyring_available() -> bool {
    keyring::Entry::store_status().is_ok()
}

#[cfg(test)]
fn system_keyring_available() -> bool {
    true
}

fn master_key_file_path() -> PathBuf {
    rauto_home_dir().join("keys").join("master.key")
}

fn load_or_create_file_master_key(path: &Path) -> Result<[u8; KEY_LEN]> {
    if path.exists() {
        return load_file_master_key(path);
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| anyhow!("failed to create local key directory: {}", err))?;
        set_private_dir_permissions(parent)?;
    }

    let mut key = [0_u8; KEY_LEN];
    UnwrapErr(SysRng).fill_bytes(&mut key);
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    match options.open(path) {
        Ok(mut file) => {
            file.write_all(&key)
                .and_then(|_| file.sync_all())
                .map_err(|err| anyhow!("failed to write local master key: {}", err))?;
            set_private_file_permissions(path)?;
            Ok(key)
        }
        Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => load_file_master_key(path),
        Err(err) => Err(anyhow!("failed to create local master key: {}", err)),
    }
}

fn load_file_master_key(path: &Path) -> Result<[u8; KEY_LEN]> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|err| anyhow!("failed to inspect local master key: {}", err))?;
    if !metadata.file_type().is_file() {
        return Err(anyhow!("local master key path is not a regular file"));
    }
    let mut bytes = Vec::with_capacity(KEY_LEN);
    File::open(path)
        .and_then(|mut file| file.read_to_end(&mut bytes))
        .map_err(|err| anyhow!("failed to read local master key: {}", err))?;
    if bytes.len() != KEY_LEN {
        return Err(anyhow!(
            "invalid local master key length: expected {}, got {}",
            KEY_LEN,
            bytes.len()
        ));
    }
    set_private_file_permissions(path)?;
    let mut key = [0_u8; KEY_LEN];
    key.copy_from_slice(&bytes);
    Ok(key)
}

#[cfg(unix)]
fn set_private_dir_permissions(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
        .map_err(|err| anyhow!("failed to secure local key directory: {}", err))
}

#[cfg(not(unix))]
fn set_private_dir_permissions(_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(unix)]
fn set_private_file_permissions(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
        .map_err(|err| anyhow!("failed to secure local master key: {}", err))
}

#[cfg(not(unix))]
fn set_private_file_permissions(_path: &Path) -> Result<()> {
    Ok(())
}

fn decode_master_key(raw: &str) -> Result<[u8; KEY_LEN]> {
    let bytes = BASE64_STANDARD
        .decode(raw.trim())
        .map_err(|err| anyhow!("invalid stored master key encoding: {}", err))?;
    if bytes.len() != KEY_LEN {
        return Err(anyhow!(
            "invalid stored master key length: expected {}, got {}",
            KEY_LEN,
            bytes.len()
        ));
    }
    let mut key = [0_u8; KEY_LEN];
    key.copy_from_slice(&bytes);
    Ok(key)
}

#[cfg(not(test))]
fn entry(secret_ref: &str) -> Result<keyring::Entry> {
    keyring::Entry::new(SERVICE_NAME, secret_ref)
        .map_err(|err| anyhow!("failed to open keyring entry '{}': {}", secret_ref, err))
}

#[cfg(not(test))]
fn set_secret_by_ref(secret_ref: &str, value: &str) -> Result<()> {
    entry(secret_ref)?
        .set_password(value)
        .map_err(|err| anyhow!("failed to save secret '{}' in keyring: {}", secret_ref, err))
}

#[cfg(not(test))]
fn get_secret_by_ref(secret_ref: &str) -> Result<Option<String>> {
    match entry(secret_ref)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(anyhow!(
            "failed to read secret '{}' from keyring: {}",
            secret_ref,
            err
        )),
    }
}

#[cfg(test)]
fn set_secret_by_ref(secret_ref: &str, value: &str) -> Result<()> {
    test_backend::set(secret_ref, value)
}

#[cfg(test)]
fn get_secret_by_ref(secret_ref: &str) -> Result<Option<String>> {
    test_backend::get(secret_ref)
}

#[cfg(test)]
mod tests {
    use super::*;

    // AES-256-GCM fixture in the existing enc:v1 format: nonce || ciphertext || tag.
    const LEGACY_SECRET: &str =
        "enc:v1:AAECAwQFBgcICQoLK2exeqac72/oMuOmwowbH+aiuwa1fVIbln9DfPNHcbAsEw==";

    #[test]
    fn decrypts_existing_v1_ciphertext() {
        let key = std::array::from_fn(|index| index as u8);
        assert_eq!(
            decrypt_secret_with_key(LEGACY_SECRET, &key).unwrap(),
            "legacy-test-secret"
        );
    }

    #[test]
    fn rejects_modified_ciphertext_and_wrong_keys() {
        let key = std::array::from_fn(|index| index as u8);
        let mut payload = BASE64_STANDARD
            .decode(LEGACY_SECRET.strip_prefix(SECRET_FORMAT_PREFIX).unwrap())
            .unwrap();
        payload[NONCE_LEN] ^= 1;
        let modified = format!("{SECRET_FORMAT_PREFIX}{}", BASE64_STANDARD.encode(payload));
        assert!(decrypt_secret_with_key(&modified, &key).is_err());
        assert!(decrypt_secret_with_key(LEGACY_SECRET, &[0; KEY_LEN]).is_err());
    }

    #[test]
    fn newly_stored_secrets_round_trip_with_unique_nonces() {
        let first = store_secret(Some("test-secret")).unwrap().unwrap();
        let second = store_secret(Some("test-secret")).unwrap().unwrap();
        assert!(first.starts_with(SECRET_FORMAT_PREFIX));
        assert_ne!(first, second);
        assert_eq!(
            load_secret(Some(&first)).unwrap().as_deref(),
            Some("test-secret")
        );
        assert_eq!(
            load_secret(Some(&second)).unwrap().as_deref(),
            Some("test-secret")
        );
    }

    #[test]
    fn local_master_key_round_trips_with_private_permissions() {
        #[cfg(unix)]
        use std::os::unix::fs::PermissionsExt;
        let root = std::env::temp_dir().join(format!("rauto-keyring-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let path = root.join("keys").join("master.key");
        let first = load_or_create_file_master_key(&path).unwrap();
        assert_eq!(first, load_or_create_file_master_key(&path).unwrap());
        #[cfg(unix)]
        assert_eq!(
            fs::metadata(&path).unwrap().permissions().mode() & 0o777,
            0o600
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn local_master_key_rejects_invalid_files() {
        let root =
            std::env::temp_dir().join(format!("rauto-keyring-invalid-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let path = root.join("master.key");
        fs::write(&path, [0_u8; KEY_LEN - 1]).unwrap();
        assert!(load_file_master_key(&path).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}

#[cfg(test)]
mod test_backend {
    use anyhow::Result;
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};

    static STORE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

    fn store() -> &'static Mutex<HashMap<String, String>> {
        STORE.get_or_init(|| Mutex::new(HashMap::new()))
    }

    pub fn set(secret_ref: &str, value: &str) -> Result<()> {
        store()
            .lock()
            .expect("test keyring lock poisoned")
            .insert(secret_ref.to_string(), value.to_string());
        Ok(())
    }

    pub fn get(secret_ref: &str) -> Result<Option<String>> {
        Ok(store()
            .lock()
            .expect("test keyring lock poisoned")
            .get(secret_ref)
            .cloned())
    }
}
