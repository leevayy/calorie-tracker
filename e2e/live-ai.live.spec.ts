import type { Locator, Page } from "@playwright/test";
import {
  behavioralIsoDay,
  expect,
  isolatedTestUser,
  loginThroughSetup,
  test,
} from "./support/fixtures";
import { openAdaptiveFoodComposer, usesDesktopWorkspace } from "./support/adaptiveComposer";

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

const openFoodComposer = openAdaptiveFoodComposer;

function mealSection(page: Page, mealType: MealType) {
  if (usesDesktopWorkspace(page)) {
    return page.getByRole("region", { name: MEAL_LABELS[mealType], exact: true });
  }
  return page.getByRole("button", { name: new RegExp(`^${MEAL_LABELS[mealType]}\\b`) }).locator("..");
}

async function openMeal(page: Page, mealType: MealType) {
  const button = usesDesktopWorkspace(page)
    ? mealSection(page, mealType).getByRole("button", { name: MEAL_LABELS[mealType], exact: true })
    : page.getByRole("button", { name: new RegExp(`^${MEAL_LABELS[mealType]}\\b`) });
  if ((await button.getAttribute("aria-expanded")) === "false") await button.click();
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

async function expandEditorSchedule(dialog: Locator): Promise<void> {
  const disclosure = dialog.getByRole("button", { name: "Date · Meal", exact: true });
  await expect(disclosure).toBeVisible();
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") {
    await disclosure.click();
  }
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
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

    await expectLoggingSuccess(page, 2);
    if (usesDesktopWorkspace(page)) {
      await expect(page.getByRole("row", { name: /banana|egg/i })).toHaveCount(2);
    } else {
      await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(2);
    }

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
      await openMeal(page, mealType);
      for (const entry of entries) {
        await expect(
          savedFood(page, mealType, new RegExp(`^${escapeRegExp(entry.name)}(?:\\s|$)`)),
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
    await openMeal(page, "lunch");
    await savedFood(page, "lunch", new RegExp(`^${escapeRegExp(seedName)}\\b`)).click();

    if (usesDesktopWorkspace(page)) {
      const editor = page.getByRole("form", { name: `Edit ${seedName}`, exact: true });
      await expect(editor).toBeVisible();
      await editor
        .getByLabel("What should change?")
        .fill("Make the saved serving exactly twice as large and double every nutrition value.");
      await editor.getByRole("button", { name: "Send & save", exact: true }).click();
      await expect(editor).toBeHidden();

      await page.reload();
      const persistedDay = await readDayThroughSession(page, day);
      expect(persistedDay.meals.lunch).toHaveLength(1);
      const persisted = persistedDay.meals.lunch[0];
      expect(persisted.name).toBe(seedName);
      expect(persisted.calories).toBeGreaterThan(300);
      expect(persisted.protein).toBeGreaterThan(20);
      expect(persisted.carbs).toBeGreaterThan(30);
      expect(persisted.fats).toBeGreaterThan(10);
      expect(persisted.fiber).toBeGreaterThan(5);
      await openMeal(page, "lunch");
      await expect(
        savedFood(
          page,
          "lunch",
          new RegExp(`^${escapeRegExp(seedName)}\\b.*${persisted.calories}\\s*kcal`),
        ),
      ).toBeVisible();
      return;
    }

    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAccessibleName(seedName);

    await dialog
      .getByLabel("What should change?")
      .fill("Make the saved serving exactly twice as large and double every nutrition value.");
    await dialog.getByRole("button", { name: "Preview" }).click();
    const proposedResult = dialog.getByText("Result", { exact: true }).locator("..");
    await expect(proposedResult).toBeVisible();
    await expect(proposedResult.getByText(seedName, { exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "Edit fields" }).click();
    await expect(dialog).toHaveAccessibleName(seedName);
    await expect(dialog.getByLabel("Name")).toHaveValue(seedName);
    await expandEditorSchedule(dialog);
    await expect(
      dialog.getByRole("textbox", { name: "Date", exact: true }),
    ).toHaveValue(day);
    await expect(
      dialog.getByRole("combobox", { name: "Meal", exact: true }),
    ).toContainText("Lunch");
    const proposedCalories = Number(
      await dialog.getByLabel("Calories", { exact: true }).inputValue(),
    );
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

    await dialog.getByRole("button", { name: "Save" }).click();
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

    await expect(mealSection(page, "lunch").getByRole("button", { name: /^Lunch\b/ })).toContainText(
      new RegExp(`${proposedCalories}\\s*kcal\\b`),
    );
    await openMeal(page, "lunch");
    await expect(
      savedFood(page, "lunch", new RegExp(`^${escapeRegExp(seedName)}\\b`)),
    ).toBeVisible();
  });
});
