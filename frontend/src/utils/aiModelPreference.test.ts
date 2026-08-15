import { describe, expect, it } from "vitest";
import { AiModelPreferenceSchema } from "@contracts/common";
import { AI_MODEL_PREFERENCE_OPTIONS, coerceAiModelPreference } from "./aiModelPreference";

describe("AI model preferences", () => {
  it("exposes every supported model exactly once", () => {
    const optionValues = AI_MODEL_PREFERENCE_OPTIONS.map(({ value }) => value);

    expect(optionValues).toEqual([
      "alicegpt",
      "deepseek",
      "qwen36",
      "aliceflash",
      "qwen3",
      "gptoss120",
      "gptoss",
    ]);
    expect(new Set(optionValues).size).toBe(AiModelPreferenceSchema.options.length);
    expect(optionValues.every((value) => AiModelPreferenceSchema.safeParse(value).success)).toBe(true);
  });

  it("accepts new models and still falls back for unknown saved values", () => {
    expect(coerceAiModelPreference("qwen36")).toBe("qwen36");
    expect(coerceAiModelPreference("aliceflash")).toBe("aliceflash");
    expect(coerceAiModelPreference("gptoss120")).toBe("gptoss120");
    expect(coerceAiModelPreference("retired-model")).toBe("qwen3");
  });
});
