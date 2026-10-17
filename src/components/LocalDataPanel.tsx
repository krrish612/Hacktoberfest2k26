import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import type { DataStatus } from "../types";
import { Icon } from "./Icon";

interface LocalDataPanelProps {
  status: DataStatus | null;
  runningInTauri: boolean;
  busy: boolean;
  /** A failed backup or restore, shown here because a toast sits behind the sheet. */
  error?: string | null;
  onBackup: () => void;
  onRestore: () => void;
  onClose: () => void;
}

export function LocalDataPanel({
  status,
  runningInTauri,
  busy,
  error = null,
  onBackup,
  onRestore,
  onClose,
}: LocalDataPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current && !busy) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="data-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={onBackdropClick}
    >
      <div className="sheet__head">
        <div>
          <h2 id="data-title" className="sheet__title">
            Local data
          </h2>
          <p className="sheet__subtitle">Everything lives on this device.</p>
        </div>
        <button type="button" className="sheet__close" onClick={onClose} aria-label="Close" disabled={busy}>
          <Icon name="close" size={18} />
        </button>
      </div>

      <p className="sheet__lede">
        Records and originals are stored in the app's private data folder. A backup is a plain folder you
        can move to another drive, and restoring puts it back.
      </p>

      <div className="sheet__group">
        <h3 className="sheet__groupTitle">Stored on this device</h3>
        <ul className="sheet__list">
          <li>
            <span>Data folder</span>
            <span className="mono path">{status?.dataDir ?? "Loading…"}</span>
          </li>
          <li>
            <span>Gear records</span>
            <span>{status?.gearCount ?? 0}</span>
          </li>
          <li>
            <span>Attached files</span>
            <span>{status?.evidenceCount ?? 0}</span>
          </li>
        </ul>
      </div>

      <div className="sheet__group">
        <h3 className="sheet__groupTitle">Backup and restore</h3>
        {runningInTauri ? (
          <p className="sheet__note">
            Backups include the database and every attached original. Restoring replaces what is on screen now.
          </p>
        ) : (
          <p className="sheet__note">
            Backup and restore run in the desktop app. This is a browser preview with nothing on disk.
          </p>
        )}
      </div>

      {error ? (
        <div className="sheet__group">
          <p className="form__error">{error}</p>
        </div>
      ) : null}

      <div className="sheet__foot">
        <p className="sheet__note">
          {runningInTauri ? `Default backup folder: ${status?.defaultBackupDir ?? "…"}` : "Preview mode"}
        </p>
        <div className="form__actions">
          <button type="button" className="btn" onClick={onRestore} disabled={busy || !runningInTauri}>
            Restore…
          </button>
          <button type="button" className="btn btn--primary" onClick={onBackup} disabled={busy || !runningInTauri}>
            {busy ? "Working…" : "Back up…"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
