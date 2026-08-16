import type { Locator, Page } from "@playwright/test";
import {
  calendarIsoDay,
  expect,
  isolatedTestUser,
  loginThroughSetup,
  test,
  type E2EControlClient,
  type E2ESeedEntry,
} from "./support/fixtures";

function displayDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

function inlineDisplayDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function arrangeEntries(
  page: Page,
  e2eControls: E2EControlClient,
  entries: E2ESeedEntry[],
): Promise<void> {
  const user = isolatedTestUser({ entries });
  await e2eControls.reset([user]);
  await loginThroughSetup(page, user);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page).toHaveURL(/\/history$/);
}

function dayButton(page: Page, day: string): Locator {
  return page.getByRole("button", {
    name: `Open log: ${inlineDisplayDay(day)}`,
    exact: true,
  });
}

async function openDay(page: Page, day: string): Promise<Locator> {
  const button = dayButton(page, day);
  await expect(button).toBeVisible();
  await button.click();
  const detail = page.getByRole("region", { name: displayDay(day), exact: true });
  await expect(detail).toBeVisible();
  return detail;
}

function entryButton(detail: Locator, name: string): Locator {
  return detail.getByRole("button", { name: new RegExp(`^${escapeRegExp(name)}\\b`) });
}

async function revealEntry(detail: Locator, meal: string, name: string): Promise<Locator> {
  const entry = entryButton(detail, name);
  if (!(await entry.isVisible())) {
    await detail.getByRole("button", { name: new RegExp(`^${meal}\\b`) }).click();
  }
  await expect(entry).toBeVisible();
  return entry;
}

async function editEntry(
  page: Page,
  detail: Locator,
  meal: string,
  name: string,
): Promise<Locator> {
  await (await revealEntry(detail, meal, name)).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Correct food");
  await dialog.getByRole("button", { name: "Edit fields" }).click();
  await expect(dialog).toHaveAccessibleName("Edit food");
  await dialog.getByRole("button", { name: "Nutrition details" }).click();
  return dialog;
}

async function expandEditorSchedule(dialog: Locator): Promise<void> {
  const disclosure = dialog.getByRole("button", { name: "Date · Meal", exact: true });
  await expect(disclosure).toBeVisible();
  await dialog.evaluate(async (editor) => {
    await Promise.all(
      editor
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") {
    await disclosure.click();
  }
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
}

async function selectMeal(dialog: Locator, meal: string): Promise<void> {
  await expandEditorSchedule(dialog);
  await dialog.getByRole("combobox", { name: "Meal", exact: true }).click();
  await dialog.page().getByRole("option", { name: meal, exact: true }).click();
}

async function save(dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
}

const SOURCE_DAY = calendarIsoDay(-1);
const DESTINATION_DAY = calendarIsoDay(-2);

test.describe("Entry movement and deletion", () => {
  test("moves an entry to another meal and day without changing nutrition", async ({
    page,
    e2eControls,
  }) => {
    await arrangeEntries(page, e2eControls, [
      {
        day: SOURCE_DAY,
        mealType: "breakfast",
        name: "Move intact bowl",
        calories: 420,
        protein: 31,
        carbs: 42,
        fats: 14,
        fiber: 6,
        portion: "1 large bowl",
        mealSlug: "move-intact-bowl",
      },
    ]);
    let detail = await openDay(page, SOURCE_DAY);
    let dialog = await editEntry(page, detail, "Breakfast", "Move intact bowl");
    await expandEditorSchedule(dialog);
    await dialog.getByRole("textbox", { name: "Date", exact: true }).fill(DESTINATION_DAY);
    await selectMeal(dialog, "Dinner");
    await save(dialog);
    await expect(detail.getByText("No log for this day.", { exact: true })).toBeVisible();

    await detail.getByRole("button", { name: "Back to history" }).click();
    detail = await openDay(page, DESTINATION_DAY);
    dialog = await editEntry(page, detail, "Dinner", "Move intact bowl");
    await expect(dialog.getByLabel("Portion")).toHaveValue("1 large bowl");
    await expect(dialog.getByLabel("Calories")).toHaveValue("420");
    await expect(dialog.getByLabel("Protein")).toHaveValue("31");
    await expect(dialog.getByLabel("Carbohydrates")).toHaveValue("42");
    await expect(dialog.getByLabel("Fat")).toHaveValue("14");
    await expect(dialog.getByLabel("Fiber")).toHaveValue("6");

    await page.reload();
    detail = await openDay(page, DESTINATION_DAY);
    dialog = await editEntry(page, detail, "Dinner", "Move intact bowl");
    await expandEditorSchedule(dialog);
    await expect(
      dialog.getByRole("textbox", { name: "Date", exact: true }),
    ).toHaveValue(DESTINATION_DAY);
    await expect(
      dialog.getByRole("combobox", { name: "Meal", exact: true }),
    ).toContainText("Dinner");
    await expect(dialog.getByLabel("Calories")).toHaveValue("420");
  });

  test("reconciles source and destination totals once after a move and reload", async ({
    page,
    e2eControls,
  }) => {
    await arrangeEntries(page, e2eControls, [
      {
        day: SOURCE_DAY,
        mealType: "breakfast",
        name: "Moving entree",
        calories: 300,
        protein: 25,
        carbs: 30,
        fats: 9,
        fiber: 4,
        mealSlug: "moving-entree",
      },
      {
        day: SOURCE_DAY,
        mealType: "dinner",
        name: "Source anchor",
        calories: 100,
        protein: 5,
        carbs: 10,
        fats: 4,
        fiber: 2,
        mealSlug: "source-anchor",
      },
      {
        day: DESTINATION_DAY,
        mealType: "dinner",
        name: "Destination anchor",
        calories: 50,
        protein: 3,
        carbs: 7,
        fats: 1,
        fiber: 1,
        mealSlug: "destination-anchor",
      },
    ]);
    let detail = await openDay(page, SOURCE_DAY);
    const dialog = await editEntry(page, detail, "Breakfast", "Moving entree");
    await expandEditorSchedule(dialog);
    await dialog.getByRole("textbox", { name: "Date", exact: true }).fill(DESTINATION_DAY);
    await selectMeal(dialog, "Dinner");
    await save(dialog);
    await expect(detail.getByText("100 kcal", { exact: true })).toBeVisible();

    await detail.getByRole("button", { name: "Back to history" }).click();
    await expect(dayButton(page, SOURCE_DAY)).toContainText("100 / 2000 kcal");
    await expect(dayButton(page, DESTINATION_DAY)).toContainText("350 / 2000 kcal");

    await page.reload();
    await expect(dayButton(page, SOURCE_DAY)).toContainText("100 / 2000 kcal");
    await expect(dayButton(page, DESTINATION_DAY)).toContainText("350 / 2000 kcal");
    detail = await openDay(page, DESTINATION_DAY);
    await expect(await revealEntry(detail, "Dinner", "Moving entree")).toBeVisible();
    await expect(entryButton(detail, "Moving entree")).toHaveCount(1);
  });

  test("deletes a saved entry and offers temporary Undo", async ({ page, e2eControls }) => {
    await arrangeEntries(page, e2eControls, [
      {
        day: SOURCE_DAY,
        mealType: "breakfast",
        name: "Delete toast",
        calories: 220,
        protein: 8,
        carbs: 34,
        fats: 6,
        fiber: 4,
        mealSlug: "delete-toast",
      },
      {
        day: SOURCE_DAY,
        mealType: "dinner",
        name: "Delete anchor",
        calories: 80,
        protein: 4,
        carbs: 8,
        fats: 3,
        fiber: 1,
        mealSlug: "delete-anchor",
      },
    ]);
    let detail = await openDay(page, SOURCE_DAY);
    const dialog = await editEntry(page, detail, "Breakfast", "Delete toast");
    await dialog.getByRole("button", { name: "Delete entry" }).click();
    await expect(dialog).toBeHidden();
    await expect(entryButton(detail, "Delete toast")).toHaveCount(0);
    await expect(detail.getByText("80 kcal", { exact: true })).toBeVisible();

    const status = detail.getByRole("status");
    await expect(status).toContainText("Delete toast was deleted.");
    await expect(status.getByRole("button", { name: "Undo" })).toBeVisible();

    await page.reload();
    detail = await openDay(page, SOURCE_DAY);
    await detail.getByRole("button", { name: /^Breakfast\b/ }).click();
    await expect(entryButton(detail, "Delete toast")).toHaveCount(0);
    await expect(detail.getByText("80 kcal", { exact: true })).toBeVisible();
    await expect(detail.getByRole("status")).toHaveCount(0);
  });

  test("restores the complete deleted entry to its original day and meal", async ({
    page,
    e2eControls,
  }) => {
    await arrangeEntries(page, e2eControls, [
      {
        day: SOURCE_DAY,
        mealType: "snack",
        name: "Restorable yogurt",
        calories: 185,
        protein: 16.5,
        carbs: 19,
        fats: 5.5,
        fiber: 2.5,
        portion: "170 g cup",
        mealSlug: "restorable-yogurt",
      },
    ]);
    let detail = await openDay(page, SOURCE_DAY);
    let dialog = await editEntry(page, detail, "Snack", "Restorable yogurt");
    await dialog.getByRole("button", { name: "Delete entry" }).click();
    const status = detail.getByRole("status");
    await expect(status).toContainText("Restorable yogurt was deleted.");
    await status.getByRole("button", { name: "Undo" }).click();
    await expect(status).toBeHidden();
    await expect(await revealEntry(detail, "Snack", "Restorable yogurt")).toBeVisible();

    await page.reload();
    detail = await openDay(page, SOURCE_DAY);
    dialog = await editEntry(page, detail, "Snack", "Restorable yogurt");
    await expect(dialog.getByLabel("Portion")).toHaveValue("170 g cup");
    await expect(dialog.getByLabel("Calories")).toHaveValue("185");
    await expect(dialog.getByLabel("Protein")).toHaveValue("16.5");
    await expect(dialog.getByLabel("Carbohydrates")).toHaveValue("19");
    await expect(dialog.getByLabel("Fat")).toHaveValue("5.5");
    await expect(dialog.getByLabel("Fiber")).toHaveValue("2.5");
    await expandEditorSchedule(dialog);
    await expect(
      dialog.getByRole("textbox", { name: "Date", exact: true }),
    ).toHaveValue(SOURCE_DAY);
    await expect(
      dialog.getByRole("combobox", { name: "Meal", exact: true }),
    ).toContainText("Snack");
  });
});
