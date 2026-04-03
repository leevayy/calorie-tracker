import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";
import { env } from "./env.ts";
import { sendUnauthorized } from "./lib/http.ts";
import {
  getClientAddress,
  InMemoryRateLimiter,
  resolveRateLimitBucket,
  sendRateLimitExceeded,
} from "./lib/rate-limit.ts";
import { registerAiRoutes } from "./routes/ai.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerFoodLogRoutes } from "./routes/food-log.ts";
import { registerHistoryRoutes } from "./routes/history.ts";
import { registerProfileRoutes } from "./routes/profile.ts";
import { registerTipsRoutes } from "./routes/tips.ts";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  const allowedOrigins = new Set(
    env.CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter((origin) => origin.length > 0),
  );

  const rateLimiter = new InMemoryRateLimiter({
    maxRequestsPerMinute: env.RATE_LIMIT_MAX_REQUESTS_PER_MINUTE,
    cooldownSeconds: env.RATE_LIMIT_COOLDOWN_SECONDS,
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      // Allow non-browser clients that do not send Origin.
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = origin.replace(/\/$/, "");
      callback(null, allowedOrigins.has(normalizedOrigin));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Accept"],
    credentials: true,
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  app.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      sendUnauthorized(reply);
    }
  });

  app.addHook("onRequest", async (request, reply) => {
    const pathname = request.url.split("?")[0] ?? "";
    const bucket = resolveRateLimitBucket(pathname);
    if (!bucket) return;

    const identifier = getClientAddress(request);
    const result = rateLimiter.check(bucket, identifier);
    if (!result.allowed) {
      sendRateLimitExceeded(reply, result.retryAfterSec ?? env.RATE_LIMIT_COOLDOWN_SECONDS);
    }
  });

  // Mount all API routes under /api/v1 (including /health and /docs).
  await app.register(
    async (api) => {
      await api.register(swagger, {
        openapi: {
          info: {
            title: "Calorie Tracker Backend API",
            version: "1.0.0",
          },
          components: {
            securitySchemes: {
              bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
              },
            },
          },
        },
      });

      await api.register(swaggerUi, {
        routePrefix: "/docs",
      });

      api.get("/health", async () => ({ ok: true }));

      await registerAuthRoutes(api);
      await registerProfileRoutes(api);
      await registerFoodLogRoutes(api);
      await registerHistoryRoutes(api);
      await registerTipsRoutes(api);
      await registerAiRoutes(api);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
