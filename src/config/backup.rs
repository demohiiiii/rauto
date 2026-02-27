use crate::config::paths::rauto_home_dir;
use anyhow::{Context, Result, anyhow};
use flate2::Compression;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use std::fs;
use std::fs::File;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tar::{Archive, Builder};

pub fn list_backups() -> Result<Vec<PathBuf>> {
    let dir = backups_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file()
            && path
                .extension()
                .and_then(|s| s.to_str())
                .is_some_and(|ext| ext == "gz")
        {
            files.push(path);
        }
    }

    files.sort();
    files.reverse();
    Ok(files)
}

pub fn backup_path_by_name(name: &str) -> Result<PathBuf> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("backup name is required"));
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err(anyhow!("invalid backup name"));
    }
    let path = backups_dir().join(trimmed);
    if !path.exists() || !path.is_file() {
        return Err(anyhow!("backup archive not found: {}", path.display()));
    }
    Ok(path)
}

pub fn create_backup(output: Option<&Path>) -> Result<PathBuf> {
    let root = rauto_home_dir();
    fs::create_dir_all(&root)?;

    let output_path = if let Some(path) = output {
        // If caller provides a directory path (or a path ending with separator),
        // auto-generate filename with timestamp under that directory.
        let raw = path.to_string_lossy();
        if path.is_dir() || raw.ends_with('/') || raw.ends_with('\\') {
            fs::create_dir_all(path)?;
            path.join(default_backup_file_name())
        } else {
            path.to_path_buf()
        }
    } else {
        fs::create_dir_all(backups_dir())?;
        backups_dir().join(default_backup_file_name())
    };

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let file = File::create(&output_path)
        .with_context(|| format!("failed to create backup file: {}", output_path.display()))?;
    let encoder = GzEncoder::new(file, Compression::default());
    let mut tar = Builder::new(encoder);
    let archive_root = PathBuf::from("rauto-data");

    for entry in fs::read_dir(&root)? {
        let entry = entry?;
        let path = entry.path();
        if path.file_name().and_then(|s| s.to_str()) == Some("backups") {
            continue;
        }
        let rel = archive_root.join(entry.file_name());
        append_path_recursive(&mut tar, &path, &rel)?;
    }

    tar.finish()?;
    Ok(output_path)
}

pub fn restore_backup(archive_path: &Path, replace: bool) -> Result<()> {
    if !archive_path.exists() {
        return Err(anyhow!(
            "backup archive not found: {}",
            archive_path.display()
        ));
    }

    let temp_dir = std::env::temp_dir().join(format!(
        "rauto-restore-{}-{}",
        std::process::id(),
        now_epoch_secs()
    ));
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir)?;
    }
    fs::create_dir_all(&temp_dir)?;

    let file = File::open(archive_path).with_context(|| {
        format!(
            "failed to open backup archive for restore: {}",
            archive_path.display()
        )
    })?;
    let decoder = GzDecoder::new(file);
    let mut archive = Archive::new(decoder);

    for entry in archive.entries()? {
        let mut entry = entry?;
        entry.unpack_in(&temp_dir)?;
    }

    let extracted_root = {
        let root_a = temp_dir.join("rauto-data");
        let root_b = temp_dir.join(".rauto");
        if root_a.exists() {
            root_a
        } else if root_b.exists() {
            root_b
        } else {
            temp_dir.clone()
        }
    };

    let target = rauto_home_dir();
    if replace {
        clear_rauto_except_backups(&target)?;
    }
    fs::create_dir_all(&target)?;
    copy_dir_recursive(&extracted_root, &target)?;
    let _ = fs::remove_dir_all(&temp_dir);
    Ok(())
}

fn backups_dir() -> PathBuf {
    rauto_home_dir().join("backups")
}

fn default_backup_file_name() -> String {
    format!("rauto-backup-{}.tar.gz", now_epoch_secs())
}

fn now_epoch_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn append_path_recursive(
    tar: &mut Builder<GzEncoder<File>>,
    source_path: &Path,
    archive_path: &Path,
) -> Result<()> {
    if source_path.is_dir() {
        tar.append_dir(archive_path, source_path)?;
        for entry in fs::read_dir(source_path)? {
            let entry = entry?;
            let child_source = entry.path();
            let child_archive = archive_path.join(entry.file_name());
            append_path_recursive(tar, &child_source, &child_archive)?;
        }
    } else if source_path.is_file() {
        tar.append_path_with_name(source_path, archive_path)?;
    }
    Ok(())
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<()> {
    if !source.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() {
            fs::create_dir_all(&target_path)?;
            copy_dir_recursive(&source_path, &target_path)?;
        } else if source_path.is_file() {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&source_path, &target_path)?;
        }
    }

    Ok(())
}

fn clear_rauto_except_backups(target: &Path) -> Result<()> {
    if !target.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(target)? {
        let entry = entry?;
        let path = entry.path();
        let keep = path.file_name().and_then(|s| s.to_str()) == Some("backups");
        if keep {
            continue;
        }
        if path.is_dir() {
            fs::remove_dir_all(path)?;
        } else if path.is_file() {
            fs::remove_file(path)?;
        }
    }
    Ok(())
}
