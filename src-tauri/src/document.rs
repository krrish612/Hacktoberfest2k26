//! Turns a receipt file into something the extraction model can read.
//!
//! A digital PDF is reduced to its text layer. A photo or scanned PDF is handed
//! to the vision model as an image, which reads it the way the photographer
//! would. Files are identified by their bytes, not their names.

use std::fs;
use std::path::Path;

use base64::Engine as _;

use crate::error::{AppError, AppResult};
use crate::files::{self, MAX_EVIDENCE_BYTES};

/// Guards the prompt size: a receipt never needs more than this much text, and a
/// runaway PDF should not be pasted into the model wholesale.
const MAX_TEXT_CHARS: usize = 16_000;

/// What the model receives: a PDF's text layer, or a base64 image of a scan.
pub enum Document {
    Text(String),
    Image { base64: String },
}

/// Reads `path`, checks the file type by its bytes, and returns the form the
/// model should receive. Errors are worded for the photographer.
pub fn read(path: &Path) -> AppResult<Document> {
    let size = fs::metadata(path)?.len();
    if size > MAX_EVIDENCE_BYTES {
        return Err(AppError::validation(
            "That file is bigger than the 25 MB receipt limit.",
        ));
    }

    let bytes = fs::read(path)?;
    if bytes.len() as u64 > MAX_EVIDENCE_BYTES {
        return Err(AppError::validation(
            "That file is bigger than the 25 MB receipt limit.",
        ));
    }

    match files::detect_mime(&bytes) {
        Some("application/pdf") => pdf_text(&bytes).map(Document::Text),
        Some("image/jpeg" | "image/png") => Ok(Document::Image {
            base64: base64::engine::general_purpose::STANDARD.encode(&bytes),
        }),
        _ => Err(AppError::validation(
            "Reading receipts works with PDF, JPEG, and PNG files.",
        )),
    }
}

fn pdf_text(bytes: &[u8]) -> AppResult<String> {
    let text = guard_extraction(|| {
        pdf_extract::extract_text_from_mem(bytes)
            .map_err(|_| AppError::validation("That PDF could not be read."))
    })?;
    normalize_text(text)
}

/// Runs one PDF text extraction and turns a panic inside the parser into an
/// ordinary error. A malformed or hostile file must never take down the app.
fn guard_extraction<F>(extract: F) -> AppResult<String>
where
    F: FnOnce() -> AppResult<String>,
{
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(extract)) {
        Ok(result) => result,
        Err(_) => Err(AppError::validation(
            "That PDF could not be read. Try a photo of the receipt instead.",
        )),
    }
}

/// Trims the extracted text, rejects a scan with no text layer, and caps how
/// much of a runaway PDF is handed to the model.
fn normalize_text(text: String) -> AppResult<String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err(AppError::validation(
            "This PDF has no text layer, so it looks like a scan. Attach a photo of the receipt instead.",
        ));
    }

    if trimmed.chars().count() > MAX_TEXT_CHARS {
        return Ok(trimmed.chars().take(MAX_TEXT_CHARS).collect());
    }
    Ok(trimmed.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_panicking_parser_is_reported_not_propagated() {
        let result = guard_extraction(|| panic!("boom inside the parser"));
        let message = result.unwrap_err().to_string();
        assert!(message.contains("could not be read"), "got: {message}");
    }

    #[test]
    fn a_parser_error_is_reported() {
        let result = guard_extraction(|| Err(AppError::validation("That PDF could not be read.")));
        assert!(result.is_err());
    }

    #[test]
    fn extracted_text_is_trimmed_and_capped() {
        assert_eq!(normalize_text("  hello  ".into()).unwrap(), "hello");

        let long = "x".repeat(MAX_TEXT_CHARS + 50);
        assert_eq!(
            normalize_text(long).unwrap().chars().count(),
            MAX_TEXT_CHARS
        );
    }

    #[test]
    fn a_pdf_without_a_text_layer_is_a_scan() {
        let error = normalize_text("   ".into()).unwrap_err().to_string();
        assert!(error.contains("scan"), "got: {error}");
    }
}
