import { describe, expect, test } from "vitest";
import {
  bearerPublicE2ESessionIdentity,
  issuePublicE2ESession,
  parsePublicE2ESessionHandle,
} from "./publicSession.ts";

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "playwright@example.invalid",
};

describe("public E2E sessions", () => {
  test("issues deterministic non-JWT handles and resolves the expected kind", () => {
    const session = issuePublicE2ESession(user);

    expect(session.accessToken).toMatch(/^e2e-public-session-v1:access:/);
    expect(session.refreshToken).toMatch(/^e2e-public-session-v1:refresh:/);
    expect(session.accessToken.split(".")).toHaveLength(1);
    expect(parsePublicE2ESessionHandle(session.accessToken, "access")).toEqual({
      ...user,
      type: "access",
    });
    expect(parsePublicE2ESessionHandle(session.accessToken, "refresh")).toBeNull();
    expect(bearerPublicE2ESessionIdentity(`Bearer ${session.accessToken}`)).toEqual({
      ...user,
      type: "access",
    });
  });

  test("rejects malformed, mismatched, and non-bearer values", () => {
    expect(parsePublicE2ESessionHandle("not-a-session", "access")).toBeNull();
    expect(
      parsePublicE2ESessionHandle(
        "e2e-public-session-v1:access:not-a-uuid:cGxheXdyaWdodEBleGFtcGxlLmludmFsaWQ",
        "access",
      ),
    ).toBeNull();
    expect(bearerPublicE2ESessionIdentity("Basic public")).toBeNull();
  });
});
