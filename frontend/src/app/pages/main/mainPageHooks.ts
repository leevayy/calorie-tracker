import { useEffect, useMemo, useState } from "react";
import { behavioralLocalIsoDate } from "@/utils/date";

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
