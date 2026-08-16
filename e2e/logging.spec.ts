import type { Page, Request } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { expectAppBackgroundExcludedFromAccessibilityTree } from "./support/modalAccessibility";

const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
} as const;

type MealType = keyof typeof MEAL_LABELS;
type ParseFoodRequestBody = {
  defaultLogDay: string;
  defaultMealType: MealType;
  aiModelPreference?: unknown;
};

async function openFoodComposer(page: Page) {
  await page.getByRole("button", { name: /Log food/ }).click();
  const input = page.getByRole("combobox", { name: "Log food" });
  await expect(input).toBeVisible();
  return input;
}

function nextParseRequest(page: Page): Promise<Request> {
  return page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === "POST" && url.pathname === "/api/v1/ai/parse-food";
  });
}

async function submitAndCaptureParse(page: Page, text: string): Promise<ParseFoodRequestBody> {
  const input = await openFoodComposer(page);
  const requestPromise = nextParseRequest(page);
  await input.fill(text);
  await input.press("Enter");
  const request = await requestPromise;
  return request.postDataJSON() as ParseFoodRequestBody;
}

function mealButton(page: Page, mealType: MealType, calories?: number) {
  const caloriePattern = calories === undefined ? ".*" : `.*${calories}\\s+kcal`;
  return page.getByRole("button", {
    name: new RegExp(`^${MEAL_LABELS[mealType]}\\b${caloriePattern}`),
  });
}

function mealSection(page: Page, mealType: MealType) {
  return mealButton(page, mealType).locator("..");
}

async function openMeal(page: Page, mealType: MealType) {
  await mealButton(page, mealType).click();
}

async function closeComposer(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Log food/ })).toBeVisible();
}

test.describe("Atomic food logging", () => {
  test("logs every recognized food atomically and persists totals after reload", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "multi-food" });

    const parseBody = await submitAndCaptureParse(page, "oatmeal and banana");

    await expect(page.getByText("Added 2", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit E2E oatmeal" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit E2E banana" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Log all 2/i })).toHaveCount(0);

    await page.reload();
    await expect(page).toHaveURL(/\/app$/);
    await openMeal(page, parseBody.defaultMealType);

    await expect(mealSection(page, parseBody.defaultMealType).getByRole("button", { name: /^E2E oatmeal\b/ })).toBeVisible();
    await expect(mealSection(page, parseBody.defaultMealType).getByRole("button", { name: /^E2E banana\b/ })).toBeVisible();
    await expect(mealButton(page, parseBody.defaultMealType, 425)).toBeVisible();
  });

  test("rolls back the complete recognized group and offers retry", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "multi-food" });
    await e2eControls.failNextBatchSave();

    const parseBody = await submitAndCaptureParse(page, "exact failed multi-food submission");
    const composer = page.getByLabel("Log food");

    await expect(
      composer.getByText("exact failed multi-food submission", { exact: true }),
    ).toBeVisible();
    await expect(composer.getByRole("alert")).toContainText("Request failed");
    await expect(composer.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await closeComposer(page);
    await expect(mealButton(page, parseBody.defaultMealType, 0)).toBeVisible();

    const input = await openFoodComposer(page);
    await expect(input).toHaveValue("");
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByText("Added 2", { exact: true })).toBeVisible();

    await page.reload();
    await openMeal(page, parseBody.defaultMealType);
    await expect(mealSection(page, parseBody.defaultMealType).getByRole("button", { name: /^E2E oatmeal\b/ })).toBeVisible();
    await expect(mealSection(page, parseBody.defaultMealType).getByRole("button", { name: /^E2E banana\b/ })).toBeVisible();
    await expect(mealButton(page, parseBody.defaultMealType, 425)).toBeVisible();
  });

  test("automatically saves recognized foods without a review step", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "multi-food" });

    await submitAndCaptureParse(page, "automatic oatmeal and banana");

    await expect(page.getByText("Added 2", { exact: true })).toBeVisible();
    await expect(page.getByText("Recognized foods", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Log all/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Dismiss", exact: true })).toHaveCount(0);
  });

  test("automatically saves recognized foods to the selected meal and day", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "success" });
    const dateNavigation = page.getByLabel("Log date");
    const todayLabel = await dateNavigation.getByRole("button").nth(1).innerText();
    await page.getByRole("button", { name: "Previous day" }).click();
    const selectedLabel = await dateNavigation.getByRole("button").nth(1).innerText();
    expect(selectedLabel).not.toBe(todayLabel);

    const parseBody = await submitAndCaptureParse(page, "oatmeal on the selected date");
    await expect(page.getByText("Added 1", { exact: true })).toBeVisible();
    expect(parseBody.defaultLogDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await page.reload();
    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(dateNavigation.getByRole("button").nth(1)).toHaveText(selectedLabel);
    await openMeal(page, parseBody.defaultMealType);
    await expect(mealSection(page, parseBody.defaultMealType).getByRole("button", { name: /^E2E oatmeal\b/ })).toBeVisible();
    await expect(mealButton(page, parseBody.defaultMealType, 320)).toBeVisible();

    await page.getByRole("button", { name: "Today" }).click();
    await openMeal(page, parseBody.defaultMealType);
    await expect(mealSection(page, parseBody.defaultMealType).getByRole("button", { name: /^E2E oatmeal\b/ })).toHaveCount(0);
    await expect(mealButton(page, parseBody.defaultMealType, 0)).toBeVisible();
  });

  test("shows the grouped receipt and repairs an addition with Edit and Undo", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "success" });
    const parseBody = await submitAndCaptureParse(page, "oatmeal to repair");

    await expect(page.getByText("Added 1", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit E2E oatmeal" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Undo added group: E2E oatmeal", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit E2E oatmeal" }).click();

    const namedEditor = page.getByRole("dialog", { name: "E2E oatmeal" });
    await expect(namedEditor).toBeVisible();
    await expectAppBackgroundExcludedFromAccessibilityTree(page);
    const editor = page.locator('[data-slot="dialog-content"]');
    await expect(editor).toHaveCount(1);
    await editor.getByRole("button", { name: "Edit fields" }).click();
    await editor.getByLabel("Calories", { exact: true }).fill("400");
    await editor.getByRole("button", { name: "Save" }).click();
    await expect(editor).toBeHidden();

    await openMeal(page, parseBody.defaultMealType);
    await expect(page.getByRole("button", { name: /E2E oatmeal.*400\s+kcal/ })).toBeVisible();
    await openFoodComposer(page);
    await page.getByRole("button", { name: "Undo added group: E2E oatmeal", exact: true }).click();
    await expect(page.getByText("Added 1", { exact: true })).toBeHidden();

    await page.reload();
    await expect(mealButton(page, parseBody.defaultMealType, 0)).toBeVisible();
    await openMeal(page, parseBody.defaultMealType);
    await expect(mealSection(page, parseBody.defaultMealType).getByRole("button", { name: /^E2E oatmeal\b/ })).toHaveCount(0);
  });

  test("undoes one multi-food submission as a group", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "multi-food" });
    const parseBody = await submitAndCaptureParse(page, "grouped oatmeal and banana");
    await expect(page.getByText("Added 2", { exact: true })).toBeVisible();

    await page.getByRole("button", {
      name: "Undo added group: E2E oatmeal and E2E banana",
      exact: true,
    }).click();
    await expect(page.getByText("Added 2", { exact: true })).toBeHidden();

    await page.reload();
    await expect(mealButton(page, parseBody.defaultMealType, 0)).toBeVisible();
    await openMeal(page, parseBody.defaultMealType);
    await expect(mealSection(page, parseBody.defaultMealType).getByRole("button", { name: /^E2E oatmeal\b/ })).toHaveCount(0);
    await expect(mealSection(page, parseBody.defaultMealType).getByRole("button", { name: /^E2E banana\b/ })).toHaveCount(0);
  });

  test("parses food with the server-selected model and no client preference", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "success" });
    const parseBody = await submitAndCaptureParse(page, "server-routed oatmeal");

    expect(Object.prototype.hasOwnProperty.call(parseBody, "aiModelPreference")).toBe(false);
    await expect(page.getByText("Added 1", { exact: true })).toBeVisible();

    await page.reload();
    await openMeal(page, parseBody.defaultMealType);
    await expect(mealSection(page, parseBody.defaultMealType).getByRole("button", { name: /^E2E oatmeal\b/ })).toBeVisible();
    await expect(mealButton(page, parseBody.defaultMealType, 320)).toBeVisible();
  });
});
