import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./SettingsPage";

const { navigate, rootStore, toggleTheme } = vi.hoisted(() => ({
  navigate: vi.fn(),
  toggleTheme: vi.fn(),
  rootStore: {
    session: { clear: vi.fn() },
    profile: {
      read: {
        profile: {
          user: {
            id: "11111111-1111-4111-8111-111111111111",
            email: "test@example.com",
          },
          dailyCalorieGoal: 2_000,
          weightKg: 70,
          heightCm: 175,
          preferredLanguage: "en",
          nutritionGoal: "maintain",
          updatedAt: "2026-08-15T08:00:00.000Z",
        },
        fetchState: "success",
        errorKey: "",
        load: vi.fn(),
      },
      patch: {
        fetchState: "initial",
        errorKey: "",
        save: vi.fn(),
      },
    },
  },
}));

vi.mock("mobx-react-lite", () => ({ observer: (component: unknown) => component }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/stores/StoreContext", () => ({ useRootStore: () => rootStore }));
vi.mock("../hooks/useRequireAuth", () => ({ useRequireAuth: () => undefined }));
vi.mock("../components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", toggleTheme }),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("SettingsPage retired coaching settings", () => {
  it("does not render daily-tip personality or AI model controls", () => {
    const view = render(createElement(SettingsPage));

    expect(view.container.querySelector("#settings-ai-model")).toBeNull();
    expect(screen.queryByText("settings.aiModel")).toBeNull();
    expect(screen.queryByText("settings.tipVibe.title")).toBeNull();
  });

  it("saves supported profile fields without an AI model preference", () => {
    render(createElement(SettingsPage));

    fireEvent.click(screen.getByRole("button", { name: "settings.save" }));

    expect(rootStore.profile.patch.save).toHaveBeenCalledWith({
      dailyCalorieGoal: 2_000,
      preferredLanguage: "en",
      nutritionGoal: "maintain",
      weightKg: 70,
      heightCm: 175,
    });
  });
});
