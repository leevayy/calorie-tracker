import type { Locator, Page } from "@playwright/test";
import {
  behavioralIsoDay,
  expect,
  isolatedTestUser,
  loginThroughSetup,
  test,
  type E2EControlClient,
  type E2ETestUser,
} from "./support/fixtures";
import { usesDesktopWorkspace } from "./support/adaptiveComposer";

const SEEDED_NAME = "Seeded power bowl";
const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";

function inlineDisplayDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

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
): Promise<{ editor: Locator; entryId: string; user: E2ETestUser }> {
  const user = correctionUser(overrides);
  const seeded = await controls.reset([user]);
  await loginThroughSetup(page, user);
  if (usesDesktopWorkspace(page)) {
    await page.getByRole("row", { name: new RegExp(SEEDED_NAME) }).click();
  } else {
    await page.getByRole("button", { name: /^Lunch/ }).click();
    await page.getByRole("button", { name: new RegExp(SEEDED_NAME) }).click();
  }
  const editor = usesDesktopWorkspace(page)
    ? page.getByRole("form", { name: `Edit ${SEEDED_NAME}`, exact: true })
    : page.getByRole("dialog", { name: SEEDED_NAME, exact: true });
  await expect(editor).toBeVisible();
  return { editor, entryId: seeded.users[0]!.entryIds[0]!, user };
}

async function previewDouble(page: Page, editor: Locator, instruction = "Double this serving"): Promise<void> {
  await editor.getByLabel("What should change?").fill(instruction);
  if (!usesDesktopWorkspace(page)) {
    await editor.getByRole("button", { name: "Preview" }).click();
    await expect(editor.getByText("Result", { exact: true })).toBeVisible();
  }
}

async function expandEditorSchedule(dialog: Locator): Promise<void> {
  if (usesDesktopWorkspace(dialog.page())) return;
  const disclosure = dialog.getByRole("button", { name: "Date · Meal", exact: true });
  await expect(disclosure).toBeVisible();
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") {
    await disclosure.click();
  }
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
}

async function exposeManualFields(page: Page, editor: Locator): Promise<void> {
  if (!usesDesktopWorkspace(page)) {
    await editor.getByRole("button", { name: "Edit fields" }).click();
  }
}

async function exposeNutrition(page: Page, editor: Locator): Promise<void> {
  if (!usesDesktopWorkspace(page)) {
    await editor.getByRole("button", { name: "Nutrition details" }).click();
  }
}

async function expectEditorClosed(page: Page, editor: Locator): Promise<void> {
  await expect(editor).toBeHidden();
  if (usesDesktopWorkspace(page)) await expect(page.getByRole("dialog")).toHaveCount(0);
}

function mainEntryRow(page: Page, name: string): Locator {
  return page.getByRole("region", { name: "Lunch", exact: true })
    .getByRole("row", { name: new RegExp(name) });
}

async function reopenDesktopEntry(page: Page, name = SEEDED_NAME): Promise<Locator> {
  await mainEntryRow(page, name).click();
  const editor = page.getByRole("form", { name: `Edit ${name}`, exact: true });
  await expect(editor).toBeVisible();
  return editor;
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
    const { editor } = await openSeededEntry(page, e2eControls);

    if (usesDesktopWorkspace(page)) {
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(editor.getByLabel("Name")).toHaveValue(SEEDED_NAME);
      await expect(editor.getByLabel("Portion")).toHaveValue("1 bowl");
      await expect(editor.getByLabel("Calories", { exact: true })).toHaveValue("300");
      for (const [label, value] of [["Protein", "20"], ["Carbohydrates", "30"], ["Fat", "10"], ["Fiber", "5"]] as const) {
        await expect(editor.getByLabel(label, { exact: true })).toHaveValue(value);
      }
      await expect(editor.getByLabel("Date", { exact: true })).toHaveValue(behavioralIsoDay());
      await expect(editor.getByRole("combobox", { name: "Meal", exact: true })).toHaveText("Lunch");
      return;
    }

    await expect(page.getByRole("heading", { name: SEEDED_NAME })).toBeVisible();
    const dialog = editor;
    await expect(dialog.getByText("300\u00a0kcal", { exact: true })).toBeVisible();
    for (const macro of ["P 20\u00a0g", "C 30\u00a0g", "F 10\u00a0g", "Fi 5\u00a0g"]) {
      await expect(dialog.getByText(macro, { exact: true })).toBeVisible();
    }
    await expect(dialog.getByText("Current saved values", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Result", { exact: true })).toHaveCount(0);
    const scheduleDisclosure = dialog.getByRole("button", {
      name: "Date · Meal",
      exact: true,
    });
    await expect(scheduleDisclosure).toHaveAttribute("aria-expanded", "false");
    await expect(scheduleDisclosure).toContainText(
      `${inlineDisplayDay(behavioralIsoDay())} · Lunch`,
    );
    await expandEditorSchedule(dialog);
    await expect(dialog.getByRole("textbox", { name: "Date" })).toHaveValue(behavioralIsoDay());
    await expect(dialog.getByRole("combobox", { name: "Meal" })).toHaveText("Lunch");
  });

  test("switches to Edit fields and exposes detailed nutrients without losing the draft", async ({
    page,
    e2eControls,
  }) => {
    const { editor } = await openSeededEntry(page, e2eControls);
    await previewDouble(page, editor);

    await exposeManualFields(page, editor);
    if (usesDesktopWorkspace(page)) {
      await expect(editor.getByLabel("Calories", { exact: true })).toHaveValue("300");
      await exposeNutrition(page, editor);
      await expect(editor.getByLabel("Protein")).toHaveValue("20");
      await expect(editor.getByLabel("What should change?")).toHaveValue("Double this serving");
    } else {
      await expect(editor.getByLabel("Calories", { exact: true })).toHaveValue("600");
      await exposeNutrition(page, editor);
      await expect(editor.getByLabel("Protein")).toHaveValue("40");
      await expect(editor.getByLabel("Carbohydrates")).toHaveValue("60");
      await expect(editor.getByLabel("Fat")).toHaveValue("20");
      await expect(editor.getByLabel("Fiber")).toHaveValue("10");
      await editor.getByRole("button", { name: "Back to AI" }).click();
      await expect(editor.getByText("2 servings · 600\u00a0kcal", { exact: true })).toBeVisible();
    }
  });

  test("saves a structured correction and reconciles every aggregate after reload", async ({
    page,
    e2eControls,
  }) => {
    const { editor } = await openSeededEntry(page, e2eControls);
    await exposeManualFields(page, editor);
    await editor.getByLabel("Name").fill("Corrected power bowl");
    await editor.getByLabel("Calories", { exact: true }).fill("450");
    await exposeNutrition(page, editor);
    await editor.getByLabel("Protein").fill("25");
    await editor.getByRole("button", { name: "Save" }).click();

    await expectEditorClosed(page, editor);
    if (usesDesktopWorkspace(page)) {
      await expect(mainEntryRow(page, "Corrected power bowl")).toContainText("450");
    } else {
      await expect(page.getByRole("button", { name: /^Lunch/ })).toContainText("450\u00a0kcal");
    }
    await page.reload();
    if (usesDesktopWorkspace(page)) {
      await expect(mainEntryRow(page, "Corrected power bowl")).toContainText("450");
    } else {
      await expect(page.getByRole("button", { name: /^Lunch/ })).toContainText("450\u00a0kcal");
    }

    await page.getByRole("button", { name: "History" }).click();
    await expect(page).toHaveURL(/\/history$/);
    const dayCard = page.getByRole("button", { name: /Open log:/ }).filter({
      hasText: "450 / 2000 kcal",
    });
    await expect(dayCard).toBeVisible();
    await dayCard.click();
    const historyDetail = page.locator('section[aria-labelledby="history-day-detail-title"]');
    await expect(historyDetail.getByText("450 kcal", { exact: true })).toBeVisible();
    await historyDetail.getByRole("button", { name: /^Lunch/ }).click();
    await expect(historyDetail.getByText("Corrected power bowl", { exact: true })).toBeVisible();
  });

  test("keeps invalid structured edits with field-level feedback", async ({
    page,
    e2eControls,
  }) => {
    const { editor } = await openSeededEntry(page, e2eControls);
    await exposeManualFields(page, editor);
    await editor.getByLabel("Name").fill("   ");
    await editor.getByLabel("Calories", { exact: true }).fill("-4");
    await editor.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("This field is required.")).toBeVisible();
    await expect(page.getByText("Must be 0 or more.")).toBeVisible();
    await expect(editor.getByLabel("Name")).toHaveValue("   ");
    await expect(editor.getByLabel("Calories", { exact: true })).toHaveValue("-4");
    expect((await readDayThroughSession(page)).body.totalCalories).toBe(300);
  });

  test("opens AI correction by default for a saved entry", async ({ page, e2eControls }) => {
    const { editor } = await openSeededEntry(page, e2eControls);

    await expect(editor.getByLabel("What should change?")).toBeVisible();
    if (usesDesktopWorkspace(page)) {
      await expect(editor.getByRole("button", { name: "Save", exact: true })).toBeVisible();
      await expect(editor.getByLabel("Name")).toBeVisible();
      await expect(editor.getByRole("button", { name: "Preview" })).toHaveCount(0);
    } else {
      await expect(editor.getByRole("button", { name: "Preview" })).toBeVisible();
      await expect(editor.getByLabel("Name")).toHaveCount(0);
      await expect(editor.getByRole("button", { name: "Edit fields" })).toBeVisible();
    }
  });

  test("uses the stored structured entry as correction context", async ({ page, e2eControls }) => {
    const { editor } = await openSeededEntry(page, e2eControls);
    await previewDouble(page, editor, "Make the saved serving twice as large");

    if (usesDesktopWorkspace(page)) {
      await editor.getByRole("button", { name: "Send & save" }).click();
      await expectEditorClosed(page, editor);
      expect((await readDayThroughSession(page)).body.totalCalories).toBe(600);
      return;
    }

    const proposedResult = editor.getByText("Result", { exact: true }).locator("..");
    await expect(
      proposedResult.getByText("2 servings · 600\u00a0kcal", { exact: true }),
    ).toBeVisible();
    for (const macro of ["P 40\u00a0g", "C 60\u00a0g", "F 20\u00a0g", "Fi 10\u00a0g"]) {
      await expect(proposedResult.getByText(macro, { exact: true })).toBeVisible();
    }
    expect((await readDayThroughSession(page)).body.totalCalories).toBe(300);
  });

  test("validates a complete AI draft before Save persists it", async ({ page, e2eControls }) => {
    const { editor } = await openSeededEntry(page, e2eControls);
    await previewDouble(page, editor);

    if (usesDesktopWorkspace(page)) {
      expect((await readDayThroughSession(page)).body.totalCalories).toBe(300);
      await editor.getByRole("button", { name: "Send & save" }).click();
      await expectEditorClosed(page, editor);
      expect((await readDayThroughSession(page)).body.totalCalories).toBe(600);
      return;
    }

    const dialog = editor;
    const proposedResult = dialog.getByText("Result", { exact: true }).locator("..");
    await expect(proposedResult.getByText(SEEDED_NAME, { exact: true })).toBeVisible();
    await expect(
      proposedResult.getByText("2 servings · 600\u00a0kcal", { exact: true }),
    ).toBeVisible();
    for (const macro of ["P 40\u00a0g", "C 60\u00a0g", "F 20\u00a0g", "Fi 10\u00a0g"]) {
      await expect(proposedResult.getByText(macro, { exact: true })).toBeVisible();
    }
    expect((await readDayThroughSession(page)).body.totalCalories).toBe(300);

    await page.getByRole("button", { name: "Save" }).click();
    expect((await readDayThroughSession(page)).body.totalCalories).toBe(600);
  });

  test("scales calories and every nutrient exactly for a proportional instruction", async ({
    page,
    e2eControls,
  }) => {
    let { editor } = await openSeededEntry(page, e2eControls);
    await previewDouble(page, editor, "Double the portion and all nutrition values");
    if (usesDesktopWorkspace(page)) {
      await editor.getByRole("button", { name: "Send & save" }).click();
      await expectEditorClosed(page, editor);
      editor = await reopenDesktopEntry(page);
    } else {
      await exposeManualFields(page, editor);
    }
    await expect(editor.getByLabel("Portion")).toHaveValue("2 servings");
    await expect(editor.getByLabel("Calories", { exact: true })).toHaveValue("600");
    await exposeNutrition(page, editor);
    await expect(editor.getByLabel("Protein")).toHaveValue("40");
    await expect(editor.getByLabel("Carbohydrates")).toHaveValue("60");
    await expect(editor.getByLabel("Fat")).toHaveValue("20");
    await expect(editor.getByLabel("Fiber")).toHaveValue("10");
  });

  test("moves the AI correction draft with explicit date and meal selectors", async ({
    page,
    e2eControls,
  }) => {
    const { editor: dialog } = await openSeededEntry(page, e2eControls);
    await exposeManualFields(page, dialog);
    await expandEditorSchedule(dialog);
    await dialog.getByRole("textbox", { name: "Date" }).fill(behavioralIsoDay(1));
    await dialog.getByRole("combobox", { name: "Meal" }).click();
    await page.getByRole("option", { name: "Dinner" }).click();
    if (!usesDesktopWorkspace(page)) {
      await dialog.getByRole("button", { name: "Back to AI" }).click();
      await previewDouble(page, dialog);
      await expandEditorSchedule(dialog);
    }
    await expect(dialog.getByRole("textbox", { name: "Date" })).toHaveValue(behavioralIsoDay(1));
    await expect(dialog.getByRole("combobox", { name: "Meal" })).toHaveText("Dinner");
    await dialog.getByRole("button", { name: "Save" }).click();

    if (usesDesktopWorkspace(page)) {
      await expect(mainEntryRow(page, SEEDED_NAME)).toHaveCount(0);
    } else {
      await expect(page.getByRole("button", { name: /^Lunch/ })).toContainText("0\u00a0kcal");
    }
    await page.getByRole("button", { name: "Next day" }).click();
    if (usesDesktopWorkspace(page)) {
      await expect(
        page
          .getByRole("region", { name: "Dinner", exact: true })
          .getByRole("row", { name: new RegExp(SEEDED_NAME) }),
      ).toContainText("300");
    } else {
      await expect(page.getByRole("button", { name: /^Dinner/ })).toContainText("600\u00a0kcal");
      await page.getByRole("button", { name: /^Dinner/ }).click();
      await expect(page.getByRole("button", { name: new RegExp(SEEDED_NAME) })).toBeVisible();
    }
  });

  test("shares one correction draft while switching AI and structured modes", async ({
    page,
    e2eControls,
  }) => {
    const { editor } = await openSeededEntry(page, e2eControls);
    await previewDouble(page, editor);
    await exposeManualFields(page, editor);
    await editor.getByLabel("Name").fill("Shared draft bowl");
    if (usesDesktopWorkspace(page)) {
      await editor.getByRole("button", { name: "Send & save" }).click();
      await expectEditorClosed(page, editor);
      const day = (await readDayThroughSession(page)).body as { meals: { lunch: Array<{ name: string; calories: number }> } };
      expect(day.meals.lunch).toEqual([expect.objectContaining({ name: SEEDED_NAME, calories: 600 })]);
    } else {
      await editor.getByRole("button", { name: "Back to AI" }).click();
      await expect(editor.getByText("Shared draft bowl", { exact: true })).toBeVisible();
      await expect(editor.getByText("2 servings · 600\u00a0kcal", { exact: true })).toBeVisible();
      await editor.getByRole("button", { name: "Edit fields" }).click();
      await expect(editor.getByLabel("Name")).toHaveValue("Shared draft bowl");
      await expect(editor.getByLabel("Calories", { exact: true })).toHaveValue("600");
    }
  });

  test("preserves the instruction and persisted entry after a failed AI correction", async ({
    page,
    e2eControls,
  }) => {
    const { editor } = await openSeededEntry(page, e2eControls);
    await e2eControls.setAiMode({ correction: "failure" });
    const instruction = "Double this but keep my note";
    await editor.getByLabel("What should change?").fill(instruction);
    if (usesDesktopWorkspace(page)) {
      await editor.getByLabel("Calories", { exact: true }).fill("350");
      await editor.getByRole("button", { name: "Send & save" }).click();
    } else {
      await editor.getByRole("button", { name: "Preview" }).click();
    }

    await expect(editor.getByRole("alert")).toContainText("correction service is unavailable");
    await expect(editor.getByLabel("What should change?")).toHaveValue(instruction);
    if (usesDesktopWorkspace(page)) {
      await expect(editor.getByLabel("Calories", { exact: true })).toHaveValue("350");
      await editor.getByRole("button", { name: "Clear instruction" }).click();
      await editor.getByRole("button", { name: "Save" }).click();
      expect((await readDayThroughSession(page)).body.totalCalories).toBe(350);
      return;
    }
    await expect(editor.getByRole("button", { name: "Edit fields" })).toBeVisible();
    expect((await readDayThroughSession(page)).body.totalCalories).toBe(300);
  });

  test("saves either correction mode exactly once and reconciles every aggregate", async ({
    page,
    e2eControls,
  }) => {
    const { editor } = await openSeededEntry(page, e2eControls);
    await previewDouble(page, editor);
    const updateResponses: number[] = [];
    page.on("response", (response) => {
      if (response.request().method() === "PATCH" && /\/entries\//.test(response.url())) {
        updateResponses.push(response.status());
      }
    });
    await editor.getByRole("button", {
      name: usesDesktopWorkspace(page) ? "Send & save" : "Save",
    }).click();
    await expectEditorClosed(page, editor);
    await page.reload();

    const day = (await readDayThroughSession(page)).body as {
      totalCalories: number;
      meals: { lunch: Array<{ calories: number }> };
    };
    expect(updateResponses).toEqual([200]);
    expect(day.totalCalories).toBe(600);
    expect(day.meals.lunch).toHaveLength(1);
    expect(day.meals.lunch[0]?.calories).toBe(600);
    if (usesDesktopWorkspace(page)) {
      await expect(mainEntryRow(page, SEEDED_NAME)).toContainText("600");
    } else {
      await expect(page.getByRole("button", { name: /^Lunch/ })).toContainText("600\u00a0kcal");
    }
  });
});
