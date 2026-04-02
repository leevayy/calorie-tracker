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

  await app.register(swagger, {
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

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  app.get("/health", async () => ({ ok: true }));

  await registerAuthRoutes(app);
  await registerProfileRoutes(app);
  await registerFoodLogRoutes(app);
  await registerHistoryRoutes(app);
  await registerTipsRoutes(app);
  await registerAiRoutes(app);

  return app;
}
