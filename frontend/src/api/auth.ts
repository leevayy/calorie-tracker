import type { AuthResponse, LoginRequest, RefreshRequest, RegisterRequest } from "@contracts/auth";
import { AuthResponseSchema } from "@contracts/auth";
import { apiClient } from "./client";
import { ApiError, parseResponse } from "./errors";

function assertAuthResponse(status: number, data: unknown): AuthResponse {
  if (status !== 200 && status !== 201) {
    if (status === 400) throw new ApiError("errors.http_400", status);
    if (status === 401) throw new ApiError("errors.http_401", status);
    if (status === 409) throw new ApiError("errors.http_409", status);
    throw new ApiError("errors.http_generic", status);
  }
  return parseResponse(AuthResponseSchema, data);
}

export async function apiRegister(body: RegisterRequest): Promise<AuthResponse> {
  const res = await apiClient.post("/auth/register", body);
  return assertAuthResponse(res.status, res.data);
}

export async function apiLogin(body: LoginRequest): Promise<AuthResponse> {
  const res = await apiClient.post("/auth/login", body);
  return assertAuthResponse(res.status, res.data);
}

export async function apiRefresh(body: RefreshRequest): Promise<AuthResponse> {
  const res = await apiClient.post("/auth/refresh", body);
  return assertAuthResponse(res.status, res.data);
}
