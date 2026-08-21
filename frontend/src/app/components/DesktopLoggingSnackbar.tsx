import type { FoodEntryResponse } from "@contracts/food-log";
import { Check } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ds/Button";
import { Text } from "./ds/Text";

const DISPLAY_MS = 4_000;

interface DesktopLoggingSnackbarProps {
  receiptId: string;
  entries: FoodEntryResponse[];
  busy: boolean;
  onDismiss: () => void;
  onUndo: () => void;
}

/** A desktop-only, short-lived acknowledgement for the newest logging group. */
export function DesktopLoggingSnackbar({
  receiptId,
  entries,
  busy,
  onDismiss,
  onUndo,
}: DesktopLoggingSnackbarProps) {
  const { t, i18n } = useTranslation();
  const timeoutRef = useRef<number | null>(null);
  const remainingRef = useRef(DISPLAY_MS);
  const startedAtRef = useRef(0);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const clearTimer = useCallback(() => {
    if (timeoutRef.current === null) return;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    startedAtRef.current = Date.now();
    timeoutRef.current = window.setTimeout(() => onDismissRef.current(), remainingRef.current);
  }, [clearTimer]);

  useEffect(() => {
    remainingRef.current = DISPLAY_MS;
    startTimer();
    return clearTimer;
  }, [receiptId, startTimer, clearTimer]);

  const pauseTimer = () => {
    if (timeoutRef.current === null) return;
    remainingRef.current = Math.max(
      0,
      remainingRef.current - (Date.now() - startedAtRef.current),
    );
    clearTimer();
  };

  const resumeTimer = () => {
    if (timeoutRef.current !== null || remainingRef.current <= 0) return;
    startTimer();
  };

  const foodNames = new Intl.ListFormat(
    i18n.resolvedLanguage ?? i18n.language,
    { style: "long", type: "conjunction" },
  ).format(entries.map((entry) => entry.name));

  return (
    <div
      data-slot="desktop-logging-snackbar"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onMouseEnter={() => {
        hoveredRef.current = true;
        pauseTimer();
      }}
      onMouseLeave={() => {
        hoveredRef.current = false;
        if (!focusedRef.current) resumeTimer();
      }}
      onFocusCapture={() => {
        focusedRef.current = true;
        pauseTimer();
      }}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        focusedRef.current = false;
        if (!hoveredRef.current) resumeTimer();
      }}
      className="fixed bottom-6 right-6 z-40 hidden min-w-72 items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-lg md:flex"
    >
      <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
      <Text className="min-w-0 flex-1" weight="semibold">
        {t("main.desktopAddedFoods", { count: entries.length })}
      </Text>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        aria-label={t("main.undoAddedGroup", { foods: foodNames })}
        loading={busy}
        onClick={onUndo}
      >
        {t("main.undoSubmission")}
      </Button>
    </div>
  );
}
