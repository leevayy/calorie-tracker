import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type AppTabChatContextValue = {
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
};

const AppTabChatContext = createContext<AppTabChatContextValue | null>(null);

export function AppTabChatProvider({ children }: { children: ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  const value = useMemo(() => ({ chatOpen, setChatOpen }), [chatOpen]);
  return <AppTabChatContext.Provider value={value}>{children}</AppTabChatContext.Provider>;
}

export function useAppTabChat() {
  const ctx = useContext(AppTabChatContext);
  if (!ctx) {
    throw new Error("useAppTabChat must be used within AppTabChatProvider");
  }
  return ctx;
}
