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

async function arrangeHistory(
  page: Page,
  e2eControls: E2EControlClient,
  entries: E2ESeedEntry[],
): Promise<void> {
  const user = isolatedTestUser({ entries });
  await e2eControls.reset([user]);
  await loginThroughSetup(page, user);
}

async function openHistory(page: Page): Promise<void> {
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
}

function historyDayButton(page: Page, day: string): Locator {
  return page.getByRole("button", {
    name: `Open log: ${inlineDisplayDay(day)}`,
    exact: true,
  });
}

async function openHistoryDay(page: Page, day: string): Promise<Locator> {
  const button = historyDayButton(page, day);
  await expect(button).toBeVisible();
  await button.click();
  const detail = page.getByRole("region", { name: displayDay(day), exact: true });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("Itemized daily log", { exact: true })).toBeVisible();
  return detail;
}

async function revealEntry(detail: Locator, meal: string, entryName: string): Promise<Locator> {
  const entry = detail.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(entryName)}\\b`),
  });
  if (!(await entry.isVisible())) {
    await detail.getByRole("button", { name: new RegExp(`^${meal}\\b`) }).click();
  }
  await expect(entry).toBeVisible();
  return entry;
}

async function openFieldsEditor(
  page: Page,
  detail: Locator,
  meal: string,
  entryName: string,
): Promise<Locator> {
  await (await revealEntry(detail, meal, entryName)).click();
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

async function chooseEditorMeal(dialog: Locator, meal: string): Promise<void> {
  await expandEditorSchedule(dialog);
  await dialog.getByRole("combobox", { name: "Meal", exact: true }).click();
  await dialog.page().getByRole("option", { name: meal, exact: true }).click();
}

async function saveEditor(dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
}

const TODAY = calendarIsoDay(0);
const HISTORY_DAY = calendarIsoDay(-1);
const DESTINATION_DAY = calendarIsoDay(-2);

test.describe("History detail", () => {
  test("opens a history day with itemized meals and totals", async ({ page, e2eControls }) => {
    await arrangeHistory(page, e2eControls, [
      {
        day: HISTORY_DAY,
        mealType: "breakfast",
        name: "History oatmeal",
        calories: 320,
        protein: 12,
        carbs: 52,
        fats: 8,
        fiber: 7,
        portion: "1 bowl",
        mealSlug: "history-oatmeal",
      },
      {
        day: HISTORY_DAY,
        mealType: "dinner",
        name: "History salmon",
        calories: 480,
        protein: 42,
        carbs: 18,
        fats: 24,
        fiber: 5,
        portion: "1 plate",
        mealSlug: "history-salmon",
      },
    ]);
    await openHistory(page);

    let detail = await openHistoryDay(page, HISTORY_DAY);
    await expect(detail.getByText("800 kcal", { exact: true })).toBeVisible();
    await expect(detail.getByText("P 54\u00a0g", { exact: true })).toBeVisible();
    await expect(detail.getByText("C 70\u00a0g", { exact: true })).toBeVisible();
    await expect(await revealEntry(detail, "Breakfast", "History oatmeal")).toBeVisible();
    await expect(await revealEntry(detail, "Dinner", "History salmon")).toBeVisible();

    await detail.getByRole("button", { name: "Back to history" }).click();
    await page.reload();
    detail = await openHistoryDay(page, HISTORY_DAY);
    await expect(detail.getByText("800 kcal", { exact: true })).toBeVisible();

    await detail.getByRole("button", { name: "Back to history" }).click();
    detail = await openHistoryDay(page, TODAY);
    await expect(detail.getByText("No log for this day.", { exact: true })).toBeVisible();
  });

  test("edits moves deletes and undoes from history detail", async ({ page, e2eControls }) => {
    await arrangeHistory(page, e2eControls, [
      {
        day: HISTORY_DAY,
        mealType: "breakfast",
        name: "History workflow",
        calories: 360,
        protein: 24,
        carbs: 45,
        fats: 10,
        fiber: 6,
        portion: "1 plate",
        mealSlug: "history-workflow",
      },
      {
        day: HISTORY_DAY,
        mealType: "dinner",
        name: "History anchor",
        calories: 100,
        protein: 5,
        carbs: 12,
        fats: 3,
        fiber: 2,
        mealSlug: "history-anchor",
      },
    ]);
    await openHistory(page);
    let detail = await openHistoryDay(page, HISTORY_DAY);

    let editor = await openFieldsEditor(page, detail, "Breakfast", "History workflow");
    await editor.getByLabel("Name").fill("Corrected history workflow");
    await editor.getByLabel("Calories").fill("400");
    await saveEditor(editor);

    editor = await openFieldsEditor(page, detail, "Breakfast", "Corrected history workflow");
    await expandEditorSchedule(editor);
    await editor.getByRole("textbox", { name: "Date", exact: true }).fill(DESTINATION_DAY);
    await chooseEditorMeal(editor, "Lunch");
    await saveEditor(editor);

    await detail.getByRole("button", { name: "Back to history" }).click();
    detail = await openHistoryDay(page, DESTINATION_DAY);
    editor = await openFieldsEditor(page, detail, "Lunch", "Corrected history workflow");
    await editor.getByRole("button", { name: "Delete entry" }).click();
    await expect(editor).toBeHidden();

    const undoStatus = detail.getByRole("status");
    await expect(undoStatus).toContainText("Corrected history workflow was deleted.");
    await undoStatus.getByRole("button", { name: "Undo" }).click();
    await expect(undoStatus).toBeHidden();
    await expect(await revealEntry(detail, "Lunch", "Corrected history workflow")).toBeVisible();

    await page.reload();
    detail = await openHistoryDay(page, DESTINATION_DAY);
    editor = await openFieldsEditor(page, detail, "Lunch", "Corrected history workflow");
    await expect(editor.getByLabel("Calories")).toHaveValue("400");
    await expandEditorSchedule(editor);
    await expect(
      editor.getByRole("textbox", { name: "Date", exact: true }),
    ).toHaveValue(DESTINATION_DAY);
    await expect(
      editor.getByRole("combobox", { name: "Meal", exact: true }),
    ).toContainText("Lunch");
  });

  test("reconciles history detail and aggregate after a correction", async ({
    page,
    e2eControls,
  }) => {
    await arrangeHistory(page, e2eControls, [
      {
        day: HISTORY_DAY,
        mealType: "breakfast",
        name: "Correctable bowl",
        calories: 300,
        protein: 15,
        carbs: 40,
        fats: 8,
        fiber: 5,
        mealSlug: "correctable-bowl",
      },
      {
        day: HISTORY_DAY,
        mealType: "dinner",
        name: "Aggregate anchor",
        calories: 200,
        protein: 20,
        carbs: 10,
        fats: 9,
        fiber: 2,
        mealSlug: "aggregate-anchor",
      },
    ]);
    await openHistory(page);
    let detail = await openHistoryDay(page, HISTORY_DAY);
    const editor = await openFieldsEditor(page, detail, "Breakfast", "Correctable bowl");
    await editor.getByLabel("Calories").fill("450");
    await editor.getByLabel("Protein").fill("30");
    await saveEditor(editor);

    await expect(detail.getByText("650 kcal", { exact: true })).toBeVisible();
    await expect(detail.getByText("P 50\u00a0g", { exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "Back to history" }).click();
    await expect(historyDayButton(page, HISTORY_DAY)).toContainText("650 / 2000 kcal");

    await page.reload();
    await expect(historyDayButton(page, HISTORY_DAY)).toContainText("650 / 2000 kcal");
    detail = await openHistoryDay(page, HISTORY_DAY);
    await expect(detail.getByText("650 kcal", { exact: true })).toBeVisible();
    await expect(detail.getByText("P 50\u00a0g", { exact: true })).toBeVisible();
  });

  test("returns to the same history scroll context", async ({ page, e2eControls }) => {
    const entries: E2ESeedEntry[] = Array.from({ length: 7 }, (_, index) => ({
      day: calendarIsoDay(-index),
      mealType: "breakfast",
      name: `Scroll meal ${index}`,
      calories: 100 + index,
      protein: 10,
      carbs: 12,
      fats: 3,
      fiber: 2,
      mealSlug: `scroll-meal-${index}`,
    }));
    await arrangeHistory(page, e2eControls, entries);
    await openHistory(page);

    const target = historyDayButton(page, calendarIsoDay(-6));
    await target.scrollIntoViewIfNeeded();
    const beforeTop = await target.evaluate((element) => element.getBoundingClientRect().top);
    await target.click();
    const detail = page.getByRole("region", { name: displayDay(calendarIsoDay(-6)), exact: true });
    await expect(detail).toBeVisible();
    await detail.getByRole("button", { name: "Back to history" }).click();

    await expect(target).toBeInViewport();
    await expect
      .poll(async () => target.evaluate((element) => element.getBoundingClientRect().top))
      .toBeCloseTo(beforeTop, 0);
  });
});
