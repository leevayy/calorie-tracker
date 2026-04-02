import type { CreateFoodEntryBody, DayLogResponse, FoodEntryResponse } from "@contracts/food-log";
import { DayLogResponseSchema, FoodEntryResponseSchema } from "@contracts/food-log";
import { apiClient } from "./client";
import { ApiError, parseResponse } from "./errors";

export async function apiGetDayLog(day: string): Promise<DayLogResponse> {
  const res = await apiClient.get(`/days/${encodeURIComponent(day)}`);
  if (res.status !== 200) {
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(DayLogResponseSchema, res.data);
}

export async function apiCreateFoodEntry(day: string, body: CreateFoodEntryBody): Promise<FoodEntryResponse> {
  const res = await apiClient.post(`/days/${encodeURIComponent(day)}/entries`, body);
  if (res.status !== 201) {
    if (res.status === 400) throw new ApiError("errors.http_400", res.status);
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(FoodEntryResponseSchema, res.data);
}

export async function apiDeleteFoodEntry(entryId: string): Promise<void> {
  const res = await apiClient.delete(`/entries/${encodeURIComponent(entryId)}`);
  if (res.status !== 204) {
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
}
