import {
  expect,
  openSettingsThroughVisibleUi,
  test,
} from "./support/fixtures";

test.describe("Supported profile settings", () => {
  test("updates supported profile fields and language after reload", async ({
    authenticatedPage: page,
  }) => {
    await openSettingsThroughVisibleUi(page);

    await page.getByLabel("App language").selectOption("ru");
    await page.getByLabel("Your target").selectOption("muscle_gain");
    await page.getByLabel("Daily calories").fill("2450");
    await page.getByLabel("Weight (kg)").fill("74.5");
    await page.getByLabel("Height (cm)").fill("181");
    await page.getByRole("button", { name: "Save settings", exact: true }).click();

    await expect(page.getByLabel("Язык приложения")).toHaveValue("ru");
    await page.reload();
    await expect(page).toHaveURL(/\/settings$/);

    await expect(page.getByLabel("Язык приложения")).toHaveValue("ru");
    await expect(page.getByLabel("Ваша цель")).toHaveValue("muscle_gain");
    await expect(page.getByLabel("Калории в день")).toHaveValue("2450");
    await expect(page.getByLabel("Вес (кг)")).toHaveValue("74.5");
    await expect(page.getByLabel("Рост (см)")).toHaveValue("181");
  });

  test("shows no retired coaching or model controls", async ({
    authenticatedPage: page,
  }) => {
    await openSettingsThroughVisibleUi(page);
    await page.reload();

    await expect(page.getByText(/^AI model$/i)).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: /assistant model/i })).toHaveCount(0);
    await expect(page.getByText(/tip vibe/i)).toHaveCount(0);

    await page.getByRole("button", { name: "Calorie Tracker" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.reload();
    await expect(page.getByText(/^Tip$/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /generate a new tip/i })).toHaveCount(0);
  });

  test("does not render or request retired daily advice", async ({
    authenticatedPage: page,
  }) => {
    const retiredRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/tips\/daily|daily-tip/i.test(request.url())) retiredRequests.push(request.url());
    });

    await page.reload();
    await expect(page.getByRole("button", { name: "Calorie Tracker" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByText(/^Tip$/i)).toHaveCount(0);
    await expect(page.getByText(/daily advice/i)).toHaveCount(0);
    expect(retiredRequests).toEqual([]);
  });

  test("keeps auth logging totals and history working without coaching", async ({
    authenticatedPage: page,
  }) => {
    await page.getByRole("button", { name: "Log food" }).click();
    const composer = page.getByRole("combobox", { name: "Log food" });
    await composer.fill("A deterministic oatmeal bowl");
    await composer.press("Enter");
    await expect(page.getByText("Added 1", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", {
        name: /^(Breakfast|Lunch|Dinner|Snack)\b.*320\s+kcal/,
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: "History" }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(
      page.getByRole("button", { name: /Open log:/ }).filter({
        hasText: "320 / 2000 kcal",
      }),
    ).toBeVisible();
    await expect(page.getByText(/^Tip$/i)).toHaveCount(0);
  });

  test("contains no retired coaching copy or controls", async ({ authenticatedPage: page }) => {
    await openSettingsThroughVisibleUi(page);
    const settingsText = await page.locator("body").innerText();
    expect(settingsText).not.toMatch(/tip vibe|daily advice|assistant model|ai model/i);

    await page.getByRole("button", { name: "Calorie Tracker" }).click();
    await expect(page).toHaveURL(/\/app$/);
    const dashboardText = await page.locator("body").innerText();
    expect(dashboardText).not.toMatch(/tip vibe|daily advice|generate a new tip|assistant model/i);
  });
});
