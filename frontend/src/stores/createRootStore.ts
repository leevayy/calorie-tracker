import { setAccessTokenGetter } from "@/api/client";
import type { IRootStore } from "./rootStore";
import { RootStore } from "./rootStore";

const defaultSnapshot = {
  session: {},
  profile: {
    read: {},
    patch: {},
  },
  foodLog: {
    dayRead: {},
    entryCreate: {},
    entryDelete: {},
  },
  history: {},
  dailyTip: {},
  aiParse: {},
};

export function createRootStore(): IRootStore {
  const store = RootStore.create(defaultSnapshot);
  setAccessTokenGetter(() => store.session.accessToken || null);
  return store;
}
