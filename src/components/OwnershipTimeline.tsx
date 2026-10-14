import { useState } from "react";
import type { FormEvent } from "react";
import type { TimelineEvent, TimelineEventInput, TimelineEventKind } from "../types";
import { formatDate } from "../lib/format";
import type { IconName } from "./Icon";
import { Icon } from "./Icon";

const kindMeta: Record<TimelineEventKind, { icon: IconName; tone: string }> = {
  purchase: { icon: "store", tone: "accent" },
  warranty_start: { icon: "shield", tone: "accent" },
  warranty_end: { icon: "clock", tone: "quiet" },
  repair: { icon: "wrench", tone: "warn" },
  inspection: { icon: "check", tone: "quiet" },
  transfer: { icon: "package", tone: "quiet" },
  note: { icon: "note", tone: "quiet" },
};

const kindLabels: [TimelineEventKind, string][] = [
  ["purchase", "Purchase"],
  ["warranty_start", "Warranty start"],
  ["warranty_end", "Warranty end"],
  ["repair", "Repair"],
  ["inspection", "Inspection"],
  ["transfer", "Transfer"],
  ["note", "Note"],
];

interface OwnershipTimelineProps {
  events: TimelineEvent[];
  busy: boolean;
  onAdd: (input: TimelineEventInput) => Promise<boolean>;
  onRemove: (id: string) => void;
}

export function OwnershipTimeline({ events, busy, onAdd, onRemove }: OwnershipTimelineProps) {
  const [kind, setKind] = useState<TimelineEventKind>("note");
  const [occurredOn, setOccurredOn] = useState("");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await onAdd({ kind, occurredOn, title, detail: detail || null });
    if (ok) {
      setOccurredOn("");
      setTitle("");
      setDetail("");
      setKind("note");
    }
  };

  return (
    <div className="timeline__wrap">
      {events.length === 0 ? (
        <p className="empty">No events recorded yet. Add the purchase to start the history.</p>
      ) : (
        <ol className="timeline">
          {events.map((event) => {
            const meta = kindMeta[event.kind];
            return (
              <li className="timeline__item" key={event.id}>
                <span className={`timeline__marker timeline__marker--${meta.tone}`} aria-hidden="true">
                  <Icon name={meta.icon} size={15} />
                </span>
                <div className="timeline__body">
                  <time className="timeline__date" dateTime={event.occurredOn}>
                    {formatDate(event.occurredOn)}
                  </time>
                  <p className="timeline__title">{event.title}</p>
                  {event.detail ? <p className="timeline__detail">{event.detail}</p> : null}
                </div>
                <button
                  type="button"
                  className="iconbtn"
                  onClick={() => onRemove(event.id)}
                  disabled={busy}
                  aria-label={`Remove ${event.title}`}
                >
                  <Icon name="close" size={15} />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <form className="eventform" onSubmit={submit}>
        <div className="eventform__row">
          <label className="field">
            <span className="field__label">Type</span>
            <select
              className="field__input"
              value={kind}
              onChange={(event) => setKind(event.target.value as TimelineEventKind)}
            >
              {kindLabels.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Date</span>
            <input
              type="date"
              className="field__input"
              value={occurredOn}
              onChange={(event) => setOccurredOn(event.target.value)}
              required
            />
          </label>
        </div>
        <label className="field">
          <span className="field__label">Title</span>
          <input
            className="field__input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Sensor cleaned"
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Detail (optional)</span>
          <input
            className="field__input"
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
          />
        </label>
        <button type="submit" className="btn btn--small" disabled={busy}>
          Add event
        </button>
      </form>
    </div>
  );
}
