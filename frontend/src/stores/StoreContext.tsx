import { createContext, useContext, useRef, type ReactNode } from "react";
import { createRootStore } from "./createRootStore";
import type { IRootStore } from "./rootStore";
import { SessionBootstrap } from "./SessionBootstrap";

const RootStoreContext = createContext<IRootStore | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<IRootStore | null>(null);
  if (storeRef.current == null) {
    storeRef.current = createRootStore();
  }
  return (
    <RootStoreContext.Provider value={storeRef.current}>
      <SessionBootstrap store={storeRef.current}>{children}</SessionBootstrap>
    </RootStoreContext.Provider>
  );
}

export function useRootStore(): IRootStore {
  const store = useContext(RootStoreContext);
  if (store == null) {
    throw new Error("useRootStore must be used within StoreProvider");
  }
  return store;
}
