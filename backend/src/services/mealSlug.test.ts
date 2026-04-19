import { describe, expect, it } from "vitest";
import {
  normalizeSlugFallback,
  resolveMealSlugFromLoggedName,
  sanitizeMealSlug,
} from "./mealSlug.ts";

describe("normalizeSlugFallback", () => {
  it("hyphenates lowercased latin words", () => {
    expect(normalizeSlugFallback("Grilled Chicken Sandwich")).toBe("grilled-chicken-sandwich");
  });

  it("collapses punctuation, spacing, and digits without semantic stripping", () => {
    expect(normalizeSlugFallback("Pizza  300g!!")).toBe("pizza-300g");
  });

  it("strips diacritics", () => {
    expect(normalizeSlugFallback("Café au lait")).toBe("cafe-au-lait");
  });

  it("returns 'unknown' for empty / non-latin-only input", () => {
    expect(normalizeSlugFallback("")).toBe("unknown");
    expect(normalizeSlugFallback("   ")).toBe("unknown");
    expect(normalizeSlugFallback("куриный сэндвич")).toBe("unknown");
  });
});

describe("sanitizeMealSlug", () => {
  it("accepts a clean slug verbatim", () => {
    expect(sanitizeMealSlug("chicken-sandwich-grilled")).toBe("chicken-sandwich-grilled");
  });

  it("lowercases and strips surrounding punctuation/quotes", () => {
    expect(sanitizeMealSlug('"Chicken-Sandwich".')).toBe("chicken-sandwich");
  });

  it("salvages the answer from a chatty response by taking the last token", () => {
    expect(sanitizeMealSlug("Sure! The slug is: turkey-burger")).toBe("turkey-burger");
  });

  it("rejects empty / too long / non-conforming output", () => {
    expect(sanitizeMealSlug("")).toBeNull();
    expect(sanitizeMealSlug("   ")).toBeNull();
    expect(sanitizeMealSlug("a".repeat(80))).toBeNull();
  });
});

describe("resolveMealSlugFromLoggedName", () => {
  it("uses the local fallback when AI is skipped", async () => {
    const slug = await resolveMealSlugFromLoggedName("Grilled Chicken Sandwich", {
      aiModelPreference: "qwen3",
      skipParse: true,
    });
    expect(slug).toBe("grilled-chicken-sandwich");
  });

  it("returns 'unknown' for empty input", async () => {
    const slug = await resolveMealSlugFromLoggedName("   ", {
      aiModelPreference: "qwen3",
      skipParse: true,
    });
    expect(slug).toBe("unknown");
  });
});
