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

/// Message shared by every "this backup is not usable" rejection.
const DAMAGED_DB: &str = "That backup's database is damaged, so restoring it was cancelled.";

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
    let written = (|| -> AppResult<()> {
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
        Ok(())
    })();
    if let Err(error) = written {
        // A half-written folder is removed so it never looks like a backup.
        remove_quietly(&folder);
        return Err(error);
    }

    Ok(BackupInfo {
        path: folder.to_string_lossy().to_string(),
        byte_size: dir_size(&folder)? as i64,
        created_at,
    })
}

#[derive(Debug)]
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
    if let Err(error) = verify_staged_db(&db) {
        remove_quietly(&root);
        return Err(error);
    }

    Ok(Staged { db, evidence, root })
}

/// Opens the staged database copy and checks it is a healthy ShutterProof
/// store. A damaged, truncated, or foreign file must never replace live
/// records, so the swap only proceeds once the staged copy is proven sound.
fn verify_staged_db(db: &Path) -> AppResult<()> {
    let connection =
        rusqlite::Connection::open(db).map_err(|_| AppError::validation(DAMAGED_DB))?;
    let verdict: String = connection
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .unwrap_or_default();
    if verdict != "ok" {
        return Err(AppError::validation(DAMAGED_DB));
    }
    let is_ours: i64 = connection
        .query_row(
            "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = 'gear'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if is_ours == 0 {
        return Err(AppError::validation(
            "That folder is not a ShutterProof backup (no gear records).",
        ));
    }
    Ok(())
}

/// Puts the previous database and evidence back after a failed swap, so the
/// app is never left holding a new database with the old evidence.
fn rollback_previous(
    previous_db: &Path,
    db_path: &Path,
    previous_evidence: &Path,
    evidence_dir: &Path,
) {
    if previous_db.exists() {
        remove_quietly(db_path);
        let _ = fs::rename(previous_db, db_path);
    }
    if previous_evidence.exists() && !evidence_dir.exists() {
        let _ = fs::rename(previous_evidence, evidence_dir);
    }
}

/// Removes staging folders left behind by a restore that was interrupted.
/// Only called at startup, never while a restore is running.
pub fn sweep_staging(data_dir: &Path) {
    let Ok(entries) = fs::read_dir(data_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let leftover = entry
            .file_name()
            .to_str()
            .is_some_and(|name| name.starts_with("restore-staging-"));
        if leftover {
            remove_quietly(&entry.path());
        }
    }
}

/// Replaces the live database and evidence with the staged copy.
///
/// The two are moved as a pair: if either rename fails the previous database
/// and evidence are put back, so a failure can never leave a new database
/// beside missing evidence. The previous copies are only discarded once the
/// staged data is fully in place — never before the swap begins, so a copy is
/// never deleted while its live slot is empty.
pub fn apply_restore(staged: Staged, db_path: &Path, evidence_dir: &Path) -> AppResult<()> {
    let previous_db = db_path.with_extension("db.previous");
    let previous_evidence = evidence_dir.with_extension("previous");

    // Recover an earlier interrupted restore before starting a new one.
    if !db_path.exists() && previous_db.exists() {
        fs::rename(&previous_db, db_path)?;
    }
    if !evidence_dir.exists() && previous_evidence.exists() {
        fs::rename(&previous_evidence, evidence_dir)?;
    }

    remove_quietly(&previous_db);
    remove_quietly(&previous_evidence);
    remove_quietly(&db_path.with_extension("db-wal"));
    remove_quietly(&db_path.with_extension("db-shm"));

    if db_path.exists() {
        fs::rename(db_path, &previous_db)?;
    }
    if evidence_dir.exists() {
        if let Err(error) = fs::rename(evidence_dir, &previous_evidence) {
            rollback_previous(&previous_db, db_path, &previous_evidence, evidence_dir);
            remove_quietly(&staged.root);
            return Err(error.into());
        }
    }

    if let Err(error) = fs::rename(&staged.db, db_path) {
        rollback_previous(&previous_db, db_path, &previous_evidence, evidence_dir);
        remove_quietly(&staged.root);
        return Err(error.into());
    }
    if let Err(error) = fs::rename(&staged.evidence, evidence_dir) {
        rollback_previous(&previous_db, db_path, &previous_evidence, evidence_dir);
        remove_quietly(&staged.root);
        return Err(error.into());
    }

    remove_quietly(&previous_db);
    remove_quietly(&previous_evidence);
    remove_quietly(&staged.root);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch() -> PathBuf {
        let root = std::env::temp_dir().join(format!("sp-backup-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        root
    }

    /// A minimal live store: a database with a `gear` table plus one evidence file.
    fn seed_store(root: &Path) -> (PathBuf, PathBuf) {
        let live = root.join("live");
        let db_path = live.join("records.db");
        let evidence_dir = live.join("evidence");
        fs::create_dir_all(&live).unwrap();
        fs::create_dir_all(&evidence_dir).unwrap();
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "CREATE TABLE gear (id TEXT PRIMARY KEY);
             INSERT INTO gear VALUES ('g1');",
        )
        .unwrap();
        fs::write(evidence_dir.join("a.pdf"), b"%PDF-1.4").unwrap();
        (db_path, evidence_dir)
    }

    #[test]
    fn backup_and_restore_round_trip_replaces_live_data() {
        let root = scratch();
        let (db_path, evidence_dir) = seed_store(&root);
        let dest = root.join("out");
        fs::create_dir_all(&dest).unwrap();

        let info = create_backup(&db_path, &evidence_dir, &dest, (1, 1), "0.1.0").unwrap();
        let backup_dir = PathBuf::from(info.path);

        // Change the live store, then restore the backup over it.
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute("INSERT INTO gear VALUES ('g2')", []).unwrap();
        drop(conn);
        fs::write(evidence_dir.join("b.pdf"), b"new").unwrap();

        let staged = stage_restore(&backup_dir, &root.join("live")).unwrap();
        apply_restore(staged, &db_path, &evidence_dir).unwrap();

        let conn = rusqlite::Connection::open(&db_path).unwrap();
        let count: i64 = conn
            .query_row("SELECT count(*) FROM gear", [], |row| row.get(0))
            .unwrap();
        assert_eq!(
            count, 1,
            "restored database should hold only the backup's rows"
        );
        assert!(evidence_dir.join("a.pdf").exists());
        assert!(!evidence_dir.join("b.pdf").exists());
        assert!(!db_path.with_extension("db.previous").exists());
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn restore_refuses_a_database_that_is_not_healthy() {
        let root = scratch();
        let (db_path, evidence_dir) = seed_store(&root);
        let backup_dir = root.join("backup");
        fs::create_dir_all(&backup_dir).unwrap();
        // A file named records.db that is not a SQLite database at all.
        fs::write(backup_dir.join("records.db"), b"not a database").unwrap();
        fs::write(
            backup_dir.join(MANIFEST_NAME),
            "{\"schema_version\":1,\"created_at\":\"now\",\"app_version\":\"0.1.0\",\
             \"gear_count\":1,\"evidence_count\":1}",
        )
        .unwrap();

        let error = stage_restore(&backup_dir, &root.join("live")).unwrap_err();
        assert!(error.to_string().contains("damaged"), "got: {error}");
        // The live store is untouched and no staging folder is left behind.
        assert!(db_path.exists());
        assert!(evidence_dir.join("a.pdf").exists());
        let leftovers = fs::read_dir(root.join("live")).unwrap().flatten().count();
        assert_eq!(leftovers, 2, "records.db + evidence only");
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn failed_backup_leaves_no_partial_folder() {
        let root = scratch();
        let missing = root.join("nope.db");
        let evidence_dir = root.join("evidence");
        fs::create_dir_all(&evidence_dir).unwrap();
        let dest = root.join("out");
        fs::create_dir_all(&dest).unwrap();

        assert!(create_backup(&missing, &evidence_dir, &dest, (0, 0), "0.1.0").is_err());
        assert_eq!(fs::read_dir(&dest).unwrap().flatten().count(), 0);
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn sweep_staging_removes_only_leftover_staging_folders() {
        let root = scratch();
        let stale = root.join(format!("restore-staging-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&stale).unwrap();
        fs::write(stale.join("records.db"), b"x").unwrap();
        let keep = root.join("evidence");
        fs::create_dir_all(&keep).unwrap();

        sweep_staging(&root);

        assert!(
            !stale.exists(),
            "interrupted staging folder should be removed"
        );
        assert!(keep.exists(), "unrelated folders must be kept");
        fs::remove_dir_all(&root).ok();
    }
}
