import { useEffect, useMemo, useRef, useState } from "react";
import type { Instance } from "mobx-state-tree";
import type { DailyTipStore } from "@/stores/dailyTipStore";
import type { ProfileReadStore } from "@/stores/profileReadStore";
import type { DayLogReadStore } from "@/stores/dayLogReadStore";
import { buildDailyTipRequest } from "@/utils/buildDailyTipRequest";
import { behavioralLocalIsoDate } from "@/utils/date";

type IDayLogRead = Instance<typeof DayLogReadStore>;
type IProfileRead = Instance<typeof ProfileReadStore>;
type IDailyTip = Instance<typeof DailyTipStore>;

export function useBehavioralToday(): string {
  const [behavioralDayTick, setBehavioralDayTick] = useState(0);
  useEffect(() => {
    const bump = () => setBehavioralDayTick((n) => n + 1);
    const id = window.setInterval(bump, 60_000);
    document.addEventListener("visibilitychange", bump);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", bump);
    };
  }, []);
  return useMemo(() => behavioralLocalIsoDate(), [behavioralDayTick]);
}

type DailyTipAutoDeps = {
  dayRead: Pick<IDayLogRead, "fetchState" | "data">;
  profileRead: Pick<IProfileRead, "fetchState">;
  dailyTip: Pick<IDailyTip, "fetchTip">;
  today: string;
  preferredLanguage: string;
  nutritionGoal: string;
  tipVibeKey: string;
};

export function useDailyTipAutoFetch({
  dayRead,
  profileRead,
  dailyTip,
  today,
  preferredLanguage,
  nutritionGoal,
  tipVibeKey,
}: DailyTipAutoDeps): void {
  const tipAutoKeyRef = useRef("");

  useEffect(() => {
    if (dayRead.fetchState !== "success" || !dayRead.data) return;
    if (profileRead.fetchState === "loading") return;
    const key = `${today}|${preferredLanguage}|${nutritionGoal}|${tipVibeKey}`;
    if (tipAutoKeyRef.current === key) return;
    tipAutoKeyRef.current = key;
    void dailyTip.fetchTip(
      buildDailyTipRequest(dayRead.data, today, { preferredLanguage, at: new Date() }),
      { force: true },
    );
  }, [
    dayRead.fetchState,
    dayRead.data,
    profileRead.fetchState,
    preferredLanguage,
    nutritionGoal,
    tipVibeKey,
    today,
    dailyTip,
  ]);
}
