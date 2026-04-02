import type { DailyTipRequest, DailyTipResponse } from "@contracts/daily-tip";
import { DailyTipResponseSchema } from "@contracts/daily-tip";
import { apiClient } from "./client";
import { ApiError, parseResponse } from "./errors";

export async function apiPostDailyTip(body: DailyTipRequest): Promise<DailyTipResponse> {
  const res = await apiClient.post("/tips/daily", body);
  if (res.status !== 200) {
    if (res.status === 400) throw new ApiError("errors.http_400", res.status);
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(DailyTipResponseSchema, res.data);
}
