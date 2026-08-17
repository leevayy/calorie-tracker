import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DESKTOP_LAYOUT_QUERY, useDesktopLayout } from "./useDesktopLayout";

function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: DESKTOP_LAYOUT_QUERY,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
  } as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));

  return (nextMatches: boolean) => {
    matches = nextMatches;
    const event = { matches, media: DESKTOP_LAYOUT_QUERY } as MediaQueryListEvent;
    listeners.forEach((listener) => listener(event));
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useDesktopLayout", () => {
  it("tracks the shared desktop breakpoint", () => {
    const changeMatches = installMatchMedia(false);
    const { result } = renderHook(() => useDesktopLayout());

    expect(result.current).toBe(false);

    act(() => changeMatches(true));
    expect(result.current).toBe(true);
  });
});
