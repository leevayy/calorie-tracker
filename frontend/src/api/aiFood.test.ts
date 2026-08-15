import { afterEach, describe, expect, it, vi } from "vitest";
import { apiParseFood } from "./aiFood";
import { apiClient } from "./client";

const request = {
  text: "oatmeal",
  preferredLanguage: "en" as const,
  localDate: "2026-08-15",
  localTimeHm: "14:23",
  clientTimeZone: "Europe/Moscow",
  defaultLogDay: "2026-08-15",
  defaultMealType: "lunch" as const,
};

const suggestion = {
  name: "Oatmeal",
  calories: 250,
  protein: 8,
  carbs: 42,
  fats: 6,
  fiber: 5,
  portion: "1 bowl",
};

describe("apiParseFood", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a legacy response without a resolved log day and meal", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({
      status: 200,
      data: { suggestions: [suggestion] },
    });

    await expect(apiParseFood(request)).rejects.toMatchObject({
      messageKey: "errors.invalidResponse",
    });
  });

  it("preserves the resolved log target from a valid response", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({
      status: 200,
      data: {
        suggestions: [
          {
            ...suggestion,
            day: "2026-08-14",
            mealType: "dinner",
          },
        ],
      },
    });

    await expect(apiParseFood(request)).resolves.toMatchObject({
      suggestions: [
        {
          day: "2026-08-14",
          mealType: "dinner",
        },
      ],
    });
  });
});
