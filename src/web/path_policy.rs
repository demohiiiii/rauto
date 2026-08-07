use crate::config::paths::rauto_home_dir;
use crate::web::error::ApiError;
use std::fs;
use std::path::{Component, Path, PathBuf};

pub(crate) fn resolve_upload_file(raw: &str) -> Result<PathBuf, ApiError> {
    resolve_existing_regular_file(&rauto_home_dir().join("uploads"), raw, "upload file")
}

pub(crate) fn upload_file_label(path: &Path) -> String {
    let root = rauto_home_dir().join("uploads");
    fs::canonicalize(root)
        .ok()
        .and_then(|canonical_root| path.strip_prefix(canonical_root).ok())
        .unwrap_or_else(|| path.file_name().map(Path::new).unwrap_or(path))
        .to_string_lossy()
        .to_string()
}

pub(crate) fn resolve_private_key_file(raw: &str) -> Result<PathBuf, ApiError> {
    resolve_existing_regular_file(&rauto_home_dir().join("keys"), raw, "private key file")
}

fn resolve_existing_regular_file(
    allowed_root: &Path,
    raw: &str,
    field_name: &str,
) -> Result<PathBuf, ApiError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(ApiError::bad_request(format!("{field_name} is required")));
    }

    let supplied = Path::new(trimmed);
    if supplied
        .components()
        .any(|component| matches!(component, Component::ParentDir | Component::Prefix(_)))
    {
        return Err(ApiError::bad_request(format!(
            "{field_name} must stay within {}",
            allowed_root.display()
        )));
    }

    fs::create_dir_all(allowed_root).map_err(ApiError::from)?;
    let canonical_root = fs::canonicalize(allowed_root).map_err(ApiError::from)?;
    let candidate = if supplied.is_absolute() {
        supplied.to_path_buf()
    } else {
        canonical_root.join(supplied)
    };
    if supplied.is_absolute() && !candidate.starts_with(&canonical_root) {
        return Err(ApiError::bad_request(format!(
            "{field_name} must stay within its managed directory"
        )));
    }
    let relative_candidate = candidate.strip_prefix(&canonical_root).map_err(|_| {
        ApiError::bad_request(format!(
            "{field_name} must stay within its managed directory"
        ))
    })?;
    let mut current = canonical_root.clone();
    let mut metadata = fs::symlink_metadata(&canonical_root).map_err(ApiError::from)?;
    for component in relative_candidate.components() {
        current.push(component);
        metadata = fs::symlink_metadata(&current).map_err(|_| {
            ApiError::bad_request(format!("{field_name} not found: {}", candidate.display()))
        })?;
        if metadata.file_type().is_symlink() {
            return Err(ApiError::bad_request(format!(
                "{field_name} must not contain symbolic links"
            )));
        }
    }
    let canonical_candidate = fs::canonicalize(&candidate).map_err(ApiError::from)?;
    if !canonical_candidate.starts_with(&canonical_root) {
        return Err(ApiError::bad_request(format!(
            "{field_name} must stay within its managed directory"
        )));
    }
    if !metadata.file_type().is_file() {
        return Err(ApiError::bad_request(format!(
            "{field_name} is not a regular file: {}",
            candidate.display()
        )));
    }
    Ok(canonical_candidate)
}

#[cfg(test)]
mod tests {
    use super::resolve_existing_regular_file;
    use std::fs;

    fn test_root() -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!(
            "rauto-path-policy-{}-{:016x}",
            std::process::id(),
            rand::random::<u64>()
        ));
        fs::create_dir_all(&root).expect("create test root");
        root
    }

    #[test]
    fn accepts_regular_files_inside_the_managed_root() {
        let root = test_root();
        let file = root.join("firmware.bin");
        fs::write(&file, b"payload").expect("write test file");

        let resolved = resolve_existing_regular_file(&root, "firmware.bin", "upload file")
            .expect("managed file should resolve");
        assert_eq!(resolved, fs::canonicalize(&file).unwrap());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_absolute_files_and_parent_traversal_outside_the_managed_root() {
        let root = test_root();
        let outside = root.parent().unwrap().join(format!(
            "rauto-path-policy-outside-{:016x}",
            rand::random::<u64>()
        ));
        fs::write(&outside, b"secret").expect("write outside file");

        assert!(
            resolve_existing_regular_file(&root, outside.to_string_lossy().as_ref(), "upload file")
                .is_err()
        );
        assert!(resolve_existing_regular_file(&root, "../secret", "upload file").is_err());
        let _ = fs::remove_file(outside);
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symbolic_links_even_when_the_target_exists() {
        use std::os::unix::fs::symlink;

        let root = test_root();
        let outside = root.parent().unwrap().join(format!(
            "rauto-path-policy-link-target-{:016x}",
            rand::random::<u64>()
        ));
        fs::write(&outside, b"secret").expect("write outside file");
        symlink(&outside, root.join("linked.bin")).expect("create symlink");

        assert!(resolve_existing_regular_file(&root, "linked.bin", "upload file").is_err());
        let _ = fs::remove_file(outside);
        let _ = fs::remove_dir_all(root);
    }
}
