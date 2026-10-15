//! Input validation for gear records.
//!
//! The UI validates too, but every command re-validates on the Rust side so the
//! database can never be written from unvalidated input (defense in depth).

use chrono::NaiveDate;

use crate::error::{AppError, AppResult};
use crate::models::GearInput;

const MAX_NAME: usize = 200;
const MAX_SHORT: usize = 120;
const MAX_NOTES: usize = 4_000;
const MAX_PRICE: f64 = 10_000_000.0;

fn trim(value: &str) -> String {
    value.trim().to_string()
}

fn optional(value: &Option<String>, limit: usize, field: &str) -> AppResult<Option<String>> {
    match value {
        None => Ok(None),
        Some(raw) => {
            let cleaned = trim(raw);
            if cleaned.is_empty() {
                return Ok(None);
            }
            if cleaned.chars().count() > limit {
                return Err(AppError::validation(format!("{field} is too long.")));
            }
            Ok(Some(cleaned))
        }
    }
}

fn parse_date(value: &str, field: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| AppError::validation(format!("{field} must be a real date like 2026-10-14.")))
}

fn optional_date(value: &Option<String>, field: &str) -> AppResult<Option<NaiveDate>> {
    match value {
        None => Ok(None),
        Some(raw) => {
            let cleaned = trim(raw);
            if cleaned.is_empty() {
                return Ok(None);
            }
            Ok(Some(parse_date(&cleaned, field)?))
        }
    }
}

/// Validates and normalises a gear record. Returns a trimmed copy to persist.
pub fn normalized_gear(input: GearInput) -> AppResult<GearInput> {
    let name = trim(&input.name);
    if name.is_empty() {
        return Err(AppError::validation("A gear name is required."));
    }
    if name.chars().count() > MAX_NAME {
        return Err(AppError::validation("The gear name is too long."));
    }

    let category = trim(&input.category);
    if category.is_empty() {
        return Err(AppError::validation("A category is required."));
    }

    if let Some(price) = input.purchase_price {
        if !price.is_finite() || price < 0.0 || price > MAX_PRICE {
            return Err(AppError::validation(
                "The purchase price looks out of range.",
            ));
        }
    }

    let purchase_date = optional_date(&input.purchase_date, "The purchase date")?;
    let warranty_start = optional_date(&input.warranty_start, "The warranty start date")?;
    let warranty_end = optional_date(&input.warranty_end, "The warranty end date")?;

    // A warranty is only ever recorded from information the photographer
    // supplied. Dates are never inferred, so any date implies confirmation.
    let has_warranty_date = warranty_start.is_some() || warranty_end.is_some();
    if has_warranty_date && !input.warranty_confirmed {
        return Err(AppError::validation(
            "Confirm the warranty dates before saving them.",
        ));
    }
    if let (Some(start), Some(end)) = (warranty_start, warranty_end) {
        if end < start {
            return Err(AppError::validation(
                "The warranty end date cannot be before the start date.",
            ));
        }
    }

    Ok(GearInput {
        name,
        category,
        brand: optional(&input.brand, MAX_SHORT, "The brand")?,
        model: optional(&input.model, MAX_SHORT, "The model")?,
        serial_number: optional(&input.serial_number, MAX_SHORT, "The serial number")?,
        purchase_date: purchase_date.map(|d| d.format("%Y-%m-%d").to_string()),
        purchase_price: input.purchase_price,
        currency: optional(&input.currency, 8, "The currency")?,
        seller: optional(&input.seller, MAX_SHORT, "The seller")?,
        warranty_start: warranty_start.map(|d| d.format("%Y-%m-%d").to_string()),
        warranty_end: warranty_end.map(|d| d.format("%Y-%m-%d").to_string()),
        warranty_confirmed: has_warranty_date || input.warranty_confirmed,
        warranty_terms: optional(&input.warranty_terms, MAX_NOTES, "The warranty terms")?,
        notes: optional(&input.notes, MAX_NOTES, "The notes")?,
    })
}

/// Validates an evidence kind against the allowlist.
pub fn evidence_kind(kind: &str) -> AppResult<&str> {
    match kind {
        "receipt" | "warranty" | "serial_photo" | "other" => Ok(kind),
        _ => Err(AppError::validation(
            "That attachment type is not supported.",
        )),
    }
}

/// Validates a timeline event kind against the allowlist.
pub fn timeline_kind(kind: &str) -> AppResult<&str> {
    match kind {
        "purchase" | "warranty_start" | "warranty_end" | "repair" | "inspection" | "transfer"
        | "note" => Ok(kind),
        _ => Err(AppError::validation(
            "That timeline event type is not supported.",
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> GearInput {
        GearInput {
            name: "Canon EOS R6 Mark II".into(),
            category: "Camera body".into(),
            brand: None,
            model: None,
            serial_number: None,
            purchase_date: None,
            purchase_price: None,
            currency: None,
            seller: None,
            warranty_start: None,
            warranty_end: None,
            warranty_confirmed: false,
            warranty_terms: None,
            notes: None,
        }
    }

    #[test]
    fn rejects_empty_name() {
        let mut input = base();
        input.name = "   ".into();
        assert!(normalized_gear(input).is_err());
    }

    #[test]
    fn rejects_unconfirmed_warranty_dates() {
        let mut input = base();
        input.warranty_end = Some("2027-11-08".into());
        assert!(normalized_gear(input).is_err());
    }

    #[test]
    fn accepts_confirmed_warranty_dates() {
        let mut input = base();
        input.warranty_end = Some("2027-11-08".into());
        input.warranty_confirmed = true;
        assert!(normalized_gear(input).is_ok());
    }

    #[test]
    fn rejects_end_before_start() {
        let mut input = base();
        input.warranty_start = Some("2027-11-08".into());
        input.warranty_end = Some("2026-11-08".into());
        input.warranty_confirmed = true;
        assert!(normalized_gear(input).is_err());
    }
}
