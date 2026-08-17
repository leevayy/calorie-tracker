import type { FoodEntryResponse } from "@contracts/food-log";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ComponentProps } from "react";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/locales/en.json";
import { DesktopLoggingSnackbar } from "./DesktopLoggingSnackbar";

const entry = (id: string, name: string): FoodEntryResponse => ({
  id,
  day: "2026-08-17",
  mealType: "lunch",
  name,
  calories: 100,
  protein: 1,
  carbs: 2,
  fats: 3,
  fiber: 4,
  createdAt: "2026-08-17T10:00:00.000Z",
});

async function renderSnackbar(
  overrides: Partial<ComponentProps<typeof DesktopLoggingSnackbar>> = {},
) {
  const i18n = i18next.createInstance();
  await i18n.init({ resources: { en: { translation: en } }, lng: "en" });
  const props = {
    receiptId: "group-1",
    entries: [entry("1", "Oats"), entry("2", "Banana")],
    busy: false,
    onDismiss: vi.fn(),
    onUndo: vi.fn(),
    ...overrides,
  };
  const result = render(
    createElement(I18nextProvider, { i18n }, createElement(DesktopLoggingSnackbar, props)),
  );
  return { ...result, props, i18n };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DesktopLoggingSnackbar", () => {
  it("shows the group count, offers group-specific Undo, and dismisses after four seconds", async () => {
    const { props } = await renderSnackbar();

    expect(screen.getByRole("status").textContent).toContain("Added 2 foods");
    fireEvent.click(screen.getByRole("button", { name: "Undo added group: Oats and Banana" }));
    expect(props.onUndo).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(3_999));
    expect(props.onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(props.onDismiss).toHaveBeenCalledOnce();
  });

  it("pauses while hovered or focused and restarts a full window for a newer group", async () => {
    const onDismiss = vi.fn();
    const { rerender, i18n } = await renderSnackbar({ onDismiss });
    const status = screen.getByRole("status");

    act(() => vi.advanceTimersByTime(1_500));
    fireEvent.mouseEnter(status);
    act(() => vi.advanceTimersByTime(5_000));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.mouseLeave(status);
    act(() => vi.advanceTimersByTime(2_499));
    expect(onDismiss).not.toHaveBeenCalled();

    rerender(createElement(
      I18nextProvider,
      { i18n },
      createElement(DesktopLoggingSnackbar, {
        receiptId: "group-2",
        entries: [entry("3", "Coffee")],
        busy: false,
        onDismiss,
        onUndo: vi.fn(),
      }),
    ));
    act(() => vi.advanceTimersByTime(3_999));
    expect(onDismiss).not.toHaveBeenCalled();

    const undo = screen.getByRole("button", { name: "Undo added group: Coffee" });
    fireEvent.focus(undo);
    act(() => vi.advanceTimersByTime(5_000));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.blur(undo);
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
