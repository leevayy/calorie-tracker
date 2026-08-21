import { IsoDateSchema } from "@contracts/common";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type RefObject, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { addDaysLocal, formatLogDayLabel } from "@/utils/date";
import { formatStandaloneCalendarDate } from "@/utils/localeFormat";
import { Button } from "./ds/Button";
import { DateInput } from "./ScheduleInputs";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export type DateNavigatorProps = {
  selectedDay: string;
  today: string;
  onChange: (day: string) => void;
  /** One-row presentation for wide layouts; the default preserves the mobile stack. */
  variant?: "default" | "compact";
};

export function DateNavigator({
  selectedDay,
  today,
  onChange,
  variant = "default",
}: DateNavigatorProps) {
  const { t, i18n } = useTranslation();
  const [directDateOpen, setDirectDateOpen] = useState(false);
  const [directDateError, setDirectDateError] = useState<string>();
  const previousButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const previousDay = addDaysLocal(selectedDay, -1);
  const nextDay = addDaysLocal(selectedDay, 1);
  const previousLabel = formatStandaloneCalendarDate(previousDay, language);
  const selectedLabel = formatStandaloneCalendarDate(selectedDay, language);
  const nextLabel = formatStandaloneCalendarDate(nextDay, language);
  const compact = variant === "compact";
  const visibleSelectedLabel = compact
    ? formatLogDayLabel(selectedDay, today, language)
    : selectedLabel;
  const navigateFromArrow = (
    target: string,
    ref: RefObject<HTMLButtonElement | null>,
  ) => {
    const restoreFocus = document.activeElement === ref.current;
    onChange(target);
    if (restoreFocus) {
      requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }));
    }
  };

  return (
    <div
      data-slot="date-navigator"
      data-variant={variant}
      className={
        compact
          ? "flex min-w-0 items-stretch gap-1"
          : "mx-auto flex w-full min-w-0 max-w-md flex-col items-stretch"
      }
    >
      {compact && selectedDay !== today ? (
        <div data-slot="date-navigator-today" className="flex min-h-11 items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2 text-primary-ink hover:text-primary-ink"
            onClick={() => onChange(today)}
          >
            {t("main.returnToToday")}
          </Button>
        </div>
      ) : null}
      <div
        role="group"
        aria-label={t("main.dateNavigation")}
        className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-stretch gap-2"
      >
        <Button
          ref={previousButtonRef}
          type="button"
          variant="secondary"
          size="icon"
          aria-label={t("main.previousDayTo", { date: previousLabel })}
          onClick={() => navigateFromArrow(previousDay, previousButtonRef)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Popover
          open={directDateOpen}
          onOpenChange={(open) => {
            setDirectDateOpen(open);
            if (!open) setDirectDateError(undefined);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              aria-label={t("main.chooseDate", { date: selectedLabel })}
              className={
                compact
                  ? "h-11 min-w-0 whitespace-nowrap px-2 py-1 text-center text-sm font-semibold"
                  : "h-auto min-h-11 min-w-0 whitespace-normal px-2 py-1 text-center text-base font-semibold"
              }
            >
              <span
                className={
                  compact
                    ? "min-w-0 truncate whitespace-nowrap leading-5"
                    : "min-w-0 whitespace-normal break-words leading-5"
                }
              >
                {visibleSelectedLabel}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(18rem,calc(100vw-2rem))] p-3">
            <DateInput
              value={selectedDay}
              error={directDateError}
              onChange={(day) => {
                if (!IsoDateSchema.safeParse(day).success) {
                  setDirectDateError("entryEditor.validation.date");
                  return;
                }
                setDirectDateError(undefined);
                onChange(day);
                setDirectDateOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        <Button
          ref={nextButtonRef}
          type="button"
          variant="secondary"
          size="icon"
          aria-label={t("main.nextDayTo", { date: nextLabel })}
          onClick={() => navigateFromArrow(nextDay, nextButtonRef)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {!compact ? (
        <div
          data-slot="date-navigator-today"
          className="flex min-h-11 items-center justify-center"
        >
          {selectedDay !== today ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2 text-primary-ink hover:text-primary-ink"
              onClick={() => onChange(today)}
            >
              {t("main.returnToToday")}
            </Button>
          ) : null}
        </div>
      ) : null}
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {t("main.selectedDayAnnouncement", { date: selectedLabel })}
      </span>
    </div>
  );
}
