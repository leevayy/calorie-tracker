import { type ReactNode, useEffect, useRef } from "react";
import type { IRootStore } from "./rootStore";

export function SessionBootstrap({
  store,
  children,
}: {
  store: IRootStore;
  children: ReactNode;
}) {
  const { session } = store;
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!session.refreshToken) return;
    void (async () => {
      await session.refresh();
      if (session.authFetchState === "error") {
        session.clear();
      }
    })();
  }, [session]);

  return children;
}
