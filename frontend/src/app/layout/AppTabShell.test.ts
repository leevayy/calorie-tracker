import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppTabShell from "./AppTabShell";

const { profileLoad } = vi.hoisted(() => ({ profileLoad: vi.fn() }));

vi.mock("mobx-react-lite", () => ({ observer: (module: unknown) => module }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/stores/StoreContext", () => ({
  useRootStore: () => ({
    profile: { read: { load: profileLoad } },
    session: { user: { email: "synthetic@example.invalid" } },
  }),
}));
vi.mock("../hooks/useSyncPreferredLanguageFromProfile", () => ({
  useSyncPreferredLanguageFromProfile: () => undefined,
}));
vi.mock("../pages/SettingsPage", () => ({
  default: () => createElement("button", { type: "button" }, "Settings control"),
}));
vi.mock("../pages/MainPage", () => ({
  default: () => createElement("button", { type: "button" }, "Home control"),
}));
vi.mock("../pages/HistoryPage", () => ({
  default: () => createElement("button", { type: "button" }, "History control"),
}));
vi.mock("./AppTabNav", () => ({ default: () => null }));

class MockResizeObserver {
  observe() {}
  disconnect() {}
}

const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalScrollTo) {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
  }
});

describe("AppTabShell accessibility", () => {
  it("exposes only the route's active tab panel", () => {
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/app"] },
        createElement(AppTabShell),
      ),
    );

    const settings = screen.getByRole("button", { name: "Settings control", hidden: true }).closest("section");
    const home = screen.getByRole("button", { name: "Home control" }).closest("section");
    const history = screen.getByRole("button", { name: "History control", hidden: true }).closest("section");

    expect(home?.getAttribute("aria-hidden")).toBe("false");
    expect(home?.hasAttribute("inert")).toBe(false);
    expect(settings?.getAttribute("aria-hidden")).toBe("true");
    expect(settings?.hasAttribute("inert")).toBe(true);
    expect(history?.getAttribute("aria-hidden")).toBe("true");
    expect(history?.hasAttribute("inert")).toBe(true);
  });
});
