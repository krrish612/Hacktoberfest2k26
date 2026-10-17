const moneyFormatters = new Map<string, (amount: number) => string>();

/**
 * Builds a price formatter for `code`. An unknown or short currency code is
 * never an error: `Intl.NumberFormat` rejects those outright, so they fall back
 * to a plain number with the code written after it.
 */
function buildFormatter(code: string): (amount: number) => string {
  try {
    const style = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    });
    return (amount) => style.format(amount);
  } catch {
    const plain = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    return (amount) => `${plain.format(amount)} ${code}`;
  }
}

/** Formats a price for display, or a plain phrase when nothing was recorded. */
export function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null) return "Not recorded";
  const trimmed = currency?.trim().toUpperCase() ?? "";
  const code = trimmed || "USD";
  let formatter = moneyFormatters.get(code);
  if (!formatter) {
    formatter = buildFormatter(code);
    moneyFormatters.set(code, formatter);
  }
  return formatter(amount);
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
 * identifier is never shown on screen. A serial with four or fewer characters
 * is masked entirely; groups of four keep longer ones readable.
 */
export function maskSerial(serial: string | null): string {
  if (!serial) return "Not recorded";
  const compact = serial.replace(/\s+/g, "");
  if (!compact) return "Not recorded";
  const visible = compact.length > 4 ? compact.slice(-4) : "";
  const hidden = "•".repeat(compact.length - visible.length);
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
