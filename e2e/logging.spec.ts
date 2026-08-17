import type { Page, Request } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { expectAppBackgroundExcludedFromAccessibilityTree } from "./support/modalAccessibility";
import { closeAdaptiveFoodComposer, openAdaptiveFoodComposer, usesDesktopWorkspace } from "./support/adaptiveComposer";

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

const openFoodComposer = openAdaptiveFoodComposer;

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
  if (usesDesktopWorkspace(page)) {
    return page.getByRole("region", { name: MEAL_LABELS[mealType], exact: true });
  }
  return mealButton(page, mealType).locator("..");
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

function failedSubmission(page: Page, mealType: MealType) {
  return usesDesktopWorkspace(page)
    ? mealSection(page, mealType)
    : page.locator("#food-log-sheet");
}

async function closeComposer(page: Page) {
  await closeAdaptiveFoodComposer(page);
}

test.describe("Atomic food logging", () => {
  test("logs every recognized food atomically and persists totals after reload", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "multi-food" });

    const parseBody = await submitAndCaptureParse(page, "oatmeal and banana");

    await expectLoggingSuccess(page, 2);
    if (usesDesktopWorkspace(page)) {
      await expect(savedFood(page, parseBody.defaultMealType, /^E2E oatmeal\b/)).toBeVisible();
      await expect(savedFood(page, parseBody.defaultMealType, /^E2E banana\b/)).toBeVisible();
    } else {
      await expect(page.getByRole("button", { name: "Edit E2E oatmeal" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Edit E2E banana" })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /Log all 2/i })).toHaveCount(0);

    await page.reload();
    await expect(page).toHaveURL(/\/app$/);
    await openMeal(page, parseBody.defaultMealType);

    await expect(savedFood(page, parseBody.defaultMealType, /^E2E oatmeal\b/)).toBeVisible();
    await expect(savedFood(page, parseBody.defaultMealType, /^E2E banana\b/)).toBeVisible();
    await expectMealCalories(page, parseBody.defaultMealType, 425);
  });

  test("rolls back the complete recognized group and offers retry", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "multi-food" });
    await e2eControls.failNextBatchSave();

    const parseBody = await submitAndCaptureParse(page, "exact failed multi-food submission");
    const composer = failedSubmission(page, parseBody.defaultMealType);

    await expect(
      composer.getByText("exact failed multi-food submission", { exact: true }),
    ).toBeVisible();
    await expect(composer.getByRole("alert")).toContainText("Request failed");
    await expect(composer.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await closeComposer(page);
    await expectMealCalories(page, parseBody.defaultMealType, 0);

    const input = await openFoodComposer(page);
    await expect(input).toHaveValue("");
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expectLoggingSuccess(page, 2);

    await page.reload();
    await openMeal(page, parseBody.defaultMealType);
    await expect(savedFood(page, parseBody.defaultMealType, /^E2E oatmeal\b/)).toBeVisible();
    await expect(savedFood(page, parseBody.defaultMealType, /^E2E banana\b/)).toBeVisible();
    await expectMealCalories(page, parseBody.defaultMealType, 425);
  });

  test("automatically saves recognized foods without a review step", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "multi-food" });

    await submitAndCaptureParse(page, "automatic oatmeal and banana");

    await expectLoggingSuccess(page, 2);
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
    await expectLoggingSuccess(page, 1);
    expect(parseBody.defaultLogDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await page.reload();
    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(dateNavigation.getByRole("button").nth(1)).toHaveText(selectedLabel);
    await openMeal(page, parseBody.defaultMealType);
    await expect(savedFood(page, parseBody.defaultMealType, /^E2E oatmeal\b/)).toBeVisible();
    await expectMealCalories(page, parseBody.defaultMealType, 320);

    await page.locator('[data-slot="date-navigator-today"]').getByRole("button").click();
    await openMeal(page, parseBody.defaultMealType);
    await expect(savedFood(page, parseBody.defaultMealType, /^E2E oatmeal\b/)).toHaveCount(0);
    await expectMealCalories(page, parseBody.defaultMealType, 0);
  });

  test("shows the grouped receipt and repairs an addition with Edit and Undo", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "success" });
    const parseBody = await submitAndCaptureParse(page, "oatmeal to repair");

    await expectLoggingSuccess(page, 1);
    const savedRow = savedFood(page, parseBody.defaultMealType, /^E2E oatmeal\b/);
    if (usesDesktopWorkspace(page)) {
      await expect(savedRow).toBeVisible();
      await desktopLoggingStatus(page).hover();
    } else {
      await expect(page.getByRole("button", { name: "Edit E2E oatmeal" })).toBeVisible();
    }
    await expect(
      page.getByRole("button", { name: "Undo added group: E2E oatmeal", exact: true }),
    ).toBeVisible();
    const editor = usesDesktopWorkspace(page)
      ? page.getByRole("form", { name: "Edit E2E oatmeal", exact: true })
      : page.locator('[data-slot="dialog-content"]');
    if (usesDesktopWorkspace(page)) {
      await savedRow.focus();
      await savedRow.press("Enter");
    } else {
      await page.getByRole("button", { name: "Edit E2E oatmeal" }).click();
      const namedEditor = page.getByRole("dialog", { name: "E2E oatmeal" });
      await expect(namedEditor).toBeVisible();
      await expectAppBackgroundExcludedFromAccessibilityTree(page);
      await editor.getByRole("button", { name: "Edit fields" }).click();
    }
    await expect(editor).toBeVisible();
    await editor.getByLabel("Calories", { exact: true }).fill("400");
    const save = editor.getByRole("button", { name: "Save" });
    await save.focus();
    await save.press("Enter");
    await expect(editor).toBeHidden();

    await openMeal(page, parseBody.defaultMealType);
    await expect(savedFood(page, parseBody.defaultMealType, /E2E oatmeal.*400\s+kcal/)).toBeVisible();
    await openFoodComposer(page);
    await page.getByRole("button", { name: "Undo added group: E2E oatmeal", exact: true }).click();
    if (usesDesktopWorkspace(page)) await expect(desktopLoggingStatus(page)).toBeHidden();
    else await expect(page.getByText("Added 1", { exact: true })).toBeHidden();

    await page.reload();
    await expectMealCalories(page, parseBody.defaultMealType, 0);
    await openMeal(page, parseBody.defaultMealType);
    await expect(savedFood(page, parseBody.defaultMealType, /^E2E oatmeal\b/)).toHaveCount(0);
  });

  test("undoes one multi-food submission as a group", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "multi-food" });
    const parseBody = await submitAndCaptureParse(page, "grouped oatmeal and banana");
    await expectLoggingSuccess(page, 2);

    await page.getByRole("button", {
      name: "Undo added group: E2E oatmeal and E2E banana",
      exact: true,
    }).click();
    if (usesDesktopWorkspace(page)) await expect(desktopLoggingStatus(page)).toBeHidden();
    else await expect(page.getByText("Added 2", { exact: true })).toBeHidden();

    await page.reload();
    await expectMealCalories(page, parseBody.defaultMealType, 0);
    await openMeal(page, parseBody.defaultMealType);
    await expect(savedFood(page, parseBody.defaultMealType, /^E2E oatmeal\b/)).toHaveCount(0);
    await expect(savedFood(page, parseBody.defaultMealType, /^E2E banana\b/)).toHaveCount(0);
  });

  test("parses food with the server-selected model and no client preference", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "success" });
    const parseBody = await submitAndCaptureParse(page, "server-routed oatmeal");

    expect(Object.prototype.hasOwnProperty.call(parseBody, "aiModelPreference")).toBe(false);
    await expectLoggingSuccess(page, 1);

    await page.reload();
    await openMeal(page, parseBody.defaultMealType);
    await expect(savedFood(page, parseBody.defaultMealType, /^E2E oatmeal\b/)).toBeVisible();
    await expectMealCalories(page, parseBody.defaultMealType, 320);
  });
});
