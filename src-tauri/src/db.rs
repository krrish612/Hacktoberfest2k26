//! SQLite access layer.
//!
//! Every statement uses bound parameters; no SQL is ever built from user input.
//! All writes go through transactions so a failure cannot leave a half-applied
//! record behind.

use std::path::Path;

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{Evidence, Gear, GearInput, TimelineEvent, TimelineEventInput};
use crate::validate;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS gear (
    id                 TEXT PRIMARY KEY NOT NULL,
    name               TEXT NOT NULL,
    category           TEXT NOT NULL,
    brand              TEXT,
    model              TEXT,
    serial_number      TEXT,
    purchase_date      TEXT,
    purchase_price     REAL,
    currency           TEXT,
    seller             TEXT,
    warranty_start     TEXT,
    warranty_end       TEXT,
    warranty_confirmed INTEGER NOT NULL DEFAULT 0,
    warranty_terms     TEXT,
    notes              TEXT,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
    id            TEXT PRIMARY KEY NOT NULL,
    gear_id       TEXT NOT NULL REFERENCES gear(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_name   TEXT NOT NULL,
    mime_type     TEXT NOT NULL,
    byte_size     INTEGER NOT NULL,
    sha256        TEXT NOT NULL,
    created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_gear ON evidence(gear_id);

CREATE TABLE IF NOT EXISTS timeline_event (
    id          TEXT PRIMARY KEY NOT NULL,
    gear_id     TEXT NOT NULL REFERENCES gear(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    occurred_on TEXT NOT NULL,
    title       TEXT NOT NULL,
    detail      TEXT
);
CREATE INDEX IF NOT EXISTS idx_timeline_gear ON timeline_event(gear_id);
"#;

const GEAR_COLUMNS: &str = "id, name, category, brand, model, serial_number, purchase_date, \
     purchase_price, currency, seller, warranty_start, warranty_end, warranty_confirmed, \
     warranty_terms, notes, created_at, updated_at";

/// Opens the database with safety-focused pragmas applied.
pub fn open(path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    Ok(conn)
}

pub fn migrate(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(SCHEMA)?;
    Ok(())
}

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn row_to_gear(row: &Row<'_>) -> rusqlite::Result<Gear> {
    Ok(Gear {
        id: row.get(0)?,
        name: row.get(1)?,
        category: row.get(2)?,
        brand: row.get(3)?,
        model: row.get(4)?,
        serial_number: row.get(5)?,
        purchase_date: row.get(6)?,
        purchase_price: row.get(7)?,
        currency: row.get(8)?,
        seller: row.get(9)?,
        warranty_start: row.get(10)?,
        warranty_end: row.get(11)?,
        warranty_confirmed: row.get::<_, i64>(12)? != 0,
        warranty_terms: row.get(13)?,
        notes: row.get(14)?,
        created_at: row.get(15)?,
        updated_at: row.get(16)?,
    })
}

pub fn list_gear(conn: &Connection) -> AppResult<Vec<Gear>> {
    let sql = format!("SELECT {GEAR_COLUMNS} FROM gear ORDER BY updated_at DESC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], row_to_gear)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn get_gear(conn: &Connection, id: &str) -> AppResult<Gear> {
    let sql = format!("SELECT {GEAR_COLUMNS} FROM gear WHERE id = ?1");
    conn.query_row(&sql, params![id], row_to_gear)
        .optional()?
        .ok_or_else(|| AppError::NotFound("That gear record no longer exists.".into()))
}

pub fn insert_gear(conn: &Connection, input: GearInput) -> AppResult<Gear> {
    let input = validate::normalized_gear(input)?;
    let id = Uuid::new_v4().to_string();
    let timestamp = now();
    conn.execute(
        "INSERT INTO gear (id, name, category, brand, model, serial_number, purchase_date, \
         purchase_price, currency, seller, warranty_start, warranty_end, warranty_confirmed, \
         warranty_terms, notes, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            id, input.name, input.category, input.brand, input.model, input.serial_number,
            input.purchase_date, input.purchase_price, input.currency, input.seller,
            input.warranty_start, input.warranty_end, input.warranty_confirmed as i64,
            input.warranty_terms, input.notes, timestamp, timestamp,
        ],
    )?;
    get_gear(conn, &id)
}

pub fn update_gear(conn: &Connection, id: &str, input: GearInput) -> AppResult<Gear> {
    let input = validate::normalized_gear(input)?;
    let changed = conn.execute(
        "UPDATE gear SET name = ?2, category = ?3, brand = ?4, model = ?5, serial_number = ?6, \
         purchase_date = ?7, purchase_price = ?8, currency = ?9, seller = ?10, warranty_start = ?11, \
         warranty_end = ?12, warranty_confirmed = ?13, warranty_terms = ?14, notes = ?15, \
         updated_at = ?16 WHERE id = ?1",
        params![
            id, input.name, input.category, input.brand, input.model, input.serial_number,
            input.purchase_date, input.purchase_price, input.currency, input.seller,
            input.warranty_start, input.warranty_end, input.warranty_confirmed as i64,
            input.warranty_terms, input.notes, now(),
        ],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("That gear record no longer exists.".into()));
    }
    get_gear(conn, id)
}

/// Deletes a gear record and returns the stored evidence file names so the
/// caller can remove the originals from disk.
pub fn delete_gear(conn: &Connection, id: &str) -> AppResult<Vec<String>> {
    let mut stored = Vec::new();
    {
        let mut stmt = conn.prepare("SELECT stored_name FROM evidence WHERE gear_id = ?1")?;
        let rows = stmt.query_map(params![id], |row| row.get::<_, String>(0))?;
        for row in rows {
            stored.push(row?);
        }
    }
    let changed = conn.execute("DELETE FROM gear WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(AppError::NotFound("That gear record no longer exists.".into()));
    }
    Ok(stored)
}

fn row_to_evidence(row: &Row<'_>) -> rusqlite::Result<Evidence> {
    Ok(Evidence {
        id: row.get(0)?,
        gear_id: row.get(1)?,
        kind: row.get(2)?,
        original_name: row.get(3)?,
        stored_name: row.get(4)?,
        mime_type: row.get(5)?,
        byte_size: row.get(6)?,
        sha256: row.get(7)?,
        created_at: row.get(8)?,
    })
}

const EVIDENCE_COLUMNS: &str =
    "id, gear_id, kind, original_name, stored_name, mime_type, byte_size, sha256, created_at";

pub fn list_evidence(conn: &Connection, gear_id: &str) -> AppResult<Vec<Evidence>> {
    let sql = format!(
        "SELECT {EVIDENCE_COLUMNS} FROM evidence WHERE gear_id = ?1 ORDER BY created_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![gear_id], row_to_evidence)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn insert_evidence(conn: &Connection, evidence: &Evidence) -> AppResult<()> {
    conn.execute(
        "INSERT INTO evidence (id, gear_id, kind, original_name, stored_name, mime_type, \
         byte_size, sha256, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            evidence.id,
            evidence.gear_id,
            evidence.kind,
            evidence.original_name,
            evidence.stored_name,
            evidence.mime_type,
            evidence.byte_size,
            evidence.sha256,
            evidence.created_at,
        ],
    )?;
    Ok(())
}

pub fn delete_evidence(conn: &Connection, id: &str) -> AppResult<String> {
    let stored: Option<String> = conn
        .query_row(
            "SELECT stored_name FROM evidence WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()?;
    let stored = stored.ok_or_else(|| AppError::NotFound("That attachment was already removed.".into()))?;
    conn.execute("DELETE FROM evidence WHERE id = ?1", params![id])?;
    Ok(stored)
}

fn row_to_event(row: &Row<'_>) -> rusqlite::Result<TimelineEvent> {
    Ok(TimelineEvent {
        id: row.get(0)?,
        gear_id: row.get(1)?,
        kind: row.get(2)?,
        occurred_on: row.get(3)?,
        title: row.get(4)?,
        detail: row.get(5)?,
    })
}

pub fn list_timeline(conn: &Connection, gear_id: &str) -> AppResult<Vec<TimelineEvent>> {
    let mut stmt = conn.prepare(
        "SELECT id, gear_id, kind, occurred_on, title, detail FROM timeline_event \
         WHERE gear_id = ?1 ORDER BY occurred_on ASC, id ASC",
    )?;
    let rows = stmt.query_map(params![gear_id], row_to_event)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn insert_timeline(
    conn: &Connection,
    gear_id: &str,
    input: &TimelineEventInput,
) -> AppResult<TimelineEvent> {
    validate::timeline_kind(&input.kind)?;
    let title = input.title.trim();
    if title.is_empty() {
        return Err(AppError::validation("A short title is required."));
    }
    if title.chars().count() > 200 {
        return Err(AppError::validation("That title is too long."));
    }
    let occurred_on = input.occurred_on.trim();
    chrono::NaiveDate::parse_from_str(occurred_on, "%Y-%m-%d")
        .map_err(|_| AppError::validation("The event date must look like 2026-10-14."))?;

    let event = TimelineEvent {
        id: Uuid::new_v4().to_string(),
        gear_id: gear_id.to_string(),
        kind: input.kind.clone(),
        occurred_on: occurred_on.to_string(),
        title: title.to_string(),
        detail: input
            .detail
            .as_ref()
            .map(|d| d.trim().to_string())
            .filter(|d| !d.is_empty()),
    };
    conn.execute(
        "INSERT INTO timeline_event (id, gear_id, kind, occurred_on, title, detail) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            event.id,
            event.gear_id,
            event.kind,
            event.occurred_on,
            event.title,
            event.detail,
        ],
    )?;
    Ok(event)
}

pub fn delete_timeline(conn: &Connection, id: &str) -> AppResult<()> {
    let changed = conn.execute("DELETE FROM timeline_event WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(AppError::NotFound("That timeline entry was already removed.".into()));
    }
    Ok(())
}

/// Returns `(gear_count, evidence_count)` for the local-data panel.
pub fn counts(conn: &Connection) -> AppResult<(i64, i64)> {
    let gear: i64 = conn.query_row("SELECT COUNT(*) FROM gear", [], |row| row.get(0))?;
    let evidence: i64 = conn.query_row("SELECT COUNT(*) FROM evidence", [], |row| row.get(0))?;
    Ok((gear, evidence))
}
