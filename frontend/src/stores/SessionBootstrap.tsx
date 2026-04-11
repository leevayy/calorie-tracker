import { type ReactNode, useEffect, useRef, useState } from "react";
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
  const [sessionReady, setSessionReady] = useState(() => !session.refreshToken);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!session.refreshToken) return;
    void (async () => {
      await session.refresh();
      if (session.authFetchState === "error") {
        session.clear();
      }
      setSessionReady(true);
    })();
  }, [session]);

  if (!sessionReady) return null;

  return children;
}
