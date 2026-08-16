import type { Page, Request } from "@playwright/test";
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
    protein: 10,
    carbs: 20,
    fats: 5,
    fiber: 3,
    portion: "1 saved serving",
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
}

async function openFoodComposer(page: Page) {
  await page.getByRole("button", { name: /Log food/ }).click();
  const input = page.getByRole("textbox", { name: "Log food" });
  await expect(input).toBeVisible();
  return input;
}

function nextParseRequest(page: Page): Promise<Request> {
  return page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === "POST" && url.pathname === "/api/v1/ai/parse-food";
  });
}

function nextBatchRequest(page: Page): Promise<Request> {
  return page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === "POST" && url.pathname === "/api/v1/entries/batch";
  });
}

function nextBatchResponse(page: Page) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST" && url.pathname === "/api/v1/entries/batch";
  });
}

function mealButton(page: Page, mealType: MealType, calories?: number) {
  const caloriePattern = calories === undefined ? ".*" : `.*${calories}\\s+kcal`;
  return page.getByRole("button", {
    name: new RegExp(`^${MEAL_LABELS[mealType]}\\b${caloriePattern}`),
  });
}

async function selectedDateLabel(page: Page): Promise<string> {
  return page.getByLabel("Log date").locator("p").first().innerText();
}

test.describe("Dashboard date navigation", () => {
  test("navigates previous and next dates and labels the selected day", async ({
    page,
    e2eControls,
  }) => {
    await seedAndLogin(page, e2eControls, []);
    const todayLabel = await selectedDateLabel(page);

    await page.getByRole("button", { name: "Next day" }).click();
    const tomorrowLabel = await selectedDateLabel(page);
    expect(tomorrowLabel).not.toBe(todayLabel);
    const returnToToday = page.getByRole("button", { name: "Today" });
    await expect(returnToToday).toBeVisible();
    const selectedDateBox = await page.getByLabel("Log date").locator("p").first().boundingBox();
    const returnToTodayBox = await returnToToday.boundingBox();
    expect(selectedDateBox).not.toBeNull();
    expect(returnToTodayBox).not.toBeNull();
    if (selectedDateBox && returnToTodayBox) {
      expect(returnToTodayBox.y).toBeGreaterThanOrEqual(
        selectedDateBox.y + selectedDateBox.height,
      );
    }

    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(page.getByLabel("Log date").locator("p").first()).toHaveText(todayLabel);
    await expect(page.getByRole("button", { name: "Today" })).toHaveCount(0);

    await page.getByRole("button", { name: "Previous day" }).click();
    const yesterdayLabel = await selectedDateLabel(page);
    expect(yesterdayLabel).not.toBe(todayLabel);
    expect(yesterdayLabel).not.toBe(tomorrowLabel);
  });

  test("keeps the selected day and its totals while navigating", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    await seedAndLogin(page, e2eControls, [
      seedEntry(today, "Today breakfast", 100),
      seedEntry(addDays(today, -1), "Previous dinner", 250, { mealType: "dinner" }),
    ]);
    const todayLabel = await selectedDateLabel(page);
    await expect(mealButton(page, "breakfast", 100)).toBeVisible();
    await expect(mealButton(page, "dinner", 0)).toBeVisible();

    await page.getByRole("button", { name: "Previous day" }).click();
    const previousLabel = await selectedDateLabel(page);
    expect(previousLabel).not.toBe(todayLabel);
    await expect(mealButton(page, "breakfast", 0)).toBeVisible();
    await expect(mealButton(page, "dinner", 250)).toBeVisible();
    await mealButton(page, "dinner").click();
    await expect(page.getByText("Previous dinner", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Log date").locator("p").first()).toHaveText(previousLabel);

    await page.getByRole("button", { name: "Next day" }).click();
    await expect(page.getByLabel("Log date").locator("p").first()).toHaveText(todayLabel);
    await expect(mealButton(page, "breakfast", 100)).toBeVisible();
    await expect(mealButton(page, "dinner", 0)).toBeVisible();
  });

  test("logs AI and historical suggestions into the selected day only", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    const selectedDay = addDays(today, -1);
    await seedAndLogin(page, e2eControls, [
      seedEntry(addDays(today, -10), "Stored date porridge", 222, {
        portion: "250 g",
        protein: 9,
        carbs: 41,
        fats: 3,
        fiber: 6,
        mealSlug: "stored-date-porridge",
      }),
    ]);
    await e2eControls.setAiMode({ parseFood: "success" });
    await page.getByRole("button", { name: "Previous day" }).click();

    const input = await openFoodComposer(page);
    const parseRequestPromise = nextParseRequest(page);
    const aiBatchPromise = nextBatchRequest(page);
    await input.fill("AI oatmeal for selected day");
    await input.press("Enter");
    const parseRequest = await parseRequestPromise;
    const aiBatch = await aiBatchPromise;
    await expect(page.getByText("Added 1", { exact: true })).toHaveCount(1);

    const parseBody = parseRequest.postDataJSON() as {
      defaultLogDay: string;
      defaultMealType: MealType;
    };
    const aiBody = aiBatch.postDataJSON() as {
      entries: Array<{ day: string; mealType: MealType; name: string }>;
    };
    expect(parseBody.defaultLogDay).toBe(selectedDay);
    expect(aiBody.entries[0]).toEqual(
      expect.objectContaining({ day: selectedDay, name: "E2E oatmeal" }),
    );

    await input.fill("Stored date porridge");
    const historicalOption = page
      .getByRole("listbox", { name: "Previous entries" })
      .getByRole("option", { name: /Stored date porridge/ });
    await expect(historicalOption).toBeVisible();
    const historicalBatchPromise = nextBatchRequest(page);
    await historicalOption.click();
    const historicalBatch = await historicalBatchPromise;
    await expect(page.getByText("Added 1", { exact: true })).toHaveCount(2);
    const historicalBody = historicalBatch.postDataJSON() as {
      entries: Array<{ day: string; mealType: MealType; name: string; calories: number }>;
    };
    expect(historicalBody.entries[0]).toEqual(
      expect.objectContaining({
        day: selectedDay,
        name: "Stored date porridge",
        calories: 222,
      }),
    );

    const targetMeal = aiBody.entries[0]?.mealType;
    expect(targetMeal).toBe(historicalBody.entries[0]?.mealType);
    await page.reload();
    await page.getByRole("button", { name: "Previous day" }).click();
    await mealButton(page, targetMeal as MealType).click();
    await expect(page.getByText("E2E oatmeal", { exact: true })).toBeVisible();
    await expect(page.getByText("Stored date porridge", { exact: true })).toBeVisible();
    await expect(mealButton(page, targetMeal as MealType, 542)).toBeVisible();

    await page.getByRole("button", { name: "Today" }).click();
    await expect(page.getByText("E2E oatmeal", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Stored date porridge", { exact: true })).toHaveCount(0);
    await expect(mealButton(page, targetMeal as MealType, 0)).toBeVisible();
  });

  test("returns directly to today from another date", async ({ page, e2eControls }) => {
    await seedAndLogin(page, e2eControls, []);
    const todayLabel = await selectedDateLabel(page);
    await page.getByRole("button", { name: "Previous day" }).click();
    await page.getByRole("button", { name: "Previous day" }).click();
    expect(await selectedDateLabel(page)).not.toBe(todayLabel);

    await page.getByRole("button", { name: "Today" }).click();
    await expect(page.getByLabel("Log date").locator("p").first()).toHaveText(todayLabel);
    await expect(page.getByRole("button", { name: "Today" })).toHaveCount(0);
  });

  test("does not leak submissions across calendar-day boundaries", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    await seedAndLogin(page, e2eControls, []);
    await e2eControls.setAiMode({ parseFood: "delay", delayMs: 1_200 });
    const todayLabel = await selectedDateLabel(page);
    const input = await openFoodComposer(page);
    const parseRequestPromise = nextParseRequest(page);
    const batchResponsePromise = nextBatchResponse(page);

    await input.fill("boundary oatmeal submitted on today");
    await input.press("Enter");
    const parseRequest = await parseRequestPromise;
    const parseBody = parseRequest.postDataJSON() as {
      defaultLogDay: string;
      defaultMealType: MealType;
    };
    expect(parseBody.defaultLogDay).toBe(today);

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Previous day" }).click();
    const previousLabel = await selectedDateLabel(page);
    expect(previousLabel).not.toBe(todayLabel);
    expect((await batchResponsePromise).status()).toBe(201);
    await expect(mealButton(page, parseBody.defaultMealType, 0)).toBeVisible();

    await page.getByRole("button", { name: "Today" }).click();
    await expect(mealButton(page, parseBody.defaultMealType, 320)).toBeVisible();
    await mealButton(page, parseBody.defaultMealType).click();
    await expect(page.getByText("E2E oatmeal", { exact: true })).toBeVisible();

    await page.reload();
    await mealButton(page, parseBody.defaultMealType).click();
    await expect(page.getByText("E2E oatmeal", { exact: true })).toBeVisible();
    await expect(mealButton(page, parseBody.defaultMealType, 320)).toBeVisible();
  });
});
