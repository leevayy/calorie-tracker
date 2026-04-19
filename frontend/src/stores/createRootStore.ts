import { setAccessTokenGetter } from "@/api/client";
import { loadPersistedSession } from "./authStorage";
import type { IRootStore } from "./rootStore";
import { RootStore } from "./rootStore";

const defaultSnapshot = {
  session: {},
  profile: {
    read: {},
    patch: {},
    setTipVibe: {},
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
  const persisted = loadPersistedSession();
  const sessionSnapshot = persisted
    ? {
        accessToken: persisted.accessToken,
        refreshToken: persisted.refreshToken,
        user: persisted.user,
      }
    : {};
  const store = RootStore.create({
    ...defaultSnapshot,
    session: sessionSnapshot,
  });
  setAccessTokenGetter(() => store.session.accessToken || null);
  return store;
}
