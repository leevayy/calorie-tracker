import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  default: () =>
    createElement(
      "div",
      null,
      createElement("button", { type: "button" }, "Home control"),
      createElement("input", { "aria-label": "Food draft", defaultValue: "" }),
    ),
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
let setDesktopLayout: (matches: boolean) => void;

beforeEach(() => {
  let matches = false;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.delete(listener),
  } as MediaQueryList;
  setDesktopLayout = (nextMatches) => {
    matches = nextMatches;
    const event = { matches } as MediaQueryListEvent;
    listeners.forEach((listener) => listener(event));
  };
  vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));
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

  it("exposes only the current page in the desktop shell", () => {
    vi.mocked(window.matchMedia).mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList);

    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/app"] },
        createElement(AppTabShell),
      ),
    );

    expect(screen.getByRole("button", { name: "Home control" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "History control" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Settings control" })).toBeNull();
    expect(screen.getByRole("button", { name: "History control", hidden: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings control", hidden: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "main.returnToToday" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "settings.account" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "settings.title" })).toBeTruthy();
  });

  it("navigates between desktop destinations", () => {
    vi.mocked(window.matchMedia).mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList);

    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/app"] },
        createElement(AppTabShell),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "history.title" }));
    expect(screen.getByRole("button", { name: "History control" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Home control" })).toBeNull();
  });

  it("preserves the mounted page and its draft across the desktop breakpoint", () => {
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/app"] },
        createElement(AppTabShell),
      ),
    );

    const draft = screen.getByRole("textbox", { name: "Food draft" }) as HTMLInputElement;
    fireEvent.change(draft, { target: { value: "For lunch I ate soup" } });

    act(() => setDesktopLayout(true));

    const desktopDraft = screen.getByRole("textbox", { name: "Food draft" }) as HTMLInputElement;
    expect(desktopDraft).toBe(draft);
    expect(desktopDraft.value).toBe("For lunch I ate soup");

    act(() => setDesktopLayout(false));

    expect(screen.getByRole("textbox", { name: "Food draft" })).toBe(draft);
    expect(draft.value).toBe("For lunch I ate soup");
  });
});
