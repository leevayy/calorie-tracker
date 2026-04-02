import type { ParseFoodRequest, ParseFoodResponse } from "@contracts/ai-food";
import { ParseFoodResponseSchema } from "@contracts/ai-food";
import { apiClient } from "./client";
import { ApiError, parseResponse } from "./errors";

export async function apiParseFood(body: ParseFoodRequest): Promise<ParseFoodResponse> {
  const res = await apiClient.post("/ai/parse-food", body);
  if (res.status !== 200) {
    if (res.status === 400) throw new ApiError("errors.http_400", res.status);
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    if (res.status === 502) throw new ApiError("errors.http_502", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(ParseFoodResponseSchema, res.data);
}
