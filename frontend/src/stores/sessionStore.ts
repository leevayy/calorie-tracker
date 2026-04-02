import type { AuthResponse } from "@contracts/auth";
import { flow, types } from "mobx-state-tree";
import { apiLogin, apiRefresh, apiRegister } from "@/api/auth";
import { ApiError, toApiError } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

function applyAuthResponse(self: { accessToken: string; refreshToken: string; user: unknown }, data: AuthResponse) {
  self.accessToken = data.accessToken;
  self.refreshToken = data.refreshToken ?? "";
  self.user = data.user;
}

export const SessionStore = types
  .model({
    accessToken: types.optional(types.string, ""),
    refreshToken: types.optional(types.string, ""),
    user: types.maybe(
      types.frozen<{
        id: string;
        email: string;
      }>(),
    ),
    authFetchState: types.optional(FetchStateModel, "initial"),
    authErrorKey: types.optional(types.string, ""),
  })
  .views((self) => ({
    get isAuthenticated() {
      return self.accessToken.length > 0;
    },
    get isAuthLoading() {
      return self.authFetchState === "loading";
    },
  }))
  .actions((self) => ({
    clear() {
      self.accessToken = "";
      self.refreshToken = "";
      self.user = undefined;
      self.authFetchState = "initial";
      self.authErrorKey = "";
    },
    resetAuthFormFeedback() {
      if (self.authFetchState === "loading") return;
      self.authFetchState = "initial";
      self.authErrorKey = "";
    },
    login: flow(function* (credentials: { email: string; password: string }) {
      if (self.authFetchState === "loading") return;
      self.authFetchState = "loading";
      self.authErrorKey = "";
      try {
        const data = (yield apiLogin(credentials)) as AuthResponse;
        applyAuthResponse(self, data);
        self.authFetchState = "success";
      } catch (e) {
        self.authFetchState = "error";
        self.authErrorKey = e instanceof ApiError ? e.messageKey : toApiError(e).messageKey;
      }
    }),
    register: flow(function* (credentials: { email: string; password: string }) {
      if (self.authFetchState === "loading") return;
      self.authFetchState = "loading";
      self.authErrorKey = "";
      try {
        const data = (yield apiRegister(credentials)) as AuthResponse;
        applyAuthResponse(self, data);
        self.authFetchState = "success";
      } catch (e) {
        self.authFetchState = "error";
        self.authErrorKey = e instanceof ApiError ? e.messageKey : toApiError(e).messageKey;
      }
    }),
    refresh: flow(function* () {
      if (self.authFetchState === "loading") return;
      if (!self.refreshToken) {
        self.authFetchState = "error";
        self.authErrorKey = "errors.refreshTokenMissing";
        return;
      }
      self.authFetchState = "loading";
      self.authErrorKey = "";
      try {
        const data = (yield apiRefresh({ refreshToken: self.refreshToken })) as AuthResponse;
        applyAuthResponse(self, data);
        self.authFetchState = "success";
      } catch (e) {
        self.authFetchState = "error";
        self.authErrorKey = e instanceof ApiError ? e.messageKey : toApiError(e).messageKey;
      }
    }),
  }));
