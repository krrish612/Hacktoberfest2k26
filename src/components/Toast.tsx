import { useEffect } from "react";
import type { Notice } from "../state/RecordsProvider";
import { Icon } from "./Icon";

interface ToastProps {
  notice: Notice;
  onDismiss: () => void;
}

export function Toast({ notice, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, notice.tone === "success" ? 4000 : 7000);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);

  return (
    <div className={`toast toast--${notice.tone}`} role="status">
      <Icon name={notice.tone === "success" ? "check" : "alert"} size={16} />
      <p className="toast__text">{notice.message}</p>
      <button type="button" className="toast__close" onClick={onDismiss} aria-label="Dismiss">
        <Icon name="close" size={15} />
      </button>
    </div>
  );
}
