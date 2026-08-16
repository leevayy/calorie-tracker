import { IsoDateSchema } from "@contracts/common";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { addDaysLocal } from "@/utils/date";
import { formatStandaloneCalendarDate } from "@/utils/localeFormat";
import { Button } from "./ds/Button";
import { DateInput } from "./ScheduleInputs";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export type DateNavigatorProps = {
  selectedDay: string;
  today: string;
  onChange: (day: string) => void;
};

export function DateNavigator({
  selectedDay,
  today,
  onChange,
}: DateNavigatorProps) {
  const { t, i18n } = useTranslation();
  const [directDateOpen, setDirectDateOpen] = useState(false);
  const [directDateError, setDirectDateError] = useState<string>();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const previousDay = addDaysLocal(selectedDay, -1);
  const nextDay = addDaysLocal(selectedDay, 1);
  const previousLabel = formatStandaloneCalendarDate(previousDay, language);
  const selectedLabel = formatStandaloneCalendarDate(selectedDay, language);
  const nextLabel = formatStandaloneCalendarDate(nextDay, language);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-md flex-col items-stretch">
      <div
        role="group"
        aria-label={t("main.dateNavigation")}
        className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-stretch gap-2"
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={t("main.previousDayTo", { date: previousLabel })}
          onClick={() => onChange(previousDay)}
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
              className="h-auto min-h-11 min-w-0 whitespace-normal px-2 py-1 text-center text-base font-semibold"
            >
              <span className="min-w-0 whitespace-normal break-words leading-5">
                {selectedLabel}
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
          type="button"
          variant="secondary"
          size="icon"
          aria-label={t("main.nextDayTo", { date: nextLabel })}
          onClick={() => onChange(nextDay)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
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
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {t("main.selectedDayAnnouncement", { date: selectedLabel })}
      </span>
    </div>
  );
}
