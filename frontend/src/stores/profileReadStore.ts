import type { UserProfileResponse } from "@contracts/profile";
import { flow, types } from "mobx-state-tree";
import { apiGetProfile } from "@/api/profile";
import { errorMessageKey } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

export const ProfileReadStore = types
  .model({
    profile: types.maybe(types.frozen<UserProfileResponse>()),
    fetchState: types.optional(FetchStateModel, "initial"),
    errorKey: types.optional(types.string, ""),
  })
  .views((self) => ({
    get isLoading() {
      return self.fetchState === "loading";
    },
  }))
  .actions((self) => ({
    setProfile(profile: UserProfileResponse | undefined) {
      self.profile = profile;
    },
    load: flow(function* () {
      if (self.fetchState === "loading") return;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const data = (yield apiGetProfile()) as UserProfileResponse;
        self.profile = data;
        self.fetchState = "success";
      } catch (e) {
        self.fetchState = "error";
        self.errorKey = errorMessageKey(e);
      }
    }),
  }));
