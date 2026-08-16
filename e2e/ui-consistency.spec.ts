import type { Locator, Page } from "@playwright/test";
import {
  behavioralIsoDay,
  calendarIsoDay,
  expect,
  isolatedTestUser,
  loginThroughSetup,
  test,
} from "./support/fixtures";

const MIN_PRIMARY_TARGET_PX = 44;
const GEOMETRY_TOLERANCE_PX = 1;

type UiLocale = {
  code: "en" | "ru";
  testTitle: string;
  appTitle: string;
  settings: string;
  account: string;
  home: string;
  history: string;
  calories: string;
  nutrients: string;
  previousDay: string;
  nextDay: string;
  logFoodPlaceholder: string;
  logFoodSuggestions: readonly string[];
  foodLogTitle: string;
  lunch: string;
  breakfast: string;
  editorHeaderMacros: readonly [string, string, string, string];
  editorInstruction: string;
  editorCorrectionInstruction: string;
  editorEditFields: string;
  editorBackToAi: string;
  editorPreview: string;
  editorProposedResult: string;
  editorProposalSummary: string;
  editorProposalMacros: readonly [string, string, string, string];
  editorCurrentResult: string;
  editorName: string;
  editorPortion: string;
  editorDetails: string;
  editorProtein: string;
  editorCarbs: string;
  editorFats: string;
  editorFiber: string;
  editorDate: string;
  editorMeal: string;
  editorDelete: string;
  editorSave: string;
  weeklySummary: string;
  openDayPrefix: string;
  historyUnit: string;
  dayDetail: string;
  itemizedMeals: string;
  backToHistory: string;
  duplicateBreakfast: string;
  duplicateBreakfastForm: string;
  destinationMeal: string;
  cancelDuplicate: string;
  confirmDuplicate: string;
  languageLabel: string;
  nutritionGoal: string;
  signOut: string;
  darkMode: string;
  authEmail: string;
  authPassword: string;
  authSignIn: string;
  homeEntryName: string;
  historyEntryName: string;
  homePortion: string;
  historyPortion: string;
};

const LOCALES: readonly UiLocale[] = [
  {
    code: "en",
    testTitle: "keeps English core screens contained and typographically consistent",
    appTitle: "Calorie Tracker",
    settings: "Settings",
    account: "Account",
    home: "Calorie Tracker",
    history: "History",
    calories: "Calories",
    nutrients: "Macros",
    previousDay: "Previous day",
    nextDay: "Next day",
    logFoodPlaceholder: "Log food",
    logFoodSuggestions: [
      "Chicken with mushrooms",
      "Ham sandwich",
      "Oatmeal with banana",
      "Tuna salad",
      "Cheese omelet",
      "Yogurt with berries",
    ],
    foodLogTitle: "Log food",
    lunch: "Lunch",
    breakfast: "Breakfast",
    editorHeaderMacros: ["P 48\u00a0g", "C 72\u00a0g", "F 18\u00a0g", "Fi 7\u00a0g"],
    editorInstruction: "What should change?",
    editorCorrectionInstruction: "Double this serving and every nutrition value",
    editorEditFields: "Edit fields",
    editorBackToAi: "Back to AI",
    editorPreview: "Preview",
    editorProposedResult: "Result",
    editorProposalSummary: "2 servings · 1280\u00a0kcal",
    editorProposalMacros: ["P 96\u00a0g", "C 144\u00a0g", "F 36\u00a0g", "Fi 14\u00a0g"],
    editorCurrentResult: "Current saved values",
    editorName: "Name",
    editorPortion: "Portion",
    editorDetails: "Nutrition details",
    editorProtein: "Protein",
    editorCarbs: "Carbohydrates",
    editorFats: "Fat",
    editorFiber: "Fiber",
    editorDate: "Date",
    editorMeal: "Meal",
    editorDelete: "Delete",
    editorSave: "Save",
    weeklySummary: "Weekly summary",
    openDayPrefix: "Open log:",
    historyUnit: "kcal",
    dayDetail: "Daily log",
    itemizedMeals: "Meals",
    backToHistory: "Back to history",
    duplicateBreakfast: "Duplicate Breakfast",
    duplicateBreakfastForm: "Duplicate Breakfast",
    destinationMeal: "Meal",
    cancelDuplicate: "Cancel",
    confirmDuplicate: "Duplicate",
    languageLabel: "App language",
    nutritionGoal: "Nutrition goal",
    signOut: "Sign out",
    darkMode: "Dark mode",
    authEmail: "Email",
    authPassword: "Password",
    authSignIn: "Sign in",
    homeEntryName:
      "Roasted chicken grain bowl with seasonal vegetables and fresh herb dressing",
    historyEntryName: "Greek yogurt with berries, walnuts, and honey",
    homePortion: "420 g",
    historyPortion: "1 bowl",
  },
  {
    code: "ru",
    testTitle: "keeps Russian core screens contained and typographically consistent",
    appTitle: "Трекер калорий",
    settings: "Настройки",
    account: "Аккаунт",
    home: "Трекер калорий",
    history: "История",
    calories: "Калории",
    nutrients: "БЖУ",
    previousDay: "Предыдущий день",
    nextDay: "Следующий день",
    logFoodPlaceholder: "Записать еду",
    logFoodSuggestions: [
      "Курица с грибами",
      "Сэндвич с ветчиной",
      "Овсянка с бананом",
      "Салат с тунцом",
      "Омлет с сыром",
      "Йогурт с ягодами",
    ],
    foodLogTitle: "Записать еду",
    lunch: "Обед",
    breakfast: "Завтрак",
    editorHeaderMacros: ["Б 48\u00a0г", "У 72\u00a0г", "Ж 18\u00a0г", "Кл 7\u00a0г"],
    editorInstruction: "Что изменить?",
    editorCorrectionInstruction: "Удвойте порцию и все значения пищевой ценности",
    editorEditFields: "Изменить поля",
    editorBackToAi: "Вернуться к ИИ",
    editorPreview: "Превью",
    editorProposedResult: "Результат",
    editorProposalSummary: "2 servings · 1280\u00a0ккал",
    editorProposalMacros: ["Б 96\u00a0г", "У 144\u00a0г", "Ж 36\u00a0г", "Кл 14\u00a0г"],
    editorCurrentResult: "Текущие значения",
    editorName: "Название",
    editorPortion: "Порция",
    editorDetails: "Пищевая ценность",
    editorProtein: "Белки",
    editorCarbs: "Углеводы",
    editorFats: "Жиры",
    editorFiber: "Клетчатка",
    editorDate: "Дата",
    editorMeal: "Приём пищи",
    editorDelete: "Удалить",
    editorSave: "Сохранить",
    weeklySummary: "Неделя",
    openDayPrefix: "Открыть записи за",
    historyUnit: "ккал",
    dayDetail: "Записи за день",
    itemizedMeals: "Приёмы пищи",
    backToHistory: "Назад к истории",
    duplicateBreakfast: "Дублировать: Завтрак",
    duplicateBreakfastForm: "Дублирование: Завтрак",
    destinationMeal: "Приём пищи",
    cancelDuplicate: "Отмена",
    confirmDuplicate: "Дублировать",
    languageLabel: "Язык приложения",
    nutritionGoal: "Цель питания",
    signOut: "Выйти",
    darkMode: "Тёмная тема",
    authEmail: "Электронная почта",
    authPassword: "Пароль",
    authSignIn: "Войти",
    homeEntryName:
      "Куриная грудка с гречкой, запечёнными овощами и соусом из свежей зелени",
    historyEntryName: "Творог с ягодами, орехами и мёдом",
    homePortion: "420 г",
    historyPortion: "1 миска",
  },
] as const;

const HOME_DAY = behavioralIsoDay();
const HISTORY_DAY = calendarIsoDay(-3);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedFontFamily(value: string): string {
  return value.replace(/["']/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

async function expectLocaleDocument(page: Page, locale: UiLocale): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("lang", locale.code);
  await expect(page).toHaveTitle(locale.appTitle);
}

/** The tab carousel intentionally overflows internally; only the document may not overflow. */
async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      viewportWidth: root.clientWidth,
      documentWidth: Math.max(root.scrollWidth, document.body.scrollWidth),
    };
  });

  expect(
    geometry.documentWidth,
    `document width ${geometry.documentWidth}px exceeded viewport ${geometry.viewportWidth}px`,
  ).toBeLessThanOrEqual(geometry.viewportWidth + GEOMETRY_TOLERANCE_PX);
}

async function expectHorizontallyContained(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  expect(box, "expected a rendered layout box").not.toBeNull();
  expect(viewport, "expected a configured Playwright viewport").not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x).toBeGreaterThanOrEqual(-GEOMETRY_TOLERANCE_PX);
  expect(box.x + box.width).toBeLessThanOrEqual(
    viewport.width + GEOMETRY_TOLERANCE_PX,
  );
}

async function expectVerticallyContained(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  expect(box, "expected a rendered layout box").not.toBeNull();
  expect(viewport, "expected a configured Playwright viewport").not.toBeNull();
  if (!box || !viewport) return;

  expect(box.y).toBeGreaterThanOrEqual(-GEOMETRY_TOLERANCE_PX);
  expect(box.y + box.height).toBeLessThanOrEqual(
    viewport.height + GEOMETRY_TOLERANCE_PX,
  );
}

async function expectContainedBy(container: Locator, child: Locator): Promise<void> {
  await expect(container).toBeVisible();
  await expect(child).toBeVisible();
  const containerBox = await container.boundingBox();
  const childBox = await child.boundingBox();

  expect(containerBox, "expected a rendered container layout box").not.toBeNull();
  expect(childBox, "expected a rendered child layout box").not.toBeNull();
  if (!containerBox || !childBox) return;

  expect(childBox.x).toBeGreaterThanOrEqual(containerBox.x - GEOMETRY_TOLERANCE_PX);
  expect(childBox.y).toBeGreaterThanOrEqual(containerBox.y - GEOMETRY_TOLERANCE_PX);
  expect(childBox.x + childBox.width).toBeLessThanOrEqual(
    containerBox.x + containerBox.width + GEOMETRY_TOLERANCE_PX,
  );
  expect(childBox.y + childBox.height).toBeLessThanOrEqual(
    containerBox.y + containerBox.height + GEOMETRY_TOLERANCE_PX,
  );
}

async function expectTextWraps(locator: Locator): Promise<void> {
  const metrics = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(style.lineHeight),
      overflowWrap: style.overflowWrap,
    };
  });

  expect(metrics.overflowWrap).toBe("break-word");
  expect(
    metrics.height,
    "expected the long proposal name to wrap onto multiple lines",
  ).toBeGreaterThan(metrics.lineHeight + GEOMETRY_TOLERANCE_PX);
}

async function expectMinimumTarget(
  locator: Locator,
  minimum = MIN_PRIMARY_TARGET_PX,
): Promise<void> {
  await expect(locator).toBeVisible();
  const threshold = minimum - GEOMETRY_TOLERANCE_PX;

  // Dialog descendants briefly inherit the opening scale animation. Poll the
  // settled layout so the assertion measures the actual touch target instead
  // of an intermediate transform frame.
  await expect
    .poll(async () => (await locator.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(threshold);
  await expect
    .poll(async () => (await locator.boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(threshold);
}

async function expectSharedFontFamily(page: Page, locators: readonly Locator[]): Promise<void> {
  const bodyFont = normalizedFontFamily(
    await page.locator("body").evaluate((element) => getComputedStyle(element).fontFamily),
  );

  for (const candidate of locators) {
    const locator = candidate.first();
    await expect(locator).toBeVisible();
    const font = normalizedFontFamily(
      await locator.evaluate((element) => getComputedStyle(element).fontFamily),
    );
    expect(font).toBe(bodyFont);
  }
}

async function expectNoEnglishUnitLeaks(page: Page, locale: UiLocale): Promise<void> {
  if (locale.code !== "ru") return;
  const text = await page.locator("body").innerText();
  const leakedUnits =
    text.match(/(?:\d+(?:[.,]\d+)?\s*|\b)(?:cal|kcal|kg|cm|g)\b/gi) ?? [];
  expect(leakedUnits, "Russian UI rendered English unit tokens").toEqual([]);
}

async function expectScreenInvariant(page: Page, locale: UiLocale): Promise<void> {
  await expectLocaleDocument(page, locale);
  await expectNoDocumentOverflow(page);
  await expectNoEnglishUnitLeaks(page, locale);
}

test.describe("Cross-locale UI consistency", () => {
  for (const locale of LOCALES) {
    test(locale.testTitle, async ({ page, e2eControls }) => {
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
            day: HOME_DAY,
            mealType: "lunch",
            name: locale.homeEntryName,
            calories: 640,
            protein: 48,
            carbs: 72,
            fats: 18,
            fiber: 7,
            portion: locale.homePortion,
            mealSlug: `ui-home-${locale.code}`,
          },
          {
            day: HISTORY_DAY,
            mealType: "breakfast",
            name: locale.historyEntryName,
            calories: 510,
            protein: 31,
            carbs: 44,
            fats: 21,
            fiber: 8,
            portion: locale.historyPortion,
            mealSlug: `ui-history-${locale.code}`,
          },
        ],
      });
      await e2eControls.reset([user]);
      await loginThroughSetup(page, user);

      await test.step("Home, composer, and editor", async () => {
        const heading = page.getByRole("heading", { name: locale.home, exact: true });
        const settingsTab = page.getByRole("button", { name: locale.settings, exact: true });
        const homeTab = page.getByRole("button", { name: locale.home, exact: true });
        const historyTab = page.getByRole("button", { name: locale.history, exact: true });
        const previousDay = page.getByRole("button", { name: locale.previousDay, exact: true });
        const nextDay = page.getByRole("button", { name: locale.nextDay, exact: true });
        const composerTrigger = page.getByRole("button", {
          name: locale.logFoodPlaceholder,
          exact: true,
        });
        const lunch = page.getByRole("button", {
          name: new RegExp(`^${escapeRegExp(locale.lunch)}`),
        });

        await expect(heading).toBeVisible();
        await expect(page.getByText(locale.calories, { exact: true })).toBeVisible();
        await expect(page.getByText(locale.nutrients, { exact: true })).toBeVisible();
        const calorieSectors = page.locator(".recharts-pie-sector path");
        await expect(calorieSectors).toHaveCount(2);
        for (const sector of await calorieSectors.all()) {
          await expect(sector).toHaveAttribute("stroke", "none");
        }
        await expect(lunch).toContainText("640");
        await expectScreenInvariant(page, locale);
        await expectSharedFontFamily(page, [heading, lunch, composerTrigger]);
        await expectHorizontallyContained(page, composerTrigger);
        const placeholderPreview = page.getByTestId("food-placeholder-preview");
        await expect(placeholderPreview).toBeVisible();
        expect(locale.logFoodSuggestions).toContain(
          await placeholderPreview.getAttribute("data-suggestion"),
        );
        await expectHorizontallyContained(page, placeholderPreview);
        for (const target of [settingsTab, homeTab, historyTab, previousDay, nextDay, composerTrigger]) {
          await expectMinimumTarget(target);
        }

        await composerTrigger.click();
        const drawer = page.locator("#food-log-sheet");
        const drawerInput = drawer.getByRole("textbox", {
          name: locale.logFoodPlaceholder,
          exact: true,
        });
        await expect(drawer.locator('[data-slot="drawer-title"]')).toHaveText(locale.foodLogTitle);
        await expect(drawerInput).toBeVisible();
        const drawerPlaceholder = await drawerInput.getAttribute("placeholder");
        const drawerSuggestion = await drawerInput.getAttribute("data-suggestion");
        expect(drawerPlaceholder).not.toBe("");
        expect(drawerSuggestion?.startsWith(drawerPlaceholder ?? "")).toBe(true);
        await expectHorizontallyContained(page, drawer);
        await expectMinimumTarget(drawerInput);
        await expectSharedFontFamily(page, [drawerInput]);
        await expectScreenInvariant(page, locale);
        await page.keyboard.press("Escape");
        await expect(drawer).toBeHidden();

        await lunch.click();
        await page
          .getByRole("button", { name: new RegExp(`^${escapeRegExp(locale.homeEntryName)}`) })
          .click();
        const initialEditor = page.getByRole("dialog", {
          name: locale.homeEntryName,
          exact: true,
        });
        await expect(initialEditor).toBeVisible();

        // Use the stable content slot for assertions that continue after switching modes.
        const editor = page.locator('[data-slot="dialog-content"]');
        const editorClose = editor.locator('[data-slot="dialog-close"]');
        const editorDescription = editor.locator('[data-slot="dialog-description"]');
        const editorBody = editor.locator("form > div").first();
        const editorFooter = editor.locator('[data-slot="dialog-footer"]');
        const instruction = editor.getByLabel(locale.editorInstruction, { exact: true });
        const editFields = editor.getByRole("button", {
          name: locale.editorEditFields,
          exact: true,
        });
        const preview = editor.getByRole("button", {
          name: locale.editorPreview,
          exact: true,
        });
        const scheduleSummary = editor.getByRole("button", {
          name: `${locale.editorDate} · ${locale.editorMeal}`,
          exact: true,
        });
        const dateInput = editor.getByLabel(locale.editorDate, { exact: true });
        const mealInput = editor.getByRole("combobox", {
          name: locale.editorMeal,
          exact: true,
        });
        const deleteAction = editor.getByRole("button", {
          name: locale.editorDelete,
          exact: true,
        });
        const saveAction = editor.getByRole("button", {
          name: locale.editorSave,
          exact: true,
        });

        await expect(editor).toBeVisible();
        await expect(editor).toHaveCount(1);
        await expect(editorDescription).toContainText(`640 ${locale.historyUnit}`);
        for (const macro of locale.editorHeaderMacros) {
          await expect(editorDescription.getByText(macro, { exact: true })).toBeVisible();
        }
        const editorContextBox = await editorDescription.boundingBox();
        expect(editorContextBox, "expected compact saved-food context").not.toBeNull();
        if (editorContextBox) {
          expect(editorContextBox.height).toBeLessThanOrEqual(
            MIN_PRIMARY_TARGET_PX + GEOMETRY_TOLERANCE_PX,
          );
        }
        await expect(instruction).toBeVisible();
        await expect(editFields).toBeVisible();
        await expect(preview).toBeVisible();
        const instructionLabel = editor.locator('label[for="food-entry-correction"]');
        const instructionLabelBox = await instructionLabel.boundingBox();
        const instructionBox = await instruction.boundingBox();
        const editFieldsBox = await editFields.boundingBox();
        expect(instructionLabelBox).not.toBeNull();
        expect(instructionBox).not.toBeNull();
        expect(editFieldsBox).not.toBeNull();
        if (instructionLabelBox && instructionBox && editFieldsBox) {
          const labelToInputGap = instructionBox.y
            - instructionLabelBox.y
            - instructionLabelBox.height;
          const modeToLabelGap = instructionLabelBox.y
            - editFieldsBox.y
            - editFieldsBox.height;
          expect(labelToInputGap).toBeGreaterThanOrEqual(7);
          expect(modeToLabelGap).toBeGreaterThanOrEqual(0);
          expect(modeToLabelGap).toBeLessThanOrEqual(16);
        }
        await expect(editor.getByText(locale.editorCurrentResult, { exact: true })).toHaveCount(0);
        await expect(editor.getByText(locale.editorProposedResult, { exact: true })).toHaveCount(0);
        await expect(scheduleSummary).toHaveAttribute("aria-expanded", "false");
        await expect(scheduleSummary).toContainText(locale.lunch);
        await expect(dateInput).toHaveCount(0);
        await expect(mealInput).toHaveCount(0);
        await expect(editorFooter).toBeVisible();
        await expectHorizontallyContained(page, editor);
        await expectVerticallyContained(page, editor);
        await expect(editor).toHaveCSS("overflow-y", "hidden");
        await expect(editorBody).toHaveCSS("overflow-y", "auto");
        for (const target of [
          editorClose,
          instruction,
          editFields,
          preview,
          scheduleSummary,
          deleteAction,
          saveAction,
        ]) {
          await expectMinimumTarget(target);
          await expectHorizontallyContained(page, target);
        }
        await expectSharedFontFamily(page, [
          editor.getByRole("heading", { name: locale.homeEntryName, exact: true }),
          instruction,
          editFields,
          scheduleSummary,
          saveAction,
        ]);
        await expectScreenInvariant(page, locale);

        await editFields.click();
        await expect(
          editor.getByRole("heading", { name: locale.homeEntryName, exact: true }),
        ).toBeVisible();

        const backToAi = editor.getByRole("button", {
          name: locale.editorBackToAi,
          exact: true,
        });
        const nameInput = editor.getByLabel(locale.editorName, { exact: true });
        const portionInput = editor.getByLabel(locale.editorPortion, { exact: true });
        const caloriesInput = editor.getByLabel(locale.calories, { exact: true });
        const detailsSummary = editor.getByRole("button", {
          name: locale.editorDetails,
          exact: true,
        });
        const nutrientInputs = [
          editor.getByLabel(locale.editorProtein, { exact: true }),
          editor.getByLabel(locale.editorCarbs, { exact: true }),
          editor.getByLabel(locale.editorFats, { exact: true }),
          editor.getByLabel(locale.editorFiber, { exact: true }),
        ] as const;

        await expect(nameInput).toHaveValue(locale.homeEntryName);
        await expect(portionInput).toHaveValue(locale.homePortion);
        await expect(caloriesInput).toHaveValue("640");
        await expect(detailsSummary).toHaveAttribute("aria-expanded", "false");
        for (const input of nutrientInputs) {
          await expect(input).toHaveCount(0);
        }
        await expect(scheduleSummary).toHaveAttribute("aria-expanded", "false");

        for (const target of [
          backToAi,
          nameInput,
          portionInput,
          caloriesInput,
          detailsSummary,
          scheduleSummary,
          deleteAction,
          saveAction,
        ]) {
          await expectMinimumTarget(target);
          await expectHorizontallyContained(page, target);
        }

        await detailsSummary.click();
        await expect(detailsSummary).toHaveAttribute("aria-expanded", "true");
        for (const input of nutrientInputs) {
          await expect(input).toBeVisible();
          await expectMinimumTarget(input);
          await expectHorizontallyContained(page, input);
        }

        await scheduleSummary.click();
        await expect(scheduleSummary).toHaveAttribute("aria-expanded", "true");
        await expect(dateInput).toBeVisible();
        await expect(dateInput).toHaveValue(HOME_DAY);
        await expect(mealInput).toBeVisible();
        await expect(mealInput).toHaveText(locale.lunch);
        for (const input of [dateInput, mealInput]) {
          await expectMinimumTarget(input);
          await expectHorizontallyContained(page, input);
        }

        expect(
          await editorBody.evaluate((body) => {
            const footer = body.parentElement?.querySelector('[data-slot="dialog-footer"]');
            return Boolean(footer && !body.contains(footer));
          }),
          "editor actions must stay outside the scrollable body",
        ).toBe(true);

        if ((page.viewportSize()?.width ?? 0) < 480) {
          await expect
            .poll(() =>
              editorBody.evaluate((body) => body.scrollHeight > body.clientHeight),
            )
            .toBe(true);
        }

        await editorBody.evaluate((body) => {
          body.scrollTop = 0;
        });
        const footerAtTop = await editorFooter.boundingBox();
        await editorBody.evaluate((body) => {
          body.scrollTop = body.scrollHeight;
        });
        const footerAtBottom = await editorFooter.boundingBox();
        expect(footerAtTop, "expected a visible editor footer before body scrolling").not.toBeNull();
        expect(footerAtBottom, "expected a visible editor footer after body scrolling").not.toBeNull();
        if (footerAtTop && footerAtBottom) {
          expect(footerAtBottom.y).toBeCloseTo(footerAtTop.y, 0);
        }
        for (const action of [deleteAction, saveAction]) {
          await expect(action).toBeVisible();
          await expectVerticallyContained(page, action);
          await expectMinimumTarget(action);
        }
        await expectScreenInvariant(page, locale);

        // Generate the deterministic proposal only after proving that the
        // persisted structured values survived the mode change. This covers
        // the denser result state in both languages and both viewports.
        await backToAi.click();
        await expect(
          editor.getByRole("heading", { name: locale.homeEntryName, exact: true }),
        ).toBeVisible();
        await instruction.fill(locale.editorCorrectionInstruction);
        await preview.click();
        await editorBody.evaluate((body) => {
          body.scrollTop = 0;
        });

        const proposalTitle = editor.getByText(locale.editorProposedResult, { exact: true });
        const proposalCard = proposalTitle.locator("..");
        const proposalName = proposalCard.getByText(locale.homeEntryName, { exact: true });
        const proposalSummary = proposalCard.getByText(locale.editorProposalSummary, {
          exact: true,
        });
        const proposalMacros = locale.editorProposalMacros.map((macro) =>
          proposalCard.getByText(macro, { exact: true }),
        );

        await expect(proposalCard).toBeVisible();
        await expect(proposalName).toBeVisible();
        await expect(proposalSummary).toBeVisible();
        await expectTextWraps(proposalName);
        for (const content of [proposalName, proposalSummary]) {
          await expectHorizontallyContained(page, content);
          await expectVerticallyContained(page, content);
          await expectContainedBy(proposalCard, content);
        }
        const proposalMacroRow = proposalMacros[0].locator("..");
        await expect(proposalMacroRow).toHaveCSS("flex-wrap", "wrap");
        await expectHorizontallyContained(page, proposalMacroRow);
        await expectVerticallyContained(page, proposalMacroRow);
        await expectContainedBy(proposalCard, proposalMacroRow);
        for (const macro of proposalMacros) {
          await expect(macro).toBeVisible();
          await expect(macro).toHaveCSS("white-space", "nowrap");
          await expectHorizontallyContained(page, macro);
          await expectVerticallyContained(page, macro);
          await expectContainedBy(proposalCard, macro);
        }

        await expectHorizontallyContained(page, proposalCard);
        await expectVerticallyContained(page, proposalCard);
        await expectContainedBy(editorBody, proposalCard);
        await expectHorizontallyContained(page, editor);
        await expectVerticallyContained(page, editor);
        await expectHorizontallyContained(page, editorFooter);
        await expectVerticallyContained(page, editorFooter);
        await expectContainedBy(editor, editorFooter);
        await expectScreenInvariant(page, locale);

        await editorClose.click();
        await expect(editor).toBeHidden();
      });

      await test.step("History detail and duplication", async () => {
        await page.getByRole("button", { name: locale.history, exact: true }).click();
        await expect(page).toHaveURL(/\/history$/);
        const heading = page.getByRole("heading", { name: locale.history, exact: true });
        await expect(heading).toBeVisible();
        await expect(page.getByText(locale.weeklySummary, { exact: true })).toBeVisible();

        const historyDay = page
          .getByRole("button", {
            name: new RegExp(`^${escapeRegExp(locale.openDayPrefix)}`),
          })
          .filter({ hasText: `510 / 2000 ${locale.historyUnit}` });
        await expect(historyDay).toHaveCount(1);
        await expectHorizontallyContained(page, historyDay);
        await expectSharedFontFamily(page, [heading, historyDay]);
        await expectScreenInvariant(page, locale);
        await historyDay.click();

        const detail = page.locator('section[aria-labelledby="history-day-detail-title"]');
        const back = detail.getByRole("button", { name: locale.backToHistory, exact: true });
        await expect(detail.getByText(locale.dayDetail, { exact: true })).toBeVisible();
        await expect(detail.getByText(locale.itemizedMeals, { exact: true })).toBeVisible();
        await expectHorizontallyContained(page, detail);
        await expectVerticallyContained(page, detail);
        await expectMinimumTarget(back);

        await detail
          .getByRole("button", { name: new RegExp(`^${escapeRegExp(locale.breakfast)}`) })
          .click();
        const duplicate = detail.getByRole("button", {
          name: locale.duplicateBreakfast,
          exact: true,
        });
        await expect(duplicate).toBeEnabled();
        await duplicate.click();

        const duplicateForm = detail.getByRole("form", {
          name: locale.duplicateBreakfastForm,
          exact: true,
        });
        const destinationMeal = duplicateForm.getByLabel(locale.destinationMeal, { exact: true });
        const cancel = duplicateForm.getByRole("button", {
          name: locale.cancelDuplicate,
          exact: true,
        });
        const confirm = duplicateForm.getByRole("button", {
          name: locale.confirmDuplicate,
          exact: true,
        });
        await expect(duplicateForm).toBeVisible();
        await expect(destinationMeal).toBeVisible();
        await expect(confirm).toBeVisible();
        await expectHorizontallyContained(page, duplicateForm);
        await expectSharedFontFamily(page, [
          detail.locator("#history-day-detail-title"),
          destinationMeal,
          confirm,
        ]);
        await expectScreenInvariant(page, locale);

        await cancel.click();
        await expect(duplicateForm).toBeHidden();
        await back.click();
      });

      await test.step("Settings and localized Auth after sign-out", async () => {
        const profileControl = page.getByRole("button", { name: locale.account, exact: true });
        await expectMinimumTarget(profileControl);
        await profileControl.click();
        await expect(page).toHaveURL(/\/settings$/);
        const heading = page.getByRole("heading", { name: locale.settings, exact: true });
        const language = page.getByLabel(locale.languageLabel, { exact: true });
        const themeSwitch = page.getByRole("switch", { name: locale.darkMode, exact: true });
        const signOut = page.getByRole("button", { name: locale.signOut, exact: true });
        await expect(heading).toBeVisible();
        await expect(language).toHaveValue(locale.code);
        await expect(page.getByText(locale.nutritionGoal, { exact: true })).toBeVisible();
        await expectHorizontallyContained(page, language);
        await expectMinimumTarget(signOut);
        await expectMinimumTarget(themeSwitch);
        await expectSharedFontFamily(page, [heading, language, signOut]);
        await expectScreenInvariant(page, locale);

        const startedDark = (await themeSwitch.getAttribute("aria-checked")) === "true";
        await themeSwitch.click();
        await expect(themeSwitch).toHaveAttribute("aria-checked", String(!startedDark));
        await expect
          .poll(() =>
            page.locator("html").evaluate((element) => getComputedStyle(element).colorScheme),
          )
          .toBe(startedDark ? "light" : "dark");

        await signOut.click();
        await expect(page).toHaveURL(/\/$/);
        const authHeading = page.getByRole("heading", { name: locale.appTitle, exact: true });
        const email = page.getByLabel(locale.authEmail, { exact: true });
        const password = page.getByLabel(locale.authPassword, { exact: true });
        const signIn = page.getByRole("button", { name: locale.authSignIn, exact: true });
        await expect(authHeading).toBeVisible();
        await expect(email).toBeVisible();
        await expect(password).toBeVisible();
        await expectMinimumTarget(email);
        await expectMinimumTarget(password);
        await expectMinimumTarget(signIn);
        await expectHorizontallyContained(page, signIn);
        await expectSharedFontFamily(page, [authHeading, email, password, signIn]);
        await expectScreenInvariant(page, locale);

        // Signing out must not discard the user's interface language. A reload
        // proves Auth restores the persisted locale instead of relying on the
        // in-memory i18n singleton left behind by the authenticated shell.
        await page.reload();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole("heading", { name: locale.appTitle, exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: locale.authSignIn, exact: true })).toBeVisible();
        await expectScreenInvariant(page, locale);
      });
    });
  }
});
