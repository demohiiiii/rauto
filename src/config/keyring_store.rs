use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use anyhow::{Result, anyhow};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use rand::RngCore;
use rand::rngs::OsRng;
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

pub fn delete_secret(_secret_ref: Option<&str>) -> Result<()> {
    // Secret refs are encrypted payloads embedded in DB rows, so there is no
    // per-connection keyring entry to delete.
    Ok(())
}

fn encrypt_secret(value: &str) -> Result<String> {
    let key = load_or_create_master_key_cached()?;
    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|err| anyhow!("invalid master key: {}", err))?;
    let mut nonce_bytes = [0_u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), value.as_bytes())
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
    let key = load_or_create_master_key_cached()?;
    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|err| anyhow!("invalid master key: {}", err))?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce), ciphertext)
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
    OsRng.fill_bytes(&mut key);
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
