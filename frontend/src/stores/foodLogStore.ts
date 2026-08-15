import type { FoodEntryResponse } from "@contracts/food-log";
import { types } from "mobx-state-tree";
import { CreateFoodEntryStore } from "./createFoodEntryStore";
import { CreateFoodEntriesStore } from "./createFoodEntriesStore";
import { DayLogReadStore } from "./dayLogReadStore";
import { DeleteFoodEntryStore } from "./deleteFoodEntryStore";
import { DuplicateMealStore } from "./duplicateMealStore";
import { FrequentFoodsWeekReadStore } from "./frequentFoodsWeekReadStore";
import { HistoricalFoodSuggestionsStore } from "./historicalFoodSuggestionsStore";
import {
  mergeFoodEntries,
  mergeFoodEntry,
  removeFoodEntryById,
  replaceFoodEntry,
} from "./foodLogMerge";
import { UpdateFoodEntryStore } from "./updateFoodEntryStore";

export const FoodLogStore = types
  .model({
    dayRead: DayLogReadStore,
    entryCreate: CreateFoodEntryStore,
    entriesCreate: CreateFoodEntriesStore,
    entryUpdate: UpdateFoodEntryStore,
    entryDelete: DeleteFoodEntryStore,
    mealDuplicate: types.optional(DuplicateMealStore, {}),
    frequentWeekRead: FrequentFoodsWeekReadStore,
    historicalSuggestions: types.optional(HistoricalFoodSuggestionsStore, {}),
  })
  .actions((self) => ({
    applyCreatedEntry(day: string, entry: FoodEntryResponse) {
      if (self.dayRead.day !== day || !self.dayRead.data) return;
      self.dayRead.setData(mergeFoodEntry(self.dayRead.data, entry));
    },
    applyCreatedEntries(entries: FoodEntryResponse[]) {
      if (!self.dayRead.data) return;
      self.dayRead.setData(mergeFoodEntries(self.dayRead.data, entries));
    },
    applyUpdatedEntry(before: FoodEntryResponse, after: FoodEntryResponse) {
      if (!self.dayRead.data) return;
      self.dayRead.setData(replaceFoodEntry(self.dayRead.data, before, after));
    },
    applyDeletedEntry(entry: FoodEntryResponse) {
      if (!self.dayRead.data || self.dayRead.day !== entry.day) return;
      const next = removeFoodEntryById(self.dayRead.data, entry.id);
      if (next) self.dayRead.setData(next);
    },
    applyRestoredEntry(entry: FoodEntryResponse) {
      if (!self.dayRead.data || self.dayRead.day !== entry.day) return;
      self.dayRead.setData(mergeFoodEntry(self.dayRead.data, entry));
    },
  }));
