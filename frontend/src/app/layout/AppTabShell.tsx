import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { CalendarDays, History, Settings, User } from "lucide-react";
import { AppTabChatProvider, useAppTabChat } from "../context/AppTabChatContext";
import { useSyncPreferredLanguageFromProfile } from "../hooks/useSyncPreferredLanguageFromProfile";
import { useDesktopLayout } from "../hooks/useDesktopLayout";
import MainPage from "../pages/MainPage";
import HistoryPage from "../pages/HistoryPage";
import SettingsPage from "../pages/SettingsPage";
import AppTabNav from "./AppTabNav";
import { Text } from "../components/ds/Text";
import { indexToPath, pathToIndex, pathToTitleKey } from "../navigation/appTabs";
import { useRootStore } from "@/stores/StoreContext";
import "../../styles/aero/shell-auth.css";

const AppTabChromeHeader = observer(function AppTabChromeHeader() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useRootStore();
  const titleKey = pathToTitleKey(location.pathname);

  return (
    <div
      data-slot="app-chrome-header-inner"
      className="flex items-center justify-between px-4 py-1"
    >
      <Text data-slot="app-chrome-title" as="h1" size="xl" weight="semibold">
        {t(titleKey)}
      </Text>
      <button
        type="button"
        title={session.user?.email}
        aria-label={t("settings.account")}
        onClick={() => navigate(indexToPath(0), { replace: true })}
        data-slot="app-account-button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <User className="h-5 w-5" />
      </button>
    </div>
  );
});

const DesktopAppRail = observer(function DesktopAppRail() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useRootStore();
  const activeTabIndex = pathToIndex(location.pathname);

  const destination = (index: number, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-current={activeTabIndex === index ? "page" : undefined}
      onClick={() => navigate(indexToPath(index), { replace: true })}
      data-slot="desktop-rail-destination"
      data-tab-index={index}
      className={`flex w-full flex-col items-center gap-1 rounded-xl px-1 py-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        activeTabIndex === index
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      <span data-slot="standard-rail-icon" className="contents">
        {icon}
      </span>
      <span
        aria-hidden="true"
        data-slot="aero-rail-icon"
        className={`aero-rail-icon aero-rail-icon--${index === 1 ? "today" : index === 2 ? "history" : "settings"}`}
      />
      <span>{label}</span>
    </button>
  );

  return (
    <aside
      data-slot="desktop-app-rail"
      className="flex w-[4.75rem] shrink-0 flex-col border-r border-border/60 bg-muted/15 px-2 py-3"
    >
      <div aria-hidden="true" data-slot="aero-rail-brand" />
      <nav aria-label={t("main.navigation")} className="space-y-1">
        {destination(1, t("main.returnToToday"), <CalendarDays aria-hidden className="h-5 w-5" />)}
        {destination(2, t("history.title"), <History aria-hidden className="h-5 w-5" />)}
      </nav>
      <div className="mt-auto space-y-1">
        <button
          type="button"
          title={session.user?.email}
          onClick={() => navigate(indexToPath(0), { replace: true })}
          data-slot="desktop-account-destination"
          className="flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span data-slot="standard-rail-icon" className="contents">
            <User aria-hidden className="h-5 w-5" />
          </span>
          <span
            aria-hidden="true"
            data-slot="aero-rail-icon"
            className="aero-rail-icon aero-rail-icon--account"
          />
          <span>{t("settings.account")}</span>
        </button>
        {destination(0, t("settings.title"), <Settings aria-hidden className="h-5 w-5" />)}
      </div>
    </aside>
  );
});

const AppTabShellInner = observer(function AppTabShellInner() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useRootStore();
  const { chatOpen, setChatOpen } = useAppTabChat();
  const desktop = useDesktopLayout();

  useSyncPreferredLanguageFromProfile();

  useEffect(() => {
    void profile.read.load();
  }, [profile.read]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const ignoreScrollEndUntilRef = useRef(0);
  const [scrollProgress, setScrollProgress] = useState(() => pathToIndex(location.pathname));

  const syncScrollToPath = useCallback(() => {
    if (desktop) return;
    const el = scrollerRef.current;
    if (!el) return;
    const idx = pathToIndex(location.pathname);
    const target = idx * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) < 2) return;
    ignoreScrollEndUntilRef.current = Date.now() + 400;
    el.scrollTo({ left: target, behavior: "instant" });
  }, [desktop, location.pathname]);

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
    if (desktop) return;
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    if (chatOpen && pathToIndex(location.pathname) === 1) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    const next = indexToPath(idx);
    if (next !== location.pathname) {
      navigate(next, { replace: true });
    }
  }, [chatOpen, desktop, location.pathname, navigate]);

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

  const activeTabIndex = pathToIndex(location.pathname);
  const horizontalLocked = chatOpen && activeTabIndex === 1;

  return (
    <div
      data-slot="app-tab-shell"
      className={
        desktop
          ? "flex h-dvh min-w-0 overflow-hidden bg-background"
          : "mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-background"
      }
    >
      {desktop ? (
        <DesktopAppRail />
      ) : (
        <header
          data-slot="mobile-app-chrome"
          className="z-20 shrink-0 bg-background/95 backdrop-blur-sm pt-[env(safe-area-inset-top,0px)]"
        >
          <div aria-hidden="true" data-slot="aero-mobile-clouds" />
          <AppTabChromeHeader />
          <AppTabNav
            progress={scrollProgress}
            activeTabIndex={activeTabIndex}
            onSelectTab={(index) => navigate(indexToPath(index), { replace: true })}
          />
        </header>
      )}
      <div
        ref={scrollerRef}
        data-slot="app-tab-scroller"
        className={
          desktop
            ? "flex min-w-0 flex-1 flex-col overflow-hidden"
            : horizontalLocked
            ? "flex min-h-0 flex-1 snap-x snap-mandatory overflow-y-hidden overflow-x-hidden overscroll-x-none"
            : "flex min-h-0 flex-1 snap-x snap-mandatory overflow-y-hidden overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
        style={{ touchAction: !desktop && horizontalLocked ? "pan-y" : undefined }}
      >
        <section
          data-slot="app-tab-panel"
          data-tab="settings"
          aria-hidden={activeTabIndex !== 0}
          inert={activeTabIndex !== 0}
          className={
            desktop
              ? activeTabIndex === 0
                ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                : "hidden"
              : "flex h-full min-h-0 shrink-0 grow-0 basis-full snap-center snap-always flex-col overflow-hidden"
          }
        >
          {desktop ? (
            <Text as="h1" size="xl" weight="semibold" className="shrink-0 px-8 pt-6 lg:px-10">
              {t(pathToTitleKey(indexToPath(0)))}
            </Text>
          ) : null}
          <SettingsPage />
        </section>
        <section
          data-slot="app-tab-panel"
          data-tab="today"
          aria-hidden={activeTabIndex !== 1}
          inert={activeTabIndex !== 1}
          className={
            desktop
              ? activeTabIndex === 1
                ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                : "hidden"
              : "flex h-full min-h-0 shrink-0 grow-0 basis-full snap-center snap-always flex-col overflow-hidden"
          }
        >
          <MainPage />
        </section>
        <section
          data-slot="app-tab-panel"
          data-tab="history"
          aria-hidden={activeTabIndex !== 2}
          inert={activeTabIndex !== 2}
          className={
            desktop
              ? activeTabIndex === 2
                ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                : "hidden"
              : "flex h-full min-h-0 shrink-0 grow-0 basis-full snap-center snap-always flex-col overflow-hidden"
          }
        >
          {desktop ? (
            <Text as="h1" size="xl" weight="semibold" className="shrink-0 px-8 pt-6 lg:px-10">
              {t(pathToTitleKey(indexToPath(2)))}
            </Text>
          ) : null}
          <HistoryPage />
        </section>
      </div>
    </div>
  );
});

/** Horizontal snap carousel for Settings ↔ Home ↔ History; URL follows scroll position. */
export default function AppTabShell() {
  return (
    <AppTabChatProvider>
      <AppTabShellInner />
    </AppTabChatProvider>
  );
}
