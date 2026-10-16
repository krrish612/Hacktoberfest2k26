import { invoke } from "@tauri-apps/api/core";
import type {
  BackupInfo,
  DataStatus,
  Evidence,
  EvidenceKind,
  Extraction,
  Gear,
  GearInput,
  OllamaStatus,
  PacketInfo,
  TimelineEvent,
  TimelineEventInput,
} from "../types";
import { isTauri } from "./tauri";
import { memoryApi } from "./memory-api";

/**
 * The records contract. The desktop build talks to Rust commands; the browser
 * preview uses an in-memory stand-in so the UI can be developed and built
 * without the Rust toolchain.
 */
export interface RecordsApi {
  listGear(): Promise<Gear[]>;
  createGear(input: GearInput): Promise<Gear>;
  updateGear(id: string, input: GearInput): Promise<Gear>;
  deleteGear(id: string): Promise<void>;
  listEvidence(gearId: string): Promise<Evidence[]>;
  importEvidence(gearId: string, sourcePath: string, kind: EvidenceKind): Promise<Evidence>;
  deleteEvidence(id: string): Promise<void>;
  listTimeline(gearId: string): Promise<TimelineEvent[]>;
  createTimelineEvent(gearId: string, input: TimelineEventInput): Promise<TimelineEvent>;
  deleteTimelineEvent(id: string): Promise<void>;
  recordsStatus(): Promise<DataStatus>;
  backupRecords(destDir: string): Promise<BackupInfo>;
  restoreRecords(backupDir: string): Promise<void>;
  exportRepairPacket(
    gearId: string,
    evidenceIds: string[],
    eventIds: string[],
    includeSerial: boolean,
    destPath: string,
  ): Promise<PacketInfo>;
  ollamaStatus(): Promise<OllamaStatus>;
  extractReceipt(sourcePath: string, gearId: string | null): Promise<Extraction>;
}

const tauriApi: RecordsApi = {
  listGear: () => invoke<Gear[]>("list_gear"),
  createGear: (input) => invoke<Gear>("create_gear", { input }),
  updateGear: (id, input) => invoke<Gear>("update_gear", { id, input }),
  deleteGear: (id) => invoke<void>("delete_gear", { id }),
  listEvidence: (gearId) => invoke<Evidence[]>("list_evidence", { gearId }),
  importEvidence: (gearId, sourcePath, kind) =>
    invoke<Evidence>("import_evidence", { gearId, sourcePath, kind }),
  deleteEvidence: (id) => invoke<void>("delete_evidence", { id }),
  listTimeline: (gearId) => invoke<TimelineEvent[]>("list_timeline", { gearId }),
  createTimelineEvent: (gearId, input) => invoke<TimelineEvent>("create_timeline_event", { gearId, input }),
  deleteTimelineEvent: (id) => invoke<void>("delete_timeline_event", { id }),
  recordsStatus: () => invoke<DataStatus>("records_status"),
  backupRecords: (destDir) => invoke<BackupInfo>("backup_records", { destDir }),
  restoreRecords: (backupDir) => invoke<void>("restore_records", { backupDir }),
  exportRepairPacket: (gearId, evidenceIds, eventIds, includeSerial, destPath) =>
    invoke<PacketInfo>("export_repair_packet", {
      gearId,
      evidenceIds,
      eventIds,
      includeSerial,
      destPath,
    }),
  ollamaStatus: () => invoke<OllamaStatus>("ollama_status"),
  extractReceipt: (sourcePath, gearId) => invoke<Extraction>("extract_receipt", { sourcePath, gearId }),
};

export const runningInTauri = isTauri();
export const api: RecordsApi = runningInTauri ? tauriApi : memoryApi;
