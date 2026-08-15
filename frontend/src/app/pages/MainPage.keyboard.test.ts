import { createElement } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppTabChatProvider } from "../context/AppTabChatContext";
import MainPage from "./MainPage";

const nativeFocus = HTMLElement.prototype.focus;

const { rootStore } = vi.hoisted(() => ({
  rootStore: {
    profile: {
      read: {
        profile: null,
        fetchState: "success",
        errorKey: null,
        load: vi.fn(),
      },
    },
    foodLog: {
      dayRead: {
        data: null,
        fetchState: "success",
        errorKey: null,
        loadDay: vi.fn(),
      },
      frequentWeekRead: {
        items: [],
        load: vi.fn(),
      },
      historicalSuggestions: {
        items: [],
        fetchState: "initial",
        load: vi.fn(),
        clear: vi.fn(),
      },
      entryCreate: {
        fetchState: "idle",
        errorKey: null,
        create: vi.fn(),
      },
      entriesCreate: {
        fetchState: "idle",
        errorKey: null,
        isLoading: false,
        create: vi.fn(),
      },
      entryUpdate: {
        fetchState: "idle",
        errorKey: null,
        clearError: vi.fn(),
        update: vi.fn(),
      },
      entryDelete: {
        fetchState: "idle",
        errorKey: null,
        isLoading: false,
        clearError: vi.fn(),
        remove: vi.fn(),
        removeMany: vi.fn(),
        restore: vi.fn(),
      },
    },
    aiParse: {
      data: null,
      fetchState: "idle",
      errorKey: null,
      parse: vi.fn(),
    },
  },
}));

vi.mock("mobx-react-lite", () => ({ observer: (component: unknown) => component }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));
vi.mock("@/stores/StoreContext", () => ({ useRootStore: () => rootStore }));
vi.mock("../hooks/useRequireAuth", () => ({ useRequireAuth: () => undefined }));
vi.mock("./main/mainPageHooks", () => ({
  useBehavioralToday: () => "2026-08-15",
}));

class MockVisualViewport extends EventTarget {
  height = 852;
  offsetTop = 0;
}

describe("MainPage virtual keyboard", () => {
  let visualViewport: MockVisualViewport;
  let focusedDrawerInputRect: { top: number; bottom: number } | null;
  let animationFrames: FrameRequestCallback[];
  let userActivation: boolean;
  let drawerFocusDuringActivation: boolean | null;
  let drawerFocusOptions: FocusOptions | undefined;
  let textInputFocusTrace: Array<"collapsed" | "drawer">;

  beforeEach(() => {
    visualViewport = new MockVisualViewport();
    focusedDrawerInputRect = null;
    animationFrames = [];
    userActivation = false;
    drawerFocusDuringActivation = null;
    drawerFocusOptions = undefined;
    textInputFocusTrace = [];
    vi.stubGlobal("innerHeight", 852);
    vi.stubGlobal("visualViewport", visualViewport);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function focus(options) {
      if (
        this instanceof HTMLInputElement &&
        this.closest("[data-vaul-drawer]") &&
        drawerFocusDuringActivation == null
      ) {
        drawerFocusDuringActivation = userActivation;
        drawerFocusOptions = options;
      }
      nativeFocus.call(this, options);
    });

    document.addEventListener("focusin", modelIPhoneKeyboardFocus);
  });

  afterEach(() => {
    document.removeEventListener("focusin", modelIPhoneKeyboardFocus);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    cleanup();
  });

  function modelIPhoneKeyboardFocus(event: FocusEvent) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const drawer = target.closest("[data-vaul-drawer]");
    if (!drawer) {
      textInputFocusTrace.push("collapsed");
      // A keyboard opened for the bottom field first, so Safari panned the visual
      // viewport before React replaced that field with the drawer input.
      visualViewport.height = 482;
      visualViewport.offsetTop = 320;
      visualViewport.dispatchEvent(new Event("resize"));
      visualViewport.dispatchEvent(new Event("scroll"));
      return;
    }

    textInputFocusTrace.push("drawer");
    // The final input exists before this is the only focus that opens the
    // keyboard. Keep a stale offset only when the collapsed text field caused it.
    visualViewport.height = 482;
    visualViewport.dispatchEvent(new Event("resize"));
    focusedDrawerInputRect = { top: 160, bottom: 204 };
  }

  it("opens the keyboard only after the drawer input is on screen", async () => {
    const view = render(
      createElement(AppTabChatProvider, null, createElement(MainPage)),
    );
    const trigger = view.container.querySelector<HTMLElement>(
      "input[placeholder='main.logFoodPlaceholder'], button[aria-label='main.logFoodPlaceholder']",
    );
    expect(trigger).not.toBeNull();
    expect(trigger).toBeInstanceOf(HTMLButtonElement);
    expect(
      document.querySelectorAll("input[placeholder='main.logFoodPlaceholder']"),
    ).toHaveLength(0);

    await act(async () => {
      trigger!.focus();
      userActivation = true;
      fireEvent.click(trigger!);
    });
    userActivation = false;
    await act(async () => {
      for (const callback of animationFrames.splice(0)) callback(0);
    });

    const drawerInput = document.querySelector<HTMLInputElement>(
      "[data-vaul-drawer] input[placeholder='main.logFoodPlaceholder']",
    );
    const drawer = document.querySelector<HTMLElement>("[data-vaul-drawer]");
    expect(drawerInput).not.toBeNull();
    expect(
      document.querySelectorAll("input[placeholder='main.logFoodPlaceholder']"),
    ).toHaveLength(1);
    expect(drawer).not.toBeNull();
    expect(document.activeElement).toBe(drawerInput);
    expect(drawerFocusDuringActivation).not.toBeNull();
    expect(focusedDrawerInputRect).not.toBeNull();
    expect(focusedDrawerInputRect!.top).toBeGreaterThanOrEqual(visualViewport.offsetTop);
    expect(focusedDrawerInputRect!.bottom).toBeLessThanOrEqual(
      visualViewport.offsetTop + visualViewport.height,
    );
    expect(drawerFocusDuringActivation).toBe(true);
    expect(drawerFocusOptions).toMatchObject({ preventScroll: true });
    expect(textInputFocusTrace).toEqual(["drawer"]);

    // Exercise keyboard-height changes plus the temporary viewport offsets iOS
    // reports while browser chrome and alternative keyboards settle.
    for (const viewport of [
      { height: 482, offsetTop: 0 },
      { height: 360, offsetTop: 0 },
      { height: 482, offsetTop: 84 },
      { height: 360, offsetTop: 120 },
    ]) {
      visualViewport.height = viewport.height;
      visualViewport.offsetTop = viewport.offsetTop;
      visualViewport.dispatchEvent(new Event("resize"));
      visualViewport.dispatchEvent(new Event("scroll"));

      expect(focusedDrawerInputRect!.top).toBeGreaterThanOrEqual(visualViewport.offsetTop);
      expect(focusedDrawerInputRect!.bottom).toBeLessThanOrEqual(
        visualViewport.offsetTop + visualViewport.height,
      );
      expect(drawer!.style.bottom).toBe("");
      expect(drawer!.style.height).toBe("");
    }
  });
});
