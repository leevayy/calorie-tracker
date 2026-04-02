import type { UpdateProfileRequest, UserProfileResponse } from "@contracts/profile";
import { flow, getParent, types } from "mobx-state-tree";
import { apiPatchProfile } from "@/api/profile";
import { ApiError, toApiError } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

type ProfileParent = {
  read: { setProfile(profile: UserProfileResponse | undefined): void };
};

export const ProfilePatchStore = types
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
    save: flow(function* (body: UpdateProfileRequest) {
      if (self.fetchState === "loading") return;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const data = (yield apiPatchProfile(body)) as UserProfileResponse;
        const profile = getParent<ProfileParent>(self);
        profile.read.setProfile(data);
        self.fetchState = "success";
      } catch (e) {
        self.fetchState = "error";
        self.errorKey = e instanceof ApiError ? e.messageKey : toApiError(e).messageKey;
      }
    }),
  }));
