import type { UpdateProfileRequest, UserProfileResponse } from "@contracts/profile";
import { UserProfileResponseSchema } from "@contracts/profile";
import { apiClient } from "./client";
import { ApiError, parseResponse } from "./errors";

export async function apiGetProfile(): Promise<UserProfileResponse> {
  const res = await apiClient.get("/api/v1/me");
  if (res.status !== 200) {
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(UserProfileResponseSchema, res.data);
}

export async function apiPatchProfile(body: UpdateProfileRequest): Promise<UserProfileResponse> {
  const res = await apiClient.patch("/api/v1/me", body);
  if (res.status !== 200) {
    if (res.status === 400) throw new ApiError("errors.http_400", res.status);
    if (res.status === 401) throw new ApiError("errors.http_401", res.status);
    throw new ApiError("errors.http_generic", res.status);
  }
  return parseResponse(UserProfileResponseSchema, res.data);
}
