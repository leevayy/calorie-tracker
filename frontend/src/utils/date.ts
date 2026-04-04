import type { MealType } from "@contracts/common";

/**
 * Guess which meal slot matches local wall time (browser timezone).
 * Breakfast 05:00–11:00, lunch 11:00–16:00, dinner 16:00–22:00, snack otherwise.
 */
export function defaultMealTypeForLocalTime(at: Date = new Date()): MealType {
  const h = at.getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 16 && h < 22) return "dinner";
  return "snack";
}

/** Local calendar day as YYYY-MM-DD */
export function localIsoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local wall time as HH:mm (24h) for the given instant in the browser's local zone. */
export function localTimeHm(d = new Date()): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** IANA time zone for the browser (falls back to UTC). */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
}

/** Parse YYYY-MM-DD as local Date at noon (avoid DST edge cases for display). */
export function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Add calendar days in the local time zone; `iso` is YYYY-MM-DD. */
export function addDaysLocal(iso: string, deltaDays: number): string {
  const d = parseIsoDateLocal(iso);
  d.setDate(d.getDate() + deltaDays);
  return localIsoDate(d);
}

/** Inclusive range of local calendar days; `from` and `to` are YYYY-MM-DD, `from <= to`. */
export function enumerateLocalIsoDatesInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  let current = from;
  while (current <= to) {
    out.push(current);
    current = addDaysLocal(current, 1);
  }
  return out;
}

/** Rolling 7-day window ending on `endIso` (inclusive), local calendar. */
export function weekRangeEndingOn(endIso: string): { from: string; to: string } {
  const end = parseIsoDateLocal(endIso);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { from: localIsoDate(start), to: endIso };
}
