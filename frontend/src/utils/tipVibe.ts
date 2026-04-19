import emojiData from "react-apple-emojis/src/data.json";
import type { TipVibeSlot } from "@contracts/common";

export type PresetTipVibeSlot = Exclude<TipVibeSlot, "custom">;

export type TipVibeTileDef =
  | { slot: PresetTipVibeSlot; emoji: string; appleName: string; labelKey: string }
  | { slot: "custom"; emoji: null; appleName: null; labelKey: string };

/** Tiles in display order (left → right). */
export const TIP_VIBE_TILES: TipVibeTileDef[] = [
  { slot: "toxic",   emoji: "😡", appleName: "pouting-face",  labelKey: "settings.tipVibe.toxic" },
  { slot: "gymBro",  emoji: "💪", appleName: "flexed-biceps", labelKey: "settings.tipVibe.gymBro" },
  { slot: "caveman", emoji: "🗿", appleName: "moai",          labelKey: "settings.tipVibe.caveman" },
  { slot: "custom",  emoji: null, appleName: null,            labelKey: "settings.tipVibe.custom" },
];

/**
 * Default English vibe prompts shown prefilled in the dialog and stored if the user submits unchanged.
 * MUST stay in sync with `backend/src/services/tips/vibePrompts.ts` (DEFAULT_TIP_VIBE_PROMPTS).
 */
export const DEFAULT_TIP_VIBE_PROMPTS: Record<PresetTipVibeSlot, string> = {
  toxic:
    "Adopt a TOXIC TOUGH-LOVE persona. Bully and mock the user about their nutrition mistakes, prioritizing the BIGGEST deviations from goal first (massive calorie surplus, totally skipped logging, repeatedly very low protein, eating-window chaos). Use harsh sarcasm, biting insults, and zero validation. The vibe is a furious coach who is fed up. Insults must target the CHOICE/BEHAVIOR, never the person, their body, weight, looks, or worth. Still deliver ONE concrete next step (food/timing/macro fix) inside the same sentence.",
  gymBro:
    "Adopt a HYPE GYM-BRO persona. Talk like an over-caffeinated lifter: 'bro', 'bruh', 'lock in', 'we're cooking'. Casually drop a plausible-sounding but FAKE scientific citation (e.g. 'a 2021 Stanford meta-analysis showed', 'RP Strength data suggests', 'a recent JISSN paper found') to friendly-pressure the user into hitting their nutrition goal and logging meals consistently. Stay supportive, never demeaning. End with one concrete next move (a food, a macro tweak, or a log reminder).",
  caveman:
    "Adopt a CAVEMAN persona. Speak ONLY in broken 'ooga booga' caveman English: very short subject-verb-object fragments, no contractions, no articles, present tense, simple words. Examples: 'eat salad good.', 'overeat 200 cal bad.', 'you stop snack night.', 'meat make strong.'. Reference real numbers from the data when relevant. Still tied to the insight and one concrete next step.",
};

/**
 * Reverse-map any emoji character (e.g. "🏴‍☠️") to its `react-apple-emojis` slug.
 * Built once from the package's bundled `data.json`.
 */
const APPLE_NAME_BY_EMOJI: Map<string, string> = (() => {
  const map = new Map<string, string>();
  // The data.json filenames look like "pouting-face_1f621.png" or
  // "flag-pirate_1f3f4-200d-2620-fe0f.png" — codepoints joined by '-' after the slug.
  for (const [name, filename] of Object.entries((emojiData as { emojis: Record<string, string> }).emojis)) {
    const underscore = filename.lastIndexOf("_");
    const dot = filename.lastIndexOf(".");
    if (underscore < 0 || dot < 0 || dot < underscore) continue;
    const codeSpec = filename.slice(underscore + 1, dot);
    try {
      const chars = codeSpec.split("-").map((hex) => String.fromCodePoint(parseInt(hex, 16)));
      const emoji = chars.join("");
      if (emoji && !map.has(emoji)) map.set(emoji, name);
      // Also index without VS16 (\uFE0F) so AI-returned text without the variation selector still resolves.
      const stripped = emoji.replace(/\uFE0F/g, "");
      if (stripped && !map.has(stripped)) map.set(stripped, name);
    } catch {
      // ignore unparseable entries
    }
  }
  return map;
})();

/** Returns the `react-apple-emojis` slug for an emoji character, or null if not found. */
export function appleEmojiNameFor(emoji: string | null | undefined): string | null {
  if (!emoji) return null;
  return APPLE_NAME_BY_EMOJI.get(emoji) ?? APPLE_NAME_BY_EMOJI.get(emoji.replace(/\uFE0F/g, "")) ?? null;
}

/**
 * Given the user's saved tipVibeEmoji, find which tile (preset or custom) is currently active.
 * Returns null when no vibe is set.
 */
export function activeTipVibeSlot(
  tipVibeEmoji: string | null | undefined,
  tipVibePrompt: string,
): TipVibeSlot | null {
  if (!tipVibeEmoji || !tipVibePrompt.trim()) return null;
  const preset = TIP_VIBE_TILES.find(
    (tile): tile is Extract<TipVibeTileDef, { slot: PresetTipVibeSlot }> =>
      tile.slot !== "custom" && tile.emoji === tipVibeEmoji,
  );
  return preset ? preset.slot : "custom";
}
