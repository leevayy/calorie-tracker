import { History, Home, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLayoutEffect, useRef, useState } from "react";

const ICONS = [Settings, Home, History] as const;
const TITLE_KEYS = ["settings.title", "main.title", "history.title"] as const;

/** Circle center ↔ tab center distance in px must be ≤ this to use primary-foreground. */
const INTERSECT_PX = 24;

type AppTabNavProps = {
  /** Fractional index 0–2 from horizontal scroll (Settings=0, Home=1, History=2). */
  progress: number;
  /** Tab index from the current URL — used for `aria-current` only. */
  activeTabIndex: number;
  onSelectTab: (index: number) => void;
};

function tabHighlight(p: number, trackWidthPx: number, tabIndex: number): boolean {
  if (trackWidthPx <= 0) {
    return Math.round(p) === tabIndex;
  }
  const third = trackWidthPx / 3;
  const distToTabPx = (Math.abs(p - tabIndex) / 3) * trackWidthPx;
  if (distToTabPx <= INTERSECT_PX) {
    return true;
  }
  const snapDistPx = Math.abs(p - Math.round(p)) * third;
  const settledNearSnap = snapDistPx <= INTERSECT_PX;
  if (settledNearSnap) {
    return Math.round(p) === tabIndex;
  }
  return false;
}

export default function AppTabNav({ progress, onSelectTab, activeTabIndex }: AppTabNavProps) {
  const { t } = useTranslation();
  const p = Math.min(2, Math.max(0, progress));
  const leftPct = ((2 * p + 1) / 6) * 100;
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setTrackWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="px-4 pb-3 pt-1">
      <div ref={trackRef} className="relative grid grid-cols-3">
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-10 w-full -translate-y-1/2"
          aria-hidden
        >
          <div
            className="absolute top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
            style={{ left: `${leftPct}%` }}
          />
        </div>
        {ICONS.map((Icon, index) => (
          <div key={index} className="relative z-10 flex justify-center">
            <button
              type="button"
              onClick={() => onSelectTab(index)}
              className={`rounded-full p-2 transition-colors ${
                tabHighlight(p, trackWidth, index)
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              aria-current={activeTabIndex === index ? "page" : undefined}
              aria-label={t(TITLE_KEYS[index])}
            >
              <Icon className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
