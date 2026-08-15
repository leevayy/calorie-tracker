import type { Page } from "@playwright/test";
import {
  behavioralIsoDay,
  expect,
  isolatedTestUser,
  loginThroughSetup,
  test,
} from "./support/fixtures";

const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
} as const;

type MealType = keyof typeof MEAL_LABELS;

type ApiFoodEntry = {
  id: string;
  day: string;
  mealType: MealType;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  portion?: string;
};

type ApiDayLog = {
  day: string;
  totalCalories: number;
  meals: {
    breakfast: ApiFoodEntry[];
    lunch: ApiFoodEntry[];
    dinner: ApiFoodEntry[];
    snack?: ApiFoodEntry[];
  };
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function apiUrl(pathname: string): string {
  const origin = process.env.E2E_API_URL?.trim() || "http://127.0.0.1:3000";
  return new URL(pathname, `${origin.replace(/\/$/, "")}/`).toString();
}

async function readDayThroughSession(page: Page, day: string): Promise<ApiDayLog> {
  const accessToken = await page.evaluate(() => {
    const raw = localStorage.getItem("calorie-tracker-auth");
    if (!raw) throw new Error("Missing persisted E2E session");
    const session = JSON.parse(raw) as { accessToken?: string };
    if (!session.accessToken) throw new Error("Missing E2E access token");
    return session.accessToken;
  });
  const response = await fetch(apiUrl(`/api/v1/days/${day}`), {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Day read failed with HTTP ${response.status}`);
  return (await response.json()) as ApiDayLog;
}

function allEntries(day: ApiDayLog): ApiFoodEntry[] {
  return Object.values(day.meals).flat();
}

async function openFoodComposer(page: Page) {
  await page.getByRole("button", { name: /Log food/ }).click();
  const input = page.getByPlaceholder(/Log food/);
  await expect(input).toBeVisible();
  return input;
}

test.describe("Live AI smoke journeys", () => {
  test("@live-ai parses and saves a real multi-food description", async ({
    authenticatedPage: page,
  }) => {
    test.slow();
    const day = behavioralIsoDay();
    const input = await openFoodComposer(page);
    await input.fill(
      "For breakfast today I ate two separate foods: one plain banana and one hard-boiled egg. Return them as two separate foods.",
    );
    await input.press("Enter");

    await expect(page.getByText("Added 2", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(2);

    await page.reload();
    await expect(page).toHaveURL(/\/app$/);
    const persistedDay = await readDayThroughSession(page, day);
    const persistedEntries = allEntries(persistedDay);
    expect(persistedEntries).toHaveLength(2);
    expect(persistedDay.totalCalories).toBeGreaterThan(0);
    expect(persistedEntries.every((entry) => entry.name.trim().length > 0)).toBe(true);
    expect(persistedEntries.every((entry) => entry.calories > 0)).toBe(true);

    for (const mealType of Object.keys(MEAL_LABELS) as MealType[]) {
      const entries = persistedDay.meals[mealType] ?? [];
      if (entries.length === 0) continue;
      await page
        .getByRole("button", { name: new RegExp(`^${MEAL_LABELS[mealType]}\\b`) })
        .click();
      for (const entry of entries) {
        await expect(
          page.getByRole("button", {
            name: new RegExp(`^${escapeRegExp(entry.name)}(?:\\s|$)`),
          }),
        ).toBeVisible();
      }
    }
  });

  test("@live-ai proposes and saves a correction from stored entry context", async ({
    page,
    e2eControls,
  }) => {
    test.slow();
    const day = behavioralIsoDay();
    const seedName = "Live correction seed bowl";
    const user = isolatedTestUser({
      entries: [
        {
          day,
          mealType: "lunch",
          name: seedName,
          calories: 300,
          protein: 20,
          carbs: 30,
          fats: 10,
          fiber: 5,
          portion: "1 bowl",
          mealSlug: "live-correction-bowl",
        },
      ],
    });
    await e2eControls.reset([user]);
    await loginThroughSetup(page, user);
    await page.getByRole("button", { name: /^Lunch\b/ }).click();
    await page
      .getByRole("button", { name: new RegExp(`^${escapeRegExp(seedName)}\\b`) })
      .click();
    const dialog = page.getByRole("dialog", { name: "Correct food" });
    await expect(dialog).toBeVisible();

    await dialog
      .getByLabel("What should change?")
      .fill("Make the saved serving exactly twice as large and double every nutrition value.");
    await dialog.getByRole("button", { name: "Preview correction" }).click();
    await expect(dialog.getByText("Proposed result", { exact: true })).toBeVisible();
    await expect(dialog.getByText(seedName, { exact: true }).first()).toBeVisible();

    await dialog.getByRole("button", { name: "Edit fields" }).click();
    await expect(dialog.getByLabel("Name")).toHaveValue(seedName);
    await expect(dialog.getByLabel("Date")).toHaveValue(day);
    await expect(dialog.getByRole("combobox", { name: "Meal" })).toContainText("Lunch");
    const proposedCalories = Number(await dialog.getByLabel("Calories").inputValue());
    await dialog.getByRole("button", { name: "Nutrition details" }).click();
    const proposedProtein = Number(await dialog.getByLabel("Protein").inputValue());
    const proposedCarbs = Number(await dialog.getByLabel("Carbohydrates").inputValue());
    const proposedFats = Number(await dialog.getByLabel("Fat").inputValue());
    const proposedFiber = Number(await dialog.getByLabel("Fiber").inputValue());
    expect(proposedCalories).toBeGreaterThan(300);
    expect(proposedProtein).toBeGreaterThan(20);
    expect(proposedCarbs).toBeGreaterThan(30);
    expect(proposedFats).toBeGreaterThan(10);
    expect(proposedFiber).toBeGreaterThan(5);

    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    const persistedDay = await readDayThroughSession(page, day);
    expect(persistedDay.meals.lunch).toHaveLength(1);
    const persisted = persistedDay.meals.lunch[0];
    expect(persisted).toMatchObject({
      name: seedName,
      calories: proposedCalories,
      protein: proposedProtein,
      carbs: proposedCarbs,
      fats: proposedFats,
      fiber: proposedFiber,
    });

    await expect(page.getByRole("button", { name: /^Lunch\b/ })).toContainText(
      `${proposedCalories} cal`,
    );
    await page.getByRole("button", { name: /^Lunch\b/ }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(`^${escapeRegExp(seedName)}\\b`) }),
    ).toBeVisible();
  });
});
