import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthPage from "./AuthPage";

const authMocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  resetAuthFormFeedback: vi.fn(),
  session: {
    authFetchState: "initial" as "initial" | "loading" | "success" | "error",
    authErrorKey: "",
    isAuthLoading: false,
  },
}));

vi.mock("mobx-react-lite", () => ({ observer: (module: unknown) => module }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/stores/StoreContext", () => ({
  useRootStore: () => ({
    session: {
      ...authMocks.session,
      login: authMocks.login,
      register: authMocks.register,
      resetAuthFormFeedback: authMocks.resetAuthFormFeedback,
    },
  }),
}));

beforeEach(() => {
  authMocks.login.mockReset();
  authMocks.register.mockReset();
  authMocks.resetAuthFormFeedback.mockReset();
  authMocks.session.authFetchState = "initial";
  authMocks.session.authErrorKey = "";
  authMocks.session.isAuthLoading = false;
});

afterEach(cleanup);

function page() {
  return createElement(MemoryRouter, null, createElement(AuthPage));
}

describe("AuthPage", () => {
  it("keeps Aero scenery ornamental and the sign-in form directly labeled", async () => {
    authMocks.login.mockResolvedValue(undefined);
    render(page());

    expect(document.querySelectorAll('[data-slot^="aero-auth-"][aria-hidden="true"]')).toHaveLength(4);
    fireEvent.change(screen.getByRole("textbox", { name: "auth.email" }), {
      target: { value: "person@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("auth.password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "auth.signIn" }));

    await waitFor(() => {
      expect(authMocks.login).toHaveBeenCalledWith({
        email: "person@example.invalid",
        password: "correct horse battery staple",
      });
    });
  });

  it("preserves error, loading, and sign-up feedback states", () => {
    authMocks.session.authFetchState = "error";
    authMocks.session.authErrorKey = "errors.invalidCredentials";
    const { rerender } = render(page());

    expect(screen.getByRole("alert").textContent).toBe("errors.invalidCredentials");

    fireEvent.click(screen.getByRole("button", { name: "auth.toggleToSignUp" }));
    expect(authMocks.resetAuthFormFeedback).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "auth.signUp" })).toBeTruthy();

    authMocks.session.authFetchState = "loading";
    authMocks.session.authErrorKey = "";
    authMocks.session.isAuthLoading = true;
    rerender(page());

    const submit = screen.getByRole("button", { name: "auth.signUp" });
    expect(submit.getAttribute("aria-busy")).toBe("true");
    expect(submit.hasAttribute("disabled")).toBe(true);
  });
});
