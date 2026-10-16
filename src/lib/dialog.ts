import { open, save } from "@tauri-apps/plugin-dialog";
import { isTauri } from "./tauri";

const EVIDENCE_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];

/** Opens the native picker for a receipt, warranty, or serial photo. */
export async function pickEvidenceFile(
  title = "Attach a receipt, warranty, or serial photo",
): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({
    multiple: false,
    directory: false,
    title,
    filters: [{ name: "Receipts and warranties", extensions: EVIDENCE_EXTENSIONS }],
  });
  return typeof selected === "string" ? selected : null;
}

/** Opens the native picker for a backup destination or a backup to restore. */
export async function pickFolder(title: string): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({ multiple: false, directory: true, title });
  return typeof selected === "string" ? selected : null;
}

/** Opens the native save dialog for a repair packet and returns the chosen path. */
export async function pickSaveZip(
  defaultName: string,
  title = "Save repair packet",
): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await save({
    title,
    defaultPath: defaultName,
    filters: [{ name: "Zip archive", extensions: ["zip"] }],
  });
  return typeof selected === "string" ? selected : null;
}
