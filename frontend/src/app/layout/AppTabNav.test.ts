import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppTabNav from "./AppTabNav";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

class MockResizeObserver {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AppTabNav", () => {
  it("keeps stable accessible destinations while exposing ornamental Aero icons", () => {
    const onSelectTab = vi.fn();
    const { container } = render(
      createElement(AppTabNav, { progress: 1, activeTabIndex: 1, onSelectTab }),
    );

    const settings = screen.getByRole("button", { name: "settings.title" });
    const today = screen.getByRole("button", { name: "main.title" });
    const history = screen.getByRole("button", { name: "history.title" });

    expect(settings.getAttribute("aria-current")).toBeNull();
    expect(today.getAttribute("aria-current")).toBe("page");
    expect(history.getAttribute("aria-current")).toBeNull();
    expect(container.querySelectorAll('[data-slot="aero-nav-icon"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-slot="aero-nav-icon"][aria-hidden="true"]')).toHaveLength(3);

    fireEvent.click(history);
    expect(onSelectTab).toHaveBeenCalledWith(2);
  });

  it("positions its feedback lens from fractional swipe progress", () => {
    const { container } = render(
      createElement(AppTabNav, { progress: 0.5, activeTabIndex: 0, onSelectTab: vi.fn() }),
    );

    const indicator = container.querySelector<HTMLElement>('[data-slot="app-tab-nav-indicator"]');
    expect(indicator?.style.left).toBe("33.33333333333333%");
  });
});
