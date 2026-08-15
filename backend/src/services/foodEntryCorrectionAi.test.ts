import { afterEach, describe, expect, test, vi } from "vitest";
import { env } from "../env.ts";
import type { FoodEntryCorrectionClassifierInput } from "./foodEntryCorrection.ts";
import { classifyFoodEntryCorrectionWithAi } from "./foodEntryCorrectionAi.ts";

const originalConfig = {
  AI_MODEL_PREFERENCE: env.AI_MODEL_PREFERENCE,
  YANDEX_AI_STUDIO_API_KEY: env.YANDEX_AI_STUDIO_API_KEY,
  YANDEX_FOLDER_ID: env.YANDEX_FOLDER_ID,
  YANDEX_AI_STUDIO_MODEL_QWEN3: env.YANDEX_AI_STUDIO_MODEL_QWEN3,
};

afterEach(() => {
  Object.assign(env, originalConfig);
  vi.unstubAllGlobals();
});

describe("food entry correction AI adapter", () => {
  test("uses the server-selected model and sends structured current-entry context", async () => {
    env.AI_MODEL_PREFERENCE = "qwen3";
    env.YANDEX_AI_STUDIO_API_KEY = "test-api-key";
    env.YANDEX_FOLDER_ID = "test-folder";
    env.YANDEX_AI_STUDIO_MODEL_QWEN3 = "server-qwen";

    let requestBody: Record<string, unknown> | undefined;
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      requestBody = JSON.parse(String(init.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Result: {"kind":"scale","factor":2}' } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const input: FoodEntryCorrectionClassifierInput = {
      current: {
        name: "Oatmeal",
        portion: "1 bowl",
        calories: 320,
        protein: 14,
        carbs: 52,
        fats: 7,
        fiber: 8,
        day: "2026-08-15",
        mealType: "breakfast",
      },
      instruction: "Double the calories",
      preferredLanguage: "en",
    };

    await expect(classifyFoodEntryCorrectionWithAi(input)).resolves.toEqual({
      kind: "scale",
      factor: 2,
    });
    expect(requestBody?.model).toBe("gpt://test-folder/server-qwen");
    const messages = requestBody?.messages as Array<{ role: string; content: string }>;
    expect(JSON.parse(messages[1]?.content ?? "null")).toEqual(input);
  });
});
