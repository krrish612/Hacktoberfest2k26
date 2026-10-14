import type { IconName } from "./Icon";
import { Icon } from "./Icon";

export interface DetailItem {
  label: string;
  value: string;
  icon?: IconName;
  muted?: boolean;
}

interface DetailListProps {
  items: DetailItem[];
}

export function DetailList({ items }: DetailListProps) {
  return (
    <dl className="details">
      {items.map((item) => (
        <div className="details__row" key={item.label}>
          <dt className="details__label">
            {item.icon ? <Icon name={item.icon} size={15} /> : null}
            {item.label}
          </dt>
          <dd className={item.muted ? "details__value details__value--muted" : "details__value"}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
