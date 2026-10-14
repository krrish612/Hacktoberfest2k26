// Domain types shared between the React frontend and the Rust backend.
// Field names use camelCase on the wire; the Rust side serialises with
// #[serde(rename_all = "camelCase")].

export type WarrantyStatus = "unknown" | "active" | "expiring" | "expired" | "none";

export type EvidenceKind = "receipt" | "warranty" | "serial_photo" | "other";

export type ExtractionStatus = "pending" | "accepted" | "rejected";

export type TimelineEventKind =
  | "purchase"
  | "warranty_start"
  | "warranty_end"
  | "repair"
  | "inspection"
  | "transfer"
  | "note";

export interface Gear {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null; // ISO yyyy-mm-dd
  purchasePrice: number | null;
  currency: string | null;
  seller: string | null;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  warrantyConfirmed: boolean;
  warrantyTerms: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GearInput {
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  currency: string | null;
  seller: string | null;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  warrantyConfirmed: boolean;
  warrantyTerms: string | null;
  notes: string | null;
}

export interface Evidence {
  id: string;
  gearId: string;
  kind: EvidenceKind;
  originalName: string;
  storedName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  gearId: string;
  kind: TimelineEventKind;
  occurredOn: string; // ISO yyyy-mm-dd
  title: string;
  detail: string | null;
}

export interface TimelineEventInput {
  kind: TimelineEventKind;
  occurredOn: string;
  title: string;
  detail: string | null;
}

export interface ExtractedField {
  key: string;
  label: string;
  value: string;
  confidence: number; // 0..1
  /** Exact substring of the receipt the value was derived from, if any. */
  evidenceQuote: string | null;
}

export interface Extraction {
  id: string;
  evidenceId: string;
  gearId: string;
  model: string;
  status: ExtractionStatus;
  fields: ExtractedField[];
  warnings: string[];
  createdAt: string;
}

export interface BackupInfo {
  path: string;
  byteSize: number;
  createdAt: string;
}

export interface OllamaStatus {
  available: boolean;
  model: string;
  modelPresent: boolean;
  version: string | null;
  message: string;
}

export interface WarrantyView {
  status: WarrantyStatus;
  label: string;
  daysRemaining: number | null;
  confirmed: boolean;
}

export interface SampleResult {
  gear: number;
  evidence: number;
  events: number;
}

/** Static build metadata returned by the Rust `app_info` command. */
export interface AppInfo {
  name: string;
  version: string;
  stage: string;
}
