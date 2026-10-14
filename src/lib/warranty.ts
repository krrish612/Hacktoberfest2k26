import type { Gear, WarrantyView } from "../types";

const DAY_MS = 86_400_000;

/** A warranty is "expiring soon" inside this many days of its end date. */
export const EXPIRING_WINDOW_DAYS = 60;

/**
 * Derives the warranty view for a gear record.
 *
 * A status is only ever reported from user-confirmed data. When the warranty
 * has not been confirmed, the result is `unknown` rather than a guessed date.
 */
export function warrantyView(gear: Gear, now: Date = new Date()): WarrantyView {
  if (!gear.warrantyConfirmed) {
    return { status: "unknown", label: "Not confirmed", daysRemaining: null, confirmed: false };
  }
  if (!gear.warrantyEnd) {
    return { status: "none", label: "No warranty recorded", daysRemaining: null, confirmed: true };
  }

  const end = new Date(`${gear.warrantyEnd}T00:00:00`);
  if (Number.isNaN(end.getTime())) {
    return { status: "unknown", label: "Not confirmed", daysRemaining: null, confirmed: false };
  }

  const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / DAY_MS);
  if (daysRemaining < 0) {
    return { status: "expired", label: "Expired", daysRemaining, confirmed: true };
  }
  if (daysRemaining <= EXPIRING_WINDOW_DAYS) {
    return { status: "expiring", label: "Expiring soon", daysRemaining, confirmed: true };
  }
  return { status: "active", label: "Active", daysRemaining, confirmed: true };
}
