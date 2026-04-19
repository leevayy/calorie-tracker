import type { DayPhase } from "./types.ts";

function parseLocalHm(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

/** Local wall-clock phase for tips (uses `localTimeHm` already in user zone). */
export function getDayPhaseFromLocalHm(localTimeHm: string): DayPhase {
  const { h } = parseLocalHm(localTimeHm);
  if (h >= 0 && h < 4) return "late_night";
  if (h < 12) return "morning";
  if (h < 17) return "day";
  return "evening";
}

/** Fraction of local calendar day elapsed at `localTimeHm` (0–1). */
export function fractionOfLocalDayElapsed(localTimeHm: string): number {
  const { h, m } = parseLocalHm(localTimeHm);
  return Math.min(1, Math.max(0, (h * 60 + m) / (24 * 60)));
}
