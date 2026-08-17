import type { Locator, Page } from "@playwright/test";
import {
  behavioralIsoDay,
  calendarIsoDay,
  expect,
  isolatedTestUser,
  loginThroughSetup,
  test,
} from "./support/fixtures";
import { usesDesktopWorkspace } from "./support/adaptiveComposer";

const MIN_TARGET_PX = 44;
const GEOMETRY_TOLERANCE_PX = 1;
const EDITOR_ENTRY = "Shared schedule editor entry";
const HISTORY_ENTRY = "Shared schedule history entry";
const HISTORY_DAY = calendarIsoDay(-3);

const SCHEDULE_LOCALES = [
  {
    code: "en" as const,
    history: "History",
    date: "Date",
    meal: "Meal",
    lunch: "Lunch",
    dinner: "Dinner",
    breakfast: "Breakfast",
    meals: ["Breakfast", "Lunch", "Dinner", "Snack"],
    editFields: "Edit fields",
    schedule: "Date · Meal",
    duplicate: "Duplicate Breakfast",
    duplicateForm: "Duplicate Breakfast",
    invalidDate: "Enter a valid date.",
    confirmDuplicate: "Duplicate",
    openDayPattern: /^Open log:/,
  },
  {
    code: "ru" as const,
    history: "История",
    date: "Дата",
    meal: "Приём пищи",
    lunch: "Обед",
    dinner: "Ужин",
    breakfast: "Завтрак",
    meals: ["Завтрак", "Обед", "Ужин", "Перекус"],
    editFields: "Изменить поля",
    schedule: "Дата · Приём пищи",
    duplicate: "Дублировать: Завтрак",
    duplicateForm: "Дублирование: Завтрак",
    invalidDate: "Введите корректную дату.",
    confirmDuplicate: "Дублировать",
    openDayPattern: /^Открыть записи за/,
  },
  {
    code: "pl" as const,
    history: "Historia",
    date: "Data",
    meal: "Posiłek",
    lunch: "Obiad",
    dinner: "Kolacja",
    breakfast: "Śniadanie",
    meals: ["Śniadanie", "Obiad", "Kolacja", "Przekąska"],
    editFields: "Edytuj pola",
    schedule: "Data · Posiłek",
    duplicate: "Duplikuj: Śniadanie",
    duplicateForm: "Formularz duplikowania: Śniadanie",
    invalidDate: "Wpisz prawidłową datę.",
    confirmDuplicate: "Duplikuj posiłek",
    openDayPattern: /^Otwórz dziennik z/,
  },
  {
    code: "tt" as const,
    history: "Тарих",
    date: "Дата",
    meal: "Аш төре",
    lunch: "Өстәнге аш",
    dinner: "Кичке аш",
    breakfast: "Иртәнге аш",
    meals: ["Иртәнге аш", "Өстәнге аш", "Кичке аш", "Ара аш"],
    editFields: "Кырларны үзгәртү",
    schedule: "Дата · Аш төре",
    duplicate: "Күчереп кабатлау: Иртәнге аш",
    duplicateForm: "Иртәнге аш күчереп кабатлау формасы",
    invalidDate: "Дөрес дата кертегез.",
    confirmDuplicate: "Ашауны күчереп кабатлау",
    openDayPattern: /көненең журналын ачу$/,
  },
  {
    code: "kk" as const,
    history: "Тарих",
    date: "Күн",
    meal: "Ас түрі",
    lunch: "Түскі ас",
    dinner: "Кешкі ас",
    breakfast: "Таңғы ас",
    meals: ["Таңғы ас", "Түскі ас", "Кешкі ас", "Аралық ас"],
    editFields: "Өрістерді өңдеу",
    schedule: "Күн · Ас түрі",
    duplicate: "Көшіріп қосу: Таңғы ас",
    duplicateForm: "Таңғы ас көшіру пішіні",
    invalidDate: "Күнді дұрыс енгізіңіз.",
    confirmDuplicate: "Асты көшіріп қосу",
    openDayPattern: /күнінің журналын ашу$/,
  },
] as const;

async function expectMinimumTarget(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.width).toBeGreaterThanOrEqual(MIN_TARGET_PX - GEOMETRY_TOLERANCE_PX);
  expect(box.height).toBeGreaterThanOrEqual(MIN_TARGET_PX - GEOMETRY_TOLERANCE_PX);
}

async function expectDateBeforeMeal(date: Locator, meal: Locator): Promise<void> {
  const dateBox = await date.boundingBox();
  const mealBox = await meal.boundingBox();
  expect(dateBox).not.toBeNull();
  expect(mealBox).not.toBeNull();
  if (!dateBox || !mealBox) return;
  const sameRow = Math.abs(dateBox.y - mealBox.y) <= GEOMETRY_TOLERANCE_PX;
  expect(sameRow ? dateBox.x < mealBox.x : dateBox.y < mealBox.y).toBe(true);
}

async function expectContained(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(-GEOMETRY_TOLERANCE_PX);
  expect(box.x + box.width).toBeLessThanOrEqual(
    viewport.width + GEOMETRY_TOLERANCE_PX,
  );
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + GEOMETRY_TOLERANCE_PX);
}

async function exposeMealOptions(
  page: Page,
  meal: Locator,
  options: readonly string[],
  selected: string,
): Promise<void> {
  await meal.click();
  for (const option of options) {
    const optionControl = page.getByRole("option", { name: option, exact: true });
    await expect(optionControl).toBeVisible();
    await expectContained(page, optionControl);
  }
  await expectNoDocumentOverflow(page);
  await page.getByRole("option", { name: selected, exact: true }).click();
  await expect(meal).toHaveText(selected);
}

test.describe("Shared schedule inputs", () => {
  test("keeps Date and Meal behavior consistent across editing and duplication in every locale", async ({
    page,
    e2eControls,
  }) => {
    const desktop = usesDesktopWorkspace(page);
    for (const locale of SCHEDULE_LOCALES) {
      await test.step(locale.code, async () => {
        await page.setViewportSize(desktop
          ? { width: 1280, height: 900 }
          : { width: 320, height: 844 });
        const user = isolatedTestUser({
          profile: {
            dailyCalorieGoal: 2_000,
            weightKg: 70,
            heightCm: 175,
            preferredLanguage: locale.code,
            nutritionGoal: "maintain",
          },
          entries: [
            {
              day: behavioralIsoDay(),
              mealType: "lunch",
              name: EDITOR_ENTRY,
              calories: 410,
              protein: 24,
              carbs: 48,
              fats: 13,
              fiber: 7,
              portion: "1 bowl",
              mealSlug: `shared-editor-${locale.code}`,
            },
            {
              day: HISTORY_DAY,
              mealType: "breakfast",
              name: HISTORY_ENTRY,
              calories: 280,
              protein: 12,
              carbs: 42,
              fats: 8,
              fiber: 6,
              portion: "1 plate",
              mealSlug: `shared-history-${locale.code}`,
            },
          ],
        });
        await e2eControls.reset([user]);
        await loginThroughSetup(page, user);
        await expect(page.locator("html")).toHaveAttribute("lang", locale.code);

        const lunch = page.getByRole("region", { name: locale.lunch, exact: true });
        let editor: Locator;
        if (desktop) {
          await lunch.getByRole("row", { name: new RegExp(`^${EDITOR_ENTRY}`) }).click();
          editor = lunch.getByRole("form");
        } else {
          await page.getByRole("button", {
            name: new RegExp(`^${locale.lunch}(?:\\s|$)`),
          }).click();
          await page.getByRole("button", { name: new RegExp(`^${EDITOR_ENTRY}`) }).click();
          editor = page.getByRole("dialog", { name: EDITOR_ENTRY, exact: true });
          await editor.getByRole("button", { name: locale.editFields, exact: true }).click();
          await editor.getByRole("button", { name: locale.schedule, exact: true }).click();
        }
        await expect(editor).toBeVisible();
        const editorDate = editor.getByLabel(locale.date, { exact: true });
        const editorMeal = editor.getByRole("combobox", {
          name: locale.meal,
          exact: true,
        });
        await expectMinimumTarget(editorDate);
        await expectMinimumTarget(editorMeal);
        await expectDateBeforeMeal(editorDate, editorMeal);
        await expectContained(page, editorDate);
        await expectContained(page, editorMeal);
        await exposeMealOptions(page, editorMeal, locale.meals, locale.dinner);
        await expectNoDocumentOverflow(page);
        if (desktop) {
          await page.reload();
        } else {
          await page.keyboard.press("Escape");
        }
        await expect(editor).toBeHidden();

        await page.getByRole("button", { name: locale.history, exact: true }).click();
        await expect(page).toHaveURL(/\/history$/);
        await page
          .getByRole("button", { name: locale.openDayPattern })
          .filter({ hasText: /280\s*\/\s*2000/ })
          .click();
        const detail = page.locator('section[aria-labelledby="history-day-detail-title"]');
        await detail.getByRole("button", {
          name: new RegExp(`^${locale.breakfast}(?:\\s|$)`),
        }).click();
        await detail.getByRole("button", { name: locale.duplicate, exact: true }).click();
        const form = detail.getByRole("form", {
          name: locale.duplicateForm,
          exact: true,
        });
        const duplicateDate = form.getByLabel(locale.date, { exact: true });
        const duplicateMeal = form.getByRole("combobox", {
          name: locale.meal,
          exact: true,
        });
        const confirm = form.getByRole("button", {
          name: locale.confirmDuplicate,
          exact: true,
        });
        await expectMinimumTarget(duplicateDate);
        await expectMinimumTarget(duplicateMeal);
        await expectDateBeforeMeal(duplicateDate, duplicateMeal);
        await expectContained(page, duplicateDate);
        await expectContained(page, duplicateMeal);
        await exposeMealOptions(page, duplicateMeal, locale.meals, locale.dinner);

        await duplicateDate.clear();

        await expect(duplicateDate).toHaveAttribute("aria-invalid", "true");
        await expect(form.getByRole("alert")).toHaveText(locale.invalidDate);
        await expect(duplicateMeal).toHaveText(locale.dinner);
        await expect(confirm).toBeDisabled();

        await duplicateDate.fill(calendarIsoDay(-1));

        await expect(form.getByRole("alert")).toHaveCount(0);
        await expect(duplicateMeal).toHaveText(locale.dinner);
        await expect(confirm).toBeEnabled();
        await expectNoDocumentOverflow(page);
      });
    }
  });
});
