import { useEffect, useState } from "react";

type TypewriterPhase = "typing" | "holding" | "deleting" | "waiting" | "reduced";

type TypewriterPlaceholder = {
  text: string;
  suggestion: string;
  phase: TypewriterPhase;
};

type TypewriterState = {
  suggestionIndex: number;
  characterCount: number;
  phase: Exclude<TypewriterPhase, "reduced">;
};

const TYPE_DELAY_MS = 75;
const HOLD_DELAY_MS = 1_400;
const DELETE_DELAY_MS = 35;
const BETWEEN_SUGGESTIONS_DELAY_MS = 250;

function initialState(suggestions: readonly string[]): TypewriterState {
  return {
    suggestionIndex: 0,
    characterCount: suggestions[0] ? 1 : 0,
    phase: "typing",
  };
}

export function useTypewriterPlaceholder(
  suggestions: readonly string[],
): TypewriterPlaceholder {
  const [state, setState] = useState<TypewriterState>(() => initialState(suggestions));
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return undefined;
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.("change", updatePreference);
    return () => media.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    setState(initialState(suggestions));
  }, [suggestions]);

  useEffect(() => {
    if (prefersReducedMotion || suggestions.length === 0) return undefined;

    const suggestion = suggestions[state.suggestionIndex % suggestions.length] ?? "";
    const characters = Array.from(suggestion);
    let delay = TYPE_DELAY_MS;
    let advance: () => void;

    if (state.phase === "typing") {
      advance = () => setState((current) => {
        const nextCount = Math.min(current.characterCount + 1, characters.length);
        return {
          ...current,
          characterCount: nextCount,
          phase: nextCount >= characters.length ? "holding" : "typing",
        };
      });
    } else if (state.phase === "holding") {
      delay = HOLD_DELAY_MS;
      advance = () => setState((current) => ({ ...current, phase: "deleting" }));
    } else if (state.phase === "deleting") {
      delay = DELETE_DELAY_MS;
      advance = () => setState((current) => {
        const nextCount = Math.max(0, current.characterCount - 1);
        return {
          ...current,
          characterCount: nextCount,
          phase: nextCount === 0 ? "waiting" : "deleting",
        };
      });
    } else {
      delay = BETWEEN_SUGGESTIONS_DELAY_MS;
      advance = () => setState((current) => ({
        suggestionIndex: (current.suggestionIndex + 1) % suggestions.length,
        characterCount: 1,
        phase: "typing",
      }));
    }

    const timeoutId = window.setTimeout(advance, delay);
    return () => window.clearTimeout(timeoutId);
  }, [prefersReducedMotion, state, suggestions]);

  const suggestion = suggestions[state.suggestionIndex % Math.max(1, suggestions.length)] ?? "";
  if (prefersReducedMotion) {
    return { text: suggestions[0] ?? "", suggestion: suggestions[0] ?? "", phase: "reduced" };
  }

  return {
    text: Array.from(suggestion).slice(0, state.characterCount).join(""),
    suggestion,
    phase: state.phase,
  };
}
