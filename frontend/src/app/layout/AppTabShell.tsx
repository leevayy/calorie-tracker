import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { User } from "lucide-react";
import { AppTabChatProvider, useAppTabChat } from "../context/AppTabChatContext";
import MainPage from "../pages/MainPage";
import HistoryPage from "../pages/HistoryPage";
import SettingsPage from "../pages/SettingsPage";
import AppTabNav from "./AppTabNav";
import { Text } from "../components/ds/Text";
import { useRootStore } from "@/stores/StoreContext";

const TAB_PATHS = ["/settings", "/app", "/history"] as const;

function pathToIndex(pathname: string): number {
  const i = TAB_PATHS.indexOf(pathname as (typeof TAB_PATHS)[number]);
  return i >= 0 ? i : 1;
}

function indexToPath(index: number): (typeof TAB_PATHS)[number] {
  return TAB_PATHS[Math.min(Math.max(index, 0), TAB_PATHS.length - 1)];
}

function pathToTitleKey(pathname: string): "settings.title" | "main.title" | "history.title" {
  if (pathname === "/settings") return "settings.title";
  if (pathname === "/history") return "history.title";
  return "main.title";
}

const AppTabChromeHeader = observer(function AppTabChromeHeader() {
  const { t } = useTranslation();
  const location = useLocation();
  const { session } = useRootStore();
  const titleKey = pathToTitleKey(location.pathname);

  return (
    <div className="flex items-center justify-between px-4 pb-2 pt-2">
      <Text as="h1" size="xl" weight="medium">
        {t(titleKey)}
      </Text>
      <button
        type="button"
        title={session.user?.email}
        className="rounded-full p-2 transition-colors hover:bg-accent"
      >
        <User className="h-5 w-5" />
      </button>
    </div>
  );
});

function AppTabShellInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { chatOpen, setChatOpen } = useAppTabChat();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const ignoreScrollEndUntilRef = useRef(0);
  const [scrollProgress, setScrollProgress] = useState(() => pathToIndex(location.pathname));

  const syncScrollToPath = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = pathToIndex(location.pathname);
    const target = idx * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) < 2) return;
    ignoreScrollEndUntilRef.current = Date.now() + 400;
    el.scrollTo({ left: target, behavior: "instant" });
  }, [location.pathname]);

  useLayoutEffect(() => {
    syncScrollToPath();
  }, [syncScrollToPath]);

  useLayoutEffect(() => {
    setScrollProgress(pathToIndex(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    if (pathToIndex(location.pathname) !== 1) setChatOpen(false);
  }, [location.pathname, setChatOpen]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const updateProgress = () => {
      const w = el.clientWidth;
      if (!w) return;
      setScrollProgress(el.scrollLeft / w);
    };
    updateProgress();
    el.addEventListener("scroll", updateProgress, { passive: true });
    const onResize = () => {
      syncScrollToPath();
      updateProgress();
    };
    window.addEventListener("resize", onResize);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            syncScrollToPath();
            updateProgress();
          })
        : null;
    if (ro) ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [syncScrollToPath]);

  const applyScrollToRoute = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    if (chatOpen && pathToIndex(location.pathname) === 1) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    const next = indexToPath(idx);
    if (next !== location.pathname) {
      navigate(next, { replace: true });
    }
  }, [chatOpen, location.pathname, navigate]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const finish = () => {
      if (Date.now() < ignoreScrollEndUntilRef.current) return;
      applyScrollToRoute();
    };

    const supportsScrollEnd = typeof window !== "undefined" && "onscrollend" in window;
    let debounceId: ReturnType<typeof setTimeout> | null = null;

    if (supportsScrollEnd) {
      el.addEventListener("scrollend", finish);
      return () => el.removeEventListener("scrollend", finish);
    }

    const onScroll = () => {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        debounceId = null;
        finish();
      }, 150);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (debounceId) clearTimeout(debounceId);
    };
  }, [applyScrollToRoute]);

  const horizontalLocked = chatOpen && pathToIndex(location.pathname) === 1;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-background">
      <header className="z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur-sm pt-[env(safe-area-inset-top,0px)]">
        <AppTabChromeHeader />
        <AppTabNav
          progress={scrollProgress}
          activeTabIndex={pathToIndex(location.pathname)}
          onSelectTab={(index) => navigate(indexToPath(index), { replace: true })}
        />
      </header>
      <div
        ref={scrollerRef}
        className={
          horizontalLocked
            ? "flex min-h-0 flex-1 snap-x snap-mandatory overflow-y-hidden overflow-x-hidden overscroll-x-none"
            : "flex min-h-0 flex-1 snap-x snap-mandatory overflow-y-hidden overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
        style={{ touchAction: horizontalLocked ? "pan-y" : undefined }}
      >
        <section className="flex h-full min-h-0 shrink-0 grow-0 basis-full snap-center snap-always flex-col overflow-hidden">
          <SettingsPage />
        </section>
        <section className="flex h-full min-h-0 shrink-0 grow-0 basis-full snap-center snap-always flex-col overflow-hidden">
          <MainPage />
        </section>
        <section className="flex h-full min-h-0 shrink-0 grow-0 basis-full snap-center snap-always flex-col overflow-hidden">
          <HistoryPage />
        </section>
      </div>
    </div>
  );
}

/** Horizontal snap carousel for Settings ↔ Home ↔ History; URL follows scroll position. */
export default function AppTabShell() {
  return (
    <AppTabChatProvider>
      <AppTabShellInner />
    </AppTabChatProvider>
  );
}
