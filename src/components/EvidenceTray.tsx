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

interface EvidenceTrayProps {
  items: Evidence[];
}

export function EvidenceTray({ items }: EvidenceTrayProps) {
  if (items.length === 0) {
    return (
      <p className="empty">
        No receipts or warranty files attached yet. Adding them keeps the repair packet in one place.
      </p>
    );
  }

  return (
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
                {meta.label} · {formatBytes(item.byteSize)} · added {formatDate(item.createdAt.slice(0, 10))}
              </p>
              <p className="evidence__hash">sha256 {item.sha256.slice(0, 12)}…</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
