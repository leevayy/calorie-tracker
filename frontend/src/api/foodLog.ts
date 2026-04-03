import type {
  CreateFoodEntryBody,
  DayLogResponse,
  FoodEntryResponse,
  FrequentFoodsQuery,
  FrequentFoodsResponse,
} from "@contracts/food-log";
import {
  DayLogResponseSchema,
  FoodEntryResponseSchema,
  FrequentFoodsQuerySchema,
  FrequentFoodsResponseSchema,
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

export async function apiGetDayLog(day: string): Promise<DayLogResponse> {
  const res = await apiClient.get(`/api/v1/days/${encodeURIComponent(day)}`);
  if (res.status !== 200) {
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(DayLogResponseSchema, res.data);
}

export async function apiCreateFoodEntry(day: string, body: CreateFoodEntryBody): Promise<FoodEntryResponse> {
  const res = await apiClient.post(`/api/v1/days/${encodeURIComponent(day)}/entries`, body);
  if (res.status !== 201) {
    if (res.status === 400) throw new ApiError("errors.http_400", res.status);
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(FoodEntryResponseSchema, res.data);
}

export async function apiDeleteFoodEntry(entryId: string): Promise<void> {
  const res = await apiClient.delete(`/api/v1/entries/${encodeURIComponent(entryId)}`);
  if (res.status !== 204) {
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
}
