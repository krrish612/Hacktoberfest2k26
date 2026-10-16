import { useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { api, runningInTauri } from "../lib/api";
import { pickSaveZip } from "../lib/dialog";
import { formatBytes, formatDate, formatMoney, maskSerial } from "../lib/format";
import { warrantyView } from "../lib/warranty";
import type { Evidence, EvidenceKind, Gear, PacketInfo, TimelineEvent, TimelineEventKind } from "../types";
import { Icon } from "./Icon";

interface PrepareRepairPacketProps {
  gear: Gear;
  evidence: Evidence[];
  events: TimelineEvent[];
}

type Phase = "review" | "saving" | "done" | "error";

const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  receipt: "Receipt",
  warranty: "Warranty",
  serial_photo: "Serial photo",
  other: "File",
};

const EVENT_LABELS: Record<TimelineEventKind, string> = {
  purchase: "Purchase",
  warranty_start: "Warranty start",
  warranty_end: "Warranty end",
  repair: "Repair",
  inspection: "Inspection",
  transfer: "Transfer",
  note: "Note",
};

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function slug(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || "gear";
}

export function PrepareRepairPacket({ gear, evidence, events }: PrepareRepairPacketProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const view = warrantyView(gear);

  const [excludedEvidence, setExcludedEvidence] = useState<Set<string>>(new Set());
  const [excludedEvents, setExcludedEvents] = useState<Set<string>>(new Set());
  const [includeSerial, setIncludeSerial] = useState(false);
  const [phase, setPhase] = useState<Phase>("review");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PacketInfo | null>(null);

  const selectedEvidence = useMemo(
    () => evidence.filter((item) => !excludedEvidence.has(item.id)),
    [evidence, excludedEvidence],
  );
  const selectedEvents = useMemo(
    () => events.filter((event) => !excludedEvents.has(event.id)),
    [events, excludedEvents],
  );

  const busy = phase === "saving";
  const nothingSelected = selectedEvidence.length === 0 && selectedEvents.length === 0;

  const open = () => {
    setExcludedEvidence(new Set());
    setExcludedEvents(new Set());
    setIncludeSerial(false);
    setPhase("review");
    setError(null);
    setResult(null);
    dialogRef.current?.showModal();
  };

  const close = () => {
    if (!busy) dialogRef.current?.close();
  };

  const toggle = (
    id: string,
    setter: (updater: (current: Set<string>) => Set<string>) => void,
  ) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setError(null);
    const dest = await pickSaveZip(`repair-packet-${slug(gear.model ?? gear.name)}.zip`);
    if (!dest) return;
    setPhase("saving");
    try {
      const info = await api.exportRepairPacket(
        gear.id,
        selectedEvidence.map((item) => item.id),
        selectedEvents.map((event) => event.id),
        includeSerial,
        dest,
      );
      setResult(info);
      setPhase("done");
    } catch (caught) {
      setError(messageOf(caught));
      setPhase("error");
    }
  };

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
        className="sheet sheet--form"
        aria-labelledby="packet-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={onBackdropClick}
      >
        <div className="sheet__head">
          <div>
            <h2 id="packet-title" className="sheet__title">
              Repair packet
            </h2>
            <p className="sheet__subtitle">{gear.name}</p>
          </div>
          <button
            type="button"
            className="sheet__close"
            onClick={close}
            aria-label="Close"
            disabled={busy}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="form__body">
          {phase === "done" && result ? (
            <>
              <p className="sheet__lede">
                The packet is saved. Copies of the originals are still in the app; nothing was moved or
                deleted.
              </p>
              <ul className="sheet__list">
                <li>
                  <span>Saved to</span>
                  <span className="mono path">{result.path}</span>
                </li>
                <li>
                  <span>Size</span>
                  <span>{formatBytes(result.byteSize)}</span>
                </li>
                <li>
                  <span>Files included</span>
                  <span>{result.fileCount}</span>
                </li>
                <li>
                  <span>Serial number</span>
                  <span>{result.includedSerial ? "Full serial included" : "Masked"}</span>
                </li>
              </ul>
            </>
          ) : (
            <>
              <p className="sheet__lede">
                Choose what goes into the packet. It is written to a file you pick on this device, and
                nothing is uploaded.
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
                {gear.serialNumber ? (
                  <label className="check packet__optin">
                    <input
                      type="checkbox"
                      checked={includeSerial}
                      disabled={busy}
                      onChange={(event) => setIncludeSerial(event.target.checked)}
                    />
                    <span>Include the full serial number</span>
                  </label>
                ) : null}
                {includeSerial ? (
                  <p className="check__hint">
                    The full serial number will appear in the report. Leave this off unless the repair shop
                    needs it.
                  </p>
                ) : null}
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
                <h3 className="sheet__groupTitle">Files ({selectedEvidence.length} of {evidence.length})</h3>
                {evidence.length === 0 ? (
                  <p className="empty">No files attached yet.</p>
                ) : (
                  <div className="checklist">
                    {evidence.map((item) => (
                      <label key={item.id} className="check">
                        <input
                          type="checkbox"
                          checked={!excludedEvidence.has(item.id)}
                          disabled={busy}
                          onChange={() => toggle(item.id, setExcludedEvidence)}
                        />
                        <span>{item.originalName}</span>
                        <span className="check__meta">{EVIDENCE_LABELS[item.kind]}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="sheet__group">
                <h3 className="sheet__groupTitle">History ({selectedEvents.length} of {events.length})</h3>
                {events.length === 0 ? (
                  <p className="empty">No history entries yet.</p>
                ) : (
                  <div className="checklist">
                    {events.map((event) => (
                      <label key={event.id} className="check">
                        <input
                          type="checkbox"
                          checked={!excludedEvents.has(event.id)}
                          disabled={busy}
                          onChange={() => toggle(event.id, setExcludedEvents)}
                        />
                        <span>{event.title}</span>
                        <span className="check__meta">
                          {EVENT_LABELS[event.kind]} · {formatDate(event.occurredOn)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {error ? <p className="form__error">{error}</p> : null}
            </>
          )}
        </div>

        <div className="sheet__foot">
          {phase === "done" ? (
            <>
              <p className="sheet__note">Keep the copy safe; it holds originals from this device.</p>
              <button type="button" className="btn" onClick={close}>
                Close
              </button>
            </>
          ) : (
            <>
              <p className="sheet__note">
                {runningInTauri
                  ? "Copies are made from the originals. Nothing is moved or deleted."
                  : "Saving runs in the desktop app. This is a browser preview with nothing on disk."}
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void save()}
                disabled={busy || nothingSelected || !runningInTauri}
              >
                <Icon name="package" size={15} />
                {busy ? "Writing the packet…" : "Save packet…"}
              </button>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
