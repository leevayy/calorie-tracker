import { observer } from "mobx-react-lite";
import type { MealType } from "@contracts/common";
import type { FrequentFoodItem } from "@contracts/food-log";
import type { ParsedFoodSuggestion } from "@contracts/ai-food";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";
import { useTranslation } from "react-i18next";
import { ChevronDown, Send, RefreshCw } from "lucide-react";
import { AsyncSection } from "../components/AsyncSection";
import { CaloriePieChart } from "../components/CaloriePieChart";
import { DayMacrosLabels } from "../components/DayMacrosLabels";
import { FoodSuggestion } from "../components/FoodSuggestion";
import { MealSection } from "../components/MealSection";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { useAppTabChat } from "../context/AppTabChatContext";
import { Button } from "../components/ds/Button";
import { Card } from "../components/ds/Card";
import { Input } from "../components/ds/Input";
import { Text } from "../components/ds/Text";
import { apiGetFrequentFoods } from "@/api/foodLog";
import { useRootStore } from "@/stores/StoreContext";
import { buildDailyTipRequest } from "@/utils/buildDailyTipRequest";
import { behavioralLocalIsoDate, defaultMealTypeForLocalTime, weekRangeEndingOn } from "@/utils/date";
import { sumDayMacros } from "@/utils/macroTotals";
import { coerceNutritionGoal } from "@/utils/nutritionGoal";
import { coercePreferredLanguage } from "@/utils/preferredLanguage";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const CHAT_SUGGESTION_LIMIT = 3;

type PendingFoodSuggestion = { id: string; food: ParsedFoodSuggestion };

const MainPage = observer(function MainPage() {
  useRequireAuth();
  const { t, i18n } = useTranslation();
  const { profile, foodLog, dailyTip, aiParse } = useRootStore();

  /** Tick so behavioral "today" updates after midnight / 4:00 without full page reload. */
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
  const today = useMemo(() => behavioralLocalIsoDate(), [behavioralDayTick]);

  const { chatOpen: chatExpanded, setChatOpen: setChatExpanded } = useAppTabChat();
  const [chatInput, setChatInput] = useState("");
  const [pendingSuggestions, setPendingSuggestions] = useState<PendingFoodSuggestion[]>([]);
  const pendingSuggestionIdRef = useRef(0);
  const nextPendingSuggestionId = () => {
    pendingSuggestionIdRef.current += 1;
    return `pending-food-${pendingSuggestionIdRef.current}`;
  };
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [targetMeal, setTargetMeal] = useState<MealType>(() => defaultMealTypeForLocalTime());
  const [weekFrequentFoods, setWeekFrequentFoods] = useState<FrequentFoodItem[]>([]);

  const tipAutoKeyRef = useRef("");
  const collapsedInputRef = useRef<HTMLInputElement>(null);
  const expandedInputRef = useRef<HTMLInputElement>(null);

  const focusChatInput = useCallback(() => {
    if (chatExpanded) expandedInputRef.current?.focus();
    else collapsedInputRef.current?.focus();
  }, [chatExpanded]);

  useEffect(() => {
    if (!chatExpanded) return;
    const id = requestAnimationFrame(() => expandedInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [chatExpanded]);

  const preferredLanguage = coercePreferredLanguage(
    profile.read.profile?.preferredLanguage ?? i18n.language,
  );
  const nutritionGoal = coerceNutritionGoal(profile.read.profile?.nutritionGoal);
  const tipVibeKey = (profile.read.profile?.tipVibePrompt ?? "").trim().length > 0
    ? `${profile.read.profile?.tipVibeEmoji ?? ""}|${(profile.read.profile?.tipVibePrompt ?? "").length}`
    : "off";

  useEffect(() => {
    void profile.read.load();
    void foodLog.dayRead.loadDay(today);
  }, [profile.read, foodLog.dayRead, today]);

  useEffect(() => {
    if (foodLog.dayRead.fetchState !== "success" || !foodLog.dayRead.data) return;
    if (profile.read.fetchState === "loading") return;
    const key = `${today}|${preferredLanguage}|${nutritionGoal}|${tipVibeKey}`;
    if (tipAutoKeyRef.current === key) return;
    tipAutoKeyRef.current = key;
    void dailyTip.fetchTip(
      buildDailyTipRequest(foodLog.dayRead.data, today, { preferredLanguage, at: new Date() }),
      { force: true },
    );
  }, [
    foodLog.dayRead.fetchState,
    foodLog.dayRead.data,
    profile.read.fetchState,
    preferredLanguage,
    nutritionGoal,
    tipVibeKey,
    today,
    dailyTip,
  ]);

  const requestDailyTip = useCallback(() => {
    const data = foodLog.dayRead.data;
    if (!data) return;
    void dailyTip.fetchTip(
      buildDailyTipRequest(data, today, { preferredLanguage, at: new Date() }),
      { force: true },
    );
  }, [foodLog.dayRead.data, dailyTip, today, preferredLanguage]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    await aiParse.parse({
      text,
      preferredLanguage: coercePreferredLanguage(profile.read.profile?.preferredLanguage ?? i18n.language),
    });
    if (aiParse.fetchState !== "success") return;
    setChatInput("");
    const list = (aiParse.data?.suggestions ?? []).slice(0, CHAT_SUGGESTION_LIMIT);
    const incoming = list.map((food) => ({
      id: nextPendingSuggestionId(),
      food,
    }));
    setPendingSuggestions((prev) => [...incoming, ...prev]);
    setShowSuggestions(true);
    setChatExpanded(true);
  };

  const onFoodLogSheetOpenChange = (open: boolean) => {
    setChatExpanded(open);
  };

  const handleAcceptFood = async (idx: number) => {
    const entry = pendingSuggestions[idx];
    if (!entry) return;
    const { food } = entry;
    await foodLog.entryCreate.create(today, {
      mealType: targetMeal,
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fats: food.fats,
      portion: food.portion,
      ...(food.mealSlug ? { mealSlug: food.mealSlug } : {}),
    });
    if (foodLog.entryCreate.fetchState === "success") {
      setPendingSuggestions((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        if (next.length === 0) setShowSuggestions(false);
        return next;
      });
    }
  };

  const handleRejectFood = (idx: number) => {
    setPendingSuggestions((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) setShowSuggestions(false);
      return next;
    });
  };

  const dayData = foodLog.dayRead.data;
  const dayFetch = foodLog.dayRead.fetchState;
  const deleteBusy = foodLog.entryDelete.fetchState === "loading";

  useEffect(() => {
    let cancelled = false;
    const { from, to } = weekRangeEndingOn(today);
    void (async () => {
      try {
        const res = await apiGetFrequentFoods({ from, to, limit: CHAT_SUGGESTION_LIMIT });
        if (!cancelled) setWeekFrequentFoods(res.items);
      } catch {
        if (!cancelled) setWeekFrequentFoods([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [today, dayData]);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      {profile.read.fetchState === "error" && profile.read.errorKey ? (
        <div className="px-4 pt-2">
          <Card className="p-3 border-destructive/50 bg-destructive/5">
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
                  <Card className="flex h-full min-h-0 min-w-0 flex-col p-4">
                    <div className="flex w-full flex-1 flex-col items-center justify-center">
                      <div className="box-border h-[140px] w-[140px] shrink-0 rounded-[var(--radius)] px-2.5 py-1.5">
                        <DayMacrosLabels totals={sumDayMacros(dayData)} />
                      </div>
                      <Text variant="muted" align="center" className="mt-2 w-full">
                        {t("main.macrosSummary")}
                      </Text>
                    </div>
                  </Card>
                </div>
                <Card className="p-4 flex flex-col">
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
                  removeDisabled={deleteBusy}
                  onRemove={(food) => food.id && void foodLog.entryDelete.remove(food.id)}
                />
                <MealSection
                  title={t("meals.lunch")}
                  foods={dayData.meals.lunch}
                  emptyLabel={t("states.emptyMeals")}
                  removeDisabled={deleteBusy}
                  onRemove={(food) => food.id && void foodLog.entryDelete.remove(food.id)}
                />
                <MealSection
                  title={t("meals.dinner")}
                  foods={dayData.meals.dinner}
                  emptyLabel={t("states.emptyMeals")}
                  removeDisabled={deleteBusy}
                  onRemove={(food) => food.id && void foodLog.entryDelete.remove(food.id)}
                />
                <MealSection
                  title={t("meals.snack")}
                  foods={dayData.meals.snack ?? []}
                  emptyLabel={t("states.emptyMeals")}
                  removeDisabled={deleteBusy}
                  onRemove={(food) => food.id && void foodLog.entryDelete.remove(food.id)}
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
            <Input
              ref={collapsedInputRef}
              placeholder={t("main.logFoodPlaceholder")}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onFocus={() => setChatExpanded(true)}
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
        </div>
      ) : null}

      <Drawer.Root
        open={chatExpanded}
        onOpenChange={onFoodLogSheetOpenChange}
        shouldScaleBackground={false}
        repositionInputs={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex h-[min(85dvh,85svh)] max-h-[min(85dvh,85svh)] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-x border-t border-border bg-background px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.15)] outline-none">
            <Drawer.Title className="sr-only">{t("main.foodLogSheetTitle")}</Drawer.Title>
            <Drawer.Handle className="mb-2 shrink-0 bg-muted" />
            <form onSubmit={(e) => void handleChatSubmit(e)} className="flex shrink-0 gap-2 pt-2">
              <Input
                ref={expandedInputRef}
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
                {aiParse.fetchState !== "loading" && weekFrequentFoods.length > 0 ? (
                  <div className="shrink-0 rounded-xl border border-border bg-muted/40">
                    <Text weight="semibold" className="px-4 pt-3 pb-2">
                      {t("main.recentLogged")}
                    </Text>
                    <ul className="pb-1">
                      {weekFrequentFoods.map((item) => (
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
                          setPendingSuggestions([]);
                        }}
                        className="group text-muted-foreground hover:text-foreground"
                      >
                        <Text as="span" variant="muted" className="group-hover:text-foreground">
                          {t("main.clear")}
                        </Text>
                      </button>
                    </div>
                    {pendingSuggestions.length > 0 ? (
                      <Text
                        as="label"
                        variant="muted"
                        className="flex flex-wrap items-center gap-2"
                      >
                        <Text as="span">{t("main.addToMeal")}</Text>
                        <select
                          className="rounded-md border border-border bg-background px-2 py-1 text-base text-foreground"
                          value={targetMeal}
                          onChange={(e) => setTargetMeal(e.target.value as MealType)}
                        >
                          {MEAL_TYPES.map((mt) => (
                            <option key={mt} value={mt}>
                              {t(`meals.${mt}`)}
                            </option>
                          ))}
                        </select>
                      </Text>
                    ) : null}
                    {pendingSuggestions.length === 0 && aiParse.fetchState === "success" ? (
                      <Text variant="muted" className="py-2">
                        {t("states.emptySuggestions")}
                      </Text>
                    ) : null}
                    {pendingSuggestions.map((entry, idx) => (
                      <FoodSuggestion
                        key={entry.id}
                        food={entry.food}
                        onAccept={() => void handleAcceptFood(idx)}
                        onReject={() => handleRejectFood(idx)}
                      />
                    ))}
                    {foodLog.entryCreate.fetchState === "error" && foodLog.entryCreate.errorKey ? (
                      <Text variant="error" className="pt-2" role="alert">
                        {t(foodLog.entryCreate.errorKey)}
                      </Text>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
});

export default MainPage;
