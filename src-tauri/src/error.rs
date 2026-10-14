//! Error type shared by every command.
//!
//! Commands return `AppResult<T>`; the error is serialized to a single message
//! string for the frontend. Messages are written to be safe to show to the
//! photographer: they never include file contents, hashes, or absolute paths
//! beyond what the user already chose.

use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("the records database could not be read: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("a file operation failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Validation(String),
    #[error("{0}")]
    NotFound(String),
    #[error("the app hit an unexpected problem: {0}")]
    Internal(String),
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn validation(message: impl Into<String>) -> Self {
        AppError::Validation(message.into())
    }

    pub fn internal(message: impl Into<String>) -> Self {
        AppError::Internal(message.into())
    }
}
