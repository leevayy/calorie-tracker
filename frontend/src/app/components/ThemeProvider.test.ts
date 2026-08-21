import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeProvider";

const storedValues = new Map<string, string>();
const testStorage: Storage = {
  get length() {
    return storedValues.size;
  },
  clear: () => storedValues.clear(),
  getItem: (key) => storedValues.get(key) ?? null,
  key: (index) => [...storedValues.keys()][index] ?? null,
  removeItem: (key) => storedValues.delete(key),
  setItem: (key, value) => storedValues.set(key, String(value)),
};

function ThemeProbe() {
  const { appearance, theme, toggleAppearance, toggleTheme } = useTheme();
  return createElement(
    "div",
    null,
    createElement("output", { "aria-label": "appearance" }, appearance),
    createElement("output", { "aria-label": "color mode" }, theme),
    createElement("button", { type: "button", onClick: toggleAppearance }, "Toggle appearance"),
    createElement("button", { type: "button", onClick: toggleTheme }, "Toggle color mode"),
  );
}

function renderProvider() {
  return render(createElement(ThemeProvider, null, createElement(ThemeProbe)));
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: testStorage,
  });
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.dataset.appearance = "standard";
});

afterEach(cleanup);

describe("ThemeProvider appearance", () => {
  it("defaults missing or invalid local appearance values to standard", () => {
    localStorage.setItem("appearance", "glassier");

    renderProvider();

    expect(screen.getByLabelText("appearance").textContent).toBe("standard");
    expect(document.documentElement.dataset.appearance).toBe("standard");
    expect(localStorage.getItem("appearance")).toBe("standard");
  });

  it("restores and persists Aero independently from color mode", () => {
    localStorage.setItem("appearance", "aero");
    localStorage.setItem("theme", "light");

    renderProvider();

    expect(screen.getByLabelText("appearance").textContent).toBe("aero");
    expect(screen.getByLabelText("color mode").textContent).toBe("light");
    expect(document.documentElement.dataset.appearance).toBe("aero");

    fireEvent.click(screen.getByRole("button", { name: "Toggle color mode" }));
    expect(screen.getByLabelText("appearance").textContent).toBe("aero");
    expect(screen.getByLabelText("color mode").textContent).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Toggle appearance" }));
    expect(screen.getByLabelText("appearance").textContent).toBe("standard");
    expect(document.documentElement.dataset.appearance).toBe("standard");
    expect(localStorage.getItem("appearance")).toBe("standard");
  });
});
