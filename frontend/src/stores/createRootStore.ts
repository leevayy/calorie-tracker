import { loadPersistedSession } from "./authStorage";
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
    entriesCreate: {},
    entryUpdate: {},
      entryDelete: {},
      mealDuplicate: {},
    frequentWeekRead: {},
    historicalSuggestions: {},
  },
  history: {},
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
  return store;
}
