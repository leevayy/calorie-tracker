import type { SetTipVibeRequest, UserProfileResponse } from "@contracts/profile";
import { flow, getParent, types } from "mobx-state-tree";
import { apiSetTipVibe } from "@/api/profile";
import { errorMessageKey } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

type ProfileParent = {
  read: { setProfile(profile: UserProfileResponse | undefined): void };
};

export const SetTipVibeStore = types
  .model({
    fetchState: types.optional(FetchStateModel, "initial"),
    errorKey: types.optional(types.string, ""),
  })
  .views((self) => ({
    get isLoading() {
      return self.fetchState === "loading";
    },
  }))
  .actions((self) => ({
    save: flow(function* (body: SetTipVibeRequest) {
      if (self.fetchState === "loading") return;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const data = (yield apiSetTipVibe(body)) as UserProfileResponse;
        const profile = getParent<ProfileParent>(self);
        profile.read.setProfile(data);
        self.fetchState = "success";
      } catch (e) {
        self.fetchState = "error";
        self.errorKey = errorMessageKey(e);
      }
    }),
  }));
