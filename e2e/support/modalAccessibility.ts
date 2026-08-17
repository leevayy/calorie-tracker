import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

async function focusDialogBoundary(
  page: Page,
  boundary: "first" | "last",
): Promise<void> {
  const dialog = await expectSingleExposedDialog(page);
  const focused = await dialog.evaluate(
    (root, { selector, edge }) => {
      const controls = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0 &&
            !element.closest("[inert]")
          );
        },
      );
      const target = edge === "first" ? controls[0] : controls.at(-1);
      target?.focus();
      return target != null && document.activeElement === target;
    },
    { selector: FOCUSABLE_SELECTOR, edge: boundary },
  );
  expect(focused, `the dialog must expose a ${boundary} keyboard focus target`).toBe(true);
}

async function expectSingleExposedDialog(page: Page) {
  const dialogs = page.getByRole("dialog");
  await expect(dialogs).toHaveCount(1);
  await expect(dialogs).toBeVisible();
  return dialogs;
}

async function expectFocusInsideDialog(page: Page): Promise<void> {
  const dialog = await expectSingleExposedDialog(page);
  await expect.poll(() => dialog.evaluate((root) => root.contains(document.activeElement))).toBe(true);
}

/**
 * Prove that modal background controls remain in the DOM but leave both the
 * accessibility tree and the forward/reverse keyboard focus cycle.
 */
export async function expectAppBackgroundExcludedFromAccessibilityTree(
  page: Page,
): Promise<void> {
  const previousDayDomControl = page.locator('button[aria-label^="Previous day,"]');
  const historyDomControl = page.locator('button[aria-label="History"]');

  await expect(previousDayDomControl).toHaveCount(1);
  await expect(historyDomControl).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Previous day,/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "History", exact: true })).toHaveCount(0);

  // Check the open behavior before the boundary probes below manipulate focus.
  // A focus trap is not sufficient if opening initially leaves focus behind on
  // an inert dashboard control.
  await expectFocusInsideDialog(page);

  const browserName = page.context().browser()?.browserType().name();
  // Mobile WebKit models Safari's default hardware-keyboard preference, where
  // Option+Tab rather than Tab advances through all form controls.
  const forwardKey = browserName === "webkit" ? "Alt+Tab" : "Tab";
  const reverseKey = browserName === "webkit" ? "Alt+Shift+Tab" : "Shift+Tab";

  await focusDialogBoundary(page, "first");
  await page.keyboard.press(reverseKey);
  await expectFocusInsideDialog(page);

  await focusDialogBoundary(page, "last");
  await page.keyboard.press(forwardKey);
  await expectFocusInsideDialog(page);
}
