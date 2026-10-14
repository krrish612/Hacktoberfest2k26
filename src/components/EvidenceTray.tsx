import type { Evidence, EvidenceKind } from "../types";
import { formatBytes, formatDate } from "../lib/format";
import type { IconName } from "./Icon";
import { Icon } from "./Icon";

const kindMeta: Record<EvidenceKind, { icon: IconName; label: string }> = {
  receipt: { icon: "receipt", label: "Receipt" },
  warranty: { icon: "shield", label: "Warranty" },
  serial_photo: { icon: "image", label: "Serial photo" },
  other: { icon: "package", label: "Document" },
};

const attachOptions: { kind: EvidenceKind; icon: IconName; label: string }[] = [
  { kind: "receipt", icon: "receipt", label: "Receipt" },
  { kind: "warranty", icon: "shield", label: "Warranty" },
  { kind: "serial_photo", icon: "image", label: "Serial photo" },
];

interface EvidenceTrayProps {
  items: Evidence[];
  busy: boolean;
  onAttach: (kind: EvidenceKind) => void;
  onRemove: (id: string) => void;
}

export function EvidenceTray({ items, busy, onAttach, onRemove }: EvidenceTrayProps) {
  return (
    <div className="evidence__wrap">
      <div className="attachbar">
        <span className="attachbar__label">Attach</span>
        {attachOptions.map((option) => (
          <button
            key={option.kind}
            type="button"
            className="chip"
            onClick={() => onAttach(option.kind)}
            disabled={busy}
          >
            <Icon name={option.icon} size={14} />
            {option.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="empty">
          Nothing attached yet. A receipt, the warranty PDF, and a serial photo keep the repair packet in one
          place. PDF, JPG, and PNG up to 25 MB.
        </p>
      ) : (
        <ul className="evidence">
          {items.map((item) => {
            const meta = kindMeta[item.kind];
            return (
              <li className="evidence__item" key={item.id}>
                <span className="evidence__thumb" aria-hidden="true">
                  <Icon name={meta.icon} size={18} />
                </span>
                <div className="evidence__body">
                  <p className="evidence__name">{item.originalName}</p>
                  <p className="evidence__meta">
                    {meta.label}, {formatBytes(item.byteSize)}, added {formatDate(item.createdAt.slice(0, 10))}
                  </p>
                  <p className="evidence__hash">sha256 {item.sha256.slice(0, 12)}…</p>
                </div>
                <button
                  type="button"
                  className="iconbtn"
                  onClick={() => onRemove(item.id)}
                  disabled={busy}
                  aria-label={`Remove ${item.originalName}`}
                >
                  <Icon name="close" size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
