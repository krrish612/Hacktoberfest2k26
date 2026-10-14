import type { Gear } from "../types";
import { describeDays, formatDate } from "../lib/format";
import { warrantyView } from "../lib/warranty";
import { Icon } from "./Icon";

interface WarrantyPanelProps {
  gear: Gear;
}

export function WarrantyPanel({ gear }: WarrantyPanelProps) {
  const view = warrantyView(gear);
  const remaining = view.daysRemaining;

  return (
    <div className={`warranty warranty--${view.status}`}>
      <div className="warranty__status">
        <Icon name={view.status === "active" ? "check" : view.status === "expired" ? "alert" : "clock"} size={16} />
        <span>{view.label}</span>
      </div>

      <ul className="warranty__facts">
        <li>
          <span>Started</span>
          <span>{formatDate(gear.warrantyStart)}</span>
        </li>
        <li>
          <span>Ends</span>
          <span>{formatDate(gear.warrantyEnd)}</span>
        </li>
      </ul>

      {remaining !== null ? (
        <p className="warranty__remaining">
          {remaining < 0
            ? `Cover ended ${describeDays(remaining)}`
            : `About ${describeDays(remaining)} of cover left`}
        </p>
      ) : null}

      {gear.warrantyTerms ? <p className="warranty__terms">{gear.warrantyTerms}</p> : null}

      <p className="warranty__confirm">
        {view.confirmed
          ? "Dates confirmed by you."
          : "No dates confirmed yet — worth checking the paperwork."}
      </p>
    </div>
  );
}
