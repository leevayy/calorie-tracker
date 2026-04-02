import type { HistoryRangeResponse } from "@contracts/history";
import { HistoryRangeResponseSchema } from "@contracts/history";
import { apiClient } from "./client";
import { ApiError, parseResponse } from "./errors";

export async function apiGetHistory(from: string, to: string): Promise<HistoryRangeResponse> {
  const params = new URLSearchParams({ from, to });
  const res = await apiClient.get(`/history?${params.toString()}`);
  if (res.status !== 200) {
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(HistoryRangeResponseSchema, res.data);
}
