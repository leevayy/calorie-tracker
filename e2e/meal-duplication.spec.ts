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

async function arrangeMeals(
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

async function openDuplicateForm(detail: Locator, sourceMeal: string): Promise<Locator> {
  await detail
    .getByRole("button", { name: `Duplicate ${sourceMeal}`, exact: true })
    .click();
  const form = detail.getByRole("form", { name: `Duplicate ${sourceMeal} form`, exact: true });
  await expect(form).toBeVisible();
  return form;
}

async function submitDuplicate(
  detail: Locator,
  form: Locator,
  destinationDay: string,
  destinationMeal: string,
): Promise<Locator> {
  await form.getByLabel("Destination day").fill(destinationDay);
  await form.getByLabel("Destination meal").selectOption({ label: destinationMeal });
  await form.getByRole("button", { name: "Duplicate meal" }).click();
  const status = detail.getByRole("status");
  await expect(status).toContainText(
    `Entries copied: 2. ${destinationMeal}, ${inlineDisplayDay(destinationDay)}.`,
  );
  return status;
}

async function openCopiedDay(page: Page, status: Locator, day: string): Promise<Locator> {
  await status.getByRole("button", { name: "Open copied day" }).click();
  const detail = page.getByRole("region", { name: displayDay(day), exact: true });
  await expect(detail).toBeVisible();
  return detail;
}

async function editEntry(
  page: Page,
  detail: Locator,
  meal: string,
  name: string,
): Promise<Locator> {
  await (await revealEntry(detail, meal, name)).click();
  const namedDialog = page.getByRole("dialog", { name: "Correct food" });
  await expect(namedDialog).toBeVisible();
  const dialog = page.locator('[data-slot="dialog-content"]');
  await expect(dialog).toHaveCount(1);
  await dialog.getByRole("button", { name: "Edit fields" }).click();
  await dialog.getByRole("button", { name: "Nutrition details" }).click();
  return dialog;
}

async function save(dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
}

const SOURCE_DAY = calendarIsoDay(-3);
const DESTINATION_DAY = calendarIsoDay(-1);

function sourceMealEntries(): E2ESeedEntry[] {
  return [
    {
      day: SOURCE_DAY,
      mealType: "breakfast",
      name: "Duplicate oatmeal",
      calories: 305,
      protein: 13.5,
      carbs: 50,
      fats: 8.5,
      fiber: 7,
      portion: "1 ceramic bowl",
      mealSlug: "duplicate-oatmeal",
    },
    {
      day: SOURCE_DAY,
      mealType: "breakfast",
      name: "Duplicate berries",
      calories: 200,
      protein: 2,
      carbs: 42,
      fats: 1,
      fiber: 9,
      portion: "250 g",
      mealSlug: "duplicate-berries",
    },
  ];
}

test.describe("Historical meal duplication", () => {
  test("chooses an explicit destination for a historical meal", async ({
    page,
    e2eControls,
  }) => {
    await arrangeMeals(page, e2eControls, sourceMealEntries());
    let detail = await openDay(page, SOURCE_DAY);
    const form = await openDuplicateForm(detail, "Breakfast");

    await form.getByLabel("Destination day").fill(DESTINATION_DAY);
    await form.getByLabel("Destination meal").selectOption("dinner");
    await expect(form.getByLabel("Destination day")).toHaveValue(DESTINATION_DAY);
    await expect(form.getByLabel("Destination meal")).toHaveValue("dinner");
    await form.getByRole("button", { name: "Duplicate meal" }).click();

    const status = detail.getByRole("status");
    await expect(status).toContainText(
      `Entries copied: 2. Dinner, ${inlineDisplayDay(DESTINATION_DAY)}.`,
    );
    detail = await openCopiedDay(page, status, DESTINATION_DAY);
    await expect(await revealEntry(detail, "Dinner", "Duplicate oatmeal")).toBeVisible();
    await expect(await revealEntry(detail, "Dinner", "Duplicate berries")).toBeVisible();

    await page.reload();
    detail = await openDay(page, DESTINATION_DAY);
    await expect(await revealEntry(detail, "Dinner", "Duplicate oatmeal")).toBeVisible();
    await expect(await revealEntry(detail, "Dinner", "Duplicate berries")).toBeVisible();
  });

  test("duplicates every food atomically with stored nutrition", async ({
    page,
    e2eControls,
  }) => {
    await arrangeMeals(page, e2eControls, sourceMealEntries());
    let detail = await openDay(page, SOURCE_DAY);
    const form = await openDuplicateForm(detail, "Breakfast");
    const status = await submitDuplicate(detail, form, DESTINATION_DAY, "Lunch");
    detail = await openCopiedDay(page, status, DESTINATION_DAY);

    let dialog = await editEntry(page, detail, "Lunch", "Duplicate oatmeal");
    await expect(dialog.getByLabel("Portion")).toHaveValue("1 ceramic bowl");
    await expect(dialog.getByLabel("Calories")).toHaveValue("305");
    await expect(dialog.getByLabel("Protein")).toHaveValue("13.5");
    await expect(dialog.getByLabel("Carbohydrates")).toHaveValue("50");
    await expect(dialog.getByLabel("Fat")).toHaveValue("8.5");
    await expect(dialog.getByLabel("Fiber")).toHaveValue("7");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    dialog = await editEntry(page, detail, "Lunch", "Duplicate berries");
    await expect(dialog.getByLabel("Portion")).toHaveValue("250 g");
    await expect(dialog.getByLabel("Calories")).toHaveValue("200");
    await expect(dialog.getByLabel("Protein")).toHaveValue("2");
    await expect(dialog.getByLabel("Carbohydrates")).toHaveValue("42");
    await expect(dialog.getByLabel("Fat")).toHaveValue("1");
    await expect(dialog.getByLabel("Fiber")).toHaveValue("9");

    await page.reload();
    detail = await openDay(page, DESTINATION_DAY);
    await expect(detail.getByText("505 kcal", { exact: true })).toBeVisible();
    await expect(await revealEntry(detail, "Lunch", "Duplicate oatmeal")).toBeVisible();
    await expect(await revealEntry(detail, "Lunch", "Duplicate berries")).toBeVisible();
    await expect(entryButton(detail, "Duplicate oatmeal")).toHaveCount(1);
    await expect(entryButton(detail, "Duplicate berries")).toHaveCount(1);
  });

  test("keeps the source meal unchanged after duplication and reload", async ({
    page,
    e2eControls,
  }) => {
    await arrangeMeals(page, e2eControls, sourceMealEntries());
    let detail = await openDay(page, SOURCE_DAY);
    const form = await openDuplicateForm(detail, "Breakfast");
    await submitDuplicate(detail, form, DESTINATION_DAY, "Snack");

    await page.reload();
    await expect(dayButton(page, SOURCE_DAY)).toContainText("505 / 2000 kcal");
    await expect(dayButton(page, DESTINATION_DAY)).toContainText("505 / 2000 kcal");
    detail = await openDay(page, SOURCE_DAY);
    await expect(detail.getByText("505 kcal", { exact: true })).toBeVisible();
    await expect(await revealEntry(detail, "Breakfast", "Duplicate oatmeal")).toBeVisible();
    await expect(await revealEntry(detail, "Breakfast", "Duplicate berries")).toBeVisible();
    await expect(entryButton(detail, "Duplicate oatmeal")).toHaveCount(1);
    await expect(entryButton(detail, "Duplicate berries")).toHaveCount(1);
  });

  test("edits a copied entry and undoes its deletion", async ({ page, e2eControls }) => {
    await arrangeMeals(page, e2eControls, sourceMealEntries());
    let detail = await openDay(page, SOURCE_DAY);
    const form = await openDuplicateForm(detail, "Breakfast");
    const status = await submitDuplicate(detail, form, DESTINATION_DAY, "Snack");
    detail = await openCopiedDay(page, status, DESTINATION_DAY);

    let dialog = await editEntry(page, detail, "Snack", "Duplicate oatmeal");
    await dialog.getByLabel("Name").fill("Edited copied oatmeal");
    await dialog.getByLabel("Calories").fill("350");
    await save(dialog);

    dialog = await editEntry(page, detail, "Snack", "Edited copied oatmeal");
    await dialog.getByRole("button", { name: "Delete entry" }).click();
    await expect(dialog).toBeHidden();
    const undoStatus = detail.getByRole("status");
    await expect(undoStatus).toContainText("Edited copied oatmeal was deleted.");
    await undoStatus.getByRole("button", { name: "Undo" }).click();
    await expect(undoStatus).toBeHidden();
    await expect(await revealEntry(detail, "Snack", "Edited copied oatmeal")).toBeVisible();

    await page.reload();
    detail = await openDay(page, DESTINATION_DAY);
    dialog = await editEntry(page, detail, "Snack", "Edited copied oatmeal");
    await expect(dialog.getByLabel("Calories")).toHaveValue("350");
    await expect(dialog.getByLabel("Portion")).toHaveValue("1 ceramic bowl");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(await revealEntry(detail, "Snack", "Duplicate berries")).toBeVisible();
  });

  test("rolls back a failed historical meal duplication", async ({ page, e2eControls }) => {
    const destinationAnchor: E2ESeedEntry = {
      day: DESTINATION_DAY,
      mealType: "dinner",
      name: "Rollback anchor",
      calories: 75,
      protein: 5,
      carbs: 8,
      fats: 2,
      fiber: 1,
      mealSlug: "rollback-anchor",
    };
    await arrangeMeals(page, e2eControls, [...sourceMealEntries(), destinationAnchor]);
    let detail = await openDay(page, SOURCE_DAY);
    const form = await openDuplicateForm(detail, "Breakfast");
    await form.getByLabel("Destination day").fill(DESTINATION_DAY);
    await form.getByLabel("Destination meal").selectOption("dinner");
    await e2eControls.failNextBatchSave();
    await form.getByRole("button", { name: "Duplicate meal" }).click();

    await expect(form.getByRole("alert")).toHaveText("Request failed. Please try again.");
    await expect(await revealEntry(detail, "Breakfast", "Duplicate oatmeal")).toBeVisible();
    await expect(await revealEntry(detail, "Breakfast", "Duplicate berries")).toBeVisible();
    await detail.getByRole("button", { name: "Back to history" }).click();
    await expect(dayButton(page, SOURCE_DAY)).toContainText("505 / 2000 kcal");
    await expect(dayButton(page, DESTINATION_DAY)).toContainText("75 / 2000 kcal");

    await page.reload();
    await expect(dayButton(page, SOURCE_DAY)).toContainText("505 / 2000 kcal");
    await expect(dayButton(page, DESTINATION_DAY)).toContainText("75 / 2000 kcal");
    detail = await openDay(page, DESTINATION_DAY);
    await expect(await revealEntry(detail, "Dinner", "Rollback anchor")).toBeVisible();
    await expect(entryButton(detail, "Duplicate oatmeal")).toHaveCount(0);
    await expect(entryButton(detail, "Duplicate berries")).toHaveCount(0);
  });
});
