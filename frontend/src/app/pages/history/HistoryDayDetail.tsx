import { IsoDateSchema, type MealType } from "@contracts/common";
import type {
  DayLogResponse,
  FoodEntryResponse,
  UpdateFoodEntryBody,
} from "@contracts/food-log";
import { ArrowLeft, Copy } from "lucide-react";
import { observer } from "mobx-react-lite";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiGetDayLog } from "@/api/foodLog";
import { errorMessageKey } from "@/api/errors";
import { useRootStore } from "@/stores/StoreContext";
import {
  mergeFoodEntry,
  removeFoodEntryById,
  replaceFoodEntry,
} from "@/stores/foodLogMerge";
import { localIsoDate } from "@/utils/date";
import {
  formatInlineCalendarDate,
  formatLocalizedGrams,
  formatLocalizedNumber,
  formatStandaloneCalendarDate,
} from "@/utils/localeFormat";
import { sumDayMacros } from "@/utils/macroTotals";
import { AsyncSection, type AsyncFetchState } from "../../components/AsyncSection";
import { FoodEntryEditor } from "../../components/FoodEntryEditor";
import { MealSection } from "../../components/MealSection";
import {
  ScheduleInputs,
  type ScheduleInputErrors,
  type ScheduleInputValue,
} from "../../components/ScheduleInputs";
import { Badge } from "../../components/ds/Badge";
import { Button } from "../../components/ds/Button";
import { Card } from "../../components/ds/Card";
import { Text } from "../../components/ds/Text";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

type HistoryDayDetailProps = {
  day: string;
  onClose: () => void;
  onOpenDay: (day: string) => void;
};

type DuplicateReceipt = {
  count: number;
  destinationDay: string;
  destinationMealType: MealType;
};

function entriesForMeal(data: DayLogResponse, mealType: MealType): FoodEntryResponse[] {
  if (mealType === "snack") return data.meals.snack ?? [];
  return data.meals[mealType];
}

function allEntries(data: DayLogResponse): FoodEntryResponse[] {
  return MEAL_TYPES.flatMap((mealType) => entriesForMeal(data, mealType));
}

export const HistoryDayDetail = observer(function HistoryDayDetail({
  day,
  onClose,
  onOpenDay,
}: HistoryDayDetailProps) {
  const { t, i18n } = useTranslation();
  const { foodLog } = useRootStore();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const formatWholeNumber = (value: number) =>
    formatLocalizedNumber(value, language, { maximumFractionDigits: 0 });
  const [data, setData] = useState<DayLogResponse>();
  const [fetchState, setFetchState] = useState<AsyncFetchState>("initial");
  const [fetchErrorKey, setFetchErrorKey] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<FoodEntryResponse | null>(null);
  const [undoEntry, setUndoEntry] = useState<FoodEntryResponse | null>(null);
  const [duplicateSourceMealType, setDuplicateSourceMealType] = useState<MealType | null>(null);
  const [duplicateDestination, setDuplicateDestination] = useState<ScheduleInputValue>(() => ({
    day: localIsoDate(),
    mealType: "breakfast",
  }));
  const [duplicateScheduleErrors, setDuplicateScheduleErrors] =
    useState<ScheduleInputErrors>({});
  const [duplicateErrorKey, setDuplicateErrorKey] = useState("");
  const [duplicateReceipt, setDuplicateReceipt] = useState<DuplicateReceipt | null>(null);
  const requestIdRef = useRef(0);

  const loadDay = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setFetchState("loading");
    setFetchErrorKey("");
    try {
      const next = await apiGetDayLog(day);
      if (requestIdRef.current !== requestId) return;
      setData(next);
      setFetchState("success");
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      setFetchState("error");
      setFetchErrorKey(errorMessageKey(error));
    }
  }, [day]);

  useEffect(() => {
    void loadDay();
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadDay]);

  useEffect(() => {
    if (!undoEntry) return undefined;
    const timeoutId = window.setTimeout(() => setUndoEntry(null), 8_000);
    return () => window.clearTimeout(timeoutId);
  }, [undoEntry]);

  const foods = useMemo(() => (data ? allEntries(data) : []), [data]);
  const macros = useMemo(
    () => (data ? sumDayMacros(data) : { protein: 0, carbs: 0, fats: 0, fiber: 0 }),
    [data],
  );

  const openEntryEditor = (entry: FoodEntryResponse) => {
    foodLog.entryUpdate.clearError();
    foodLog.entryDelete.clearError();
    setSelectedEntry(entry);
  };

  const handleSaveEntry = async (
    entry: FoodEntryResponse,
    body: UpdateFoodEntryBody,
  ): Promise<boolean> => {
    const updated = await foodLog.entryUpdate.update(entry, body);
    if (!updated) return false;
    setData((current) => (current ? replaceFoodEntry(current, entry, updated) : current));
    return true;
  };

  const handleDeleteEntry = async (entry: FoodEntryResponse): Promise<boolean> => {
    setData((current) => {
      if (!current) return current;
      return removeFoodEntryById(current, entry.id) ?? current;
    });
    const deleted = await foodLog.entryDelete.remove(entry);
    if (!deleted) {
      setData((current) => (current ? mergeFoodEntry(current, entry) : current));
      return false;
    }
    setUndoEntry(deleted);
    return true;
  };

  const handleUndoDelete = async () => {
    if (!undoEntry) return;
    const restored = await foodLog.entryDelete.restore(undoEntry.id);
    if (!restored) return;
    setData((current) =>
      current && restored.day === current.day ? mergeFoodEntry(current, restored) : current,
    );
    setUndoEntry(null);
  };

  const openDuplicateMeal = (mealType: MealType) => {
    setDuplicateSourceMealType(mealType);
    setDuplicateDestination({ day: localIsoDate(), mealType });
    setDuplicateScheduleErrors({});
    setDuplicateErrorKey("");
  };

  const changeDuplicateDestination = (value: ScheduleInputValue) => {
    setDuplicateDestination(value);
    setDuplicateScheduleErrors(
      IsoDateSchema.safeParse(value.day).success
        ? {}
        : { day: "entryEditor.validation.date" },
    );
  };

  const handleDuplicateMeal = async (event: FormEvent) => {
    event.preventDefault();
    if (!duplicateSourceMealType) return;
    if (!IsoDateSchema.safeParse(duplicateDestination.day).success) {
      setDuplicateScheduleErrors({ day: "entryEditor.validation.date" });
      return;
    }
    setDuplicateErrorKey("");
    const request = {
      sourceDay: day,
      sourceMealType: duplicateSourceMealType,
      destinationDay: duplicateDestination.day,
      destinationMealType: duplicateDestination.mealType,
    };
    const result = await foodLog.mealDuplicate.duplicate(request);
    if (!result || "errorKey" in result) {
      setDuplicateErrorKey(
        result && "errorKey" in result
          ? result.errorKey
          : foodLog.mealDuplicate.errorKey || "errors.unknown",
      );
      return;
    }
    setDuplicateReceipt({
      count: result.entries.length,
      destinationDay: request.destinationDay,
      destinationMealType: request.destinationMealType,
    });
    setDuplicateSourceMealType(null);
    if (request.destinationDay === day) await loadDay();
  };

  const openCopiedDay = () => {
    if (!duplicateReceipt) return;
    if (duplicateReceipt.destinationDay === day) {
      void loadDay();
      return;
    }
    onOpenDay(duplicateReceipt.destinationDay);
  };

  const mutationBusy =
    foodLog.entryUpdate.fetchState === "loading" ||
    foodLog.entryDelete.fetchState === "loading";
  const duplicateLoading = foodLog.mealDuplicate.fetchState === "loading";
  const editorErrorKey =
    foodLog.entryUpdate.fetchState === "error"
      ? foodLog.entryUpdate.errorKey
      : foodLog.entryDelete.fetchState === "error"
        ? foodLog.entryDelete.errorKey
        : "";
  const formattedDay = formatStandaloneCalendarDate(day, language);
  const inlineDay = formatInlineCalendarDate(day, language);

  return (
    <section
      data-slot="history-day-detail"
      className="absolute inset-0 z-30 flex min-h-0 flex-col bg-background"
      aria-labelledby="history-day-detail-title"
    >
      <div
        data-slot="history-detail-header"
        className="flex shrink-0 items-center gap-2 bg-background/95 px-3 py-1 backdrop-blur-sm"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("history.backToHistory")}
          onClick={onClose}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <Text
            id="history-day-detail-title"
            as="h2"
            weight="medium"
            className="break-words leading-snug"
          >
            {formattedDay}
          </Text>
          <Text variant="muted" size="sm">
            {t("history.dayDetail")}
          </Text>
        </div>
      </div>

      <div
        data-slot="history-detail-scroll"
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <AsyncSection
          fetchState={fetchState}
          errorKey={fetchErrorKey}
          onRetry={() => void loadDay()}
        >
          {data ? (
            <div data-slot="history-detail-content" className="space-y-4">
              <Card data-slot="history-day-total" variant="elevated" className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <Text variant="muted">{t("history.dayTotal")}</Text>
                    <Text size="2xl" weight="semibold" className="tabular-nums">
                      {formatWholeNumber(Math.round(data.totalCalories))} {t("history.calShort")}
                    </Text>
                  </div>
                  <Text variant="muted" className="tabular-nums">
                    {t("history.goalTotal", {
                      goal: formatWholeNumber(Math.round(data.calorieGoal)),
                    })}
                  </Text>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge size="sm" variant="secondary" className="tabular-nums">
                    {t("macros.proteinLetter")} {formatLocalizedGrams(macros.protein, language)}
                  </Badge>
                  <Badge size="sm" variant="secondary" className="tabular-nums">
                    {t("macros.fatsLetter")} {formatLocalizedGrams(macros.fats, language)}
                  </Badge>
                  <Badge size="sm" variant="secondary" className="tabular-nums">
                    {t("macros.carbsLetter")} {formatLocalizedGrams(macros.carbs, language)}
                  </Badge>
                  <Badge size="sm" variant="secondary" className="tabular-nums">
                    {t("macros.fiberLetter")} {formatLocalizedGrams(macros.fiber, language)}
                  </Badge>
                </div>
              </Card>

              <Text data-slot="history-panel-title" as="h3" weight="medium">
                {t("history.itemizedMeals")}
              </Text>
              {duplicateReceipt ? (
                <Card
                  data-slot="history-duplicate-success"
                  variant="elevated"
                  className="space-y-3 bg-success/10"
                  role="status"
                >
                  <Text>
                    {t("history.duplicateSuccess", {
                      count: duplicateReceipt.count,
                      date: formatInlineCalendarDate(
                        duplicateReceipt.destinationDay,
                        language,
                      ),
                      meal: t(`meals.${duplicateReceipt.destinationMealType}`),
                    })}
                  </Text>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={openCopiedDay}>
                      {t("history.openCopiedDay")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDuplicateReceipt(null)}
                    >
                      {t("history.dismissDuplicateSuccess")}
                    </Button>
                  </div>
                </Card>
              ) : null}
              {foods.length === 0 ? (
                <Card data-slot="history-state-card" variant="elevated" className="py-8">
                  <Text variant="muted" align="center">
                    {t("states.emptyDay")}
                  </Text>
                </Card>
              ) : (
                <div data-slot="history-meals" className="space-y-3">
                  {MEAL_TYPES.map((mealType) => {
                    const mealEntries = entriesForMeal(data, mealType);
                    return (
                      <div data-slot="history-meal" key={mealType} className="space-y-2">
                        <MealSection
                          title={t(`meals.${mealType}`)}
                          foods={mealEntries}
                          emptyLabel={t("states.emptyMeals")}
                          onEdit={openEntryEditor}
                        />
                        {mealEntries.length > 0 ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="w-full"
                            disabled={duplicateLoading}
                            onClick={() => openDuplicateMeal(mealType)}
                          >
                            <Copy className="h-4 w-4" aria-hidden="true" />
                            {t("history.duplicateMeal", { meal: t(`meals.${mealType}`) })}
                          </Button>
                        ) : null}

                        {duplicateSourceMealType === mealType ? (
                          <Card
                            data-slot="history-duplicate-form"
                            className="space-y-4 rounded-xl bg-muted/45 p-4"
                          >
                            <div>
                              <Text as="h4" weight="medium">
                                {t("history.duplicateMealTitle", {
                                  meal: t(`meals.${mealType}`),
                                })}
                              </Text>
                              <Text variant="muted" size="sm">
                                {t("history.duplicateMealDescription", {
                                  count: mealEntries.length,
                                  date: inlineDay,
                                })}
                              </Text>
                            </div>
                            <form
                              className="space-y-3"
                              aria-label={t("history.duplicateMealForm", {
                                meal: t(`meals.${mealType}`),
                              })}
                              onSubmit={(event) => void handleDuplicateMeal(event)}
                            >
                              <ScheduleInputs
                                value={duplicateDestination}
                                onChange={changeDuplicateDestination}
                                disabled={duplicateLoading}
                                errors={duplicateScheduleErrors}
                              />

                              {duplicateErrorKey ? (
                                <Text variant="error" role="alert">
                                  {t(duplicateErrorKey)}
                                </Text>
                              ) : null}

                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={duplicateLoading}
                                  onClick={() => setDuplicateSourceMealType(null)}
                                >
                                  {t("history.cancelDuplicate")}
                                </Button>
                                <Button
                                  type="submit"
                                  size="sm"
                                  loading={duplicateLoading}
                                  disabled={!duplicateDestination.day}
                                >
                                  {t("history.confirmDuplicate")}
                                </Button>
                              </div>
                            </form>
                          </Card>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              {foodLog.entryDelete.fetchState === "error" && foodLog.entryDelete.errorKey ? (
                <Text variant="error" role="alert">
                  {t(foodLog.entryDelete.errorKey)}
                </Text>
              ) : null}
            </div>
          ) : null}
        </AsyncSection>
      </div>

      <FoodEntryEditor
        entry={selectedEntry}
        busy={mutationBusy}
        errorKey={editorErrorKey}
        onClose={() => setSelectedEntry(null)}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
      />

      {undoEntry ? (
        <div
          data-slot="history-undo-toast"
          className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-lg"
          role="status"
        >
          <Text className="min-w-0 flex-1">
            {t("entryEditor.undoMessage", { name: undoEntry.name })}
          </Text>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={foodLog.entryDelete.isLoading}
            onClick={() => void handleUndoDelete()}
          >
            {t("entryEditor.undo")}
          </Button>
        </div>
      ) : null}
    </section>
  );
});
