import type { TimelineEvent, TimelineEventKind } from "../types";
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

interface OwnershipTimelineProps {
  events: TimelineEvent[];
}

export function OwnershipTimeline({ events }: OwnershipTimelineProps) {
  if (events.length === 0) {
    return <p className="empty">No ownership events recorded for this item yet.</p>;
  }

  return (
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
          </li>
        );
      })}
    </ol>
  );
}
