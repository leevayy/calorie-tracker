import type { ParseFoodRequest, ParseFoodResponse } from "@contracts/ai-food";
import { flow, types } from "mobx-state-tree";
import { apiParseFood } from "@/api/aiFood";
import { ApiError, toApiError } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

export const AiParseFoodStore = types
  .model({
    data: types.maybe(types.frozen<ParseFoodResponse>()),
    fetchState: types.optional(FetchStateModel, "initial"),
    errorKey: types.optional(types.string, ""),
  })
  .views((self) => ({
    get isLoading() {
      return self.fetchState === "loading";
    },
  }))
  .actions((self) => ({
    parse: flow(function* (body: ParseFoodRequest) {
      if (self.fetchState === "loading") return;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const data = (yield apiParseFood(body)) as ParseFoodResponse;
        self.data = data;
        self.fetchState = "success";
      } catch (e) {
        self.fetchState = "error";
        self.errorKey = e instanceof ApiError ? e.messageKey : toApiError(e).messageKey;
      }
    }),
  }));
