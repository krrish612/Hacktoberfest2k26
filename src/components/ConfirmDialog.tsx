import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import { Icon } from "./Icon";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "default" | "danger";
  busy?: boolean;
  /** A failed confirm, shown here because a toast sits behind the dialog. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = "default",
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current && !busy) onCancel();
  };

  return (
    <dialog
      ref={dialogRef}
      className="sheet sheet--confirm"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={onBackdropClick}
    >
      <div className="sheet__head">
        <h2 id="confirm-title" className="sheet__title">
          {title}
        </h2>
        <button type="button" className="sheet__close" onClick={onCancel} aria-label="Close" disabled={busy}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <p className="sheet__lede">{message}</p>
      {error ? <p className="form__error">{error}</p> : null}
      <div className="sheet__foot">
        <span className="sheet__note">This cannot be undone.</span>
        <div className="form__actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn btn--danger" : "btn btn--primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
