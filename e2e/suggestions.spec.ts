import type { Page, Request, Response } from "@playwright/test";
import {
  expect,
  isolatedTestUser,
  loginThroughSetup,
  test,
  type E2EControlClient,
  type E2ESeedEntry,
} from "./support/fixtures";

const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
} as const;

type MealType = keyof typeof MEAL_LABELS;

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function behavioralToday(page: Page): Promise<string> {
  return page.evaluate(() => {
    const date = new Date();
    if (date.getUTCHours() < 4) date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  });
}

function seedEntry(
  day: string,
  name: string,
  calories: number,
  overrides: Partial<E2ESeedEntry> = {},
): E2ESeedEntry {
  return {
    day,
    mealType: "breakfast",
    name,
    calories,
    protein: 12,
    carbs: 18,
    fats: 4,
    fiber: 2,
    portion: "170 g",
    mealSlug: name.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, ""),
    ...overrides,
  };
}

async function seedAndLogin(
  page: Page,
  e2eControls: E2EControlClient,
  entries: E2ESeedEntry[],
) {
  const user = isolatedTestUser({ entries });
  await e2eControls.reset([user]);
  await loginThroughSetup(page, user);
  return user;
}

async function openFoodComposer(page: Page) {
  await page.getByRole("button", { name: /Log food/ }).click();
  const input = page.getByPlaceholder(/Log food/);
  await expect(input).toBeVisible();
  return input;
}

function suggestionList(page: Page) {
  return page.getByRole("listbox", { name: "Previously logged" });
}

function mealButton(page: Page, mealType: MealType, calories?: number) {
  const caloriePattern = calories === undefined ? ".*" : `.*${calories} cal`;
  return page.getByRole("button", {
    name: new RegExp(`^${MEAL_LABELS[mealType]}\\b${caloriePattern}`),
  });
}

function isSuggestionRequest(request: Request): boolean {
  return new URL(request.url()).pathname === "/api/v1/food-suggestions";
}

test.describe("Historical food suggestions", () => {
  test("suggests historical foods with nutrition and usage context", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    await seedAndLogin(page, e2eControls, [
      seedEntry(addDays(today, -5), "Greek Yogurt", 150),
      seedEntry(addDays(today, -3), "Greek Yogurt", 150),
      seedEntry(addDays(today, -1), "Greek Yogurt", 150),
    ]);

    const input = await openFoodComposer(page);
    await input.fill("Greek");

    const list = suggestionList(page);
    await expect(list).toBeVisible();
    const option = list.getByRole("option", { name: /Greek Yogurt/ });
    await expect(option).toBeVisible();
    await expect(option).toContainText("170 g · 150 cal");
    await expect(option).toContainText("Used 3×");
    await expect(option).toContainText("Yesterday");
  });

  test("keeps same-name historical configurations distinct", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    await seedAndLogin(page, e2eControls, [
      seedEntry(addDays(today, -4), "Greek yogurt", 150, {
        portion: "170 g",
        protein: 15,
        mealSlug: "greek-yogurt",
      }),
      seedEntry(addDays(today, -2), "Greek yogurt", 260, {
        portion: "300 g",
        protein: 26,
        carbs: 30,
        mealSlug: "greek-yogurt",
      }),
    ]);

    const input = await openFoodComposer(page);
    await input.fill("Greek yogurt");

    const options = suggestionList(page).getByRole("option", { name: /Greek yogurt/ });
    await expect(options).toHaveCount(2);
    await expect(options.filter({ hasText: "170 g · 150 cal" })).toHaveCount(1);
    await expect(options.filter({ hasText: "300 g · 260 cal" })).toHaveCount(1);
  });

  test("ranks historical suggestions by relevance frequency and recency", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    await seedAndLogin(page, e2eControls, [
      seedEntry(addDays(today, -20), "Apple", 80),
      seedEntry(addDays(today, -12), "Apple frequent", 100),
      seedEntry(addDays(today, -11), "Apple frequent", 100),
      seedEntry(addDays(today, -10), "Apple frequent", 100),
      seedEntry(addDays(today, -8), "Apple old pair", 110),
      seedEntry(addDays(today, -7), "Apple old pair", 110),
      seedEntry(addDays(today, -2), "Apple recent pair", 120),
      seedEntry(addDays(today, -1), "Apple recent pair", 120),
      ...Array.from({ length: 5 }, (_, index) =>
        seedEntry(addDays(today, -6 + index), "Green apple", 90),
      ),
    ]);

    const input = await openFoodComposer(page);
    await input.fill("apple");
    const options = suggestionList(page).getByRole("option");
    await expect(options).toHaveCount(5);
    const names: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      names.push(await options.nth(index).locator("span").first().innerText());
    }

    expect(names).toEqual([
      "Apple",
      "Apple frequent",
      "Apple recent pair",
      "Apple old pair",
      "Green apple",
    ]);
  });

  test("reuses a stored suggestion on the selected day without an AI request", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    const selectedDay = addDays(today, -1);
    await seedAndLogin(page, e2eControls, [
      seedEntry(addDays(today, -8), "Stored porridge", 222, {
        portion: "250 g",
        protein: 9,
        carbs: 41,
        fats: 3,
        fiber: 6,
        mealSlug: "stored-porridge",
      }),
    ]);
    await e2eControls.setAiMode({ parseFood: "failure" });
    await page.getByRole("button", { name: "Previous day" }).click();

    const input = await openFoodComposer(page);
    await input.fill("Stored porridge");
    const option = suggestionList(page).getByRole("option", { name: /Stored porridge/ });
    await expect(option).toBeVisible();

    let parseRequests = 0;
    const countParseRequests = (request: Request) => {
      if (new URL(request.url()).pathname === "/api/v1/ai/parse-food") parseRequests += 1;
    };
    page.on("request", countParseRequests);
    const batchRequestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return request.method() === "POST" && url.pathname === "/api/v1/entries/batch";
    });
    await option.click();
    const batchRequest = await batchRequestPromise;
    await expect(page.getByText("Added 1", { exact: true })).toBeVisible();
    page.off("request", countParseRequests);

    expect(parseRequests).toBe(0);
    const batch = batchRequest.postDataJSON() as {
      entries: Array<{ day: string; mealType: MealType; name: string; calories: number; portion?: string }>;
    };
    expect(batch.entries).toEqual([
      expect.objectContaining({
        day: selectedDay,
        name: "Stored porridge",
        calories: 222,
        portion: "250 g",
      }),
    ]);

    const targetMeal = batch.entries[0]?.mealType;
    expect(targetMeal).toBeTruthy();
    await page.reload();
    await page.getByRole("button", { name: "Previous day" }).click();
    await mealButton(page, targetMeal as MealType).click();
    await expect(page.getByRole("button", { name: /Stored porridge.*222 cal/ })).toBeVisible();
    await expect(mealButton(page, targetMeal as MealType, 222)).toBeVisible();
  });

  test("debounces a large history and ignores stale suggestion responses", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    const bulkEntries = Array.from({ length: 300 }, (_, index) =>
      seedEntry(addDays(today, -1 - (index % 30)), `Bulk apple ${String(index).padStart(3, "0")}`, 50 + (index % 20)),
    );
    await seedAndLogin(page, e2eControls, [
      ...bulkEntries,
      seedEntry(addDays(today, -1), "Final banana", 123, {
        portion: "1 saved banana",
        mealSlug: "final-banana",
      }),
    ]);
    await e2eControls.delayNextHistoricalSuggestions(1_500);

    const input = await openFoodComposer(page);
    let suggestionRequests = 0;
    const countSuggestionRequests = (request: Request) => {
      if (isSuggestionRequest(request)) suggestionRequests += 1;
    };
    page.on("request", countSuggestionRequests);
    const responseOrder: string[] = [];
    const recordSuggestionResponse = (response: Response) => {
      const url = new URL(response.url());
      if (url.pathname !== "/api/v1/food-suggestions") return;
      const query = url.searchParams.get("query");
      if (query === "Bulk apple" || query === "Final banana") responseOrder.push(query);
    };
    page.on("response", recordSuggestionResponse);

    const firstRequestPromise = page.waitForRequest(
      (request) => isSuggestionRequest(request) && new URL(request.url()).searchParams.get("query") === "Bulk apple",
    );
    const firstResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/v1/food-suggestions" && url.searchParams.get("query") === "Bulk apple";
    });
    await input.fill("B");
    await page.waitForTimeout(50);
    await input.fill("Bulk");
    await page.waitForTimeout(50);
    await input.fill("Bulk apple");
    await firstRequestPromise;

    const finalResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/v1/food-suggestions" && url.searchParams.get("query") === "Final banana";
    });
    await input.fill("Final banana");
    await finalResponsePromise;
    expect(responseOrder).toEqual(["Final banana"]);
    await firstResponsePromise;
    expect(responseOrder).toEqual(["Final banana", "Bulk apple"]);

    const list = suggestionList(page);
    await expect(list.getByRole("option")).toHaveCount(1);
    await expect(list.getByRole("option", { name: /Final banana/ })).toBeVisible();
    await expect(list.getByRole("option", { name: /Bulk apple/ })).toHaveCount(0);
    await expect(input).toHaveValue("Final banana");
    expect(suggestionRequests).toBe(2);
    page.off("request", countSuggestionRequests);
    page.off("response", recordSuggestionResponse);
  });
});
