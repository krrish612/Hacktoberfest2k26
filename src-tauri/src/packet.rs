//! The repair packet: one ZIP a photographer can email to a repair shop.
//!
//! The packet holds a readable HTML report plus the evidence files the
//! photographer chose. Every value that came from a record is HTML-escaped, the
//! serial number is only included when they opt in, and files are copied exactly
//! as stored — the originals are never modified or removed.

use std::collections::HashSet;
use std::fmt::Write as _;
use std::fs::{self, File, OpenOptions};
use std::io::{Read as _, Write as _};
use std::path::{Path, PathBuf};

use crate::archive::ZipWriter;
use crate::error::{AppError, AppResult};
use crate::models::{Evidence, Gear, TimelineEvent};

/// The whole packet is capped so a large selection cannot fill the disk or
/// produce a file nobody can share.
pub const MAX_PACKET_BYTES: u64 = 200 * 1024 * 1024;

const SUMMARY_NAME: &str = "repair-summary.html";
const MEBIBYTE: u64 = 1024 * 1024;

fn oversized_file_error(name: &str) -> AppError {
    AppError::validation(format!(
        "{} is too large. Each evidence file must be {} MB or less.",
        name,
        crate::files::MAX_EVIDENCE_BYTES / MEBIBYTE
    ))
}

fn packet_limit_error(name: Option<&str>) -> AppError {
    let limit = MAX_PACKET_BYTES / MEBIBYTE;
    match name {
        Some(name) => AppError::validation(format!(
            "Adding {} would make the repair packet exceed its {} MB limit.",
            name, limit
        )),
        None => AppError::validation(format!("The repair packet exceeds its {} MB limit.", limit)),
    }
}

/// Escapes text for HTML so a record field can never inject markup into the
/// report a repair shop opens.
pub fn escape_html(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(ch),
        }
    }
    out
}

/// Resolves the save path the frontend handed over, guaranteeing a `.zip` name.
pub fn destination(raw: &str) -> AppResult<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(AppError::validation("Choose where to save the packet."));
    }
    let mut path = PathBuf::from(trimmed);
    let is_zip = path
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("zip"));
    if !is_zip {
        path.set_extension("zip");
    }
    Ok(path)
}

/// Resolves requested ids against the records that belong to one gear.
///
/// Every requested id must be present in `owned`, so a selection can never pull
/// in another gear's files or history. The result keeps the records in `owned`
/// order. The caller passes the records it already loaded for that gear.
pub fn select_owned<T: Clone>(
    owned: &[T],
    requested: &[String],
    id_of: impl Fn(&T) -> &str,
    missing: &str,
) -> AppResult<Vec<T>> {
    let owned_ids: HashSet<&str> = owned.iter().map(&id_of).collect();
    if requested.iter().any(|id| !owned_ids.contains(id.as_str())) {
        return Err(AppError::validation(missing));
    }
    let wanted: HashSet<&str> = requested.iter().map(String::as_str).collect();
    Ok(owned
        .iter()
        .filter(|item| wanted.contains(id_of(item)))
        .cloned()
        .collect())
}

/// Shows all but the last four characters of a serial number.
fn masked_serial(raw: &str) -> String {
    let compact: String = raw.chars().filter(|c| !c.is_whitespace()).collect();
    let count = compact.chars().count();
    if count <= 4 {
        return compact;
    }
    let visible: String = compact.chars().skip(count - 4).collect();
    format!("{}{}", "•".repeat(count - 4), visible)
}

fn text(value: &Option<String>) -> String {
    match value {
        Some(raw) if !raw.trim().is_empty() => escape_html(raw.trim()),
        _ => "Not recorded".to_string(),
    }
}

fn price(amount: Option<f64>, currency: &Option<String>) -> String {
    match amount {
        None => "Not recorded".to_string(),
        Some(value) => {
            let money = if (value.fract()).abs() < f64::EPSILON {
                format!("{value:.0}")
            } else {
                format!("{value:.2}")
            };
            match currency {
                Some(code) if !code.trim().is_empty() => {
                    format!("{money} {}", escape_html(code.trim()))
                }
                _ => money,
            }
        }
    }
}

fn warranty_status(gear: &Gear) -> &'static str {
    if !gear.warranty_confirmed {
        return "Not confirmed";
    }
    let Some(raw) = gear.warranty_end.as_ref() else {
        return "Not recorded";
    };
    let Ok(date) = chrono::NaiveDate::parse_from_str(raw.trim(), "%Y-%m-%d") else {
        return "Not recorded";
    };
    let today = chrono::Utc::now().date_naive();
    let days = (date - today).num_days();
    if days < 0 {
        "Expired"
    } else if days <= 60 {
        "Expiring soon"
    } else {
        "Active"
    }
}

fn safe_stem(name: &str) -> String {
    let stem = Path::new(name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("file");
    let mapped: String = stem
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '-' | '_') {
                c
            } else {
                '-'
            }
        })
        .take(60)
        .collect();
    let mut collapsed = mapped;
    while collapsed.contains("--") {
        collapsed = collapsed.replace("--", "-");
    }
    let trimmed = collapsed.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "file".to_string()
    } else {
        trimmed
    }
}

fn extension_of(stored_name: &str) -> &'static str {
    match Path::new(stored_name)
        .extension()
        .and_then(|value| value.to_str())
    {
        Some("pdf") => "pdf",
        Some("png") => "png",
        _ => "jpg",
    }
}

/// A ZIP-relative, safe name for one evidence file. The original file name is
/// never used as a path; only a sanitised stem survives.
pub fn entry_name(index: usize, evidence: &Evidence) -> String {
    format!(
        "evidence/{:02}-{}-{}.{}",
        index + 1,
        evidence.kind,
        safe_stem(&evidence.original_name),
        extension_of(&evidence.stored_name)
    )
}

fn kind_label(kind: &str) -> &'static str {
    match kind {
        "receipt" => "Receipt",
        "warranty" => "Warranty",
        "serial_photo" => "Serial photo",
        _ => "File",
    }
}

fn row(label: &str, value: &str) -> String {
    format!(
        "<tr><th scope=\"row\">{}</th><td>{}</td></tr>",
        escape_html(label),
        value
    )
}

fn list_items(items: &[String], empty: &str) -> String {
    if items.is_empty() {
        return format!("<p class=\"empty\">{}</p>", escape_html(empty));
    }
    let mut out = String::from("<ul>");
    for item in items {
        let _ = write!(out, "<li>{item}</li>");
    }
    out.push_str("</ul>");
    out
}

/// Builds the HTML report bundled into the packet.
pub fn summary_html(
    gear: &Gear,
    events: &[TimelineEvent],
    evidence: &[Evidence],
    include_serial: bool,
) -> String {
    let title = gear.model.clone().unwrap_or_else(|| gear.name.clone());
    let generated = chrono::Utc::now().format("%d %b %Y, %H:%M UTC").to_string();

    let serial = if include_serial {
        text(&gear.serial_number)
    } else {
        match &gear.serial_number {
            Some(raw) if !raw.trim().is_empty() => escape_html(&masked_serial(raw)),
            _ => "Not recorded".to_string(),
        }
    };
    let serial_note = if include_serial {
        "The full serial number is included in this copy."
    } else {
        "The serial number is masked; only the last four digits are shown."
    };

    let identity = [
        row("Brand", &text(&gear.brand)),
        row("Model", &text(&gear.model)),
        row("Category", &escape_html(&gear.category)),
        row("Serial number", &serial),
    ]
    .join("");

    let purchase = [
        row("Seller", &text(&gear.seller)),
        row("Purchased", &text(&gear.purchase_date)),
        row("Price", &price(gear.purchase_price, &gear.currency)),
    ]
    .join("");

    let warranty = [
        row("Status", warranty_status(gear)),
        row("Cover ends", &text(&gear.warranty_end)),
        row("Covered from", &text(&gear.warranty_start)),
        row("Terms", &text(&gear.warranty_terms)),
    ]
    .join("");

    let history: Vec<String> = events
        .iter()
        .map(|event| {
            let mut line = format!(
                "{} — {} <span class=\"meta\">{}</span>",
                escape_html(&event.occurred_on),
                escape_html(&event.title),
                escape_html(kind_label(&event.kind))
            );
            if let Some(detail) = event
                .detail
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                let _ = write!(
                    line,
                    "<br><span class=\"meta\">{}</span>",
                    escape_html(detail)
                );
            }
            line
        })
        .collect();

    let files: Vec<String> = evidence
        .iter()
        .enumerate()
        .map(|(index, item)| {
            format!(
                "{} <span class=\"meta\">{}</span>",
                escape_html(&entry_name(index, item)),
                escape_html(kind_label(&item.kind))
            )
        })
        .collect();

    let mut html = String::new();
    html.push_str("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n");
    html.push_str("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n");
    let _ = writeln!(
        html,
        "<title>Repair packet — {}</title>",
        escape_html(&title)
    );
    html.push_str(
        "<style>\
:root{color-scheme:light}\
body{margin:0;padding:40px 20px;background:#f6f7f5;color:#23282a;\
font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}\
main{max-width:720px;margin:0 auto;background:#fff;border:1px solid #e4e7e2;\
border-radius:12px;padding:32px 36px}\
h1{font-size:24px;margin:0 0 4px}\
h2{font-size:14px;letter-spacing:.04em;text-transform:uppercase;color:#6e7773;\
margin:28px 0 8px}\
.lede{color:#5b6563;margin:0 0 4px}\
table{width:100%;border-collapse:collapse}\
th,td{text-align:left;vertical-align:top;padding:7px 0;border-top:1px solid #e4e7e2}\
tr:first-child th,tr:first-child td{border-top:0}\
th{width:34%;font-weight:600;color:#5b6563}\
ul{margin:6px 0 0;padding-left:18px}\
li{margin:4px 0}\
.meta{color:#6e7773;font-size:13px}\
.empty{color:#6e7773;margin:6px 0 0}\
footer{margin-top:30px;padding-top:14px;border-top:1px solid #e4e7e2;\
color:#6e7773;font-size:13px}</style>\n",
    );
    html.push_str("</head>\n<body>\n<main>\n");
    let _ = writeln!(html, "<h1>{}</h1>", escape_html(&title));
    html.push_str("<p class=\"lede\">Repair packet prepared with ShutterProof.</p>\n");

    let _ = writeln!(
        html,
        "<h2>Identity</h2>\n<table>{identity}</table>\n<p class=\"meta\">{}</p>",
        escape_html(serial_note)
    );
    let _ = writeln!(
        html,
        "<h2>Proof of purchase</h2>\n<table>{purchase}</table>"
    );
    let _ = writeln!(html, "<h2>Warranty</h2>\n<table>{warranty}</table>");
    let _ = writeln!(
        html,
        "<h2>History ({})</h2>\n{}",
        events.len(),
        list_items(&history, "No history entries were included.")
    );
    let _ = writeln!(
        html,
        "<h2>Files ({})</h2>\n{}",
        evidence.len(),
        list_items(&files, "No files were included.")
    );

    let _ = writeln!(
        html,
        "<footer>Generated on {generated} on this device. Nothing in this packet was uploaded anywhere.</footer>"
    );
    html.push_str("</main>\n</body>\n</html>\n");
    html
}

/// Joins a stored name back onto the evidence directory, refusing anything that
/// could climb out of it. Stored names are generated by the app as
/// `<uuid>.<ext>`, so a rejection here means a corrupted record.
fn evidence_path(evidence_dir: &Path, stored_name: &str, display_name: &str) -> AppResult<PathBuf> {
    let unsafe_name = stored_name.is_empty()
        || stored_name.contains('/')
        || stored_name.contains('\\')
        || stored_name.contains("..")
        || stored_name.contains('\0');
    if unsafe_name {
        return Err(AppError::internal("An attachment path was unsafe."));
    }
    let root = fs::canonicalize(evidence_dir)?;
    let candidate = evidence_dir.join(stored_name);
    let metadata = match fs::symlink_metadata(&candidate) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(AppError::validation(format!(
                "{display_name} could not be found. It may have been moved or removed."
            )));
        }
        Err(error) => return Err(error.into()),
    };
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(AppError::validation(
            "One of the selected evidence files is unavailable.",
        ));
    }
    let resolved = fs::canonicalize(candidate)?;
    if !resolved.starts_with(root) {
        return Err(AppError::validation(
            "One of the selected evidence files is unavailable.",
        ));
    }
    Ok(resolved)
}

fn write_atomic(dest: &Path, bytes: &[u8]) -> AppResult<()> {
    let parent = match dest.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent.to_path_buf(),
        _ => PathBuf::from("."),
    };
    if !parent.is_dir() {
        return Err(AppError::validation("That folder no longer exists."));
    }

    let temp = parent.join(format!(".shutterproof-{}.zip.part", uuid::Uuid::new_v4()));
    let result = (|| -> AppResult<()> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)?;
        file.write_all(bytes)?;
        file.flush()?;
        file.sync_all()?;
        fs::rename(&temp, dest)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&temp);
    }
    result
}

/// Writes the packet to `dest_path`, returning its size in bytes.
pub fn write_packet(
    evidence_dir: &Path,
    gear: &Gear,
    events: &[TimelineEvent],
    evidence: &[Evidence],
    include_serial: bool,
    dest_path: &Path,
) -> AppResult<i64> {
    let report = summary_html(gear, events, evidence, include_serial);
    let mut writer = ZipWriter::new();
    writer.add(SUMMARY_NAME, report.as_bytes())?;

    let mut total = report.len() as u64;
    for (index, item) in evidence.iter().enumerate() {
        let path = evidence_path(evidence_dir, &item.stored_name, &item.original_name)?;
        let file = File::open(&path).map_err(|_| {
            AppError::validation(format!(
                "{} could not be read. It may have been moved or removed.",
                item.original_name
            ))
        })?;
        let file_size = file.metadata()?.len();
        let remaining = MAX_PACKET_BYTES.saturating_sub(total);
        if file_size > crate::files::MAX_EVIDENCE_BYTES {
            return Err(oversized_file_error(&item.original_name));
        }
        if file_size > remaining {
            return Err(packet_limit_error(Some(&item.original_name)));
        }
        let read_limit = crate::files::MAX_EVIDENCE_BYTES
            .min(remaining)
            .saturating_add(1);
        let mut bytes = Vec::with_capacity(file_size as usize);
        std::io::Read::take(file, read_limit).read_to_end(&mut bytes)?;
        let actual_size = bytes.len() as u64;
        if actual_size > crate::files::MAX_EVIDENCE_BYTES {
            return Err(oversized_file_error(&item.original_name));
        }
        if actual_size > remaining {
            return Err(packet_limit_error(Some(&item.original_name)));
        }
        total = total.saturating_add(actual_size);
        writer.add(&entry_name(index, item), &bytes)?;
    }

    let archive = writer.finish();
    if archive.len() as u64 > MAX_PACKET_BYTES {
        return Err(packet_limit_error(
            evidence.last().map(|item| item.original_name.as_str()),
        ));
    }
    write_atomic(dest_path, &archive)?;
    Ok(archive.len() as i64)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gear() -> Gear {
        Gear {
            id: "g1".into(),
            name: "R6".into(),
            category: "Camera body".into(),
            brand: Some("Canon".into()),
            model: Some("EOS R6 <Mark II>".into()),
            serial_number: Some("SN-1234-5678".into()),
            purchase_date: Some("2025-01-02".into()),
            purchase_price: Some(2499.0),
            currency: Some("USD".into()),
            seller: Some("Shop & Co".into()),
            warranty_start: Some("2025-01-02".into()),
            warranty_end: Some("2027-01-02".into()),
            warranty_confirmed: true,
            warranty_terms: None,
            notes: None,
            created_at: "2025-01-02T00:00:00Z".into(),
            updated_at: "2025-01-02T00:00:00Z".into(),
        }
    }

    fn evidence(original: &str, stored: &str) -> Evidence {
        Evidence {
            id: "e1".into(),
            gear_id: "g1".into(),
            kind: "receipt".into(),
            original_name: original.into(),
            stored_name: stored.into(),
            mime_type: "application/pdf".into(),
            byte_size: 10,
            sha256: "abc".into(),
            created_at: "2025-01-02T00:00:00Z".into(),
        }
    }

    #[test]
    fn escapes_html() {
        assert_eq!(
            escape_html("<script>&\"'"),
            "&lt;script&gt;&amp;&quot;&#39;"
        );
    }

    #[test]
    fn masks_serial_unless_requested() {
        let masked = summary_html(&gear(), &[], &[], false);
        assert!(masked.contains("••••••5678"));
        assert!(!masked.contains("SN-1234-5678"));

        let full = summary_html(&gear(), &[], &[], true);
        assert!(full.contains("SN-1234-5678"));
    }

    #[test]
    fn size_errors_name_file_and_relevant_limits() {
        let file_message = oversized_file_error("receipt.pdf").to_string();
        assert!(file_message.contains("receipt.pdf"));
        assert!(file_message.contains("25 MB"));

        let packet_message = packet_limit_error(Some("receipt.pdf")).to_string();
        assert!(packet_message.contains("receipt.pdf"));
        assert!(packet_message.contains("200 MB"));
    }

    #[test]
    fn timeline_detail_is_included_and_escaped() {
        let event = TimelineEvent {
            id: "event-1".into(),
            gear_id: "g1".into(),
            kind: "repair".into(),
            occurred_on: "2025-02-03".into(),
            title: "Service visit".into(),
            detail: Some("Checked <sensor> & cleaned".into()),
        };
        let html = summary_html(&gear(), &[event], &[], false);
        assert!(html.contains("Checked &lt;sensor&gt; &amp; cleaned"));
        assert!(!html.contains("Checked <sensor>"));
    }

    #[test]
    fn warranty_status_is_never_reported_for_unconfirmed_dates() {
        let mut item = gear();
        item.warranty_confirmed = false;

        let html = summary_html(&item, &[], &[], false);
        assert!(html.contains("<th scope=\"row\">Status</th><td>Not confirmed</td>"));
        assert!(!html.contains("<th scope=\"row\">Status</th><td>Active</td>"));
    }

    #[test]
    fn serialises_record_markup() {
        let html = summary_html(&gear(), &[], &[], true);
        assert!(html.contains("EOS R6 &lt;Mark II&gt;"));
        assert!(html.contains("Shop &amp; Co"));
        assert!(!html.contains("<Mark II>"));
    }

    #[test]
    fn builds_safe_entry_names() {
        let item = evidence("../../etc/passwd.pdf", "uuid.pdf");
        assert_eq!(entry_name(0, &item), "evidence/01-receipt-passwd.pdf");
    }

    #[test]
    fn rejects_escaping_stored_names() {
        assert!(evidence_path(Path::new("C:/data/evidence"), "../x.pdf", "x.pdf").is_err());
        assert!(evidence_path(Path::new("C:/data/evidence"), "a/b.pdf", "x.pdf").is_err());
    }

    #[test]
    fn missing_evidence_error_names_file() {
        let root = std::env::temp_dir().join(format!("sp-packet-test-{}", uuid::Uuid::new_v4()));
        let evidence_dir = root.join("evidence");
        std::fs::create_dir_all(&evidence_dir).unwrap();
        let items = vec![evidence("Wedding receipt.pdf", "missing.pdf")];
        let error = write_packet(
            &evidence_dir,
            &gear(),
            &[],
            &items,
            false,
            &root.join("packet.zip"),
        )
        .unwrap_err();
        assert!(error.to_string().contains("Wedding receipt.pdf"));
        assert!(error.to_string().contains("moved or removed"));
        std::fs::remove_dir_all(&root).ok();
    }

    fn with_id(mut item: Evidence, id: &str) -> Evidence {
        item.id = id.to_string();
        item
    }

    #[test]
    fn select_keeps_only_requested_in_owned_order() {
        let owned = vec![
            with_id(evidence("a.pdf", "a.pdf"), "a"),
            with_id(evidence("b.pdf", "b.pdf"), "b"),
            with_id(evidence("c.pdf", "c.pdf"), "c"),
        ];
        let requested = vec!["c".to_string(), "a".to_string()];
        let picked = select_owned(&owned, &requested, |item| item.id.as_str(), "missing").unwrap();
        let ids: Vec<&str> = picked.iter().map(|item| item.id.as_str()).collect();
        assert_eq!(ids, vec!["a", "c"]);
    }

    #[test]
    fn select_rejects_ids_from_another_record() {
        let owned = vec![with_id(evidence("a.pdf", "a.pdf"), "a")];
        let requested = vec!["other".to_string()];
        assert!(select_owned(&owned, &requested, |item| item.id.as_str(), "missing").is_err());
    }

    #[test]
    fn writes_summary_and_evidence_into_the_archive() {
        let root = std::env::temp_dir().join(format!("sp-packet-test-{}", uuid::Uuid::new_v4()));
        let evidence_dir = root.join("evidence");
        std::fs::create_dir_all(&evidence_dir).unwrap();
        std::fs::write(evidence_dir.join("uuid.pdf"), b"%PDF-1.7").unwrap();

        let items = vec![evidence("../../Receipt Scan.PDF", "uuid.pdf")];
        let dest = root.join("packet.zip");
        let size = write_packet(&evidence_dir, &gear(), &[], &items, false, &dest).unwrap();
        assert!(size > 0);

        let bytes = std::fs::read(&dest).unwrap();
        let names = crate::archive::read_names(&bytes);
        assert_eq!(names[0], "repair-summary.html");
        assert_eq!(names[1], "evidence/01-receipt-Receipt-Scan.pdf");

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn destination_adds_zip_extension() {
        assert_eq!(
            destination("C:/tmp/packet").unwrap(),
            Path::new("C:/tmp/packet.zip")
        );
        assert_eq!(
            destination("C:/tmp/packet.ZIP").unwrap(),
            Path::new("C:/tmp/packet.ZIP")
        );
        assert!(destination("   ").is_err());
    }
}
