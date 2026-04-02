import type { Instance } from "mobx-state-tree";
import { types } from "mobx-state-tree";
import { ProfilePatchStore } from "./profilePatchStore";
import { ProfileReadStore } from "./profileReadStore";

export const ProfileStore = types.model({
  read: ProfileReadStore,
  patch: ProfilePatchStore,
});

export type IProfileStore = Instance<typeof ProfileStore>;
