import type { FastifyReply, FastifyRequest } from "fastify";

export type RateLimitBucket = "auth" | "ai";

type BucketState = {
  windowStartedAtMs: number;
  requestCount: number;
  blockedUntilMs: number;
};

export type RateLimitConfig = {
  maxRequestsPerMinute: number;
  cooldownSeconds: number;
};

export class InMemoryRateLimiter {
  private readonly states = new Map<string, BucketState>();
  private readonly windowMs = 60_000;
  private readonly cooldownMs: number;
  private readonly maxRequests: number;

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequestsPerMinute;
    this.cooldownMs = config.cooldownSeconds * 1000;
  }

  check(bucket: RateLimitBucket, key: string, nowMs = Date.now()): { allowed: boolean; retryAfterSec?: number } {
    const stateKey = `${bucket}:${key}`;
    const existing = this.states.get(stateKey);

    if (!existing) {
      this.states.set(stateKey, {
        windowStartedAtMs: nowMs,
        requestCount: 1,
        blockedUntilMs: 0,
      });
      return { allowed: true };
    }

    if (existing.blockedUntilMs > nowMs) {
      return {
        allowed: false,
        retryAfterSec: Math.ceil((existing.blockedUntilMs - nowMs) / 1000),
      };
    }

    if (nowMs - existing.windowStartedAtMs >= this.windowMs) {
      existing.windowStartedAtMs = nowMs;
      existing.requestCount = 1;
      existing.blockedUntilMs = 0;
      return { allowed: true };
    }

    existing.requestCount += 1;
    if (existing.requestCount > this.maxRequests) {
      existing.blockedUntilMs = nowMs + this.cooldownMs;
      return {
        allowed: false,
        retryAfterSec: Math.ceil(this.cooldownMs / 1000),
      };
    }

    return { allowed: true };
  }
}

export function resolveRateLimitBucket(pathname: string): RateLimitBucket | null {
  // When mounted under /api/v1, incoming paths become /api/v1/auth/* and /api/v1/ai/*.
  // Normalize so the existing bucket logic keeps working.
  const normalized = pathname.replace(/^\/api\/v1/, "");
  if (normalized.startsWith("/auth/")) return "auth";
  if (normalized.startsWith("/ai/")) return "ai";
  return null;
}

export function getClientAddress(request: FastifyRequest): string {
  const xff = request.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim().length > 0) {
    return xff.split(",")[0].trim();
  }
  return request.ip;
}

export function sendRateLimitExceeded(reply: FastifyReply, retryAfterSec: number): FastifyReply {
  return reply
    .header("Retry-After", String(retryAfterSec))
    .status(429)
    .send({ message: "Too Many Requests. Please retry later." });
}
