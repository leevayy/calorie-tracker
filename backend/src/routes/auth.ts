import { randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  AuthResponseSchema,
  LoginRequestSchema,
  RefreshRequestSchema,
  RegisterRequestSchema,
  type AuthResponse,
} from "../contracts/auth.ts";
import { db } from "../db/client.ts";
import { usersTable } from "../db/schema.ts";
import { env } from "../env.ts";
import { ErrorResponseJsonSchema, sendValidationError } from "../lib/http.ts";
import { toJsonSchema } from "../lib/zod-schema.ts";

type AuthUser = { id: string; email: string };

export type AuthRouteDependencies = {
  issueSession?: (user: AuthUser) => Promise<AuthResponse> | AuthResponse;
  resolveRefreshSession?: (token: string) => AuthUser | null;
};

type TokenPayload = {
  sub: string;
  email: string;
  type: "access" | "refresh";
};

async function issueTokens(app: FastifyInstance, user: AuthUser) {
  const accessToken = await app.jwt.sign(
    {
      sub: user.id,
      email: user.email,
      type: "access",
    } satisfies TokenPayload,
    { expiresIn: env.ACCESS_TOKEN_TTL_SECONDS },
  );

  const refreshToken = await app.jwt.sign(
    {
      sub: user.id,
      email: user.email,
      type: "refresh",
    } satisfies TokenPayload,
    { expiresIn: env.REFRESH_TOKEN_TTL_SECONDS },
  );

  return {
    accessToken,
    refreshToken,
    expiresInSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  dependencies: AuthRouteDependencies = {},
): Promise<void> {
  const issueSession = dependencies.issueSession ?? ((user: AuthUser) => issueTokens(app, user));

  app.post(
    "/auth/register",
    {
      schema: {
        tags: ["auth"],
        body: toJsonSchema(RegisterRequestSchema),
        response: {
          201: toJsonSchema(AuthResponseSchema),
          400: ErrorResponseJsonSchema,
          409: ErrorResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      const parsed = RegisterRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply);

      const existing = await db.query.usersTable.findFirst({
        where: eq(usersTable.email, parsed.data.email.toLowerCase()),
      });
      if (existing) {
        return reply.status(409).send({ message: "Email is already used" });
      }

      const user = {
        id: randomUUID(),
        email: parsed.data.email.toLowerCase(),
        passwordHash: await hash(parsed.data.password, 12),
      };

      await db.insert(usersTable).values({
        ...user,
        dailyCalorieGoal: 2000,
      });

      const authResponse = AuthResponseSchema.parse(await issueSession(user));
      return reply.status(201).send(authResponse);
    },
  );

  app.post(
    "/auth/login",
    {
      schema: {
        tags: ["auth"],
        body: toJsonSchema(LoginRequestSchema),
        response: {
          200: toJsonSchema(AuthResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      const parsed = LoginRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply);

      const existing = await db.query.usersTable.findFirst({
        where: eq(usersTable.email, parsed.data.email.toLowerCase()),
      });
      if (!existing) {
        return reply.status(401).send({ message: "Invalid credentials" });
      }

      const ok = await compare(parsed.data.password, existing.passwordHash);
      if (!ok) {
        return reply.status(401).send({ message: "Invalid credentials" });
      }

      const authResponse = AuthResponseSchema.parse(await issueSession(existing));
      return reply.status(200).send(authResponse);
    },
  );

  app.post(
    "/auth/refresh",
    {
      schema: {
        tags: ["auth"],
        body: toJsonSchema(RefreshRequestSchema),
        response: {
          200: toJsonSchema(AuthResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      const parsed = RefreshRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply);

      let payload: Partial<TokenPayload>;
      const publicSession = dependencies.resolveRefreshSession?.(parsed.data.refreshToken);
      if (publicSession) {
        payload = {
          sub: publicSession.id,
          email: publicSession.email,
          type: "refresh",
        };
      } else {
        try {
          payload = app.jwt.verify(parsed.data.refreshToken) as Partial<TokenPayload>;
        } catch {
          return reply.status(401).send({ message: "Invalid refresh token" });
        }
      }

      if (payload.type !== "refresh" || !payload.sub || !payload.email) {
        return reply.status(401).send({ message: "Invalid refresh token" });
      }

      const existing = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, payload.sub),
      });
      if (!existing) {
        return reply.status(401).send({ message: "Invalid refresh token" });
      }

      if (existing.email !== payload.email) {
        return reply.status(401).send({ message: "Invalid refresh token" });
      }

      const authResponse = AuthResponseSchema.parse(await issueSession(existing));
      return reply.status(200).send(authResponse);
    },
  );
}
