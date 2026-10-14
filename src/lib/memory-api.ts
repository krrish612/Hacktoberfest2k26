import type {
  BackupInfo,
  DataStatus,
  Evidence,
  Gear,
  GearInput,
  TimelineEvent,
} from "../types";
import { evidenceFor, gears as sampleGears, timelineFor } from "../data/sample";
import type { RecordsApi } from "./api";

// Browser-preview stand-in for the Rust records store. It keeps records in
// memory (seeded from the stage-1 sample) so the UI can be built and typechecked
// without the Rust toolchain. Nothing here touches the disk, so backups report
// that they are a desktop-only feature.

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

let gearStore: Gear[] = copy(sampleGears);
let evidenceStore: Evidence[] = sampleGears.flatMap((gear) => copy(evidenceFor(gear.id)));
let timelineStore: TimelineEvent[] = sampleGears.flatMap((gear) => copy(timelineFor(gear.id)));

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

function requireText(value: string, label: string, max = 200): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  if (trimmed.length > max) throw new Error(`${label} is too long.`);
  return trimmed;
}

function optionalText(value: string | null, max = 4_000): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw new Error("That value is too long.");
  return trimmed;
}

function optionalDate(value: string | null, label: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || Number.isNaN(Date.parse(trimmed))) {
    throw new Error(`${label} must be a real date like 2026-10-14.`);
  }
  return trimmed;
}

function normalize(input: GearInput): GearInput {
  const name = requireText(input.name, "A gear name");
  const category = requireText(input.category, "A category", 100);
  const purchaseDate = optionalDate(input.purchaseDate, "The purchase date");
  const warrantyStart = optionalDate(input.warrantyStart, "The warranty start date");
  const warrantyEnd = optionalDate(input.warrantyEnd, "The warranty end date");

  const hasDates = Boolean(warrantyStart || warrantyEnd);
  if (hasDates && !input.warrantyConfirmed) {
    throw new Error("Confirm the warranty dates before saving them.");
  }
  if (warrantyStart && warrantyEnd && warrantyEnd < warrantyStart) {
    throw new Error("The warranty end date cannot be before the start date.");
  }
  if (input.purchasePrice !== null && (input.purchasePrice < 0 || !Number.isFinite(input.purchasePrice))) {
    throw new Error("The purchase price looks out of range.");
  }

  return {
    name,
    category,
    brand: optionalText(input.brand, 120),
    model: optionalText(input.model, 120),
    serialNumber: optionalText(input.serialNumber, 120),
    purchaseDate,
    purchasePrice: input.purchasePrice,
    currency: optionalText(input.currency, 8),
    seller: optionalText(input.seller, 120),
    warrantyStart,
    warrantyEnd,
    warrantyConfirmed: hasDates || input.warrantyConfirmed,
    warrantyTerms: optionalText(input.warrantyTerms),
    notes: optionalText(input.notes),
  };
}

function mimeFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

export const memoryApi: RecordsApi = {
  async listGear() {
    return copy(gearStore).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async createGear(input) {
    const clean = normalize(input);
    const timestamp = now();
    const gear: Gear = { id: id(), ...clean, createdAt: timestamp, updatedAt: timestamp };
    gearStore = [gear, ...gearStore];
    return copy(gear);
  },

  async updateGear(gearId, input) {
    const clean = normalize(input);
    const existing = gearStore.find((gear) => gear.id === gearId);
    if (!existing) throw new Error("That gear record no longer exists.");
    const updated: Gear = { ...existing, ...clean, updatedAt: now() };
    gearStore = gearStore.map((gear) => (gear.id === gearId ? updated : gear));
    return copy(updated);
  },

  async deleteGear(gearId) {
    gearStore = gearStore.filter((gear) => gear.id !== gearId);
    evidenceStore = evidenceStore.filter((item) => item.gearId !== gearId);
    timelineStore = timelineStore.filter((item) => item.gearId !== gearId);
  },

  async listEvidence(gearId) {
    return copy(evidenceStore)
      .filter((item) => item.gearId === gearId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async importEvidence(gearId, sourcePath, kind) {
    const name = sourcePath.split(/[\\/]/).pop() ?? "attachment";
    const evidence: Evidence = {
      id: id(),
      gearId,
      kind,
      originalName: name,
      storedName: `${id()}.preview`,
      mimeType: mimeFor(name),
      byteSize: 0,
      sha256: "preview-only",
      createdAt: now(),
    };
    evidenceStore = [evidence, ...evidenceStore];
    return copy(evidence);
  },

  async deleteEvidence(evidenceId) {
    evidenceStore = evidenceStore.filter((item) => item.id !== evidenceId);
  },

  async listTimeline(gearId) {
    return copy(timelineStore)
      .filter((item) => item.gearId === gearId)
      .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
  },

  async createTimelineEvent(gearId, input) {
    const title = requireText(input.title, "A short title");
    const occurredOn = optionalDate(input.occurredOn, "The event date");
    if (!occurredOn) throw new Error("An event date is required.");
    const event: TimelineEvent = {
      id: id(),
      gearId,
      kind: input.kind,
      occurredOn,
      title,
      detail: optionalText(input.detail),
    };
    timelineStore = [event, ...timelineStore];
    return copy(event);
  },

  async deleteTimelineEvent(eventId) {
    timelineStore = timelineStore.filter((item) => item.id !== eventId);
  },

  async recordsStatus(): Promise<DataStatus> {
    return {
      dataDir: "Browser preview (no files written)",
      defaultBackupDir: "Browser preview (no files written)",
      gearCount: gearStore.length,
      evidenceCount: evidenceStore.length,
    };
  },

  async backupRecords(): Promise<BackupInfo> {
    throw new Error("Local backups run in the ShutterProof desktop app.");
  },

  async restoreRecords(): Promise<void> {
    throw new Error("Restore runs in the ShutterProof desktop app.");
  },
};
