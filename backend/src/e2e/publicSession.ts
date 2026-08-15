import type { AuthResponse, UserSummary } from "../contracts/auth.ts";

const PUBLIC_SESSION_PREFIX = "e2e-public-session-v1";

type PublicSessionKind = "access" | "refresh";

export type PublicE2ESessionIdentity = UserSummary & {
  type: PublicSessionKind;
};

function publicHandle(kind: PublicSessionKind, user: UserSummary): string {
  return [
    PUBLIC_SESSION_PREFIX,
    kind,
    user.id,
    Buffer.from(user.email, "utf8").toString("base64url"),
  ].join(":");
}

/**
 * Issue non-secret handles for the isolated E2E runtime. These values are
 * intentionally public so retained browser traces never contain a real JWT.
 */
export function issuePublicE2ESession(user: UserSummary): AuthResponse {
  return {
    accessToken: publicHandle("access", user),
    refreshToken: publicHandle("refresh", user),
    expiresInSeconds: 60 * 60,
    user,
  };
}

export function parsePublicE2ESessionHandle(
  candidate: string,
  expectedKind: PublicSessionKind,
): PublicE2ESessionIdentity | null {
  const [prefix, kind, id, encodedEmail, ...extra] = candidate.split(":");
  if (
    prefix !== PUBLIC_SESSION_PREFIX ||
    kind !== expectedKind ||
    extra.length > 0 ||
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
    !encodedEmail
  ) {
    return null;
  }

  try {
    const email = Buffer.from(encodedEmail, "base64url").toString("utf8");
    if (!/^\S+@\S+\.\S+$/.test(email)) return null;
    return { id, email, type: expectedKind };
  } catch {
    return null;
  }
}

export function bearerPublicE2ESessionIdentity(
  authorization: string | undefined,
): PublicE2ESessionIdentity | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  return parsePublicE2ESessionHandle(authorization.slice("Bearer ".length), "access");
}
