import type { Instance } from "mobx-state-tree";
import { types } from "mobx-state-tree";
import { AiParseFoodStore } from "./aiParseFoodStore";
import { DailyTipStore } from "./dailyTipStore";
import { FoodLogStore } from "./foodLogStore";
import { HistoryRangeStore } from "./historyRangeStore";
import { ProfileStore } from "./profileStore";
import { SessionStore } from "./sessionStore";

export const RootStore = types.model({
  session: SessionStore,
  profile: ProfileStore,
  foodLog: FoodLogStore,
  history: HistoryRangeStore,
  dailyTip: DailyTipStore,
  aiParse: AiParseFoodStore,
});

export type IRootStore = Instance<typeof RootStore>;
