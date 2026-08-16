import { act, cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTypewriterPlaceholder } from "./useTypewriterPlaceholder";

const SUGGESTIONS = ["курица", "сэндвич"] as const;

function TypewriterPreview() {
  const placeholder = useTypewriterPlaceholder(SUGGESTIONS);
  return createElement(
    "output",
    { "data-phase": placeholder.phase, "data-suggestion": placeholder.suggestion },
    placeholder.text,
  );
}

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

describe("useTypewriterPlaceholder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReducedMotion(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("types, holds, deletes, and rotates through the hardcoded suggestions", async () => {
    render(createElement(TypewriterPreview));
    const preview = screen.getByText("к");

    for (let index = 0; index < 5; index += 1) {
      await act(async () => vi.advanceTimersByTimeAsync(75));
    }
    expect(preview.textContent).toBe("курица");
    expect(preview.dataset.phase).toBe("holding");

    await act(async () => vi.advanceTimersByTimeAsync(7_000));
    for (let index = 0; index < 6; index += 1) {
      await act(async () => vi.advanceTimersByTimeAsync(35));
    }
    await act(async () => vi.advanceTimersByTimeAsync(250));
    expect(preview.textContent).toBe("с");
    expect(preview.dataset.suggestion).toBe("сэндвич");
    expect(preview.dataset.phase).toBe("typing");
  });

  it("keeps a completed suggestion fully visible for at least four seconds", async () => {
    render(createElement(TypewriterPreview));
    const preview = screen.getByText("к");

    for (let index = 0; index < 5; index += 1) {
      await act(async () => vi.advanceTimersByTimeAsync(75));
    }
    expect(preview.textContent).toBe("курица");

    for (let elapsed = 0; elapsed < 4_000; elapsed += 100) {
      await act(async () => vi.advanceTimersByTimeAsync(100));
    }
    expect(preview.dataset.suggestion).toBe("курица");
    expect(preview.textContent).toBe("курица");
  });

  it("does not start a different suggestion within seven seconds", async () => {
    render(createElement(TypewriterPreview));
    const preview = screen.getByText("к");

    for (let elapsed = 0; elapsed < 6_900; elapsed += 100) {
      await act(async () => vi.advanceTimersByTimeAsync(100));
    }
    await act(async () => vi.advanceTimersByTimeAsync(99));

    expect(preview.dataset.suggestion).toBe("курица");
  });

  it("shows one complete suggestion without animation when motion is reduced", async () => {
    mockReducedMotion(true);
    render(createElement(TypewriterPreview));

    await act(async () => Promise.resolve());
    expect(screen.getByText("курица").dataset.phase).toBe("reduced");
  });
});
