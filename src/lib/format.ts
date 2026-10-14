const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** Formats a price for display, or a plain phrase when nothing was recorded. */
export function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null) return "Not recorded";
  const code = currency ?? "USD";
  let formatter = moneyFormatters.get(code);
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    });
    moneyFormatters.set(code, formatter);
  }
  return formatter.format(amount);
}

/** Formats an ISO `yyyy-mm-dd` date for display, or a plain phrase when absent. */
export function formatDate(iso: string | null): string {
  if (!iso) return "Not recorded";
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

/**
 * Masks all but the last four characters of a serial number so the full
 * identifier is never shown on screen. Groups of four keep it readable.
 */
export function maskSerial(serial: string | null): string {
  if (!serial) return "Not recorded";
  const compact = serial.replace(/\s+/g, "");
  if (compact.length <= 4) return compact;
  const visible = compact.slice(-4);
  const hidden = "•".repeat(compact.length - 4);
  return `${hidden}${visible}`.replace(/(.{4})/g, "$1 ").trim();
}

/** Formats a byte count as a short human-readable size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

/** Formats a duration in days as a short phrase. */
export function describeDays(days: number): string {
  const abs = Math.abs(days);
  const label = abs === 1 ? "day" : "days";
  return days < 0 ? `${abs} ${label} ago` : `${abs} ${label}`;
}
