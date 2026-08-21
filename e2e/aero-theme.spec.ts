import type { Locator, Page, Request } from "@playwright/test";
import {
  behavioralIsoDay,
  calendarIsoDay,
  expect,
  isolatedTestUser,
  loginThroughSetup,
  openSettingsThroughVisibleUi,
  test,
  type E2EControlClient,
  type E2ESeedEntry,
} from "./support/fixtures";
import {
  closeAdaptiveFoodComposer,
  openAdaptiveFoodComposer,
  usesDesktopWorkspace,
} from "./support/adaptiveComposer";
import { expectAppBackgroundExcludedFromAccessibilityTree } from "./support/modalAccessibility";

type ColorMode = "light" | "dark";

const HISTORY_DAY = calendarIsoDay(-1);
const DUPLICATE_DESTINATION_DAY = calendarIsoDay(-2);

function inlineDisplayDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

function displayDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

function appearanceSwitch(page: Page): Locator {
  return page.locator('[data-aero-toggle="appearance"]');
}

function darkModeSwitch(page: Page): Locator {
  return page.locator('[data-aero-toggle="color-mode"]');
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    )
    .toBe(true);
}

async function expectMinimumTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, "expected an interactive control with layout geometry").not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function expectInsideVisualViewport(locator: Locator): Promise<void> {
  const contained = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const right = left + (viewport?.width ?? window.innerWidth);
    const bottom = top + (viewport?.height ?? window.innerHeight);
    return (
      rect.left >= left - 1 &&
      rect.top >= top - 1 &&
      rect.right <= right + 1 &&
      rect.bottom <= bottom + 1
    );
  });
  expect(contained).toBe(true);
}

async function expectAero(page: Page, colorMode?: ColorMode): Promise<void> {
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-appearance", "aero");
  if (colorMode === "dark") await expect(root).toHaveClass(/\bdark\b/);
  if (colorMode === "light") await expect(root).not.toHaveClass(/\bdark\b/);
}

async function setStoredAppearance(page: Page, appearance: "standard" | "aero"): Promise<void> {
  await page.evaluate((value) => localStorage.setItem("appearance", value), appearance);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", appearance);
}

async function setStoredColorMode(page: Page, colorMode: ColorMode): Promise<void> {
  await page.evaluate((value) => localStorage.setItem("theme", value), colorMode);
  await page.reload();
  await expectAero(page, colorMode);
}

async function seedAndLogin(
  page: Page,
  e2eControls: E2EControlClient,
  entries: E2ESeedEntry[],
): Promise<void> {
  const user = isolatedTestUser({ entries });
  await e2eControls.reset([user]);
  await loginThroughSetup(page, user);
}

function historyDayButton(page: Page, day: string): Locator {
  return page.getByRole("button", {
    name: `Open log: ${inlineDisplayDay(day)}`,
    exact: true,
  });
}

async function openHistoryDay(page: Page, day: string): Promise<Locator> {
  await historyDayButton(page, day).click();
  const detail = page.getByRole("region", { name: displayDay(day), exact: true });
  await expect(detail).toBeVisible();
  return detail;
}

async function revealTodayEntry(page: Page, meal: string, name: string): Promise<Locator> {
  if (usesDesktopWorkspace(page)) {
    const row = page.getByRole("region", { name: meal, exact: true }).getByRole("row", {
      name: new RegExp(`^${name}\\b`),
    });
    await expect(row).toBeVisible();
    return row;
  }

  const mealButton = page.getByRole("button", { name: new RegExp(`^${meal}\\b`) });
  if ((await mealButton.getAttribute("aria-expanded")) !== "true") await mealButton.click();
  const entry = page.getByRole("button", { name: new RegExp(`^${name}\\b`) });
  await expect(entry).toBeVisible();
  return entry;
}

async function openManualEditor(page: Page, meal: string, name: string): Promise<Locator> {
  await (await revealTodayEntry(page, meal, name)).click();
  if (usesDesktopWorkspace(page)) {
    const form = page.getByRole("form", { name: `Edit ${name}`, exact: true });
    await expect(form).toBeVisible();
    return form;
  }

  const dialog = page.getByRole("dialog", { name, exact: true });
  await expect(dialog).toBeVisible();
  await expectAppBackgroundExcludedFromAccessibilityTree(page);
  await dialog.getByRole("button", { name: "Edit fields", exact: true }).click();
  return dialog;
}

async function expectLoggingSuccess(page: Page, totalGroups = 1): Promise<void> {
  if (usesDesktopWorkspace(page)) {
    await expect(page.getByRole("status").filter({ hasText: "Added 1 food" })).toBeVisible();
    return;
  }
  if (totalGroups > 1) {
    await expect(
      page.getByRole("button", {
        name: `Logging activity · ${totalGroups} groups logged · ${totalGroups} foods`,
        exact: true,
      }),
    ).toBeVisible();
    return;
  }
  await expect(page.getByText("Added 1", { exact: true })).toBeVisible();
}

test.describe("Frutiger Aero appearance", () => {
  test("defaults to Standard and persists an independent Aero preference without a first-paint flash", async ({
    page,
    e2eControls,
  }) => {
    const user = isolatedTestUser();
    await e2eControls.reset([user]);
    await loginThroughSetup(page, user);

    await expect(page.locator("html")).toHaveAttribute("data-appearance", "standard");
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    await openSettingsThroughVisibleUi(page);

    const aero = appearanceSwitch(page);
    const darkMode = darkModeSwitch(page);
    await expect(aero).toHaveAttribute("aria-checked", "false");
    await expect(darkMode).toHaveAttribute("aria-checked", "false");
    await expectMinimumTarget(aero);

    const preferenceRequests: string[] = [];
    const recordPreferenceRequest = (request: Request) => {
      if (new URL(request.url()).pathname.startsWith("/api/v1/")) {
        preferenceRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
      }
    };
    page.on("request", recordPreferenceRequest);
    await aero.click();
    await expectAero(page, "light");
    await expect(aero).toHaveAttribute("aria-checked", "true");
    await darkMode.click();
    await expectAero(page, "dark");
    await expect(aero).toHaveAttribute("aria-checked", "true");
    page.off("request", recordPreferenceRequest);
    expect(preferenceRequests).toEqual([]);

    await page.addInitScript(() => {
      const state = { firstFrame: null as string | null, sampled: false };
      Object.assign(window, { __e2eAppearanceBeforePaint: state });
      requestAnimationFrame(() => {
        state.firstFrame = document.documentElement.getAttribute("data-appearance");
        state.sampled = true;
      });
    });
    await page.reload();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as Window & {
            __e2eAppearanceBeforePaint?: { firstFrame: string | null; sampled: boolean };
          }).__e2eAppearanceBeforePaint,
        ),
      )
      .toEqual({ firstFrame: "aero", sampled: true });
    await expectAero(page, "dark");
    await expect(appearanceSwitch(page)).toHaveAttribute("aria-checked", "true");
  });

  test("keeps Aero Day and Aero Night coherent across Auth Today History detail and Settings", async ({
    page,
    e2eControls,
  }) => {
    const entries: E2ESeedEntry[] = [
      {
        day: HISTORY_DAY,
        mealType: "breakfast",
        name: "Aero route oatmeal",
        calories: 325,
        protein: 14,
        carbs: 48,
        fats: 9,
        fiber: 7,
        portion: "1 bowl",
        mealSlug: "aero-route-oatmeal",
      },
    ];
    const user = isolatedTestUser({ entries });
    await e2eControls.reset([user]);

    for (const colorMode of ["light", "dark"] as const) {
      await test.step(`Aero ${colorMode}`, async () => {
        await loginThroughSetup(page, user);
        await setStoredAppearance(page, "aero");
        await setStoredColorMode(page, colorMode);
        await page.emulateMedia({ reducedMotion: "reduce" });

        await expect(page).toHaveURL(/\/app$/);
        await expectAero(page, colorMode);
        await expect(page.locator('button[aria-current="page"]')).toHaveCount(1);
        await expectNoDocumentOverflow(page);

        await page.getByRole("button", { name: "History", exact: true }).click();
        await expect(page).toHaveURL(/\/history$/);
        await expectAero(page, colorMode);
        const detail = await openHistoryDay(page, HISTORY_DAY);
        await expect(detail.getByText("325 kcal", { exact: true })).toBeVisible();
        await expectNoDocumentOverflow(page);

        await page.getByRole("button", { name: "Settings", exact: true }).click();
        await expect(page).toHaveURL(/\/settings$/);
        await expectAero(page, colorMode);
        await expect(appearanceSwitch(page)).toHaveAttribute("aria-checked", "true");
        await expect(darkModeSwitch(page)).toHaveAttribute(
          "aria-checked",
          String(colorMode === "dark"),
        );
        await expectNoDocumentOverflow(page);

        await page.getByRole("button", { name: "Sign out", exact: true }).click();
        await expect(page).toHaveURL(/\/$/);
        await expectAero(page, colorMode);
        await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
        await expectNoDocumentOverflow(page);
      });
    }
  });

  test("keeps logging suggestions editing retry deletion and Undo operable in Aero", async ({
    page,
    e2eControls,
  }) => {
    await seedAndLogin(page, e2eControls, [
      {
        day: behavioralIsoDay(-1),
        mealType: "breakfast",
        name: "Aero granola",
        calories: 240,
        protein: 9,
        carbs: 38,
        fats: 7,
        fiber: 6,
        portion: "1 bowl",
        mealSlug: "aero-granola",
      },
      {
        day: behavioralIsoDay(),
        mealType: "breakfast",
        name: "Aero toast",
        calories: 210,
        protein: 8,
        carbs: 32,
        fats: 6,
        fiber: 4,
        portion: "2 slices",
        mealSlug: "aero-toast",
      },
    ]);
    await setStoredAppearance(page, "aero");
    await e2eControls.setAiMode({ parseFood: "failure" });

    const composer = await openAdaptiveFoodComposer(page);
    await composer.fill("Aero granola");
    const suggestions = page.getByRole("listbox", { name: "Previous entries" });
    await expect(suggestions.getByRole("option", { name: /Aero granola/ })).toBeVisible();
    let parseRequests = 0;
    const countParseRequests = (request: Request) => {
      if (new URL(request.url()).pathname === "/api/v1/ai/parse-food") parseRequests += 1;
    };
    page.on("request", countParseRequests);
    await composer.press("ArrowDown");
    await expect(composer).toBeFocused();
    await composer.press("Enter");
    await expectLoggingSuccess(page);
    page.off("request", countParseRequests);
    expect(parseRequests).toBe(0);
    await expectAero(page);

    const failedText = "Aero retry oatmeal";
    await composer.fill(failedText);
    await composer.press("Enter");
    await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
    await e2eControls.setAiMode({ parseFood: "success" });
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expectLoggingSuccess(page, 2);
    await closeAdaptiveFoodComposer(page);

    let editor = await openManualEditor(page, "Breakfast", "Aero toast");
    await editor.getByLabel("Name", { exact: true }).fill("Aero toast corrected");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor).toBeHidden();
    editor = await openManualEditor(page, "Breakfast", "Aero toast corrected");
    const deleteButton = editor.getByRole("button", { name: "Delete", exact: true });
    await expectMinimumTarget(deleteButton);
    await deleteButton.click();
    await expect(editor).toBeHidden();
    const deletionStatus = page.getByRole("status").filter({ hasText: /was deleted/ });
    await expect(deletionStatus).toContainText("Aero toast corrected was deleted.");
    await deletionStatus.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(deletionStatus).toBeHidden();
    await expect(await revealTodayEntry(page, "Breakfast", "Aero toast corrected")).toBeVisible();
    await expectAero(page);
  });

  test("keeps History navigation and meal duplication operable in Aero", async ({
    page,
    e2eControls,
  }) => {
    await seedAndLogin(page, e2eControls, [
      {
        day: HISTORY_DAY,
        mealType: "breakfast",
        name: "Aero duplicate oats",
        calories: 300,
        protein: 12,
        carbs: 48,
        fats: 8,
        fiber: 7,
        mealSlug: "aero-duplicate-oats",
      },
      {
        day: HISTORY_DAY,
        mealType: "breakfast",
        name: "Aero duplicate berries",
        calories: 90,
        protein: 1,
        carbs: 21,
        fats: 0,
        fiber: 5,
        mealSlug: "aero-duplicate-berries",
      },
    ]);
    await setStoredAppearance(page, "aero");
    await page.getByRole("button", { name: "History", exact: true }).click();
    const detail = await openHistoryDay(page, HISTORY_DAY);
    const breakfast = detail.getByRole("button", { name: /^Breakfast\b/ });
    if ((await breakfast.getAttribute("aria-expanded")) !== "true") await breakfast.click();

    await detail.getByRole("button", { name: "Duplicate Breakfast", exact: true }).click();
    const form = detail.getByRole("form", { name: "Duplicate Breakfast", exact: true });
    await expect(form).toBeVisible();
    await form.getByLabel("Date", { exact: true }).fill(DUPLICATE_DESTINATION_DAY);
    await form.getByRole("combobox", { name: "Meal", exact: true }).click();
    await page.getByRole("option", { name: "Dinner", exact: true }).click();
    const duplicate = form.getByRole("button", { name: "Duplicate", exact: true });
    await expectMinimumTarget(duplicate);
    await duplicate.click();

    const status = detail.getByRole("status");
    await expect(status).toContainText(
      `Duplicated: 2. Dinner, ${inlineDisplayDay(DUPLICATE_DESTINATION_DAY)}.`,
    );
    await status.getByRole("button", { name: "Open day", exact: true }).click();
    const copiedDetail = page.getByRole("region", {
      name: displayDay(DUPLICATE_DESTINATION_DAY),
      exact: true,
    });
    await expect(copiedDetail).toBeVisible();
    await expect(copiedDetail.getByText("390 kcal", { exact: true })).toBeVisible();
    await expectAero(page);
    await expectNoDocumentOverflow(page);
  });

  test("preserves Aero session state across responsive seams and representative viewports", async ({
    authenticatedPage: page,
  }) => {
    await setStoredAppearance(page, "aero");
    for (const [width, height] of [
      [390, 844],
      [900, 1024],
      [1280, 720],
      [1440, 900],
    ] as const) {
      await test.step(`${width}x${height}`, async () => {
        await page.setViewportSize({ width, height });
        await expectAero(page);
        await expectNoDocumentOverflow(page);
        await expect(page.locator('button[aria-current="page"]')).toHaveCount(1);
      });
    }

    await page.setViewportSize({ width: 767, height: 900 });
    const dateNavigation = page.getByRole("group", { name: "Log date", exact: true });
    await dateNavigation.getByRole("button", { name: /Previous day/ }).click();
    const selectedDate = await dateNavigation.getByRole("button").nth(1).getAttribute("aria-label");
    const composer = await openAdaptiveFoodComposer(page);
    await page.getByRole("combobox", { name: "Meal", exact: true }).click();
    await page.getByRole("option", { name: "Dinner", exact: true }).click();
    await composer.fill("Aero seam-safe tofu and rice");

    await page.waitForTimeout(350);
    const resizeRequests: string[] = [];
    const recordRequest = (request: Request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/v1/")) resizeRequests.push(pathname);
    };
    page.on("request", recordRequest);
    await page.setViewportSize({ width: 768, height: 900 });
    const desktopComposer = page.getByRole("combobox", { name: "Log food", exact: true });
    await expect(desktopComposer).toHaveValue("Aero seam-safe tofu and rice");
    await expect(dateNavigation.getByRole("button").nth(1)).toHaveAttribute(
      "aria-label",
      selectedDate ?? "",
    );
    await expectAero(page);

    await page.setViewportSize({ width: 767, height: 900 });
    await expect(page.locator("#food-log-sheet")).toBeVisible();
    await expect(composer).toHaveValue("Aero seam-safe tofu and rice");
    await expect(page.getByRole("combobox", { name: "Meal", exact: true })).toHaveText("Dinner");
    page.off("request", recordRequest);
    expect(resizeRequests).toEqual([]);
  });

  test("contains long locales and honors reduced motion focus targets and safe areas in Aero", async ({
    page,
    e2eControls,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const localeUsers = (["ru", "pl", "tt"] as const).map((locale) => ({
      locale,
      user: isolatedTestUser({
        email: `aero-${locale}@example.invalid`,
        profile: {
          dailyCalorieGoal: 2_000,
          weightKg: 70,
          heightCm: 175,
          preferredLanguage: locale,
          nutritionGoal: "maintain",
        },
      }),
    }));
    await e2eControls.reset(localeUsers.map(({ user }) => user));

    for (const { locale, user } of localeUsers) {
      await test.step(locale, async () => {
        await loginThroughSetup(page, user);
        await setStoredAppearance(page, "aero");

        for (const width of [320, 390, 430]) {
          await page.setViewportSize({ width, height: 844 });
          for (const route of ["/app", "/history", "/settings"]) {
            await page.goto(route);
            await expectAero(page);
            await expectNoDocumentOverflow(page);
            await expect(page.locator('[data-slot="app-tab-shell"]')).toBeVisible();
            const activeDestination = page.locator('button[aria-current="page"]');
            await expect(activeDestination).toBeVisible();
            await expectInsideVisualViewport(activeDestination);
          }
        }

        await page.goto("/settings");
        const aero = appearanceSwitch(page);
        await expect(aero).toHaveAttribute("aria-checked", "true");
        await expectMinimumTarget(aero);
        await aero.focus();
        await expect(aero).toBeFocused();
        await expect
          .poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))
          .toBe(true);
        await page.waitForTimeout(300);
        expect(
          await page.locator("body").evaluate((body) =>
            body.getAnimations({ subtree: true }).every((animation) => {
              const iterations = animation.effect?.getTiming().iterations;
              return iterations !== Infinity || animation.playState !== "running";
            }),
          ),
        ).toBe(true);
      });
    }
  });
});
