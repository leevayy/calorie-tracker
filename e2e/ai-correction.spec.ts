import type { Page } from "@playwright/test";
import {
  behavioralIsoDay,
  expect,
  isolatedTestUser,
  loginThroughSetup,
  test,
  type E2EControlClient,
  type E2ETestUser,
} from "./support/fixtures";

const SEEDED_NAME = "Seeded power bowl";
const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";

function correctionUser(overrides: Partial<E2ETestUser> = {}): E2ETestUser {
  return isolatedTestUser({
    entries: [
      {
        day: behavioralIsoDay(),
        mealType: "lunch",
        name: SEEDED_NAME,
        calories: 300,
        protein: 20,
        carbs: 30,
        fats: 10,
        fiber: 5,
        portion: "1 bowl",
        mealSlug: "seeded-power-bowl",
      },
    ],
    ...overrides,
  });
}

async function openSeededEntry(
  page: Page,
  controls: E2EControlClient,
  overrides: Partial<E2ETestUser> = {},
): Promise<{ entryId: string; user: E2ETestUser }> {
  const user = correctionUser(overrides);
  const seeded = await controls.reset([user]);
  await loginThroughSetup(page, user);
  await page.getByRole("button", { name: /^Lunch/ }).click();
  await page.getByRole("button", { name: new RegExp(SEEDED_NAME) }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return { entryId: seeded.users[0]!.entryIds[0]!, user };
}

async function previewDouble(page: Page, instruction = "Double this serving"): Promise<void> {
  await page.getByLabel("What should change?").fill(instruction);
  await page.getByRole("button", { name: "Preview correction" }).click();
  await expect(page.getByText("Proposed result")).toBeVisible();
}

async function readDayThroughSession(page: Page, day = behavioralIsoDay()) {
  return page.evaluate(async ({ apiUrl, requestedDay }) => {
    const raw = localStorage.getItem("calorie-tracker-auth");
    if (!raw) throw new Error("Missing persisted E2E session");
    const { accessToken } = JSON.parse(raw) as { accessToken: string };
    const response = await fetch(`${apiUrl}/api/v1/days/${requestedDay}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { status: response.status, body: await response.json() };
  }, { apiUrl: API_URL, requestedDay: day });
}

test.describe("AI-first food-entry correction", () => {
  test("opens a saved entry in the AI-first editor with its persisted draft", async ({
    page,
    e2eControls,
  }) => {
    await openSeededEntry(page, e2eControls);

    await expect(page.getByRole("heading", { name: "Correct food" })).toBeVisible();
    await expect(page.getByText("AI correction", { exact: true })).toBeVisible();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(SEEDED_NAME, { exact: true })).toBeVisible();
    await expect(dialog.getByText("1 bowl · 300 cal", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Date" })).toHaveValue(behavioralIsoDay());
    await expect(page.getByRole("combobox", { name: "Meal" })).toHaveText("Lunch");
  });

  test("switches to Edit fields and exposes detailed nutrients without losing the draft", async ({
    page,
    e2eControls,
  }) => {
    await openSeededEntry(page, e2eControls);
    await previewDouble(page);

    await page.getByRole("button", { name: "Edit fields" }).click();
    await expect(page.getByLabel("Calories")).toHaveValue("600");
    await page.getByRole("button", { name: "Nutrition details" }).click();
    await expect(page.getByLabel("Protein")).toHaveValue("40");
    await expect(page.getByLabel("Carbohydrates")).toHaveValue("60");
    await expect(page.getByLabel("Fat")).toHaveValue("20");
    await expect(page.getByLabel("Fiber")).toHaveValue("10");
    await page.getByRole("button", { name: "Back to AI" }).click();
    await expect(page.getByText("2 servings · 600 cal", { exact: true })).toBeVisible();
  });

  test("saves a structured correction and reconciles every aggregate after reload", async ({
    page,
    e2eControls,
  }) => {
    await openSeededEntry(page, e2eControls);
    await page.getByRole("button", { name: "Edit fields" }).click();
    await page.getByLabel("Name").fill("Corrected power bowl");
    await page.getByLabel("Calories").fill("450");
    await page.getByRole("button", { name: "Nutrition details" }).click();
    await page.getByLabel("Protein").fill("25");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Lunch/ })).toContainText("450 cal");
    await page.reload();
    await expect(page.getByRole("button", { name: /^Lunch/ })).toContainText("450 cal");

    await page.getByRole("button", { name: "History" }).click();
    await expect(page).toHaveURL(/\/history$/);
    const dayCard = page.getByRole("button", { name: /Open log for/ }).filter({
      hasText: "450 / 2000 cal",
    });
    await expect(dayCard).toBeVisible();
    await dayCard.click();
    await expect(page.getByText("450 cal", { exact: true })).toBeVisible();
    const historyDetail = page.locator('section[aria-labelledby="history-day-detail-title"]');
    await historyDetail.getByRole("button", { name: /^Lunch/ }).click();
    await expect(historyDetail.getByText("Corrected power bowl", { exact: true })).toBeVisible();
  });

  test("keeps invalid structured edits with field-level feedback", async ({
    page,
    e2eControls,
  }) => {
    await openSeededEntry(page, e2eControls);
    await page.getByRole("button", { name: "Edit fields" }).click();
    await page.getByLabel("Name").fill("   ");
    await page.getByLabel("Calories").fill("-4");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("This field is required.")).toBeVisible();
    await expect(page.getByText("Must be zero or greater.")).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue("   ");
    await expect(page.getByLabel("Calories")).toHaveValue("-4");
    expect((await readDayThroughSession(page)).body.totalCalories).toBe(300);
  });

  test("opens AI correction by default for a saved entry", async ({ page, e2eControls }) => {
    await openSeededEntry(page, e2eControls);

    await expect(page.getByLabel("What should change?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview correction" })).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit fields" })).toBeVisible();
  });

  test("uses the stored structured entry as correction context", async ({ page, e2eControls }) => {
    await openSeededEntry(page, e2eControls);
    await previewDouble(page, "Make the saved serving twice as large");

    await expect(page.getByText("2 servings · 600 cal", { exact: true })).toBeVisible();
    await expect(page.getByText("P 40 · C 60 · F 20 · Fi 10", { exact: true })).toBeVisible();
    expect((await readDayThroughSession(page)).body.totalCalories).toBe(300);
  });

  test("validates a complete AI draft before Save persists it", async ({ page, e2eControls }) => {
    await openSeededEntry(page, e2eControls);
    await previewDouble(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(SEEDED_NAME, { exact: true })).toBeVisible();
    await expect(dialog.getByText("2 servings · 600 cal", { exact: true })).toBeVisible();
    await expect(dialog.getByText("P 40 · C 60 · F 20 · Fi 10", { exact: true })).toBeVisible();
    expect((await readDayThroughSession(page)).body.totalCalories).toBe(300);

    await page.getByRole("button", { name: "Save changes" }).click();
    expect((await readDayThroughSession(page)).body.totalCalories).toBe(600);
  });

  test("scales calories and every nutrient exactly for a proportional instruction", async ({
    page,
    e2eControls,
  }) => {
    await openSeededEntry(page, e2eControls);
    await previewDouble(page, "Double the portion and all nutrition values");
    await page.getByRole("button", { name: "Edit fields" }).click();
    await expect(page.getByLabel("Portion")).toHaveValue("2 servings");
    await expect(page.getByLabel("Calories")).toHaveValue("600");
    await page.getByRole("button", { name: "Nutrition details" }).click();
    await expect(page.getByLabel("Protein")).toHaveValue("40");
    await expect(page.getByLabel("Carbohydrates")).toHaveValue("60");
    await expect(page.getByLabel("Fat")).toHaveValue("20");
    await expect(page.getByLabel("Fiber")).toHaveValue("10");
  });

  test("moves the AI correction draft with explicit date and meal selectors", async ({
    page,
    e2eControls,
  }) => {
    await openSeededEntry(page, e2eControls);
    await page.getByRole("textbox", { name: "Date" }).fill(behavioralIsoDay(1));
    await page.getByRole("combobox", { name: "Meal" }).click();
    await page.getByRole("option", { name: "Dinner" }).click();
    await previewDouble(page);
    await expect(page.getByRole("textbox", { name: "Date" })).toHaveValue(behavioralIsoDay(1));
    await expect(page.getByRole("combobox", { name: "Meal" })).toHaveText("Dinner");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("button", { name: /^Lunch/ })).toContainText("0 cal");
    await page.getByRole("button", { name: "Next day" }).click();
    await expect(page.getByRole("button", { name: /^Dinner/ })).toContainText("600 cal");
    await page.getByRole("button", { name: /^Dinner/ }).click();
    await expect(page.getByRole("button", { name: new RegExp(SEEDED_NAME) })).toBeVisible();
  });

  test("shares one correction draft while switching AI and structured modes", async ({
    page,
    e2eControls,
  }) => {
    await openSeededEntry(page, e2eControls);
    await previewDouble(page);
    await page.getByRole("button", { name: "Edit fields" }).click();
    await page.getByLabel("Name").fill("Shared draft bowl");
    await page.getByRole("button", { name: "Back to AI" }).click();

    await expect(page.getByText("Shared draft bowl", { exact: true })).toBeVisible();
    await expect(page.getByText("2 servings · 600 cal", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit fields" }).click();
    await expect(page.getByLabel("Name")).toHaveValue("Shared draft bowl");
    await expect(page.getByLabel("Calories")).toHaveValue("600");
  });

  test("preserves the instruction and persisted entry after a failed AI correction", async ({
    page,
    e2eControls,
  }) => {
    await openSeededEntry(page, e2eControls);
    await e2eControls.setAiMode({ correction: "failure" });
    const instruction = "Double this but keep my note";
    await page.getByLabel("What should change?").fill(instruction);
    await page.getByRole("button", { name: "Preview correction" }).click();

    await expect(page.getByRole("alert")).toContainText("correction service is unavailable");
    await expect(page.getByLabel("What should change?")).toHaveValue(instruction);
    await expect(page.getByRole("button", { name: "Edit fields" })).toBeVisible();
    expect((await readDayThroughSession(page)).body.totalCalories).toBe(300);
  });

  test("saves either correction mode exactly once and reconciles every aggregate", async ({
    page,
    e2eControls,
  }) => {
    await openSeededEntry(page, e2eControls);
    await previewDouble(page);
    const updateResponses: number[] = [];
    page.on("response", (response) => {
      if (response.request().method() === "PATCH" && /\/entries\//.test(response.url())) {
        updateResponses.push(response.status());
      }
    });
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();

    const day = (await readDayThroughSession(page)).body as {
      totalCalories: number;
      meals: { lunch: Array<{ calories: number }> };
    };
    expect(updateResponses).toEqual([200]);
    expect(day.totalCalories).toBe(600);
    expect(day.meals.lunch).toHaveLength(1);
    expect(day.meals.lunch[0]?.calories).toBe(600);
    await expect(page.getByRole("button", { name: /^Lunch/ })).toContainText("600 cal");
  });
});
