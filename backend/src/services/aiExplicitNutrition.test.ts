import { afterEach, describe, expect, test, vi } from "vitest";
import { env } from "../env.ts";
import { parseFoodTextWithAi } from "./ai.ts";

const originalConfig = {
  YANDEX_AI_STUDIO_API_KEY: env.YANDEX_AI_STUDIO_API_KEY,
  YANDEX_FOLDER_ID: env.YANDEX_FOLDER_ID,
};

afterEach(() => {
  Object.assign(env, originalConfig);
  vi.unstubAllGlobals();
});

describe("production food parser adapter", () => {
  test("preserves every explicit nutrition literal returned by the provider", async () => {
    env.YANDEX_AI_STUDIO_API_KEY = "test-api-key";
    env.YANDEX_FOLDER_ID = "test-folder";
    vi.stubGlobal("fetch", async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  foods: [
                    {
                      name: "Literal trail mix",
                      estimated_portion: "37 g",
                      nutrients: [
                        { name: "calories", amount: 913, unit: "kcal" },
                        { name: "protein", amount: 17, unit: "g" },
                        { name: "carbohydrates", amount: 23, unit: "g" },
                        { name: "fat", amount: 29, unit: "g" },
                        { name: "fiber", amount: 31, unit: "g" },
                      ],
                      meal_slug: "literal-trail-mix",
                      log_day: "2026-08-16",
                      meal_type: "snack",
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      parseFoodTextWithAi(
        "Literal trail mix, portion 37 g, 913 calories, 17 g protein, 23 g carbs, 29 g fat, 31 g fiber",
        "en",
        "maintain",
        "qwen3",
        {
          localDate: "2026-08-16",
          localTimeHm: "12:00",
          clientTimeZone: "UTC",
          defaultLogDay: "2026-08-16",
          defaultMealType: "lunch",
        },
        { skipCache: true },
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        name: "Literal trail mix",
        portion: "37 g",
        calories: 913,
        protein: 17,
        carbs: 23,
        fats: 29,
        fiber: 31,
      }),
    ]);
  });
});
