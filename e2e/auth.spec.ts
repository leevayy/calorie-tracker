import {
  expect,
  isolatedTestUser,
  loginThroughVisibleUi,
  openSettingsThroughVisibleUi,
  test,
} from "./support/fixtures";

test.describe("Authentication", () => {
  test("signs up, signs in, persists the session, and signs out", async ({
    page,
    e2eControls,
  }) => {
    const user = isolatedTestUser();
    await e2eControls.reset();

    await page.goto("/");
    await page.getByRole("button", { name: "Don't have an account? Sign up" }).click();
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page).toHaveURL(/\/app$/);

    await page.reload();
    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole("button", { name: "Calorie Tracker" }),
    ).toHaveAttribute("aria-current", "page");

    await openSettingsThroughVisibleUi(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);

    await loginThroughVisibleUi(page, user);
    await page.reload();
    await expect(page).toHaveURL(/\/app$/);

    await openSettingsThroughVisibleUi(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  test("shows validation and rejects invalid credentials without losing input", async ({
    page,
    isolatedUser,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Don't have an account? Sign up" }).click();

    const emailInput = page.getByLabel("Email");
    const passwordInput = page.getByLabel("Password");
    await emailInput.fill(isolatedUser.email);
    await passwordInput.fill("short");
    await page.getByRole("button", { name: "Sign Up" }).click();

    expect(
      await passwordInput.evaluate((element: HTMLInputElement) => element.validationMessage),
    ).not.toBe("");
    await expect(emailInput).toHaveValue(isolatedUser.email);
    await expect(passwordInput).toHaveValue("short");
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("button", { name: "Already have an account? Sign in" }).click();
    await passwordInput.fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByRole("alert")).toHaveText("Invalid email or password.");
    await expect(emailInput).toHaveValue(isolatedUser.email);
    await expect(passwordInput).toHaveValue("definitely-wrong-password");
    await expect(page).toHaveURL(/\/$/);
  });
});
