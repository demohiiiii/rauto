use anyhow::Result;

#[cfg(not(test))]
const SERVICE_NAME: &str = "rauto";

pub fn build_secret_ref(connection_name: &str, field_name: &str) -> String {
    format!("connection/{}/{}", connection_name, field_name)
}

pub fn store_secret(
    connection_name: &str,
    field_name: &str,
    value: Option<&str>,
) -> Result<Option<String>> {
    let secret_ref = build_secret_ref(connection_name, field_name);
    let Some(value) = value.filter(|item| !item.trim().is_empty()) else {
        delete_secret(Some(&secret_ref))?;
        return Ok(None);
    };
    set_secret_by_ref(&secret_ref, value)?;
    Ok(Some(secret_ref))
}

pub fn load_secret(secret_ref: Option<&str>) -> Result<Option<String>> {
    let Some(secret_ref) = secret_ref.filter(|item| !item.trim().is_empty()) else {
        return Ok(None);
    };
    get_secret_by_ref(secret_ref)
}

pub fn delete_secret(secret_ref: Option<&str>) -> Result<()> {
    let Some(secret_ref) = secret_ref.filter(|item| !item.trim().is_empty()) else {
        return Ok(());
    };
    delete_secret_by_ref(secret_ref)
}

pub fn has_secret(secret_ref: Option<&str>) -> bool {
    load_secret(secret_ref)
        .ok()
        .flatten()
        .is_some_and(|value| !value.is_empty())
}

#[cfg(not(test))]
fn entry(secret_ref: &str) -> Result<keyring::Entry> {
    use anyhow::anyhow;

    keyring::Entry::new(SERVICE_NAME, secret_ref)
        .map_err(|err| anyhow!("failed to open keyring entry '{}': {}", secret_ref, err))
}

#[cfg(not(test))]
fn set_secret_by_ref(secret_ref: &str, value: &str) -> Result<()> {
    use anyhow::anyhow;

    entry(secret_ref)?
        .set_password(value)
        .map_err(|err| anyhow!("failed to save secret '{}' in keyring: {}", secret_ref, err))
}

#[cfg(not(test))]
fn get_secret_by_ref(secret_ref: &str) -> Result<Option<String>> {
    use anyhow::anyhow;

    match entry(secret_ref)?.get_password().map_err(|err| {
        anyhow!(
            "failed to read secret '{}' from keyring: {}",
            secret_ref,
            err
        )
    }) {
        Ok(value) => Ok(Some(value)),
        Err(err) => {
            if err.to_string().to_ascii_lowercase().contains("no entry") {
                Ok(None)
            } else {
                Err(err)
            }
        }
    }
}

#[cfg(not(test))]
fn delete_secret_by_ref(secret_ref: &str) -> Result<()> {
    use anyhow::anyhow;

    let result = entry(secret_ref)?.delete_credential();
    match result {
        Ok(()) => Ok(()),
        Err(err) if err.to_string().to_ascii_lowercase().contains("no entry") => Ok(()),
        Err(err) => Err(anyhow!(
            "failed to delete secret '{}' from keyring: {}",
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
fn delete_secret_by_ref(secret_ref: &str) -> Result<()> {
    test_backend::delete(secret_ref)
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

    pub fn delete(secret_ref: &str) -> Result<()> {
        store()
            .lock()
            .expect("test keyring lock poisoned")
            .remove(secret_ref);
        Ok(())
    }
}
