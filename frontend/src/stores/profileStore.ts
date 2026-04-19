import type { Instance } from "mobx-state-tree";
import { types } from "mobx-state-tree";
import { ProfilePatchStore } from "./profilePatchStore";
import { ProfileReadStore } from "./profileReadStore";
import { SetTipVibeStore } from "./setTipVibeStore";

export const ProfileStore = types.model({
  read: ProfileReadStore,
  patch: ProfilePatchStore,
  setTipVibe: SetTipVibeStore,
});

export type IProfileStore = Instance<typeof ProfileStore>;
