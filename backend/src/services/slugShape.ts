/** Pure shape helpers for meal slugs; safe to import from both AI and resolver code. */

const MAX_SLUG_LENGTH = 60;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Non-semantic last-resort normalizer used when AI is unavailable (offline / no API key / failure / tests).
 * Just lowercases, drops diacritics, and replaces non-`[a-z0-9]` runs with `-`. No keyword logic.
 */
export function normalizeSlugFallback(raw: string): string {
  const folded = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const collapsed = folded.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!collapsed) return "unknown";
  if (collapsed.length <= MAX_SLUG_LENGTH) return collapsed;
  return collapsed.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "") || "unknown";
}

/**
 * Coerce raw AI output into a clean slug. Returns null if nothing usable can be salvaged.
 * Trusts the model's intent; only enforces the structural slug shape.
 */
export function sanitizeMealSlug(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  const lastToken = text.split(/\s+/).pop() ?? "";
  const cleaned = lastToken
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!cleaned || cleaned.length > MAX_SLUG_LENGTH) return null;
  if (!SLUG_PATTERN.test(cleaned)) return null;
  return cleaned;
}
