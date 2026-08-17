import type { Locator, Page } from "@playwright/test";
import { expect } from "./fixtures";

export function usesDesktopWorkspace(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 768;
}

/** Opens the mobile sheet or returns the already-visible desktop composer. */
export async function openAdaptiveFoodComposer(
  page: Page,
  accessibleName = "Log food",
): Promise<Locator> {
  const input = page.getByRole("combobox", { name: accessibleName, exact: true });
  if (!usesDesktopWorkspace(page)) {
    await page.getByRole("button", { name: accessibleName, exact: true }).click();
  }
  await expect(input).toBeVisible();
  return input;
}

/** Closes only the compact mobile sheet; desktop's persistent composer stays visible. */
export async function closeAdaptiveFoodComposer(
  page: Page,
  accessibleName = "Log food",
): Promise<void> {
  if (usesDesktopWorkspace(page)) return;
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: accessibleName, exact: true })).toBeVisible();
}
