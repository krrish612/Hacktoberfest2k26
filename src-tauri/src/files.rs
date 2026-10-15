//! Evidence file handling: signature checking and safe, atomic imports.
//!
//! A file is validated by its magic bytes rather than its name, copied to a
//! temporary `.part` file in the app's private data directory, then atomically
//! renamed into place. A crash or power loss can leave a `.part` file behind,
//! which is swept on the next start; it can never leave a half-written record
//! that the database points at.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::error::{AppError, AppResult};

/// 25 MB ceiling for receipts, warranty scans, and serial photos.
pub const MAX_EVIDENCE_BYTES: u64 = 25 * 1024 * 1024;

const PART_SUFFIX: &str = ".part";

struct Signature {
    mime: &'static str,
    extension: &'static str,
}

/// Identifies a supported file by its leading bytes.
fn detect(bytes: &[u8]) -> Option<Signature> {
    if bytes.starts_with(b"%PDF-") {
        Some(Signature {
            mime: "application/pdf",
            extension: "pdf",
        })
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(Signature {
            mime: "image/jpeg",
            extension: "jpg",
        })
    } else if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        Some(Signature {
            mime: "image/png",
            extension: "png",
        })
    } else {
        None
    }
}

/// The MIME type of a supported file, or `None` for anything unrecognised.
/// Shared with the extraction pipeline so both agree on what a file is.
pub fn detect_mime(bytes: &[u8]) -> Option<&'static str> {
    detect(bytes).map(|signature| signature.mime)
}

/// Removes leftover `.part` files from an interrupted import.
pub fn sweep_temp(temp_dir: &Path) {
    let Ok(entries) = fs::read_dir(temp_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let is_part = path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.ends_with(PART_SUFFIX));
        if is_part {
            let _ = fs::remove_file(path);
        }
    }
}

pub struct Imported {
    pub mime_type: String,
    pub extension: String,
    pub byte_size: i64,
    pub sha256: String,
}

/// Validates `source` and copies it into `dest_dir` under `stored_stem`.
pub fn import_source(
    source: &Path,
    temp_dir: &Path,
    dest_dir: &Path,
    stored_stem: &str,
) -> AppResult<Imported> {
    let metadata = fs::metadata(source)?;
    if !metadata.is_file() {
        return Err(AppError::validation(
            "Choose a file to attach, not a folder.",
        ));
    }

    let mut probe = [0u8; 8];
    let mut handle = File::open(source)?;
    let read = handle.read(&mut probe)?;
    let signature = detect(&probe[..read])
        .ok_or_else(|| AppError::validation("Only PDF, JPEG, and PNG files can be attached."))?;
    drop(handle);

    fs::create_dir_all(temp_dir)?;
    fs::create_dir_all(dest_dir)?;

    let temp_path = temp_dir.join(format!("{}.part", uuid::Uuid::new_v4()));
    let final_path = dest_dir.join(format!("{stored_stem}.{}", signature.extension));

    let (byte_size, sha256) = match copy_checked(source, &temp_path) {
        Ok(result) => result,
        Err(error) => {
            let _ = fs::remove_file(&temp_path);
            return Err(error);
        }
    };

    if let Err(error) = fs::rename(&temp_path, &final_path) {
        let _ = fs::remove_file(&temp_path);
        return Err(error.into());
    }

    Ok(Imported {
        mime_type: signature.mime.to_string(),
        extension: signature.extension.to_string(),
        byte_size: byte_size as i64,
        sha256,
    })
}

/// Streams the file into `temp_path`, hashing as it goes and enforcing the cap.
/// Returns `(byte_size, sha256)`.
fn copy_checked(source: &Path, temp_path: &Path) -> AppResult<(u64, String)> {
    let mut reader = File::open(source)?;
    let mut writer = File::create(temp_path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    let mut total: u64 = 0;
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        total += read as u64;
        if total > MAX_EVIDENCE_BYTES {
            return Err(AppError::validation(
                "That file is bigger than the 25 MB attachment limit.",
            ));
        }
        hasher.update(&buffer[..read]);
        writer.write_all(&buffer[..read])?;
    }
    writer.flush()?;
    writer.sync_all()?;
    Ok((total, hex::encode(hasher.finalize())))
}

/// Deletes a stored evidence file. Missing files are treated as already gone.
pub fn remove_stored(dest_dir: &Path, stored_name: &str) -> AppResult<()> {
    let path: PathBuf = dest_dir.join(stored_name);
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_pdf_jpeg_png() {
        assert_eq!(detect(b"%PDF-1.7").unwrap().extension, "pdf");
        assert_eq!(detect(&[0xFF, 0xD8, 0xFF, 0xE0]).unwrap().extension, "jpg");
        assert_eq!(
            detect(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
                .unwrap()
                .extension,
            "png"
        );
    }

    #[test]
    fn rejects_unknown_signatures() {
        assert!(detect(b"MZ\x90\x00").is_none());
    }
}
