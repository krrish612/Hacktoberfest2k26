//! Local backup and restore.
//!
//! A backup is a self-describing folder holding the SQLite database, the
//! evidence files, and a manifest. Restore stages the backup next to the live
//! data, validates it, then swaps it in — the current data is only replaced
//! after the incoming copy is fully staged, so an interrupted restore leaves
//! the original records intact.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::models::BackupInfo;

const MANIFEST_NAME: &str = "shutterproof-backup.json";
const DB_NAME: &str = "records.db";
const EVIDENCE_NAME: &str = "evidence";

#[derive(Debug, Serialize, Deserialize)]
struct Manifest {
    schema_version: u32,
    created_at: String,
    app_version: String,
    gear_count: i64,
    evidence_count: i64,
}

fn copy_dir_all(source: &Path, target: &Path) -> AppResult<()> {
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let to = target.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_all(&entry.path(), &to)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), to)?;
        }
    }
    Ok(())
}

fn dir_size(path: &Path) -> AppResult<u64> {
    if !path.exists() {
        return Ok(0);
    }
    let mut total = 0u64;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        if metadata.is_dir() {
            total += dir_size(&entry.path())?;
        } else {
            total += metadata.len();
        }
    }
    Ok(total)
}

fn remove_quietly(path: &Path) {
    if path.is_dir() {
        let _ = fs::remove_dir_all(path);
    } else if path.exists() {
        let _ = fs::remove_file(path);
    }
}

/// Writes a backup into `dest_root` and returns where it landed.
///
/// The caller must checkpoint the database (and drop any WAL sidecars) before
/// calling so `db_path` is a complete, self-contained copy.
pub fn create_backup(
    db_path: &Path,
    evidence_dir: &Path,
    dest_root: &Path,
    counts: (i64, i64),
    app_version: &str,
) -> AppResult<BackupInfo> {
    let created_at = chrono::Utc::now().to_rfc3339();
    let folder = dest_root.join(format!(
        "shutterproof-backup-{}",
        chrono::Utc::now().format("%Y%m%d-%H%M%S")
    ));

    if folder.exists() {
        return Err(AppError::validation(
            "A backup from this exact second already exists. Try again in a moment.",
        ));
    }

    fs::create_dir_all(&folder)?;
    fs::copy(db_path, folder.join(DB_NAME))?;
    if evidence_dir.exists() {
        copy_dir_all(evidence_dir, &folder.join(EVIDENCE_NAME))?;
    }

    let manifest = Manifest {
        schema_version: 1,
        created_at: created_at.clone(),
        app_version: app_version.to_string(),
        gear_count: counts.0,
        evidence_count: counts.1,
    };
    let json = serde_json::to_vec_pretty(&manifest)
        .map_err(|error| AppError::internal(error.to_string()))?;
    fs::write(folder.join(MANIFEST_NAME), json)?;

    Ok(BackupInfo {
        path: folder.to_string_lossy().to_string(),
        byte_size: dir_size(&folder)? as i64,
        created_at,
    })
}

pub struct Staged {
    db: PathBuf,
    evidence: PathBuf,
    root: PathBuf,
}

/// Copies a backup into a private staging area beside the live data.
pub fn stage_restore(backup_dir: &Path, data_dir: &Path) -> AppResult<Staged> {
    let source_db = backup_dir.join(DB_NAME);
    if !source_db.is_file() {
        return Err(AppError::validation(
            "That folder is not a ShutterProof backup (no records.db).",
        ));
    }
    let manifest_path = backup_dir.join(MANIFEST_NAME);
    let manifest_bytes = fs::read(&manifest_path).map_err(|_| {
        AppError::validation("That folder is not a ShutterProof backup (no manifest).")
    })?;
    let manifest: Manifest = serde_json::from_slice(&manifest_bytes)
        .map_err(|_| AppError::validation("That backup's manifest could not be read."))?;
    if manifest.schema_version > 1 {
        return Err(AppError::validation(
            "That backup was made by a newer version of ShutterProof.",
        ));
    }

    let root = data_dir.join(format!("restore-staging-{}", uuid::Uuid::new_v4()));
    let db = root.join(DB_NAME);
    let evidence = root.join(EVIDENCE_NAME);
    fs::create_dir_all(&root)?;
    fs::copy(&source_db, &db)?;
    let source_evidence = backup_dir.join(EVIDENCE_NAME);
    if source_evidence.is_dir() {
        copy_dir_all(&source_evidence, &evidence)?;
    } else {
        fs::create_dir_all(&evidence)?;
    }

    Ok(Staged { db, evidence, root })
}

/// Replaces the live database and evidence with the staged copy.
pub fn apply_restore(staged: Staged, db_path: &Path, evidence_dir: &Path) -> AppResult<()> {
    let previous_db = db_path.with_extension("db.previous");
    let previous_evidence = evidence_dir.with_extension("previous");

    remove_quietly(&previous_db);
    remove_quietly(&previous_evidence);
    remove_quietly(&db_path.with_extension("db-wal"));
    remove_quietly(&db_path.with_extension("db-shm"));

    if db_path.exists() {
        fs::rename(db_path, &previous_db)?;
    }
    if evidence_dir.exists() {
        fs::rename(evidence_dir, &previous_evidence)?;
    }

    fs::rename(&staged.db, db_path)?;
    fs::rename(&staged.evidence, evidence_dir)?;

    remove_quietly(&previous_db);
    remove_quietly(&previous_evidence);
    remove_quietly(&staged.root);
    Ok(())
}
