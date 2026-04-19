import { TIP_MAX_CHARS } from "./constants.ts";

export function takeFirstSentence(text: string): string {
  const t = text.trim();
  const m = t.match(/^[\s\S]+?[.!?](?=\s|$)/);
  return m ? m[0].trim() : t;
}

export function validateAndClampTipText(raw: string): string {
  let t = takeFirstSentence(raw).replace(/\s+/g, " ").trim();
  if (!t) return t;
  if (t.length > TIP_MAX_CHARS) {
    t = `${t.slice(0, TIP_MAX_CHARS - 1).trimEnd()}…`;
  }
  return t;
}
