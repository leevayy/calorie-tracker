import { observer } from "mobx-react-lite";
import type { MealType } from "@contracts/common";
import type { FrequentFoodItem } from "@contracts/food-log";
import type { ParsedFoodSuggestion } from "@contracts/ai-food";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { User, Home, History, Settings, ChevronDown, Send, RefreshCw } from "lucide-react";
import { AsyncSection } from "../components/AsyncSection";
import { CaloriePieChart } from "../components/CaloriePieChart";
import { FoodSuggestion } from "../components/FoodSuggestion";
import { MealSection } from "../components/MealSection";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { Button } from "../components/ds/Button";
import { Card } from "../components/ds/Card";
import { Input } from "../components/ds/Input";
import { apiGetFrequentFoods } from "@/api/foodLog";
import { useRootStore } from "@/stores/StoreContext";
import { buildDailyTipRequest } from "@/utils/buildDailyTipRequest";
import { localIsoDate, weekRangeEndingOn } from "@/utils/date";
import { coerceNutritionGoal } from "@/utils/nutritionGoal";
import { coercePreferredLanguage } from "@/utils/preferredLanguage";
import { AnimatePresence, motion } from "motion/react";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const CHAT_SUGGESTION_LIMIT = 3;

const MainPage = observer(function MainPage() {
  useRequireAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { session, profile, foodLog, dailyTip, aiParse } = useRootStore();

  const today = useMemo(() => localIsoDate(), []);

  const [chatExpanded, setChatExpanded] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [pendingSuggestions, setPendingSuggestions] = useState<ParsedFoodSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [targetMeal, setTargetMeal] = useState<MealType>("dinner");
  const [weekFrequentFoods, setWeekFrequentFoods] = useState<FrequentFoodItem[]>([]);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const tipAutoKeyRef = useRef("");
  const chatInputRef = useRef<HTMLInputElement>(null);

  const preferredLanguage = coercePreferredLanguage(
    profile.read.profile?.preferredLanguage ?? i18n.language,
  );
  const nutritionGoal = coerceNutritionGoal(profile.read.profile?.nutritionGoal);

  useEffect(() => {
    void profile.read.load();
    void foodLog.dayRead.loadDay(today);
  }, [profile.read, foodLog.dayRead, today]);

  useEffect(() => {
    if (foodLog.dayRead.fetchState !== "success" || !foodLog.dayRead.data) return;
    if (profile.read.fetchState === "loading") return;
    const key = `${today}|${preferredLanguage}|${nutritionGoal}`;
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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const swipeThreshold = 100;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) navigate("/history");
      else navigate("/settings");
    }
  };

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
    setPendingSuggestions(list);
    setShowSuggestions(list.length > 0);
  };

  const handleAcceptFood = async (idx: number) => {
    const food = pendingSuggestions[idx];
    if (!food) return;
    await foodLog.entryCreate.create(today, {
      mealType: targetMeal,
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fats: food.fats,
      portion: food.portion,
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
    <div
      className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex justify-between items-center">
        <h1 className="text-xl">{t("main.title")}</h1>
        <button
          type="button"
          title={session.user?.email}
          className="p-2 rounded-full hover:bg-accent transition-colors"
        >
          <User className="h-5 w-5" />
        </button>
      </div>

      {profile.read.fetchState === "error" && profile.read.errorKey ? (
        <div className="px-4 pt-2">
          <Card className="p-3 border-destructive/50 bg-destructive/5">
            <p className="text-sm text-destructive mb-2">{t(profile.read.errorKey)}</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => void profile.read.load()}>
              {t("states.retry")}
            </Button>
          </Card>
        </div>
      ) : null}

      {foodLog.entryDelete.fetchState === "error" && foodLog.entryDelete.errorKey ? (
        <div className="px-4 pt-2">
          <p className="text-sm text-destructive text-center" role="alert">
            {t(foodLog.entryDelete.errorKey)}
          </p>
        </div>
      ) : null}

      <div
        className={`flex-1 overflow-y-auto px-4 pt-4 ${
          chatExpanded ? (showSuggestions ? "pb-[78vh]" : "pb-[58vh]") : "pb-20"
        }`}
      >
        <div className="flex justify-center gap-6 mb-6">
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="p-2 rounded-full hover:bg-accent transition-colors text-muted-foreground"
          >
            <Settings className="h-5 w-5" />
          </button>
          <button type="button" className="p-2 rounded-full bg-primary text-primary-foreground">
            <Home className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/history")}
            className="p-2 rounded-full hover:bg-accent transition-colors text-muted-foreground"
          >
            <History className="h-5 w-5" />
          </button>
        </div>

        <AsyncSection
          fetchState={dayFetch}
          errorKey={foodLog.dayRead.errorKey}
          onRetry={() => void foodLog.dayRead.loadDay(today)}
        >
          {dayData ? (
            <>
              <div className="grid grid-cols-[1fr_1fr] gap-4 mb-6">
                <CaloriePieChart
                  consumed={dayData.totalCalories}
                  goal={dayData.calorieGoal}
                  caption={t("main.caloriesToday")}
                />
                <Card className="p-4 flex flex-col justify-center min-h-[140px]">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm text-muted-foreground">{t("main.tip")}</p>
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
                      <p className="text-sm leading-relaxed">{dailyTip.data.message}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("states.emptyTip")}</p>
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
            <p className="text-sm text-muted-foreground text-center py-8">{t("states.emptyDay")}</p>
          )}
        </AsyncSection>
      </div>

      <AnimatePresence>
        {chatExpanded ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-20"
            onClick={() => {
              setChatExpanded(false);
              setShowSuggestions(false);
            }}
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-30 max-w-md mx-auto"
        animate={{
          height: chatExpanded ? (showSuggestions ? "85vh" : "72vh") : "auto",
        }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        <div className="p-4">
          {chatExpanded && showSuggestions ? (
            <div className="mb-4 max-h-[52vh] overflow-y-auto space-y-2">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <p className="text-sm">{t("main.recognizedFoods")}</p>
                <button
                  type="button"
                  onClick={() => setShowSuggestions(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("main.clear")}
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <span>{t("main.addToMeal")}</span>
                <select
                  className="border border-border rounded-md bg-background text-foreground text-xs py-1 px-2"
                  value={targetMeal}
                  onChange={(e) => setTargetMeal(e.target.value as MealType)}
                >
                  {MEAL_TYPES.map((mt) => (
                    <option key={mt} value={mt}>
                      {t(`meals.${mt}`)}
                    </option>
                  ))}
                </select>
              </label>
              {pendingSuggestions.length === 0 && aiParse.fetchState === "success" ? (
                <p className="text-sm text-muted-foreground py-2">{t("states.emptySuggestions")}</p>
              ) : null}
              {pendingSuggestions.map((food, idx) => (
                <FoodSuggestion
                  key={`${food.name}-${idx}`}
                  food={food}
                  onAccept={() => void handleAcceptFood(idx)}
                  onReject={() => handleRejectFood(idx)}
                />
              ))}
              {foodLog.entryCreate.fetchState === "error" && foodLog.entryCreate.errorKey ? (
                <p className="text-sm text-destructive pt-2" role="alert">
                  {t(foodLog.entryCreate.errorKey)}
                </p>
              ) : null}
            </div>
          ) : null}

          {chatExpanded && aiParse.fetchState === "loading" ? (
            <p className="text-sm text-muted-foreground mb-2">{t("main.parsingFood")}</p>
          ) : null}

          {chatExpanded && aiParse.fetchState === "error" && aiParse.errorKey ? (
            <p className="text-sm text-destructive mb-2" role="alert">
              {t(aiParse.errorKey)}
            </p>
          ) : null}

          <form onSubmit={(e) => void handleChatSubmit(e)} className="flex gap-2">
            <Input
              ref={chatInputRef}
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

          {chatExpanded && weekFrequentFoods.length > 0 ? (
            <div className="mt-4 rounded-xl border border-border bg-muted/40">
              <p className="px-4 pt-4 pb-2 text-sm font-semibold text-foreground">
                {t("main.recentLogged")}
              </p>
              <ul className="pb-1">
                {weekFrequentFoods.map((item) => (
                  <li key={item.name} className="border-t border-border/70 first:border-t-0">
                    <button
                      type="button"
                      className="w-full text-left px-4 py-4 min-h-[3.25rem] flex items-center justify-between gap-4 hover:bg-accent/90 active:bg-accent transition-colors"
                      onClick={() => {
                        setChatInput(item.name);
                        chatInputRef.current?.focus();
                      }}
                    >
                      <span className="text-base font-medium leading-snug break-words flex-1">
                        {item.name}
                      </span>
                      <span className="text-base tabular-nums text-muted-foreground shrink-0">
                        ×{item.count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {chatExpanded ? (
            <button
              type="button"
              onClick={() => {
                setChatExpanded(false);
                setShowSuggestions(false);
              }}
              className="w-full mt-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-4 w-4 mx-auto" />
            </button>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
});

export default MainPage;
