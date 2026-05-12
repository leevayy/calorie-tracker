import { afterEach, describe, expect, it, vi } from "vitest";
import * as accessTokenBinding from "./accessTokenBinding";
import { bindApiClientSession } from "./client";

describe("bindApiClientSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers getter that reads store.session.accessToken", () => {
    const spy = vi.spyOn(accessTokenBinding, "setAccessTokenGetter").mockImplementation(() => {});
    const store = { session: { accessToken: "abc" as string | undefined } };
    bindApiClientSession(store);
    expect(spy).toHaveBeenCalledTimes(1);
    const getter = spy.mock.calls[0]![0] as () => string | null;
    expect(getter()).toBe("abc");
    store.session.accessToken = undefined;
    expect(getter()).toBeNull();
  });
});
