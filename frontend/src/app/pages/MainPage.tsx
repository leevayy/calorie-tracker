import { observer } from "mobx-react-lite";
import type { ParseFoodResponse, ParsedFoodSuggestion } from "@contracts/ai-food";
import type { MealType } from "@contracts/common";
import type {
  CreateFoodEntryRequest,
  FoodEntryResponse,
  UpdateFoodEntryBody,
} from "@contracts/food-log";
import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { useTranslation } from "react-i18next";
import { Check, Pencil, RefreshCw, RotateCcw, Send } from "lucide-react";
import { AsyncSection } from "../components/AsyncSection";
import { CaloriePieChart } from "../components/CaloriePieChart";
import { DayMacrosLabels } from "../components/DayMacrosLabels";
import { FoodEntryEditor } from "../components/FoodEntryEditor";
import { MealSection } from "../components/MealSection";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { useAppTabChat } from "../context/AppTabChatContext";
import { useBehavioralToday, useDailyTipAutoFetch } from "./main/mainPageHooks";
import { Button } from "../components/ds/Button";
import { Card } from "../components/ds/Card";
import { Input, inputVariants } from "../components/ds/Input";
import { Text } from "../components/ds/Text";
import { cn } from "../components/ui/utils";
import { useRootStore } from "@/stores/StoreContext";
import { buildDailyTipRequest } from "@/utils/buildDailyTipRequest";
import {
  buildParseFoodTiming,
  formatLogDayLabel,
  localIsoDate,
  weekRangeEndingOn,
} from "@/utils/date";
import { sumDayMacros } from "@/utils/macroTotals";
import { coerceNutritionGoal } from "@/utils/nutritionGoal";
import { coercePreferredLanguage } from "@/utils/preferredLanguage";

const CHAT_SUGGESTION_LIMIT = 3;

type LoggingSubmission = {
  id: string;
  text: string;
  phase: "parsing" | "saving" | "failed";
  retryFrom?: "parse" | "save";
  errorKey?: string;
  foods: ParsedFoodSuggestion[];
  timing: ReturnType<typeof buildParseFoodTiming>;
};

type LoggingReceipt = {
  id: string;
  entries: FoodEntryResponse[];
};

const MainPage = observer(function MainPage() {
  useRequireAuth();
  const { t, i18n } = useTranslation();
  const { profile, foodLog, dailyTip, aiParse } = useRootStore();

  const today = useBehavioralToday();

  const { chatOpen: chatExpanded, setChatOpen: setChatExpanded } = useAppTabChat();
  const [chatInput, setChatInput] = useState("");
  const [loggingSubmissions, setLoggingSubmissions] = useState<LoggingSubmission[]>([]);
  const [loggingReceipts, setLoggingReceipts] = useState<LoggingReceipt[]>([]);
  const submissionIdRef = useRef(0);
  const nextSubmissionId = () => {
    submissionIdRef.current += 1;
    return `logging-submission-${submissionIdRef.current}`;
  };
  const [undoingReceiptId, setUndoingReceiptId] = useState<string | null>(null);
  const [receiptErrorId, setReceiptErrorId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<FoodEntryResponse | null>(null);
  const [undoEntry, setUndoEntry] = useState<FoodEntryResponse | null>(null);
  const expandedInputRef = useRef<HTMLInputElement>(null);

  const setExpandedInputRef = useCallback((input: HTMLInputElement | null) => {
    expandedInputRef.current = input;
    // The portaled field must focus during the opening tap, before iOS can pan
    // for a stale field or a deferred animation frame loses user activation.
    input?.focus({ preventScroll: true });
  }, []);

  const focusChatInput = useCallback(() => {
    expandedInputRef.current?.focus({ preventScroll: true });
  }, []);

  const preferredLanguage = coercePreferredLanguage(
    profile.read.profile?.preferredLanguage ?? i18n.language,
  );
  const nutritionGoal = coerceNutritionGoal(profile.read.profile?.nutritionGoal);
  const tipVibeKey = (profile.read.profile?.tipVibePrompt ?? "").trim().length > 0
    ? `${profile.read.profile?.tipVibeEmoji ?? ""}|${(profile.read.profile?.tipVibePrompt ?? "").length}`
    : "off";

  useEffect(() => {
    void foodLog.dayRead.loadDay(today);
  }, [foodLog.dayRead, today]);

  useDailyTipAutoFetch({
    dayRead: foodLog.dayRead,
    profileRead: profile.read,
    dailyTip,
    today,
    preferredLanguage,
    nutritionGoal,
    tipVibeKey,
  });

  const requestDailyTip = useCallback(() => {
    const data = foodLog.dayRead.data;
    if (!data) return;
    void dailyTip.fetchTip(
      buildDailyTipRequest(data, today, { preferredLanguage, at: new Date() }),
      { force: true },
    );
  }, [foodLog.dayRead.data, dailyTip, today, preferredLanguage]);

  const updateSubmission = (
    id: string,
    changes: Partial<Omit<LoggingSubmission, "id" | "text" | "timing">>,
  ) => {
    setLoggingSubmissions((current) =>
      current.map((submission) =>
        submission.id === id ? { ...submission, ...changes } : submission,
      ),
    );
  };

  const saveSubmission = async (submission: LoggingSubmission, foods: ParsedFoodSuggestion[]) => {
    updateSubmission(submission.id, {
      phase: "saving",
      foods,
      retryFrom: undefined,
      errorKey: undefined,
    });
    const entries: CreateFoodEntryRequest[] = foods.map((food) => ({
      day: food.day,
      mealType: food.mealType,
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fats: food.fats,
      fiber: food.fiber,
      portion: food.portion,
      ...(food.mealSlug ? { mealSlug: food.mealSlug } : {}),
    }));
    const result = (await foodLog.entriesCreate.create(entries)) as
      | { entries: FoodEntryResponse[] }
      | { errorKey: string }
      | undefined;
    if (!result || "errorKey" in result) {
      updateSubmission(submission.id, {
        phase: "failed",
        retryFrom: "save",
        errorKey: result?.errorKey ?? "errors.unknown",
      });
      return;
    }
    setLoggingSubmissions((current) =>
      current.filter((candidate) => candidate.id !== submission.id),
    );
    setLoggingReceipts((current) => [
      { id: submission.id, entries: result.entries },
      ...current,
    ]);
    focusChatInput();
  };

  const parseAndSaveSubmission = async (submission: LoggingSubmission) => {
    updateSubmission(submission.id, {
      phase: "parsing",
      foods: [],
      retryFrom: undefined,
      errorKey: undefined,
    });
    const result = (await aiParse.parse({
      text: submission.text,
      preferredLanguage: coercePreferredLanguage(
        profile.read.profile?.preferredLanguage ?? i18n.language,
      ),
      ...submission.timing,
    })) as { data: ParseFoodResponse } | { errorKey: string } | undefined;
    if (!result || "errorKey" in result) {
      updateSubmission(submission.id, {
        phase: "failed",
        retryFrom: "parse",
        errorKey: result?.errorKey ?? "errors.unknown",
      });
      return;
    }
    const parsed = result.data;
    if (parsed.suggestions.length === 0) {
      updateSubmission(submission.id, {
        phase: "failed",
        retryFrom: "parse",
        errorKey: "states.emptySuggestions",
      });
      return;
    }
    await saveSubmission(submission, parsed.suggestions);
  };

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const submission: LoggingSubmission = {
      id: nextSubmissionId(),
      text: chatInput,
      phase: "parsing",
      foods: [],
      timing: { ...buildParseFoodTiming(), defaultLogDay: today },
    };
    setChatInput("");
    setLoggingSubmissions((current) => [submission, ...current]);
    setChatExpanded(true);
    void parseAndSaveSubmission(submission);
    focusChatInput();
  };

  const onFoodLogSheetOpenChange = (open: boolean) => {
    setChatExpanded(open);
  };

  const handleRetrySubmission = (submission: LoggingSubmission) => {
    if (submission.retryFrom === "save") {
      void saveSubmission(submission, submission.foods);
    } else {
      void parseAndSaveSubmission(submission);
    }
    focusChatInput();
  };

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
    if (typeof updated === "object") {
      setLoggingReceipts((current) =>
        current.map((receipt) => ({
          ...receipt,
          entries: receipt.entries.map((candidate) =>
            candidate.id === entry.id ? updated : candidate,
          ),
        })),
      );
    }
    return true;
  };

  const handleDeleteEntry = async (entry: FoodEntryResponse): Promise<boolean> => {
    const deleted = await foodLog.entryDelete.remove(entry);
    if (!deleted) return false;
    setLoggingReceipts((current) =>
      current
        .map((receipt) => ({
          ...receipt,
          entries: receipt.entries.filter((candidate) => candidate.id !== entry.id),
        }))
        .filter((receipt) => receipt.entries.length > 0),
    );
    setUndoEntry(deleted);
    return true;
  };

  const handleUndoReceipt = async (receipt: LoggingReceipt) => {
    setUndoingReceiptId(receipt.id);
    setReceiptErrorId(null);
    try {
      const deleted = await foodLog.entryDelete.removeMany(receipt.entries);
      if (!deleted) {
        setReceiptErrorId(receipt.id);
        return;
      }
      setLoggingReceipts((current) =>
        current.filter((candidate) => candidate.id !== receipt.id),
      );
    } finally {
      setUndoingReceiptId(null);
    }
  };

  const handleUndoDelete = async () => {
    if (!undoEntry) return;
    const restored = await foodLog.entryDelete.restore(undoEntry.id);
    if (restored) setUndoEntry(null);
  };

  useEffect(() => {
    if (!undoEntry) return undefined;
    const timeoutId = window.setTimeout(() => setUndoEntry(null), 8_000);
    return () => window.clearTimeout(timeoutId);
  }, [undoEntry]);

  const dayData = foodLog.dayRead.data;
  const dayFetch = foodLog.dayRead.fetchState;
  const mutationBusy =
    foodLog.entryUpdate.fetchState === "loading" ||
    foodLog.entryDelete.fetchState === "loading";
  const editorErrorKey =
    foodLog.entryUpdate.fetchState === "error"
      ? foodLog.entryUpdate.errorKey
      : foodLog.entryDelete.fetchState === "error"
        ? foodLog.entryDelete.errorKey
        : "";

  const pendingFoodsForMeal = (mealType: MealType) =>
    loggingSubmissions.flatMap((submission) => {
      if (
        submission.phase === "parsing" &&
        submission.timing.defaultLogDay === today &&
        submission.timing.defaultMealType === mealType
      ) {
        return [{
          id: submission.id,
          label: submission.text,
          phase: "parsing" as const,
        }];
      }
      if (submission.phase !== "saving") return [];
      return submission.foods.flatMap((food, index) =>
        food.day === today && food.mealType === mealType
          ? [{
              id: `${submission.id}-${index}`,
              label: food.name,
              phase: "saving" as const,
            }]
          : [],
      );
    });

  useEffect(() => {
    const { from, to } = weekRangeEndingOn(today);
    void foodLog.frequentWeekRead.load({ from, to, limit: CHAT_SUGGESTION_LIMIT });
  }, [today, dayData, foodLog.frequentWeekRead]);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      {profile.read.fetchState === "error" && profile.read.errorKey ? (
        <div className="px-4 pt-2">
          <Card className="bg-destructive/10 px-0 py-2">
            <Text variant="error" className="mb-2">
              {t(profile.read.errorKey)}
            </Text>
            <Button type="button" size="sm" variant="secondary" onClick={() => void profile.read.load()}>
              {t("states.retry")}
            </Button>
          </Card>
        </div>
      ) : null}

      {foodLog.entryDelete.fetchState === "error" && foodLog.entryDelete.errorKey ? (
        <div className="px-4 pt-2">
          <Text variant="error" align="center" role="alert">
            {t(foodLog.entryDelete.errorKey)}
          </Text>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(7rem,calc(env(safe-area-inset-bottom)+5.25rem))] pt-4">
        <AsyncSection
          fetchState={dayFetch}
          errorKey={foodLog.dayRead.errorKey}
          onRetry={() => void foodLog.dayRead.loadDay(today)}
        >
          {dayData ? (
            <>
              <div className="mb-6 flex flex-col gap-4">
                {/* Две колонки одной высоты: grid тянет ячейки по высоте ряда */}
                <div className="grid min-h-0 grid-cols-2 gap-3 sm:gap-4">
                  <CaloriePieChart
                    className="min-h-0 min-w-0 h-full"
                    consumed={dayData.totalCalories}
                    goal={dayData.calorieGoal}
                    caption={t("main.caloriesToday")}
                  />
                  <Card className="flex h-full min-h-0 min-w-0 flex-col px-0 py-2">
                    <div className="flex w-full flex-1 flex-col items-center justify-center">
                      <div className="box-border h-[188px] w-[140px] shrink-0 rounded-[var(--radius)] px-2.5 py-1.5">
                        <DayMacrosLabels totals={sumDayMacros(dayData)} />
                      </div>
                      <Text variant="muted" align="center" className="mt-2 w-full">
                        {t("main.macrosSummary")}
                      </Text>
                    </div>
                  </Card>
                </div>
                <Card className="flex flex-col px-0 py-2">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Text variant="muted">{t("main.tip")}</Text>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8 -mt-0.5"
                      onClick={() => requestDailyTip()}
                      disabled={dailyTip.fetchState === "loading" || !dayData}
                      aria-label={t("main.regenerateTip")}
                      title={t("main.regenerateTip")}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${dailyTip.fetchState === "loading" ? "animate-spin" : ""}`}
                      />
                    </Button>
                  </div>
                  <AsyncSection
                    fetchState={dailyTip.fetchState}
                    errorKey={dailyTip.errorKey}
                    onRetry={requestDailyTip}
                    loadingClassName="py-4"
                  >
                    {dailyTip.data?.message ? (
                      <Text className="leading-relaxed">{dailyTip.data.message}</Text>
                    ) : (
                      <Text variant="muted">{t("states.emptyTip")}</Text>
                    )}
                  </AsyncSection>
                </Card>
              </div>

              <div className="space-y-3">
                <MealSection
                  title={t("meals.breakfast")}
                  foods={dayData.meals.breakfast}
                  emptyLabel={t("states.emptyMeals")}
                  onEdit={openEntryEditor}
                  pendingFoods={pendingFoodsForMeal("breakfast")}
                />
                <MealSection
                  title={t("meals.lunch")}
                  foods={dayData.meals.lunch}
                  emptyLabel={t("states.emptyMeals")}
                  onEdit={openEntryEditor}
                  pendingFoods={pendingFoodsForMeal("lunch")}
                />
                <MealSection
                  title={t("meals.dinner")}
                  foods={dayData.meals.dinner}
                  emptyLabel={t("states.emptyMeals")}
                  onEdit={openEntryEditor}
                  pendingFoods={pendingFoodsForMeal("dinner")}
                />
                <MealSection
                  title={t("meals.snack")}
                  foods={dayData.meals.snack ?? []}
                  emptyLabel={t("states.emptyMeals")}
                  onEdit={openEntryEditor}
                  pendingFoods={pendingFoodsForMeal("snack")}
                />
              </div>
            </>
          ) : (
            <Text variant="muted" align="center" className="py-8">
              {t("states.emptyDay")}
            </Text>
          )}
        </AsyncSection>
      </div>

      {!chatExpanded ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-md border-t border-border bg-background p-3 shadow-[0_-6px_24px_rgba(0,0,0,0.08)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <form onSubmit={(e) => void handleChatSubmit(e)} className="flex gap-2">
            {/* A text input here would open the keyboard before the drawer field exists. */}
            <button
              type="button"
              aria-label={t("main.logFoodPlaceholder")}
              aria-haspopup="dialog"
              aria-controls="food-log-sheet"
              aria-expanded={false}
              onClick={() => setChatExpanded(true)}
              className={cn(
                inputVariants(),
                "flex-1 cursor-text items-center text-left font-normal touch-manipulation",
              )}
            >
              <span
                className={cn(
                  "block min-w-0 truncate",
                  chatInput ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {chatInput || t("main.logFoodPlaceholder")}
              </span>
            </button>
            <Button
              type="submit"
              size="icon"
              disabled={!chatInput.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : null}

      {/* Vaul's own repositioner can double-lift the sheet when iOS reports offsetTop. */}
      <Drawer.Root
        open={chatExpanded}
        onOpenChange={onFoodLogSheetOpenChange}
        shouldScaleBackground={false}
        repositionInputs={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Drawer.Content
            id="food-log-sheet"
            aria-describedby={undefined}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex h-[min(85dvh,85svh)] max-h-[min(85dvh,85svh)] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-x border-t border-border bg-background px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.15)] outline-none"
          >
            <Drawer.Title className="sr-only">{t("main.foodLogSheetTitle")}</Drawer.Title>
            <Drawer.Handle className="mb-2 shrink-0 bg-muted" />
            <form onSubmit={(e) => void handleChatSubmit(e)} className="flex shrink-0 gap-2 pt-2">
              <Input
                ref={setExpandedInputRef}
                placeholder={t("main.logFoodPlaceholder")}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!chatInput.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
                {loggingSubmissions.some((submission) => submission.phase !== "failed") ? (
                  <div className="space-y-1" aria-live="polite">
                    {loggingSubmissions
                      .filter((submission) => submission.phase !== "failed")
                      .map((submission) => (
                        <div
                          key={submission.id}
                          className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"
                        >
                          <Text className="min-w-0 flex-1 truncate">{submission.text}</Text>
                          <Text variant="muted" size="sm" className="shrink-0">
                            {t(`main.pending.${submission.phase}`)}
                          </Text>
                        </div>
                      ))}
                  </div>
                ) : null}

                {loggingSubmissions.some((submission) => submission.phase === "failed") ? (
                  <div className="space-y-2">
                    {loggingSubmissions
                      .filter((submission) => submission.phase === "failed")
                      .map((submission) => (
                        <Card key={submission.id} className="border-destructive/40 bg-destructive/5 px-3 py-3">
                          <Text weight="medium" className="break-words">
                            {submission.text}
                          </Text>
                          <Text variant="error" size="sm" className="mt-1" role="alert">
                            {t(submission.errorKey ?? "errors.unknown")}
                          </Text>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="mt-2"
                            onClick={() => handleRetrySubmission(submission)}
                          >
                            <RotateCcw className="h-4 w-4" />
                            {t("main.retrySubmission")}
                          </Button>
                        </Card>
                      ))}
                  </div>
                ) : null}

                {loggingReceipts.length > 0 ? (
                  <div className="space-y-2" aria-live="polite">
                    {loggingReceipts.map((receipt) => (
                      <Card key={receipt.id} className="border-success/35 bg-success/5 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <Check className="h-4 w-4 shrink-0 text-success" />
                            <Text weight="semibold">
                              {t("main.addedReceipt", { count: receipt.entries.length })}
                            </Text>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            loading={undoingReceiptId === receipt.id}
                            disabled={undoingReceiptId !== null && undoingReceiptId !== receipt.id}
                            onClick={() => void handleUndoReceipt(receipt)}
                          >
                            {t("main.undoSubmission")}
                          </Button>
                        </div>
                        <div className="mt-2 divide-y divide-border/60">
                          {receipt.entries.map((entry) => (
                            <div key={entry.id} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                              <div className="min-w-0 flex-1">
                                <Text className="truncate">{entry.name}</Text>
                                <Text variant="muted" size="sm">
                                  {formatLogDayLabel(
                                    entry.day,
                                    localIsoDate(),
                                    i18n.resolvedLanguage ?? i18n.language,
                                  )}{" "}
                                  · {t(`meals.${entry.mealType}`)}
                                </Text>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                aria-label={t("main.editAddedFood", { name: entry.name })}
                                onClick={() => {
                                  setChatExpanded(false);
                                  openEntryEditor(entry);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                {t("main.edit")}
                              </Button>
                            </div>
                          ))}
                        </div>
                        {receiptErrorId === receipt.id ? (
                          <Text variant="error" size="sm" className="mt-2" role="alert">
                            {t(foodLog.entryDelete.errorKey || "errors.unknown")}
                          </Text>
                        ) : null}
                      </Card>
                    ))}
                  </div>
                ) : null}

                {foodLog.frequentWeekRead.items.length > 0 ? (
                  <div className="shrink-0 rounded-xl bg-muted/35">
                    <Text weight="semibold" className="px-4 pt-3 pb-2">
                      {t("main.recentLogged")}
                    </Text>
                    <ul className="pb-1">
                      {foodLog.frequentWeekRead.items.map((item) => (
                        <li key={item.name} className="border-t border-border/70 first:border-t-0">
                          <button
                            type="button"
                            className="flex min-h-[3rem] w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-accent/90 active:bg-accent"
                            onClick={() => {
                              setChatInput(item.name);
                              focusChatInput();
                            }}
                          >
                            <Text as="span" weight="medium" className="flex-1 leading-snug break-words">
                              {item.name}
                            </Text>
                            <Text as="span" variant="muted" className="shrink-0 tabular-nums">
                              ×{item.count}
                            </Text>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

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
          className="fixed bottom-[max(5.75rem,calc(env(safe-area-inset-bottom)+5.25rem))] left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
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
    </div>
  );
});

export default MainPage;
