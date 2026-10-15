//! Domain models exchanged with the frontend.
//!
//! Field names are camelCase on the wire to match `src/types.ts`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Gear {
    pub id: String,
    pub name: String,
    pub category: String,
    pub brand: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub purchase_date: Option<String>,
    pub purchase_price: Option<f64>,
    pub currency: Option<String>,
    pub seller: Option<String>,
    pub warranty_start: Option<String>,
    pub warranty_end: Option<String>,
    pub warranty_confirmed: bool,
    pub warranty_terms: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Fields the photographer fills in. Everything the app cannot derive itself.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GearInput {
    pub name: String,
    pub category: String,
    pub brand: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub purchase_date: Option<String>,
    pub purchase_price: Option<f64>,
    pub currency: Option<String>,
    pub seller: Option<String>,
    pub warranty_start: Option<String>,
    pub warranty_end: Option<String>,
    pub warranty_confirmed: bool,
    pub warranty_terms: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Evidence {
    pub id: String,
    pub gear_id: String,
    pub kind: String,
    pub original_name: String,
    pub stored_name: String,
    pub mime_type: String,
    pub byte_size: i64,
    pub sha256: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEvent {
    pub id: String,
    pub gear_id: String,
    pub kind: String,
    pub occurred_on: String,
    pub title: String,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEventInput {
    pub kind: String,
    pub occurred_on: String,
    pub title: String,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub path: String,
    pub byte_size: i64,
    pub created_at: String,
}

/// Where records live and how much is stored, surfaced in the local-data panel.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataStatus {
    pub data_dir: String,
    pub default_backup_dir: String,
    pub gear_count: i64,
    pub evidence_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub stage: String,
}

/// Whether the local Ollama server is reachable and the chosen model is pulled.
/// This is only ever checked against 127.0.0.1; nothing leaves the device.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaStatus {
    pub available: bool,
    pub model: String,
    pub model_present: bool,
    pub version: Option<String>,
    pub message: String,
}

/// One field the model read off a receipt, with its own confidence. A suggestion
/// only: the photographer confirms or corrects it before it is saved.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedField {
    pub key: String,
    pub label: String,
    pub value: String,
    pub confidence: f64,
    pub evidence_quote: Option<String>,
}

/// The full set of suggestions for one receipt. `status` stays `pending` here;
/// accepting or rejecting happens in the UI when the record is edited.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Extraction {
    pub id: String,
    pub evidence_id: Option<String>,
    pub gear_id: Option<String>,
    pub model: String,
    pub status: String,
    pub fields: Vec<ExtractedField>,
    pub warnings: Vec<String>,
    pub created_at: String,
}
