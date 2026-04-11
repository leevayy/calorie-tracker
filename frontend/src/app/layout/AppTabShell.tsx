import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { AppTabChatProvider, useAppTabChat } from "../context/AppTabChatContext";
import MainPage from "../pages/MainPage";
import HistoryPage from "../pages/HistoryPage";
import SettingsPage from "../pages/SettingsPage";

const TAB_PATHS = ["/settings", "/app", "/history"] as const;

function pathToIndex(pathname: string): number {
  const i = TAB_PATHS.indexOf(pathname as (typeof TAB_PATHS)[number]);
  return i >= 0 ? i : 1;
}

function indexToPath(index: number): (typeof TAB_PATHS)[number] {
  return TAB_PATHS[Math.min(Math.max(index, 0), TAB_PATHS.length - 1)];
}

function AppTabShellInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { chatOpen, setChatOpen } = useAppTabChat();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const ignoreScrollEndUntilRef = useRef(0);

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

  useEffect(() => {
    if (pathToIndex(location.pathname) !== 1) setChatOpen(false);
  }, [location.pathname, setChatOpen]);

  useEffect(() => {
    const onResize = () => syncScrollToPath();
    window.addEventListener("resize", onResize);
    const el = scrollerRef.current;
    const ro =
      el && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => syncScrollToPath())
        : null;
    if (el && ro) ro.observe(el);
    return () => {
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
    <div
      ref={scrollerRef}
      className={
        horizontalLocked
          ? "flex h-dvh w-full snap-x snap-mandatory overflow-y-hidden overflow-x-hidden overscroll-x-none"
          : "flex h-dvh w-full snap-x snap-mandatory overflow-y-hidden overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      }
      style={{ touchAction: horizontalLocked ? "pan-y" : undefined }}
    >
      <section className="flex h-full w-screen shrink-0 snap-center snap-always flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <SettingsPage />
        </div>
      </section>
      <section className="flex h-full w-screen shrink-0 snap-center snap-always flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <MainPage />
        </div>
      </section>
      <section className="flex h-full w-screen shrink-0 snap-center snap-always flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <HistoryPage />
        </div>
      </section>
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
