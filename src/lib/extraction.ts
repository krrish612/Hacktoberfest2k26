import type { Extraction, GearInput } from "../types";

/**
 * Maps reviewed suggestions onto the fields the gear editor accepts. Only the
 * values the model actually read are set, so anything it left null keeps what
 * the photographer already typed. Warranty dates are never included: they are
 * entered and confirmed by hand.
 */
export function presetFromExtraction(extraction: Extraction): Partial<GearInput> {
  const values = new Map(extraction.fields.map((field) => [field.key, field.value]));
  const preset: Partial<GearInput> = {};

  const seller = values.get("seller");
  if (seller) preset.seller = seller;

  const item = values.get("item");
  if (item) {
    preset.name = item;
    preset.model = item;
  }

  const date = values.get("purchase_date");
  if (date) preset.purchaseDate = date;

  const price = values.get("price");
  if (price) {
    const amount = Number(price);
    if (Number.isFinite(amount)) preset.purchasePrice = amount;
  }

  const currency = values.get("currency");
  if (currency) preset.currency = currency.toUpperCase().slice(0, 4);

  const serial = values.get("serial_number");
  if (serial) preset.serialNumber = serial;

  const terms = values.get("warranty_terms");
  if (terms) preset.warrantyTerms = terms;

  return preset;
}

/** A short, plain word for a 0..1 confidence score. */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "Looks clear";
  if (confidence >= 0.5) return "Check this";
  return "Unsure";
}
