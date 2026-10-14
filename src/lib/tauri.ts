import { invoke } from "@tauri-apps/api/core";
import type { AppInfo } from "../types";

/** True when the UI is running inside the Tauri webview rather than a browser. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Reads static build metadata from the Rust shell.
 *
 * Returns `null` in a plain browser preview or if the command is unavailable, so
 * the UI degrades gracefully instead of throwing.
 */
export async function fetchAppInfo(): Promise<AppInfo | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<AppInfo>("app_info");
  } catch {
    return null;
  }
}
