//! Shared application state: the database handle and the private data paths.
//!
//! All app data lives under the OS app-data directory, never in the install
//! folder or a user-visible documents folder.

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};
use crate::{db, files};

pub struct AppState {
    db: Mutex<Option<Connection>>,
    pub data_dir: PathBuf,
    pub db_path: PathBuf,
    pub evidence_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub default_backup_dir: PathBuf,
}

impl AppState {
    pub fn init(handle: &AppHandle) -> AppResult<Self> {
        let data_dir = handle
            .path()
            .app_data_dir()
            .map_err(|error| AppError::internal(error.to_string()))?;
        let db_path = data_dir.join("records.db");
        let evidence_dir = data_dir.join("evidence");
        let temp_dir = data_dir.join("tmp");
        let default_backup_dir = data_dir.join("backups");

        std::fs::create_dir_all(&data_dir)?;
        std::fs::create_dir_all(&evidence_dir)?;
        std::fs::create_dir_all(&temp_dir)?;
        std::fs::create_dir_all(&default_backup_dir)?;

        files::sweep_temp(&temp_dir);

        let connection = db::open(&db_path)?;
        db::migrate(&connection)?;

        Ok(Self {
            db: Mutex::new(Some(connection)),
            data_dir,
            db_path,
            evidence_dir,
            temp_dir,
            default_backup_dir,
        })
    }

    /// Runs `f` against the open connection while holding the lock.
    pub fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> AppResult<T>) -> AppResult<T> {
        let guard = self
            .db
            .lock()
            .map_err(|_| AppError::internal("The records database is busy."))?;
        let connection = guard
            .as_ref()
            .ok_or_else(|| AppError::internal("The records database is not open."))?;
        f(connection)
    }

    /// Closes the connection so files on disk can be safely replaced.
    pub fn close_db(&self) -> AppResult<()> {
        let mut guard = self
            .db
            .lock()
            .map_err(|_| AppError::internal("The records database is busy."))?;
        guard.take();
        Ok(())
    }

    /// Opens (and migrates) the database, replacing whatever was open.
    pub fn reopen_db(&self) -> AppResult<()> {
        let connection = db::open(&self.db_path)?;
        db::migrate(&connection)?;
        let mut guard = self
            .db
            .lock()
            .map_err(|_| AppError::internal("The records database is busy."))?;
        *guard = Some(connection);
        Ok(())
    }
}
