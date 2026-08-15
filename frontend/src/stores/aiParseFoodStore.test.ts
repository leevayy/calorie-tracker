import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParseFoodRequest, ParseFoodResponse } from "@contracts/ai-food";
import { AiParseFoodStore } from "./aiParseFoodStore";

const api = vi.hoisted(() => ({ apiParseFood: vi.fn() }));
vi.mock("@/api/aiFood", () => api);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const request: ParseFoodRequest = {
  text: "oats",
  preferredLanguage: "en",
  localDate: "2026-08-15",
  localTimeHm: "12:00",
  clientTimeZone: "Europe/Moscow",
  defaultLogDay: "2026-08-15",
  defaultMealType: "lunch",
};

const response: ParseFoodResponse = {
  suggestions: [{
    name: "Oats",
    calories: 320,
    protein: 12,
    carbs: 50,
    fats: 8,
    fiber: 7,
    portion: "1 bowl",
    day: "2026-08-15",
    mealType: "lunch",
  }],
};

beforeEach(() => vi.clearAllMocks());

describe("AiParseFoodStore", () => {
  it("keeps independent consecutive parses in flight", async () => {
    const first = deferred<ParseFoodResponse>();
    const second = deferred<ParseFoodResponse>();
    api.apiParseFood.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const store = AiParseFoodStore.create({});

    const firstParse = store.parse(request);
    const secondParse = store.parse({ ...request, text: "banana" });

    expect(api.apiParseFood).toHaveBeenCalledTimes(2);
    expect(store.isLoading).toBe(true);
    first.resolve(response);
    second.resolve(response);
    await Promise.all([firstParse, secondParse]);
    expect(store.isLoading).toBe(false);
  });
});
