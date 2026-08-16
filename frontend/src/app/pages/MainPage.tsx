import { observer } from "mobx-react-lite";
import type { ParseFoodResponse } from "@contracts/ai-food";
import type { MealType } from "@contracts/common";
import type {
  CreateFoodEntryRequest,
  FoodEntryResponse,
  HistoricalFoodSuggestion,
  UpdateFoodEntryBody,
} from "@contracts/food-log";
import type { FormEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Pencil, RotateCcw, Send } from "lucide-react";
import { AsyncSection } from "../components/AsyncSection";
import { CaloriePieChart } from "../components/CaloriePieChart";
import { DayMacrosLabels } from "../components/DayMacrosLabels";
import { DateNavigator } from "../components/DateNavigator";
import { FoodEntryEditor } from "../components/FoodEntryEditor";
import { MealSection } from "../components/MealSection";
import { MealInput } from "../components/ScheduleInputs";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { useTypewriterPlaceholder } from "../hooks/useTypewriterPlaceholder";
import { useAppTabChat } from "../context/AppTabChatContext";
import { useBehavioralToday } from "./main/mainPageHooks";
import {
  loadFailedLoggingSubmissions,
  saveFailedLoggingSubmissions,
  type PersistedFailedLoggingSubmission,
} from "./main/failedLoggingSubmissionsStorage";
import { Button } from "../components/ds/Button";
import { Card } from "../components/ds/Card";
import { Input, inputVariants } from "../components/ds/Input";
import { Text } from "../components/ds/Text";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible";
import { cn } from "../components/ui/utils";
import { useRootStore } from "@/stores/StoreContext";
import {
  buildParseFoodTiming,
  defaultMealTypeForLocalTime,
  formatLogDayLabel,
  localIsoDate,
  weekRangeEndingOn,
} from "@/utils/date";
import { sumDayMacros } from "@/utils/macroTotals";
import { coercePreferredLanguage } from "@/utils/preferredLanguage";
import {
  formatLocalizedEnergy,
  formatLocalizedGrams,
  formatStandaloneCalendarDate,
} from "@/utils/localeFormat";

const CHAT_SUGGESTION_LIMIT = 3;
const HISTORICAL_SUGGESTION_LIST_ID = "historical-food-suggestions";
const FOOD_PLACEHOLDER_KEYS = [
  "chickenMushrooms",
  "hamSandwich",
  "bananaOatmeal",
  "tunaSalad",
  "cheeseOmelet",
  "berryYogurt",
] as const;

type LoggingSubmission = {
  id: string;
  text: string;
  phase: "parsing" | "saving" | "failed";
  retryFrom?: "parse" | "save";
  errorKey?: string;
  foods: CreateFoodEntryRequest[];
  timing: ReturnType<typeof buildParseFoodTiming>;
  /** Keep the last recoverable failure until an in-flight retry actually succeeds. */
  durableFailure?: PersistedFailedLoggingSubmission;
};

type LoggingReceipt = {
  id: string;
  entries: FoodEntryResponse[];
};

type FailedSubmissionEdit = {
  submissionId: string;
  previousInput: string;
};

function historicalSuggestionIdentity(item: HistoricalFoodSuggestion): string {
  return [
    item.name,
    item.portion ?? "",
    item.calories,
    item.protein,
    item.carbs,
    item.fats,
    item.fiber,
    item.mealSlug ?? "",
  ].join("|");
}

function persistedFailureFromSubmission(
  submission: LoggingSubmission,
): PersistedFailedLoggingSubmission | null {
  if (!submission.retryFrom || !submission.errorKey) return null;
  return {
    id: submission.id,
    text: submission.text,
    retryFrom: submission.retryFrom,
    errorKey: submission.errorKey,
    foods: submission.foods,
    timing: submission.timing,
  };
}

const MainPage = observer(function MainPage() {
  useRequireAuth();
  const { t, i18n } = useTranslation();
  const { session, profile, foodLog, aiParse } = useRootStore();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const foodPlaceholderSuggestions = useMemo(
    () => FOOD_PLACEHOLDER_KEYS.map((key) => t(`main.logFoodSuggestions.${key}`)),
    [language],
  );
  const foodPlaceholder = useTypewriterPlaceholder(foodPlaceholderSuggestions);

  const today = useBehavioralToday();
  const [selectedDay, setSelectedDay] = useState(today);
  const previousTodayRef = useRef(today);

  useEffect(() => {
    const previousToday = previousTodayRef.current;
    previousTodayRef.current = today;
    setSelectedDay((current) => current === previousToday ? today : current);
  }, [today]);

  const { chatOpen: chatExpanded, setChatOpen: setChatExpanded } = useAppTabChat();
  const [chatInput, setChatInput] = useState("");
  const [composerMealTarget, setComposerMealTarget] = useState<MealType>(() =>
    defaultMealTypeForLocalTime(),
  );
  const composerMealTargetOverriddenRef = useRef(false);
  const [failedSubmissionEdit, setFailedSubmissionEdit] = useState<FailedSubmissionEdit | null>(null);
  const [activeHistoricalSuggestionIndex, setActiveHistoricalSuggestionIndex] = useState(-1);
  const [dismissedHistoricalSuggestionQuery, setDismissedHistoricalSuggestionQuery] = useState("");
  const historicalSuggestionSetIdentity = foodLog.historicalSuggestions.items
    .map(historicalSuggestionIdentity)
    .join("\u001e");
  const failedSubmissionStorageUserId = session?.user?.id;
  const [loggingSubmissions, setLoggingSubmissions] = useState<LoggingSubmission[]>(() =>
    loadFailedLoggingSubmissions(failedSubmissionStorageUserId).map((submission) => ({
      ...submission,
      phase: "failed",
    })),
  );
  const [loggingReceipts, setLoggingReceipts] = useState<LoggingReceipt[]>([]);
  const [receiptActivityOpen, setReceiptActivityOpen] = useState(true);
  const previousReceiptCountRef = useRef(0);
  const submissionIdRef = useRef(
    loggingSubmissions.reduce((highestId, submission) => {
      const match = /^logging-submission-(\d+)$/.exec(submission.id);
      return match ? Math.max(highestId, Number(match[1])) : highestId;
    }, 0),
  );
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

  useEffect(() => {
    void foodLog.dayRead.loadDay(selectedDay);
    setSelectedEntry(null);
  }, [foodLog.dayRead, selectedDay]);

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

  const saveSubmission = async (submission: LoggingSubmission, foods: CreateFoodEntryRequest[]) => {
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
    await saveSubmission(
      submission,
      parsed.suggestions.map((food) => ({
        ...food,
        // The explicitly selected dashboard day is authoritative for this composer.
        day: submission.timing.defaultLogDay,
        // `defaultMealType` is only the fallback sent to parsing. A meal named
        // in the description is returned on the food and intentionally wins.
      })),
    );
  };

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const submission: LoggingSubmission = {
      id: nextSubmissionId(),
      text: chatInput,
      phase: "parsing",
      foods: [],
      timing: {
        ...buildParseFoodTiming(),
        defaultLogDay: selectedDay,
        defaultMealType: composerMealTarget,
      },
    };
    const supersededSubmissionId = failedSubmissionEdit?.submissionId;
    setChatInput("");
    setActiveHistoricalSuggestionIndex(-1);
    setDismissedHistoricalSuggestionQuery("");
    setFailedSubmissionEdit(null);
    setLoggingSubmissions((current) => [
      submission,
      ...current.filter((candidate) => candidate.id !== supersededSubmissionId),
    ]);
    setChatExpanded(true);
    void parseAndSaveSubmission(submission);
    focusChatInput();
  };

  const handleHistoricalSuggestion = (suggestion: HistoricalFoodSuggestion) => {
    const timing = {
      ...buildParseFoodTiming(),
      defaultLogDay: selectedDay,
      defaultMealType: composerMealTarget,
    };
    const food: CreateFoodEntryRequest = {
      day: selectedDay,
      mealType: timing.defaultMealType,
      name: suggestion.name,
      calories: suggestion.calories,
      protein: suggestion.protein,
      carbs: suggestion.carbs,
      fats: suggestion.fats,
      fiber: suggestion.fiber,
      ...(suggestion.portion ? { portion: suggestion.portion } : {}),
      ...(suggestion.mealSlug ? { mealSlug: suggestion.mealSlug } : {}),
    };
    const submission: LoggingSubmission = {
      id: nextSubmissionId(),
      text: suggestion.name,
      phase: "saving",
      foods: [food],
      timing,
    };
    const supersededSubmissionId = failedSubmissionEdit?.submissionId;
    setChatInput("");
    setActiveHistoricalSuggestionIndex(-1);
    setDismissedHistoricalSuggestionQuery("");
    setFailedSubmissionEdit(null);
    setLoggingSubmissions((current) => [
      submission,
      ...current.filter((candidate) => candidate.id !== supersededSubmissionId),
    ]);
    foodLog.historicalSuggestions.clear();
    void saveSubmission(submission, [food]);
    focusChatInput();
  };

  const historicalSuggestionQuery = chatInput.trim();
  const historicalSuggestionsVisible =
    historicalSuggestionQuery.length > 0 &&
    foodLog.historicalSuggestions.query === historicalSuggestionQuery &&
    foodLog.historicalSuggestions.fetchState === "success" &&
    foodLog.historicalSuggestions.items.length > 0 &&
    dismissedHistoricalSuggestionQuery !== historicalSuggestionQuery;
  const activeHistoricalSuggestion = historicalSuggestionsVisible
    ? foodLog.historicalSuggestions.items[activeHistoricalSuggestionIndex]
    : undefined;

  const handleChatInputChange = (value: string) => {
    setChatInput(value);
    setActiveHistoricalSuggestionIndex(-1);
    setDismissedHistoricalSuggestionQuery("");
  };

  const beginFailedSubmissionEdit = (submission: LoggingSubmission) => {
    setFailedSubmissionEdit((current) => ({
      submissionId: submission.id,
      previousInput: current?.previousInput ?? chatInput,
    }));
    handleChatInputChange(submission.text);
    focusChatInput();
  };

  const cancelFailedSubmissionEdit = () => {
    if (!failedSubmissionEdit) return;
    handleChatInputChange(failedSubmissionEdit.previousInput);
    setFailedSubmissionEdit(null);
    focusChatInput();
  };

  const handleChatInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const suggestionCount = foodLog.historicalSuggestions.items.length;
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && historicalSuggestionsVisible) {
      event.preventDefault();
      setActiveHistoricalSuggestionIndex((current) => {
        if (event.key === "ArrowDown") return current < 0 ? 0 : (current + 1) % suggestionCount;
        return current < 0 ? suggestionCount - 1 : (current - 1 + suggestionCount) % suggestionCount;
      });
      return;
    }
    if (event.key === "Enter" && activeHistoricalSuggestion) {
      event.preventDefault();
      handleHistoricalSuggestion(activeHistoricalSuggestion);
      return;
    }
    if (event.key === "Escape" && historicalSuggestionsVisible) {
      event.preventDefault();
      event.stopPropagation();
      setActiveHistoricalSuggestionIndex(-1);
      setDismissedHistoricalSuggestionQuery(historicalSuggestionQuery);
      return;
    }
    if (event.key === "Escape" && failedSubmissionEdit) {
      event.preventDefault();
      event.stopPropagation();
      cancelFailedSubmissionEdit();
    }
  };

  const onFoodLogSheetOpenChange = (open: boolean) => {
    setChatExpanded(open);
  };

  const openFoodLogSheet = () => {
    if (!composerMealTargetOverriddenRef.current) {
      setComposerMealTarget(defaultMealTypeForLocalTime());
    }
    setChatExpanded(true);
  };

  const changeComposerMealTarget = (mealType: MealType) => {
    composerMealTargetOverriddenRef.current = true;
    setComposerMealTarget(mealType);
  };

  const handleRetrySubmission = (submission: LoggingSubmission) => {
    if (failedSubmissionEdit?.submissionId === submission.id) {
      cancelFailedSubmissionEdit();
    }
    const durableFailure = persistedFailureFromSubmission(submission);
    if (durableFailure) updateSubmission(submission.id, { durableFailure });
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

  useEffect(() => {
    const previousCount = previousReceiptCountRef.current;
    if (previousCount <= 1 && loggingReceipts.length > 1) {
      setReceiptActivityOpen(false);
    }
    previousReceiptCountRef.current = loggingReceipts.length;
  }, [loggingReceipts.length]);

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
  const loggedFoodCount = loggingReceipts.reduce(
    (count, receipt) => count + receipt.entries.length,
    0,
  );

  const pendingFoodsForMeal = (mealType: MealType) =>
    loggingSubmissions.flatMap((submission) => {
      if (
        submission.phase === "parsing" &&
        submission.timing.defaultLogDay === selectedDay &&
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
        food.day === selectedDay && food.mealType === mealType
          ? [{
              id: `${submission.id}-${index}`,
              label: food.name,
              phase: "saving" as const,
            }]
          : [],
      );
    });

  useEffect(() => {
    const { from, to } = weekRangeEndingOn(selectedDay);
    void foodLog.frequentWeekRead.load({ from, to, limit: CHAT_SUGGESTION_LIMIT });
  }, [selectedDay, dayData, foodLog.frequentWeekRead]);

  useEffect(() => {
    const query = chatInput.trim();
    if (!query) {
      foodLog.historicalSuggestions.clear();
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      void foodLog.historicalSuggestions.load(query);
    }, 150);
    return () => window.clearTimeout(timeoutId);
  }, [chatInput, foodLog.historicalSuggestions]);

  useEffect(() => {
    setActiveHistoricalSuggestionIndex(-1);
  }, [historicalSuggestionSetIdentity]);

  useEffect(() => {
    saveFailedLoggingSubmissions(
      failedSubmissionStorageUserId,
      loggingSubmissions.flatMap((submission) =>
        submission.phase === "failed"
          ? [persistedFailureFromSubmission(submission)].filter(
              (failure): failure is PersistedFailedLoggingSubmission => failure !== null,
            )
          : submission.durableFailure
            ? [submission.durableFailure]
            : [],
      ),
    );
  }, [failedSubmissionStorageUserId, loggingSubmissions]);

  return (
    <div
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background"
      aria-hidden={chatExpanded || undefined}
      inert={chatExpanded || undefined}
    >
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

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+5rem))] pt-4">
        <div className="mb-4">
          <DateNavigator
            selectedDay={selectedDay}
            today={today}
            onChange={setSelectedDay}
          />
        </div>
        <AsyncSection
          fetchState={dayFetch}
          errorKey={foodLog.dayRead.errorKey}
          onRetry={() => void foodLog.dayRead.loadDay(selectedDay)}
        >
          {dayData ? (
            <>
              <div className="mb-5 flex flex-col gap-4">
                <div className="grid min-h-0 grid-cols-2 gap-4">
                  <CaloriePieChart
                    className="min-h-0 min-w-0 h-full"
                    consumed={dayData.totalCalories}
                    goal={dayData.calorieGoal}
                    caption={t("main.caloriesForDay")}
                  />
                  <Card className="flex h-full min-h-0 min-w-0 flex-col px-0 py-2">
                    <div className="flex w-full flex-1 flex-col items-center justify-center">
                      <div className="box-border h-[140px] w-full max-w-[140px] shrink-0 px-2.5 py-1.5">
                        <DayMacrosLabels totals={sumDayMacros(dayData)} />
                      </div>
                      <Text variant="muted" align="center" className="mt-2 w-full">
                        {t("main.macrosSummary")}
                      </Text>
                    </div>
                  </Card>
                </div>
              </div>

              <div className="space-y-2">
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
        // Keep tab chrome inside Home: sibling carousel tabs stay mounted and a
        // viewport-fixed composer would otherwise intercept their controls.
        <div className="absolute bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-md bg-background/95 p-3 shadow-[0_-8px_28px_rgba(15,23,42,0.12)] backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <form onSubmit={(e) => void handleChatSubmit(e)} className="flex min-w-0 gap-2">
            {/* A text input here would open the keyboard before the drawer field exists. */}
            <button
              type="button"
              aria-label={t("main.logFoodPlaceholder")}
              aria-haspopup="dialog"
              aria-controls="food-log-sheet"
              aria-expanded={false}
              onClick={openFoodLogSheet}
              className={cn(
                inputVariants(),
                "min-w-0 flex-1 cursor-text items-center text-left font-normal touch-manipulation",
              )}
            >
              <span
                aria-hidden="true"
                data-testid="food-placeholder-preview"
                data-suggestion={foodPlaceholder.suggestion}
                data-typewriter-phase={foodPlaceholder.phase}
                className={cn(
                  "flex min-w-0 items-center overflow-hidden",
                  chatInput ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="min-w-0 truncate">{chatInput || foodPlaceholder.text}</span>
                {!chatInput ? (
                  <span
                    className="ml-0.5 h-4 w-px shrink-0 bg-muted-foreground/70 motion-safe:animate-pulse"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
            </button>
            <Button
              type="submit"
              size="icon"
              className="shrink-0"
              aria-label={t("main.sendFood")}
              disabled={!chatInput.trim()}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
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
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex h-[min(85dvh,85svh)] max-h-[min(85dvh,85svh)] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-background px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-16px_48px_rgba(15,23,42,0.22)] outline-none"
          >
            <Drawer.Title data-slot="drawer-title" className="sr-only">
              {t("main.foodLogSheetTitle")}
            </Drawer.Title>
            <Drawer.Handle className="mb-2 shrink-0 bg-muted" />
            <div className="shrink-0 pt-2">
              <MealInput value={composerMealTarget} onChange={changeComposerMealTarget} />
            </div>
            <form onSubmit={(e) => void handleChatSubmit(e)} className="flex min-w-0 shrink-0 gap-2 pt-2">
              <Input
                ref={setExpandedInputRef}
                role="combobox"
                aria-label={t("main.logFoodPlaceholder")}
                placeholder={foodPlaceholder.text}
                data-suggestion={foodPlaceholder.suggestion}
                data-typewriter-phase={foodPlaceholder.phase}
                value={chatInput}
                aria-autocomplete="list"
                aria-expanded={historicalSuggestionsVisible}
                aria-controls={historicalSuggestionsVisible ? HISTORICAL_SUGGESTION_LIST_ID : undefined}
                aria-activedescendant={
                  activeHistoricalSuggestion
                    ? `${HISTORICAL_SUGGESTION_LIST_ID}-option-${activeHistoricalSuggestionIndex}`
                    : undefined
                }
                onChange={(e) => handleChatInputChange(e.target.value)}
                onKeyDown={handleChatInputKeyDown}
                className="min-w-0 flex-1"
              />
              <Button
                type="submit"
                size="icon"
                className="shrink-0"
                aria-label={t("main.sendFood")}
                disabled={!chatInput.trim()}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>

            {failedSubmissionEdit ? (
              <div className="mt-2 flex shrink-0 items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-1.5">
                <Text size="sm" variant="muted" className="min-w-0 truncate">
                  {t("main.editingFailedSubmission")}
                </Text>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={cancelFailedSubmissionEdit}
                >
                  {t("main.cancelFailedSubmissionEdit")}
                </Button>
              </div>
            ) : null}

            <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
                {historicalSuggestionsVisible ? (
                  <div
                    id={HISTORICAL_SUGGESTION_LIST_ID}
                    className="shrink-0 rounded-xl bg-muted/35"
                    role="listbox"
                    aria-label={t("main.historicalSuggestions")}
                    onPointerLeave={() => setActiveHistoricalSuggestionIndex(-1)}
                  >
                    <Text weight="semibold" className="px-4 pt-3 pb-2">
                      {t("main.historicalSuggestions")}
                    </Text>
                    <ul>
                      {foodLog.historicalSuggestions.items.map((item, index) => (
                        <li
                          key={`${historicalSuggestionIdentity(item)}|${index}`}
                          className="border-t border-border/70"
                        >
                          <button
                            id={`${HISTORICAL_SUGGESTION_LIST_ID}-option-${index}`}
                            type="button"
                            role="option"
                            aria-selected={activeHistoricalSuggestionIndex === index}
                            className="w-full px-4 py-3 text-left transition-colors hover:bg-accent/90 active:bg-accent aria-selected:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            onPointerMove={() => setActiveHistoricalSuggestionIndex(index)}
                            onFocus={() => setActiveHistoricalSuggestionIndex(index)}
                            onClick={() => handleHistoricalSuggestion(item)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <Text as="span" weight="medium" className="block break-words">
                                  {item.name}
                                </Text>
                                <Text as="span" variant="muted" size="sm" className="mt-0.5 block">
                                  {item.portion ?? t("main.portionNotRecorded")} ·{" "}
                                  {formatLocalizedEnergy(
                                    item.calories,
                                    i18n.resolvedLanguage ?? i18n.language,
                                    t("history.calShort"),
                                  )}
                                </Text>
                                <Text as="span" variant="muted" size="xs" className="mt-0.5 block">
                                  {t("macros.proteinLetter")} {formatLocalizedGrams(item.protein, language)} ·{" "}
                                  {t("macros.carbsLetter")} {formatLocalizedGrams(item.carbs, language)} ·{" "}
                                  {t("macros.fatsLetter")} {formatLocalizedGrams(item.fats, language)} ·{" "}
                                  {t("macros.fiberLetter")} {formatLocalizedGrams(item.fiber, language)}
                                </Text>
                              </div>
                              <Text as="span" variant="muted" size="sm" className="shrink-0 text-right">
                                {t("main.usedCount", { count: item.usageCount })}
                                <br />
                                {formatLogDayLabel(
                                  item.lastUsedDay,
                                  localIsoDate(),
                                  i18n.resolvedLanguage ?? i18n.language,
                                )}
                              </Text>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
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
                        <Card key={submission.id} className="bg-destructive/10 px-3 py-3">
                          <Text weight="medium" className="break-words">
                            {submission.text}
                          </Text>
                          <Text variant="error" size="sm" className="mt-1" role="alert">
                            {t(submission.errorKey ?? "errors.unknown")}
                          </Text>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => handleRetrySubmission(submission)}
                            >
                              <RotateCcw className="h-4 w-4" aria-hidden="true" />
                              {t("main.retrySubmission")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => beginFailedSubmissionEdit(submission)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              {t("main.editFailedSubmission")}
                            </Button>
                          </div>
                        </Card>
                      ))}
                  </div>
                ) : null}

                {loggingReceipts.length > 0 ? (
                  <Collapsible
                    open={receiptActivityOpen}
                    onOpenChange={setReceiptActivityOpen}
                    className="shrink-0 rounded-xl border border-border/70 bg-muted/20"
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        className="group w-full px-3 [&>span]:w-full [&>span]:justify-between"
                      >
                        <span aria-live="polite" aria-atomic="true">
                          {t("main.loggingActivitySummary", {
                            count: loggingReceipts.length,
                            foods: t("main.loggedFoods", { count: loggedFoodCount }),
                          })}
                        </span>
                        <ChevronDown
                          className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
                          aria-hidden="true"
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="max-h-64 space-y-2 overflow-y-auto overscroll-contain p-2 [scrollbar-gutter:stable]">
                      {loggingReceipts.map((receipt) => (
                        <Card key={receipt.id} className="bg-success/10 px-3 py-3">
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
                              aria-label={t("main.undoAddedGroup", {
                                foods: new Intl.ListFormat(language, {
                                  style: "long",
                                  type: "conjunction",
                                }).format(receipt.entries.map((entry) => entry.name)),
                              })}
                              loading={undoingReceiptId === receipt.id}
                              disabled={undoingReceiptId !== null && undoingReceiptId !== receipt.id}
                              onClick={() => void handleUndoReceipt(receipt)}
                            >
                              {t("main.undoSubmission")}
                            </Button>
                          </div>
                          <div className="mt-2 space-y-2">
                            {receipt.entries.map((entry) => (
                              <div key={entry.id} className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <Text className="truncate">{entry.name}</Text>
                                  <Text variant="muted" size="sm">
                                    {formatStandaloneCalendarDate(
                                      entry.day,
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
                    </CollapsibleContent>
                  </Collapsible>
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
        // This page remains mounted offscreen while another carousel tab is active.
        <div
          className="absolute bottom-[max(5.75rem,calc(env(safe-area-inset-bottom)+5.25rem))] left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-lg"
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
