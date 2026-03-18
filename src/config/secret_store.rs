use anyhow::{Context, Result};
use keyring::{Entry, Error as KeyringError};

const SERVICE_NAME: &str = "rauto";

#[derive(Debug, Clone, Copy)]
pub enum SecretKind {
    Password,
    EnablePassword,
}

impl SecretKind {
    fn suffix(self) -> &'static str {
        match self {
            Self::Password => "password",
            Self::EnablePassword => "enable_password",
        }
    }
}

pub fn connection_secret_ref(name: &str, kind: SecretKind) -> String {
    format!("connection/{}/{}", name, kind.suffix())
}

pub fn set_secret(secret_ref: &str, value: &str) -> Result<()> {
    #[cfg(test)]
    {
        let secrets = TEST_BACKEND_SECRETS.get_or_init(|| Mutex::new(None));
        if let Ok(mut guard) = secrets.lock()
            && let Some(secrets) = guard.as_mut()
        {
            secrets.insert(secret_ref.to_string(), value.to_string());
            return Ok(());
        }
    }

    entry(secret_ref)?
        .set_password(value)
        .with_context(|| format!("failed to save secret '{}'", secret_ref))?;
    Ok(())
}

pub fn get_secret(secret_ref: &str) -> Result<Option<String>> {
    #[cfg(test)]
    {
        let secrets = TEST_BACKEND_SECRETS.get_or_init(|| Mutex::new(None));
        if let Ok(guard) = secrets.lock()
            && let Some(secrets) = guard.as_ref()
        {
            return Ok(secrets.get(secret_ref).cloned());
        }
    }

    match entry(secret_ref)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(err) => Err(err).with_context(|| format!("failed to load secret '{}'", secret_ref)),
    }
}

pub fn delete_secret(secret_ref: &str) -> Result<()> {
    #[cfg(test)]
    {
        let secrets = TEST_BACKEND_SECRETS.get_or_init(|| Mutex::new(None));
        if let Ok(mut guard) = secrets.lock()
            && let Some(secrets) = guard.as_mut()
        {
            secrets.remove(secret_ref);
            return Ok(());
        }
    }

    match entry(secret_ref)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(err) => Err(err).with_context(|| format!("failed to delete secret '{}'", secret_ref)),
    }
}

fn entry(secret_ref: &str) -> Result<Entry> {
    Entry::new(SERVICE_NAME, secret_ref)
        .with_context(|| format!("failed to access keychain entry '{}'", secret_ref))
}

#[cfg(test)]
use std::collections::HashMap;
#[cfg(test)]
use std::sync::{Mutex, MutexGuard, OnceLock};

#[cfg(test)]
static TEST_BACKEND_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
#[cfg(test)]
static TEST_BACKEND_SECRETS: OnceLock<Mutex<Option<HashMap<String, String>>>> = OnceLock::new();

#[cfg(test)]
pub struct TestSecretStoreGuard {
    _guard: MutexGuard<'static, ()>,
}

#[cfg(test)]
impl Drop for TestSecretStoreGuard {
    fn drop(&mut self) {
        if let Ok(mut secrets) = TEST_BACKEND_SECRETS.get_or_init(|| Mutex::new(None)).lock() {
            *secrets = None;
        }
    }
}

#[cfg(test)]
pub fn install_test_backend() -> TestSecretStoreGuard {
    let guard = TEST_BACKEND_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .expect("test secret backend lock poisoned");
    let mut secrets = TEST_BACKEND_SECRETS
        .get_or_init(|| Mutex::new(None))
        .lock()
        .expect("test secret backend state poisoned");
    *secrets = Some(HashMap::new());
    drop(secrets);
    TestSecretStoreGuard { _guard: guard }
}

#[cfg(test)]
mod tests {
    use super::{
        SecretKind, connection_secret_ref, delete_secret, get_secret, install_test_backend,
        set_secret,
    };
    use anyhow::Result;

    #[test]
    fn test_backend_round_trips_connection_secrets() -> Result<()> {
        let _guard = install_test_backend();
        let secret_ref = connection_secret_ref("lab1", SecretKind::Password);

        set_secret(&secret_ref, "secret-value")?;
        assert_eq!(get_secret(&secret_ref)?.as_deref(), Some("secret-value"));

        delete_secret(&secret_ref)?;
        assert_eq!(get_secret(&secret_ref)?, None);
        Ok(())
    }
}
