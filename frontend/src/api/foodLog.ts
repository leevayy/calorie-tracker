import type {
  CreateFoodEntriesBody,
  CreateFoodEntriesResponse,
  DeleteFoodEntriesBody,
  DeleteFoodEntriesResponse,
  DayLogResponse,
  DuplicateMealBody,
  DuplicateMealResponse,
  FoodEntryResponse,
  FrequentFoodsQuery,
  FrequentFoodsResponse,
  HistoricalFoodSuggestionsQuery,
  HistoricalFoodSuggestionsResponse,
  UpdateFoodEntryBody,
} from "@contracts/food-log";
import {
  CreateFoodEntriesResponseSchema,
  DeleteFoodEntriesResponseSchema,
  DayLogResponseSchema,
  DuplicateMealResponseSchema,
  FoodEntryResponseSchema,
  FrequentFoodsQuerySchema,
  FrequentFoodsResponseSchema,
  HistoricalFoodSuggestionsQuerySchema,
  HistoricalFoodSuggestionsResponseSchema,
} from "@contracts/food-log";
import { apiClient } from "./client";
import { ApiError, parseResponse } from "./errors";

export async function apiGetFrequentFoods(query: FrequentFoodsQuery): Promise<FrequentFoodsResponse> {
  const q = FrequentFoodsQuerySchema.parse(query);
  const params = new URLSearchParams({ from: q.from, to: q.to, limit: String(q.limit) });
  const res = await apiClient.get(`/api/v1/frequent-foods?${params.toString()}`);
  if (res.status !== 200) {
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(FrequentFoodsResponseSchema, res.data);
}

export async function apiGetHistoricalFoodSuggestions(
  query: HistoricalFoodSuggestionsQuery,
): Promise<HistoricalFoodSuggestionsResponse> {
  const q = HistoricalFoodSuggestionsQuerySchema.parse(query);
  const params = new URLSearchParams({ query: q.query, limit: String(q.limit) });
  const res = await apiClient.get(`/api/v1/food-suggestions?${params.toString()}`);
  if (res.status !== 200) {
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(HistoricalFoodSuggestionsResponseSchema, res.data);
}

export async function apiGetDayLog(day: string): Promise<DayLogResponse> {
  const res = await apiClient.get(`/api/v1/days/${encodeURIComponent(day)}`);
  if (res.status !== 200) {
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(DayLogResponseSchema, res.data);
}

export async function apiCreateFoodEntries(
  body: CreateFoodEntriesBody,
): Promise<CreateFoodEntriesResponse> {
  const res = await apiClient.post("/api/v1/entries/batch", body);
  if (res.status !== 201) {
    if (res.status === 400) throw new ApiError("errors.http_400", res.status);
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(CreateFoodEntriesResponseSchema, res.data);
}

export async function apiDuplicateMeal(body: DuplicateMealBody): Promise<DuplicateMealResponse> {
  const res = await apiClient.post("/api/v1/meals/duplicate", body);
  if (res.status !== 201) {
    if (res.status === 400) throw new ApiError("errors.http_400", res.status);
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    if (res.status === 404) throw new ApiError("errors.http_404", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(DuplicateMealResponseSchema, res.data);
}

export async function apiDeleteFoodEntries(
  body: DeleteFoodEntriesBody,
): Promise<DeleteFoodEntriesResponse> {
  const res = await apiClient.delete("/api/v1/entries/batch", { data: body });
  if (res.status !== 200) {
    if (res.status === 400) throw new ApiError("errors.http_400", res.status);
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(DeleteFoodEntriesResponseSchema, res.data);
}

export async function apiUpdateFoodEntry(
  entryId: string,
  body: UpdateFoodEntryBody,
): Promise<FoodEntryResponse> {
  const res = await apiClient.patch(`/api/v1/entries/${encodeURIComponent(entryId)}`, body);
  if (res.status !== 200) {
    if (res.status === 400) throw new ApiError("errors.http_400", res.status);
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(FoodEntryResponseSchema, res.data);
}

export async function apiDeleteFoodEntry(entryId: string): Promise<FoodEntryResponse> {
  const res = await apiClient.delete(`/api/v1/entries/${encodeURIComponent(entryId)}`);
  if (res.status !== 200) {
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(FoodEntryResponseSchema, res.data);
}

export async function apiRestoreFoodEntry(entryId: string): Promise<FoodEntryResponse> {
  const res = await apiClient.post(`/api/v1/entries/${encodeURIComponent(entryId)}/restore`);
  if (res.status !== 200) {
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(FoodEntryResponseSchema, res.data);
}
