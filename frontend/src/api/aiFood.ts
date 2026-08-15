import type {
  CorrectFoodEntryRequest,
  CorrectFoodEntryResponse,
  ParseFoodRequest,
  ParseFoodResponse,
} from "@contracts/ai-food";
import {
  CorrectFoodEntryResponseSchema,
  ParseFoodResponseSchema,
} from "@contracts/ai-food";
import { apiClient } from "./client";
import { ApiError, parseResponse } from "./errors";

export async function apiParseFood(body: ParseFoodRequest): Promise<ParseFoodResponse> {
  const res = await apiClient.post("/api/v1/ai/parse-food", body);
  if (res.status !== 200) {
    if (res.status === 400) throw new ApiError("errors.http_400", res.status);
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    if (res.status === 502) throw new ApiError("errors.http_502", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(ParseFoodResponseSchema, res.data);
}

export async function apiCorrectFoodEntry(
  entryId: string,
  body: CorrectFoodEntryRequest,
): Promise<CorrectFoodEntryResponse> {
  const res = await apiClient.post(
    `/api/v1/ai/entries/${encodeURIComponent(entryId)}/correction`,
    body,
  );
  if (res.status !== 200) {
    if (res.status === 400) throw new ApiError("errors.http_400", res.status);
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    if (res.status === 404) throw new ApiError("errors.http_404", res.status);
    if (res.status === 422) throw new ApiError("errors.correction_unactionable", res.status);
    if (res.status === 502) throw new ApiError("errors.correction_failed", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(CorrectFoodEntryResponseSchema, res.data);
}
