import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
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

const frontendRoot = resolve(fileURLToPath(new URL("../../frontend/dist/", import.meta.url)));

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function isFile(pathname: string): Promise<boolean> {
  try {
    return (await stat(pathname)).isFile();
  } catch {
    return false;
  }
}

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
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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

  // Serve the built frontend on the same origin. Client-side routes fall back to
  // index.html, while unknown /api paths remain API 404s.
  app.setNotFoundHandler(async (request, reply) => {
    const pathname = request.url.split("?", 1)[0] ?? "/";
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return reply.code(404).send({ message: "Route not found" });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return reply.code(404).send({ message: "Route not found" });
    }

    let requestedPath: string;
    try {
      requestedPath = decodeURIComponent(pathname);
    } catch {
      return reply.code(400).send({ message: "Invalid URL" });
    }

    const candidate = resolve(frontendRoot, `.${requestedPath}`);
    const isInsideFrontend =
      candidate === frontendRoot || candidate.startsWith(`${frontendRoot}${sep}`);
    const filePath = isInsideFrontend && (await isFile(candidate))
      ? candidate
      : resolve(frontendRoot, "index.html");

    if (!(await isFile(filePath))) {
      request.log.error({ frontendRoot }, "Frontend build was not found");
      return reply.code(503).send({ message: "Frontend is unavailable" });
    }

    reply.type(contentTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream");
    return reply.send(createReadStream(filePath));
  });

  return app;
}
