import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Drawer } from "vaul";
import { FoodLogDrawerRoot } from "./FoodLogDrawer";

class MockVisualViewport extends EventTarget {
  height = 852;
}

afterEach(() => cleanup());

describe("FoodLogDrawerRoot", () => {
  it("keeps a focused input inside the visual viewport when the iOS keyboard opens", () => {
    const visualViewport = new MockVisualViewport();
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 852 });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: visualViewport,
    });

    render(
      createElement(
        FoodLogDrawerRoot,
        { open: true, onOpenChange: () => undefined },
        createElement(
          Drawer.Portal,
          null,
          createElement(
            Drawer.Content,
            null,
            createElement(Drawer.Title, null, "Log food"),
            createElement("input", { "aria-label": "Food" }),
          ),
        ),
      ),
    );

    const drawer = document.querySelector<HTMLElement>("[data-vaul-drawer]");
    const input = document.querySelector<HTMLInputElement>("input[aria-label='Food']");
    expect(drawer).not.toBeNull();
    expect(input).not.toBeNull();

    drawer!.getBoundingClientRect = () => ({
      top: 128,
      bottom: 852,
      height: 724,
      left: 0,
      right: 393,
      width: 393,
      x: 0,
      y: 128,
      toJSON() {},
    });
    input!.focus();

    visualViewport.height = 482;
    visualViewport.dispatchEvent(new Event("resize"));

    expect(drawer!.style.bottom).toBe("370px");
    expect(Number.parseFloat(drawer!.style.height)).toBeLessThanOrEqual(482 - 128);
  });
});
