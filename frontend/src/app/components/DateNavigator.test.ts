import { createElement, useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/locales/en.json";
import kk from "@/i18n/locales/kk.json";
import pl from "@/i18n/locales/pl.json";
import ru from "@/i18n/locales/ru.json";
import tt from "@/i18n/locales/tt.json";
import { DateNavigator } from "./DateNavigator";

const resources = {
  en: { translation: en },
  kk: { translation: kk },
  pl: { translation: pl },
  ru: { translation: ru },
  tt: { translation: tt },
};

afterEach(cleanup);

async function renderNavigator(
  language = "en",
  initialSelectedDay = "2026-08-15",
  today = "2026-08-15",
) {
  const i18n = i18next.createInstance();
  await i18n.init({ resources, lng: language, fallbackLng: "en" });
  const onChange = vi.fn();

  function Harness() {
    const [selectedDay, setSelectedDay] = useState(initialSelectedDay);
    return createElement(DateNavigator, {
      selectedDay,
      today,
      onChange: (day: string) => {
        onChange(day);
        setSelectedDay(day);
      },
    });
  }

  render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(Harness),
    ),
  );
  return { onChange };
}

describe("DateNavigator", () => {
  it("exposes a composed controlled previous, selected, and next-day interface", async () => {
    const { onChange } = await renderNavigator();
    const navigation = screen.getByRole("group", { name: "Log date" });
    const previous = within(navigation).getByRole("button", {
      name: "Previous day, Friday, August 14, 2026",
    });
    const selected = within(navigation).getByRole("button", {
      name: "Choose date, currently Saturday, August 15, 2026",
    });
    const next = within(navigation).getByRole("button", {
      name: "Next day, Sunday, August 16, 2026",
    });

    expect(previous.className).toContain("h-11");
    expect(previous.className).toContain("w-11");
    expect(next.className).toContain("h-11");
    expect(next.className).toContain("w-11");
    expect(selected.className).toContain("text-base");
    expect(selected.className).toContain("font-semibold");
    expect(selected.textContent).toContain("Saturday, August 15, 2026");

    fireEvent.click(previous);

    expect(onChange).toHaveBeenLastCalledWith("2026-08-14");
    expect(
      within(navigation).getByRole("button", {
        name: "Choose date, currently Friday, August 14, 2026",
      }),
    ).toBeTruthy();
  });

  it("opens the shared date input from the selected date for direct navigation", async () => {
    const { onChange } = await renderNavigator();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Choose date, currently Saturday, August 15, 2026",
      }),
    );

    const dateInput = screen.getByLabelText("Date") as HTMLInputElement;
    expect(dateInput.value).toBe("2026-08-15");

    fireEvent.change(dateInput, { target: { value: "2027-01-01" } });

    expect(onChange).toHaveBeenLastCalledWith("2027-01-01");
    expect(screen.queryByLabelText("Date")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Choose date, currently Friday, January 1, 2027",
      }),
    ).toBeTruthy();
  });

  it("keeps direct navigation open and reports an invalid cleared date", async () => {
    const { onChange } = await renderNavigator();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Choose date, currently Saturday, August 15, 2026",
      }),
    );

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Date").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid date.");
  });

  it("reserves a stable-height Today slot while exposing its action only off today", async () => {
    const { onChange } = await renderNavigator("en", "2026-08-14", "2026-08-15");
    const todayAction = screen.getByRole("button", { name: "Today" });
    const todaySlot = todayAction.closest('[data-slot="date-navigator-today"]');

    expect(todaySlot?.className).toContain("min-h-11");

    fireEvent.click(todayAction);

    expect(onChange).toHaveBeenLastCalledWith("2026-08-15");
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
    expect(
      document.querySelector('[data-slot="date-navigator-today"]')?.className,
    ).toContain("min-h-11");
  });

  it("announces each controlled selected-day change through one polite status", async () => {
    await renderNavigator();

    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]?.getAttribute("aria-live")).toBe("polite");
    expect(statuses[0]?.textContent).toBe(
      "Selected date: Saturday, August 15, 2026",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Next day, Sunday, August 16, 2026",
      }),
    );

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe(
      "Selected date: Sunday, August 16, 2026",
    );
  });

  it.each([
    [
      "ru",
      "Дата записи",
      "Суббота, 15 августа 2026 г.",
      "Выбрать дату, сейчас Суббота, 15 августа 2026 г.",
    ],
    [
      "pl",
      "Data dziennika",
      "Sobota, 15 sierpnia 2026",
      "Wybierz datę, obecnie Sobota, 15 sierpnia 2026",
    ],
    [
      "tt",
      "Көндәлек датасы",
      "15 август, 2026 ел, шимбә",
      "Датаны сайлау, хәзер 15 август, 2026 ел, шимбә",
    ],
  ])(
    "keeps the long %s date inside its narrow-layout control",
    async (language, groupName, dateLabel, selectedName) => {
      await renderNavigator(language);
      const navigation = screen.getByRole("group", { name: groupName });
      const selected = within(navigation).getByRole("button", { name: selectedName });
      const visibleDate = within(selected).getByText(dateLabel);
      const outer = navigation.parentElement;

      expect(outer?.className).toContain("w-full");
      expect(outer?.className).toContain("min-w-0");
      expect(outer?.className).toContain("max-w-md");
      expect(navigation.className).toContain("min-w-0");
      expect(selected.className).toContain("min-w-0");
      expect(selected.className).toContain("whitespace-normal");
      expect(selected.className).not.toContain("whitespace-nowrap");
      expect(visibleDate.className).toContain("break-words");
      expect(visibleDate.className).not.toContain("line-clamp");
    },
  );
});
