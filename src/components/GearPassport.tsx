import type { Evidence, Gear, TimelineEvent, WarrantyView } from "../types";
import { formatMoney, maskSerial } from "../lib/format";
import { warrantyView } from "../lib/warranty";
import { DetailList } from "./DetailList";
import { EvidenceTray } from "./EvidenceTray";
import { Icon } from "./Icon";
import { OwnershipTimeline } from "./OwnershipTimeline";
import { PrepareRepairPacket } from "./PrepareRepairPacket";
import { Section } from "./Section";
import { WarrantyPanel } from "./WarrantyPanel";

function StatusPill({ view }: { view: WarrantyView }) {
  return (
    <span className={`pill pill--${view.status}`}>
      <span className={`dot dot--${view.status}`} aria-hidden="true" />
      {view.label}
    </span>
  );
}

interface GearPassportProps {
  gear: Gear;
  evidence: Evidence[];
  events: TimelineEvent[];
}

export function GearPassport({ gear, evidence, events }: GearPassportProps) {
  const view = warrantyView(gear);

  return (
    <article className="passport">
      <header className="identity">
        <div className="identity__main">
          <p className="identity__kicker">
            {gear.brand}, {gear.category.toLowerCase()}
          </p>
          <h2 className="identity__model">{gear.model ?? gear.name}</h2>
          <p className="identity__serial">
            <Icon name="lock" size={14} />
            <span className="mono">{maskSerial(gear.serialNumber)}</span>
            <span className="identity__hint">last four digits only</span>
          </p>
        </div>
        <div className="identity__side">
          <StatusPill view={view} />
          <PrepareRepairPacket gear={gear} evidence={evidence} events={events} />
        </div>
      </header>

      <div className="passport__grid">
        <div className="passport__col">
          <Section title="Purchase" description="Where and when it was bought.">
            <DetailList
              items={[
                { label: "Seller", value: gear.seller ?? "Not recorded", icon: "store" },
                { label: "Date", value: gear.purchaseDate ?? "Not recorded", icon: "calendar" },
                { label: "Price", value: formatMoney(gear.purchasePrice, gear.currency), icon: "receipt" },
              ]}
            />
          </Section>

          <Section title="Ownership timeline" description="Purchases, services, and notes in order.">
            <OwnershipTimeline events={events} />
          </Section>
        </div>

        <div className="passport__col">
          <Section title="Warranty">
            <WarrantyPanel gear={gear} />
          </Section>

          <Section title="Evidence" description="Receipts, warranty files, and serial photos.">
            <EvidenceTray items={evidence} />
          </Section>
        </div>
      </div>
    </article>
  );
}
