import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import type { Gear, GearInput } from "../types";
import { Icon } from "./Icon";

const CATEGORIES = ["Camera body", "Lens", "Flash", "Light", "Tripod", "Audio", "Bag", "Other"];

interface FormState {
  name: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  purchasePrice: string;
  currency: string;
  seller: string;
  warrantyStart: string;
  warrantyEnd: string;
  warrantyConfirmed: boolean;
  warrantyTerms: string;
  notes: string;
}

function toForm(gear: Gear | null, preset: Partial<GearInput> | null): FormState {
  return {
    name: preset?.name ?? gear?.name ?? "",
    category: preset?.category ?? gear?.category ?? "Camera body",
    brand: preset?.brand ?? gear?.brand ?? "",
    model: preset?.model ?? gear?.model ?? "",
    serialNumber: preset?.serialNumber ?? gear?.serialNumber ?? "",
    purchaseDate: preset?.purchaseDate ?? gear?.purchaseDate ?? "",
    purchasePrice:
      preset?.purchasePrice != null
        ? String(preset.purchasePrice)
        : gear?.purchasePrice != null
          ? String(gear.purchasePrice)
          : "",
    currency: preset?.currency ?? gear?.currency ?? "USD",
    seller: preset?.seller ?? gear?.seller ?? "",
    warrantyStart: preset?.warrantyStart ?? gear?.warrantyStart ?? "",
    warrantyEnd: preset?.warrantyEnd ?? gear?.warrantyEnd ?? "",
    warrantyConfirmed: preset?.warrantyConfirmed ?? gear?.warrantyConfirmed ?? false,
    warrantyTerms: preset?.warrantyTerms ?? gear?.warrantyTerms ?? "",
    notes: preset?.notes ?? gear?.notes ?? "",
  };
}

function toInput(form: FormState): GearInput {
  const hasDates = Boolean(form.warrantyStart || form.warrantyEnd);
  return {
    name: form.name.trim(),
    category: form.category.trim(),
    brand: form.brand.trim() || null,
    model: form.model.trim() || null,
    serialNumber: form.serialNumber.trim() || null,
    purchaseDate: form.purchaseDate || null,
    purchasePrice: form.purchasePrice.trim() ? Number(form.purchasePrice) : null,
    currency: form.currency.trim() || null,
    seller: form.seller.trim() || null,
    warrantyStart: form.warrantyStart || null,
    warrantyEnd: form.warrantyEnd || null,
    warrantyConfirmed: hasDates || form.warrantyConfirmed,
    warrantyTerms: form.warrantyTerms.trim() || null,
    notes: form.notes.trim() || null,
  };
}

function validate(form: FormState): string | null {
  if (!form.name.trim()) return "Give the gear a name.";
  if (!form.category.trim()) return "Choose a category.";
  const hasDates = Boolean(form.warrantyStart || form.warrantyEnd);
  if (hasDates && !form.warrantyConfirmed) {
    return "Tick the box to confirm you checked the warranty dates.";
  }
  if (form.warrantyStart && form.warrantyEnd && form.warrantyEnd < form.warrantyStart) {
    return "The warranty end date cannot be before the start date.";
  }
  if (form.purchasePrice.trim() && !Number.isFinite(Number(form.purchasePrice))) {
    return "The purchase price needs to be a number.";
  }
  return null;
}

interface GearEditorProps {
  gear: Gear | null;
  /** Values suggested by reading a receipt. The photographer reviews them here. */
  preset?: Partial<GearInput> | null;
  busy: boolean;
  onClose: () => void;
  /**
   * Saves the record and resolves with the failure to show in this sheet, or
   * `null` on success so the sheet can close. Failures have to surface here:
   * a toast sits behind a modal `<dialog>` and cannot be seen.
   */
  onSubmit: (input: GearInput) => Promise<string | null>;
}

export function GearEditor({ gear, preset = null, busy, onClose, onSubmit }: GearEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<FormState>(() => toForm(gear, preset));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current && !busy) onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    const failure = await onSubmit(toInput(form));
    if (failure) setError(failure);
  };

  const title = gear ? "Edit gear record" : "New gear record";

  return (
    <dialog
      ref={dialogRef}
      className="sheet sheet--form"
      aria-labelledby="gear-editor-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={onBackdropClick}
    >
      <form className="form" onSubmit={handleSubmit}>
        <div className="sheet__head">
          <div>
            <h2 id="gear-editor-title" className="sheet__title">
              {title}
            </h2>
            <p className="sheet__subtitle">
              {preset
                ? "These come from the receipt you read. Check each one, then save."
                : "You type everything in; nothing is guessed."}
            </p>
          </div>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Close" disabled={busy}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="form__body">
          <div className="form__row">
            <label className="field field--grow">
              <span className="field__label">Name</span>
              <input
                className="field__input"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="Canon EOS R6 Mark II"
                required
              />
            </label>
            <label className="field">
              <span className="field__label">Category</span>
              <input
                className="field__input"
                list="gear-categories"
                value={form.category}
                onChange={(event) => set("category", event.target.value)}
              />
              <datalist id="gear-categories">
                {CATEGORIES.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="form__row">
            <label className="field field--grow">
              <span className="field__label">Brand</span>
              <input
                className="field__input"
                value={form.brand}
                onChange={(event) => set("brand", event.target.value)}
              />
            </label>
            <label className="field field--grow">
              <span className="field__label">Model</span>
              <input
                className="field__input"
                value={form.model}
                onChange={(event) => set("model", event.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span className="field__label">Serial number</span>
            <input
              className="field__input"
              value={form.serialNumber}
              onChange={(event) => set("serialNumber", event.target.value)}
              placeholder="Stored locally, shown masked"
            />
          </label>

          <fieldset className="form__group">
            <legend className="form__legend">Purchase</legend>
            <div className="form__row">
              <label className="field">
                <span className="field__label">Date</span>
                <input
                  type="date"
                  className="field__input"
                  value={form.purchaseDate}
                  onChange={(event) => set("purchaseDate", event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Price</span>
                <input
                  className="field__input"
                  inputMode="decimal"
                  value={form.purchasePrice}
                  onChange={(event) => set("purchasePrice", event.target.value)}
                  placeholder="2499"
                />
              </label>
              <label className="field field--narrow">
                <span className="field__label">Currency</span>
                <input
                  className="field__input"
                  value={form.currency}
                  onChange={(event) => set("currency", event.target.value)}
                  maxLength={4}
                />
              </label>
            </div>
            <label className="field">
              <span className="field__label">Seller</span>
              <input
                className="field__input"
                value={form.seller}
                onChange={(event) => set("seller", event.target.value)}
                placeholder="B&H Photo Video"
              />
            </label>
          </fieldset>

          <fieldset className="form__group">
            <legend className="form__legend">Warranty</legend>
            <div className="form__row">
              <label className="field">
                <span className="field__label">Starts</span>
                <input
                  type="date"
                  className="field__input"
                  value={form.warrantyStart}
                  onChange={(event) => set("warrantyStart", event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Ends</span>
                <input
                  type="date"
                  className="field__input"
                  value={form.warrantyEnd}
                  onChange={(event) => set("warrantyEnd", event.target.value)}
                />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={form.warrantyConfirmed}
                onChange={(event) => set("warrantyConfirmed", event.target.checked)}
              />
              <span>I checked these dates against the paperwork.</span>
            </label>
            <label className="field">
              <span className="field__label">Terms</span>
              <textarea
                className="field__input field__input--area"
                value={form.warrantyTerms}
                onChange={(event) => set("warrantyTerms", event.target.value)}
                rows={2}
              />
            </label>
          </fieldset>

          <label className="field">
            <span className="field__label">Notes</span>
            <textarea
              className="field__input field__input--area"
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              rows={2}
            />
          </label>

          {error ? <p className="form__error">{error}</p> : null}
        </div>

        <div className="sheet__foot">
          <p className="sheet__note">Dates stay blank until you enter and confirm them.</p>
          <div className="form__actions">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? "Saving…" : gear ? "Save changes" : "Create record"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
