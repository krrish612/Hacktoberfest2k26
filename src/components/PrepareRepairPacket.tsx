import { useRef } from "react";
import type { MouseEvent } from "react";
import type { Evidence, Gear, TimelineEvent } from "../types";
import { formatDate, formatMoney, maskSerial } from "../lib/format";
import { warrantyView } from "../lib/warranty";
import { Icon } from "./Icon";

interface PrepareRepairPacketProps {
  gear: Gear;
  evidence: Evidence[];
  events: TimelineEvent[];
}

export function PrepareRepairPacket({ gear, evidence, events }: PrepareRepairPacketProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const view = warrantyView(gear);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) close();
  };

  return (
    <>
      <button type="button" className="btn btn--primary" onClick={open}>
        <Icon name="package" size={16} />
        Prepare repair packet
      </button>

      <dialog
        ref={dialogRef}
        className="sheet"
        aria-labelledby="packet-title"
        onClick={onBackdropClick}
      >
        <div className="sheet__head">
          <div>
            <h2 id="packet-title" className="sheet__title">
              Repair packet
            </h2>
            <p className="sheet__subtitle">{gear.name}</p>
          </div>
          <button type="button" className="sheet__close" onClick={close} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>

        <p className="sheet__lede">
          This is what would be bundled if you sent the {gear.model ?? gear.name} in for a repair. Nothing
          leaves this device in this build.
        </p>

        <div className="sheet__group">
          <h3 className="sheet__groupTitle">Identity</h3>
          <ul className="sheet__list">
            <li>
              <span>Model</span>
              <span>{gear.model ?? gear.name}</span>
            </li>
            <li>
              <span>Serial</span>
              <span className="mono">{maskSerial(gear.serialNumber)}</span>
            </li>
          </ul>
        </div>

        <div className="sheet__group">
          <h3 className="sheet__groupTitle">Proof of purchase</h3>
          <ul className="sheet__list">
            <li>
              <span>Seller</span>
              <span>{gear.seller ?? "Not recorded"}</span>
            </li>
            <li>
              <span>Purchased</span>
              <span>{formatDate(gear.purchaseDate)}</span>
            </li>
            <li>
              <span>Price</span>
              <span>{formatMoney(gear.purchasePrice, gear.currency)}</span>
            </li>
          </ul>
        </div>

        <div className="sheet__group">
          <h3 className="sheet__groupTitle">Warranty</h3>
          <ul className="sheet__list">
            <li>
              <span>Status</span>
              <span>{view.label}</span>
            </li>
            <li>
              <span>Cover ends</span>
              <span>{formatDate(gear.warrantyEnd)}</span>
            </li>
          </ul>
        </div>

        <div className="sheet__group">
          <h3 className="sheet__groupTitle">
            Attached files and history ({evidence.length + events.length})
          </h3>
          {evidence.length + events.length === 0 ? (
            <p className="empty">Nothing attached yet.</p>
          ) : (
            <ul className="sheet__list">
              {evidence.map((item) => (
                <li key={item.id}>
                  <span>{item.originalName}</span>
                  <span>File</span>
                </li>
              ))}
              {events.map((event) => (
                <li key={event.id}>
                  <span>{event.title}</span>
                  <span>{formatDate(event.occurredOn)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sheet__foot">
          <p className="sheet__note">
            Export and printing arrive in a later build. Manual entry still works if you close this.
          </p>
          <button type="button" className="btn" onClick={close}>
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
