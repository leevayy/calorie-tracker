import axios from "axios";
import type { ZodType } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly messageKey: string,
    public readonly status?: number,
  ) {
    super(messageKey);
    this.name = "ApiError";
  }
}

export function parseResponse<T>(schema: ZodType<T>, data: unknown, fallbackKey = "errors.invalidResponse"): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new ApiError(fallbackKey);
  }
  return r.data;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 400) return new ApiError("errors.http_400", status);
    if (status === 401) return new ApiError("errors.http_401", status);
    if (status === 409) return new ApiError("errors.http_409", status);
    if (status === 502) return new ApiError("errors.http_502", status);
    if (status != null) return new ApiError("errors.http_generic", status);
    if (error.code === "ECONNABORTED") return new ApiError("errors.timeout");
    return new ApiError("errors.network");
  }
  return new ApiError("errors.unknown");
}
