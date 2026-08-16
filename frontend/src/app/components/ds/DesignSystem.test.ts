import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import { Text } from "./Text";

afterEach(cleanup);

describe("design-system primitives", () => {
  it("keeps all button densities at a 44px minimum without decorative effects", () => {
    render(createElement(Button, { size: "sm" }, "Compact action"));

    const button = screen.getByRole("button", { name: "Compact action" });
    expect(button.className).toContain("min-h-11");
    expect(button.className).toContain("h-11");
    expect(button.className).not.toContain("gradient");
    expect(button.className).not.toContain("shadow");
  });

  it("preserves the button label and footprint while loading", () => {
    render(createElement(Button, { loading: true }, "Save profile"));

    const button = screen.getByRole("button", { name: "Save profile" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.textContent).toContain("Save profile");
    expect(button.className).toContain("h-11");
  });

  it("uses semantic heading and label typography defaults", () => {
    render(
      createElement(
        "div",
        null,
        createElement(Text, { as: "h1" }, "Page title"),
        createElement(Text, { as: "h3" }, "Section title"),
        createElement(Text, { as: "label" }, "Field label"),
      ),
    );

    expect(screen.getByRole("heading", { level: 1 }).className).toContain("text-2xl");
    expect(screen.getByRole("heading", { level: 3 }).className).toContain("text-lg");
    expect(screen.getByText("Field label").className).toContain("text-sm");
  });

  it("aligns inputs and semantic badges with shared accessible tokens", () => {
    render(
      createElement(
        "div",
        null,
        createElement(Input, { "aria-label": "Name" }),
        createElement(Badge, { variant: "success" }, "Saved"),
      ),
    );

    expect(screen.getByRole("textbox", { name: "Name" }).className).toContain("h-11");
    expect(screen.getByText("Saved").className).toContain("text-success-ink");
  });
});
