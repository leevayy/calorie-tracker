import { afterEach, describe, expect, it, vi } from "vitest";
import { apiCorrectFoodEntry, apiParseFood } from "./aiFood";
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

describe("apiCorrectFoodEntry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a complete validated draft without persisting it client-side", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({
      status: 200,
      data: {
        draft: {
          name: "Oatmeal",
          portion: "2 bowls",
          calories: 500,
          protein: 16,
          carbs: 84,
          fats: 12,
          fiber: 10,
          day: "2026-08-15",
          mealType: "breakfast",
        },
      },
    });

    await expect(apiCorrectFoodEntry("entry-1", {
      instruction: "double it",
      preferredLanguage: "en",
    })).resolves.toMatchObject({ draft: { calories: 500, protein: 16, fiber: 10 } });
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/ai/entries/entry-1/correction",
      { instruction: "double it", preferredLanguage: "en" },
    );
  });

  it("maps an ambiguous correction to a recoverable editor error", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({ status: 422, data: {} });

    await expect(apiCorrectFoodEntry("entry-1", {
      instruction: "make it better",
      preferredLanguage: "en",
    })).rejects.toMatchObject({ messageKey: "errors.correction_unactionable", status: 422 });
  });
});
