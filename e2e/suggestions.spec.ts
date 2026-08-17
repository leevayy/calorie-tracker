import type { Page, Request, Response } from "@playwright/test";
import {
  expect,
  isolatedTestUser,
  loginThroughSetup,
  test,
  type E2EControlClient,
  type E2ESeedEntry,
} from "./support/fixtures";
import { openAdaptiveFoodComposer, usesDesktopWorkspace } from "./support/adaptiveComposer";

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

const openFoodComposer = openAdaptiveFoodComposer;

function suggestionList(page: Page) {
  return page.getByRole("listbox", { name: "Previous entries" });
}

function mealButton(page: Page, mealType: MealType, calories?: number) {
  if (usesDesktopWorkspace(page)) {
    return page.getByRole("region", { name: MEAL_LABELS[mealType], exact: true })
      .getByRole("button", { name: MEAL_LABELS[mealType], exact: true });
  }
  const caloriePattern = calories === undefined ? ".*" : `.*${calories}\\s+kcal`;
  return page.getByRole("button", {
    name: new RegExp(`^${MEAL_LABELS[mealType]}\\b${caloriePattern}`),
  });
}

function mealSection(page: Page, mealType: MealType) {
  return usesDesktopWorkspace(page)
    ? page.getByRole("region", { name: MEAL_LABELS[mealType], exact: true })
    : mealButton(page, mealType).locator("..");
}

async function openMeal(page: Page, mealType: MealType) {
  const button = mealButton(page, mealType);
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
}

async function expectMealCalories(page: Page, mealType: MealType, calories: number) {
  if (usesDesktopWorkspace(page)) {
    const calorieCells = mealSection(page, mealType).locator('button[role="row"] [role="cell"]:nth-child(2)');
    await expect.poll(async () => {
      const values = await calorieCells.allTextContents();
      return values.reduce((sum, value) => sum + Number(value.replace(/[^\d.-]/g, "")), 0);
    }).toBe(calories);
    return;
  }
  await expect(mealButton(page, mealType, calories)).toBeVisible();
}

function savedFood(page: Page, mealType: MealType, name: RegExp) {
  const section = mealSection(page, mealType);
  return usesDesktopWorkspace(page)
    ? section.getByRole("row", { name })
    : section.getByRole("button", { name });
}

function desktopLoggingStatus(page: Page) {
  return page.getByRole("status").filter({ hasText: /^Added \d+ foods?/ });
}

async function expectLoggingSuccess(page: Page, foodCount: number) {
  if (usesDesktopWorkspace(page)) {
    await expect(desktopLoggingStatus(page)).toContainText(
      `Added ${foodCount} ${foodCount === 1 ? "food" : "foods"}`,
    );
    return;
  }
  await expect(page.getByText(`Added ${foodCount}`, { exact: true })).toBeVisible();
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
    await expect(option).toContainText("170 g");
    await expect(option).toContainText("150 kcal");
    await expect(option).toContainText("×3");
    await expect(option).toContainText("Yesterday");
  });

  test("keeps same-name historical configurations distinct when their slugs differ", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    await seedAndLogin(page, e2eControls, [
      seedEntry(addDays(today, -4), "Greek yogurt", 150, {
        portion: "170 g",
        protein: 15,
        mealSlug: "greek-yogurt-high-protein",
      }),
      seedEntry(addDays(today, -2), "Greek yogurt", 260, {
        portion: "300 g",
        protein: 26,
        carbs: 30,
        mealSlug: "greek-yogurt-large",
      }),
      seedEntry(addDays(today, -1), "Greek yogurt", 150, {
        portion: "170 g",
        protein: 9,
        carbs: 24,
        fats: 2,
        fiber: 1,
        mealSlug: "greek-yogurt-low-fat",
      }),
    ]);

    const input = await openFoodComposer(page);
    await input.fill("Greek yogurt");

    const options = suggestionList(page).getByRole("option", { name: /Greek yogurt/ });
    await expect(options).toHaveCount(3);
    await expect(
      options.filter({ hasText: "170 g" }).filter({ hasText: "150 kcal" }).filter({ hasText: /P:?\s*15\s*g/ }),
    ).toHaveCount(1);
    await expect(
      options.filter({ hasText: "170 g" }).filter({ hasText: "150 kcal" }).filter({ hasText: /P:?\s*9\s*g/ }),
    ).toHaveCount(1);
    await expect(options.filter({ hasText: "300 g" }).filter({ hasText: "260 kcal" })).toHaveCount(1);
  });

  test("merges shared-slug suggestions and keeps the highest-ranked representative", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    await seedAndLogin(page, e2eControls, [
      seedEntry(addDays(today, -5), "Fried eggs", 100, {
        portion: "1 egg",
        mealSlug: "fried-eggs",
      }),
      seedEntry(addDays(today, -3), "Fried eggs", 200, {
        portion: "2 eggs",
        mealSlug: "fried-eggs",
      }),
      seedEntry(addDays(today, -1), "Fried eggs", 200, {
        portion: "2 eggs",
        mealSlug: "fried-eggs",
      }),
      seedEntry(addDays(today, -2), "Fried eggs with spinach", 240, {
        portion: "1 plate",
        mealSlug: "fried-eggs-spinach",
      }),
      seedEntry(addDays(today, -4), "Fried eggs with mushrooms", 180, {
        portion: "1 plate",
        mealSlug: null,
      }),
      seedEntry(addDays(today, -6), "Fried eggs with tomato", 190, {
        portion: "1 plate",
        mealSlug: null,
      }),
    ]);

    const input = await openFoodComposer(page);
    await input.fill("Fried eggs");

    const options = suggestionList(page).getByRole("option", { name: /Fried eggs/ });
    await expect(options).toHaveCount(4);
    await expect(options.filter({ hasText: "2 eggs" }).filter({ hasText: "200 kcal" })).toContainText("×2");
    await expect(options.filter({ hasText: "1 egg" }).filter({ hasText: "100 kcal" })).toHaveCount(0);
    await expect(options.filter({ hasText: "Fried eggs with spinach" })).toHaveCount(1);
    await expect(options.filter({ hasText: "Fried eggs with mushrooms" })).toHaveCount(1);
    await expect(options.filter({ hasText: "Fried eggs with tomato" })).toHaveCount(1);
  });

  test("shows a matching large-history result within the user-visible latency budget", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    const bulkEntries = Array.from({ length: 1_000 }, (_, index) =>
      seedEntry(
        addDays(today, -1 - (index % 30)),
        `Archived meal ${String(index).padStart(4, "0")}`,
        100 + (index % 100),
      ),
    );
    await seedAndLogin(page, e2eControls, [
      ...bulkEntries,
      seedEntry(addDays(today, -1), "Needle porridge", 321),
    ]);

    const input = await openFoodComposer(page);
    const startedAt = await page.evaluate(() => performance.now());
    await input.fill("Needle porridge");
    await expect(
      suggestionList(page).getByRole("option", { name: /Needle porridge/ }),
    ).toBeVisible();
    const elapsedMs = await page.evaluate((start) => performance.now() - start, startedAt);

    expect(elapsedMs).toBeLessThan(1_250);
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
      const text = await options.nth(index).locator("span").first().innerText();
      names.push(usesDesktopWorkspace(page) ? text.split(" · ")[0] : text);
    }

    expect(names).toEqual([
      "Apple",
      "Apple frequent",
      "Apple recent pair",
      "Apple old pair",
      "Green apple",
    ]);
  });

  test("selects an active historical suggestion with arrows and Enter without AI", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    await seedAndLogin(page, e2eControls, [
      seedEntry(addDays(today, -2), "Keyboard porridge", 210),
      seedEntry(addDays(today, -1), "Keyboard omelet", 330),
    ]);
    await e2eControls.setAiMode({ parseFood: "failure" });

    const input = await openFoodComposer(page);
    await input.fill("Keyboard");
    const options = suggestionList(page).getByRole("option");
    await expect(options).toHaveCount(2);
    const firstOption = options.nth(0);
    const secondOption = options.nth(1);
    const firstOptionId = await firstOption.getAttribute("id");
    const secondOptionId = await secondOption.getAttribute("id");
    const firstOptionText = await firstOption.locator("span").first().innerText();
    const firstOptionName = usesDesktopWorkspace(page) ? firstOptionText.split(" · ")[0] : firstOptionText;
    expect(firstOptionId).toBeTruthy();
    expect(secondOptionId).toBeTruthy();

    await input.press("ArrowDown");
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("aria-activedescendant", firstOptionId ?? "");
    await expect(firstOption).toHaveAttribute("aria-selected", "true");
    await expect(secondOption).toHaveAttribute("aria-selected", "false");

    await input.press("ArrowDown");
    await expect(input).toHaveAttribute("aria-activedescendant", secondOptionId ?? "");
    await expect(secondOption).toHaveAttribute("aria-selected", "true");
    await input.press("ArrowUp");
    await expect(input).toHaveAttribute("aria-activedescendant", firstOptionId ?? "");

    let parseRequests = 0;
    const countParseRequests = (request: Request) => {
      if (new URL(request.url()).pathname === "/api/v1/ai/parse-food") parseRequests += 1;
    };
    page.on("request", countParseRequests);
    const batchRequestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return request.method() === "POST" && url.pathname === "/api/v1/entries/batch";
    });
    await input.press("Enter");
    const batch = (await batchRequestPromise).postDataJSON() as {
      entries: Array<{ name: string }>;
    };
    await expectLoggingSuccess(page, 1);
    page.off("request", countParseRequests);

    expect(parseRequests).toBe(0);
    expect(batch.entries).toEqual([expect.objectContaining({ name: firstOptionName })]);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("");
    await expect(suggestionList(page)).toHaveCount(0);
  });

  test("dismisses suggestions without losing text and keeps accessibility state current", async ({
    page,
    e2eControls,
    browserName,
  }) => {
    const today = await behavioralToday(page);
    await seedAndLogin(page, e2eControls, [
      seedEntry(addDays(today, -1), "Dismissible porridge", 245),
    ]);

    const input = await openFoodComposer(page);
    const query = "Dismissible";
    await input.fill(query);
    const list = suggestionList(page);
    const option = list.getByRole("option", { name: /Dismissible porridge/ });
    await expect(option).toBeVisible();
    const optionId = await option.getAttribute("id");
    expect(optionId).toBeTruthy();
    const send = page.getByRole("button", { name: "Submit food description" });

    await option.hover();
    await expect(option).toHaveAttribute("aria-selected", "true");
    await expect(input).toHaveAttribute("aria-activedescendant", optionId ?? "");
    await send.hover();
    await expect(option).toHaveAttribute("aria-selected", "false");
    await expect.poll(() => input.getAttribute("aria-activedescendant")).toBeNull();
    const unfocusedIndicator = await option.evaluate((element) => {
      const style = getComputedStyle(element);
      return { boxShadow: style.boxShadow, outline: style.outline };
    });

    await expect(send).toHaveAccessibleName("Submit food description");
    // Mobile WebKit models Safari's default focus preference: Option+Tab, rather
    // than Tab, advances through buttons when a hardware keyboard is attached.
    const advanceFocusKey = browserName === "webkit" ? "Alt+Tab" : "Tab";
    await expect(input).toBeFocused();
    await page.keyboard.press(advanceFocusKey);
    await expect(send).toBeFocused();
    await page.keyboard.press(advanceFocusKey);
    await expect(option).toBeFocused();
    const focusedIndicator = await option.evaluate((element) => {
      const style = getComputedStyle(element);
      return { boxShadow: style.boxShadow, outline: style.outline };
    });
    expect(focusedIndicator).not.toEqual(unfocusedIndicator);
    expect(
      focusedIndicator.outline !== "none" || focusedIndicator.boxShadow !== "none",
    ).toBe(true);

    await input.focus();
    await input.press("Escape");
    await expect(input).toBeFocused();
    await expect(input).toHaveValue(query);
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => input.getAttribute("aria-controls")).toBeNull();
    await expect(list).toHaveCount(0);
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
    await expectLoggingSuccess(page, 1);
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
    await openMeal(page, targetMeal as MealType);
    await expect(savedFood(page, targetMeal as MealType, /Stored porridge.*222\s+kcal/)).toBeVisible();
    await expectMealCalories(page, targetMeal as MealType, 222);
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
