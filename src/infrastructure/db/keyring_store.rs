use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use anyhow::{Result, anyhow};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use rand::Rng;
use rand::rand_core::UnwrapErr;
use rand::rngs::SysRng;
use std::sync::OnceLock;

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
    if let Some(stored) = get_secret_by_ref(MASTER_KEY_REF)? {
        return decode_master_key(&stored);
    }
    let mut key = [0_u8; KEY_LEN];
    UnwrapErr(SysRng).fill_bytes(&mut key);
    let encoded = BASE64_STANDARD.encode(key);
    set_secret_by_ref(MASTER_KEY_REF, &encoded)?;
    Ok(key)
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
