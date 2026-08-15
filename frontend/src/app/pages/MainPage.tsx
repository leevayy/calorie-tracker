import { observer } from "mobx-react-lite";
import type { ParsedFoodSuggestion } from "@contracts/ai-food";
import type {
  CreateFoodEntryRequest,
  FoodEntryResponse,
  UpdateFoodEntryBody,
} from "@contracts/food-log";
import type { FormEvent } from "react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { useTranslation } from "react-i18next";
import { Send, RefreshCw } from "lucide-react";
import { AsyncSection } from "../components/AsyncSection";
import { CaloriePieChart } from "../components/CaloriePieChart";
import { DayMacrosLabels } from "../components/DayMacrosLabels";
import { FoodSuggestion } from "../components/FoodSuggestion";
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

type PendingFoodGroup = {
  id: string;
  foods: ParsedFoodSuggestion[];
};

const MainPage = observer(function MainPage() {
  useRequireAuth();
  const { t, i18n } = useTranslation();
  const { profile, foodLog, dailyTip, aiParse } = useRootStore();

  const today = useBehavioralToday();

  const { chatOpen: chatExpanded, setChatOpen: setChatExpanded } = useAppTabChat();
  const [chatInput, setChatInput] = useState("");
  const [pendingGroups, setPendingGroups] = useState<PendingFoodGroup[]>([]);
  const pendingGroupIdRef = useRef(0);
  const nextPendingGroupId = () => {
    pendingGroupIdRef.current += 1;
    return `pending-food-group-${pendingGroupIdRef.current}`;
  };
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
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

  const handleChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    await aiParse.parse({
      text,
      preferredLanguage: coercePreferredLanguage(profile.read.profile?.preferredLanguage ?? i18n.language),
      ...buildParseFoodTiming(),
    });
    if (aiParse.fetchState !== "success") return;
    setChatInput("");
    const foods = aiParse.data?.suggestions ?? [];
    if (foods.length > 0) {
      const incoming = { id: nextPendingGroupId(), foods };
      setPendingGroups((prev) => [incoming, ...prev]);
    }
    setShowSuggestions(true);
    setChatExpanded(true);
  };

  const onFoodLogSheetOpenChange = (open: boolean) => {
    setChatExpanded(open);
  };

  const handleAcceptGroup = async (group: PendingFoodGroup) => {
    if (foodLog.entriesCreate.isLoading) return;
    const entries: CreateFoodEntryRequest[] = group.foods.map((food) => ({
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
    setSavingGroupId(group.id);
    try {
      const created = await foodLog.entriesCreate.create(entries);
      if (!created) return;
      setPendingGroups((prev) => {
        const next = prev.filter((candidate) => candidate.id !== group.id);
        if (next.length === 0) setShowSuggestions(false);
        return next;
      });
    } finally {
      setSavingGroupId(null);
    }
  };

  const dismissGroup = (groupId: string) => {
    setPendingGroups((prev) => {
      const next = prev.filter((group) => group.id !== groupId);
      if (next.length === 0) setShowSuggestions(false);
      return next;
    });
  };

  const openEntryEditor = (entry: FoodEntryResponse) => {
    foodLog.entryUpdate.clearError();
    foodLog.entryDelete.clearError();
    setSelectedEntry(entry);
  };

  const handleSaveEntry = async (
    entry: FoodEntryResponse,
    body: UpdateFoodEntryBody,
  ): Promise<boolean> => Boolean(await foodLog.entryUpdate.update(entry, body));

  const handleDeleteEntry = async (entry: FoodEntryResponse): Promise<boolean> => {
    const deleted = await foodLog.entryDelete.remove(entry);
    if (!deleted) return false;
    setUndoEntry(deleted);
    return true;
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
                />
                <MealSection
                  title={t("meals.lunch")}
                  foods={dayData.meals.lunch}
                  emptyLabel={t("states.emptyMeals")}
                  onEdit={openEntryEditor}
                />
                <MealSection
                  title={t("meals.dinner")}
                  foods={dayData.meals.dinner}
                  emptyLabel={t("states.emptyMeals")}
                  onEdit={openEntryEditor}
                />
                <MealSection
                  title={t("meals.snack")}
                  foods={dayData.meals.snack ?? []}
                  emptyLabel={t("states.emptyMeals")}
                  onEdit={openEntryEditor}
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
              disabled={aiParse.fetchState === "loading"}
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
              disabled={!chatInput.trim() || aiParse.fetchState === "loading"}
              loading={aiParse.fetchState === "loading"}
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
                disabled={aiParse.fetchState === "loading"}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!chatInput.trim() || aiParse.fetchState === "loading"}
                loading={aiParse.fetchState === "loading"}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>

            {aiParse.fetchState === "loading" ? (
              <Text variant="muted" className="mt-2 shrink-0">
                {t("main.parsingFood")}
              </Text>
            ) : null}

            {aiParse.fetchState === "error" && aiParse.errorKey ? (
              <Text variant="error" className="mt-2 shrink-0" role="alert">
                {t(aiParse.errorKey)}
              </Text>
            ) : null}

            <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
                {aiParse.fetchState !== "loading" && foodLog.frequentWeekRead.items.length > 0 ? (
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

                {showSuggestions ? (
                  <div className="space-y-2 border-t border-border/60 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Text weight="medium">{t("main.recognizedFoods")}</Text>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSuggestions(false);
                          setPendingGroups([]);
                        }}
                        className="group text-muted-foreground hover:text-foreground"
                      >
                        <Text as="span" variant="muted" className="group-hover:text-foreground">
                          {t("main.clear")}
                        </Text>
                      </button>
                    </div>
                    {pendingGroups.length === 0 && aiParse.fetchState === "success" ? (
                      <Text variant="muted" className="py-2">
                        {t("states.emptySuggestions")}
                      </Text>
                    ) : null}
                    {pendingGroups.map((group) => {
                      const locale = i18n.resolvedLanguage ?? i18n.language;
                      return (
                        <div
                          key={group.id}
                          className="space-y-2 rounded-xl border border-border/70 p-3"
                        >
                          {group.foods.map((food, foodIndex) => {
                            const previous = group.foods[foodIndex - 1];
                            const startsTargetSection =
                              !previous ||
                              previous.day !== food.day ||
                              previous.mealType !== food.mealType;
                            return (
                              <Fragment key={`${group.id}-${foodIndex}`}>
                                {startsTargetSection ? (
                                  <Text
                                    as="h3"
                                    variant="muted"
                                    size="sm"
                                    weight="medium"
                                    className="pt-2 first:pt-0"
                                  >
                                    {formatLogDayLabel(food.day, localIsoDate(), locale)} ·{" "}
                                    {t(`meals.${food.mealType}`)}
                                  </Text>
                                ) : null}
                                <FoodSuggestion food={food} />
                              </Fragment>
                            );
                          })}
                          <div className="flex gap-2 pt-1">
                            <Button
                              type="button"
                              variant="secondary"
                              className="flex-1"
                              disabled={foodLog.entriesCreate.isLoading}
                              onClick={() => dismissGroup(group.id)}
                            >
                              {t("main.dismissRecognizedGroup")}
                            </Button>
                            <Button
                              type="button"
                              className="flex-1"
                              disabled={foodLog.entriesCreate.isLoading && savingGroupId !== group.id}
                              loading={savingGroupId === group.id}
                              onClick={() => void handleAcceptGroup(group)}
                            >
                              {foodLog.entriesCreate.isLoading
                                ? t("main.loggingRecognizedGroup")
                                : t("main.logRecognizedGroup", { count: group.foods.length })}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {foodLog.entriesCreate.fetchState === "error" && foodLog.entriesCreate.errorKey ? (
                      <Text variant="error" className="pt-2" role="alert">
                        {t(foodLog.entriesCreate.errorKey)}
                      </Text>
                    ) : null}
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
