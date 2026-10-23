use std::fs::{self, DirBuilder, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

pub struct StagedUpload {
    path: PathBuf,
}

impl StagedUpload {
    pub fn create(directory: &Path, content: &[u8]) -> io::Result<Self> {
        let mut builder = DirBuilder::new();
        builder.recursive(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::DirBuilderExt;
            builder.mode(0o700);
        }
        builder.create(directory)?;

        let path = directory.join(super::runtime::new_id());
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&path)?;
        let upload = Self { path };
        let result = file.write_all(content).and_then(|_| file.flush());
        // Close before cleanup can run, including when a write fails on Windows.
        drop(file);
        result?;
        Ok(upload)
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for StagedUpload {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn staged_content_is_readable_until_drop_and_preserves_other_uploads() {
        let root =
            std::env::temp_dir().join(format!("rauto-upload-{}", super::super::runtime::new_id()));
        let upload = StagedUpload::create(&root, b"private content").unwrap();
        let path = upload.path().to_owned();
        assert_eq!(fs::read(&path).unwrap(), b"private content");
        let other = StagedUpload::create(&root, b"other content").unwrap();
        assert_ne!(upload.path(), other.path());
        drop(upload);
        assert!(!path.exists());
        assert_eq!(fs::read(other.path()).unwrap(), b"other content");
        drop(other);
        assert_eq!(fs::read_dir(&root).unwrap().count(), 0);
        fs::remove_dir(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn files_are_private_even_in_an_existing_shared_directory() {
        use std::os::unix::fs::PermissionsExt;

        let root =
            std::env::temp_dir().join(format!("rauto-upload-{}", super::super::runtime::new_id()));
        let upload = StagedUpload::create(&root, b"private content").unwrap();
        assert_eq!(
            fs::metadata(&root).unwrap().permissions().mode() & 0o777,
            0o700
        );
        drop(upload);
        fs::set_permissions(&root, fs::Permissions::from_mode(0o755)).unwrap();
        let upload = StagedUpload::create(&root, b"private content").unwrap();
        assert_eq!(
            fs::metadata(upload.path()).unwrap().permissions().mode() & 0o777,
            0o600
        );
        drop(upload);
        fs::remove_dir(root).unwrap();
    }

    #[test]
    fn invalid_staging_directory_does_not_overwrite_existing_content() {
        let path =
            std::env::temp_dir().join(format!("rauto-upload-{}", super::super::runtime::new_id()));
        fs::write(&path, b"existing content").unwrap();
        assert!(StagedUpload::create(&path, b"private content").is_err());
        assert_eq!(fs::read(&path).unwrap(), b"existing content");
        fs::remove_file(path).unwrap();
    }
}
