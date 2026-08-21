import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { AsyncSection } from "../components/AsyncSection";
import { Badge } from "../components/ds/Badge";
import { Card } from "../components/ds/Card";
import { Text } from "../components/ds/Text";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { HistoryDayDetail } from "./history/HistoryDayDetail";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useRootStore } from "@/stores/StoreContext";
import { localIsoDate, parseIsoDateLocal } from "@/utils/date";
import {
  formatInlineCalendarDate,
  formatLocalizedGrams,
  formatLocalizedNumber,
} from "@/utils/localeFormat";
import "../../styles/aero/history.css";

const HistoryPage = observer(function HistoryPage() {
  useRequireAuth();
  const { t, i18n } = useTranslation();
  const { history } = useRootStore();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const formatWholeNumber = (value: number) =>
    formatLocalizedNumber(value, language, { maximumFractionDigits: 0 });

  const { from, to, today } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const toDate = localIsoDate(end);
    return { from: localIsoDate(start), to: toDate, today: toDate };
  }, []);

  useEffect(() => {
    void history.loadRange(from, to, today);
  }, [history, from, to, today]);

  const chartData = useMemo(() => {
    const days = history.data?.days ?? [];
    return days.map((d) => ({
      date: parseIsoDateLocal(d.date).toLocaleDateString(language, { weekday: "short" }),
      iso: d.date,
      calories: d.calories,
      goal: d.goal,
      protein: d.protein,
      fats: d.fats,
      carbs: d.carbs,
      fiber: d.fiber,
    }));
  }, [history.data?.days, language]);

  const daysForAverageFallback = useMemo(() => {
    const days = history.data?.days ?? [];
    return days.filter((d) => d.calories > 0 && d.date !== today);
  }, [history.data?.days, today]);

  const weeklyAverage =
    history.data?.weeklyAverageCalories ??
    (daysForAverageFallback.length
      ? Math.round(
          daysForAverageFallback.reduce((s, d) => s + d.calories, 0) / daysForAverageFallback.length,
        )
      : 0);

  const weeklyGoal = chartData[0]?.goal ?? history.data?.days[0]?.goal ?? 0;
  const difference = weeklyAverage - weeklyGoal;
  const displayAverage = Math.round(weeklyAverage);
  const displayVsGoal = Math.round(Math.abs(difference));
  const isEmptySuccess = history.fetchState === "success" && chartData.length === 0;

  return (
    <div
      data-testid="history-page"
      data-slot="history-workspace"
      className="relative mx-auto flex min-h-0 w-full flex-1 flex-col bg-background"
    >
      <div
        data-slot="history-scroll"
        className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <AsyncSection
          fetchState={history.fetchState}
          errorKey={history.errorKey}
          onRetry={() => void history.loadRange(from, to, today)}
          empty={isEmptySuccess}
          emptyContent={
            <Card data-slot="history-state-card" className="px-0 py-8">
              <Text variant="muted" align="center">
                {t("states.emptyHistory")}
              </Text>
            </Card>
          }
        >
          <Card data-slot="history-summary">
            <Text data-slot="history-panel-title" as="h2" className="mb-4">
              {t("history.weeklySummary")}
            </Text>
            <div data-slot="history-summary-metrics" className="grid grid-cols-2 gap-4 mb-4">
              <div data-slot="history-metric" data-tone="average">
                <Text variant="muted">{t("history.average")}</Text>
                <Text size="2xl" weight="semibold" className="tabular-nums leading-tight">
                  {formatWholeNumber(displayAverage)}
                </Text>
                <Text variant="muted">{t("history.calPerDay")}</Text>
              </div>
              <div data-slot="history-metric" data-tone={difference > 0 ? "over" : "under"}>
                <Text variant="muted">{t("history.vsGoal")}</Text>
                <div className="flex items-center gap-2">
                  {difference > 0 ? (
                    <TrendingUp className="h-5 w-5 text-destructive-ink" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-success-ink" />
                  )}
                  <Text size="2xl" weight="semibold" className="tabular-nums leading-tight">
                    {formatWholeNumber(displayVsGoal)}
                  </Text>
                </div>
                <Text variant="muted">
                  {difference > 0 ? t("history.over") : t("history.under")}
                </Text>
              </div>
            </div>

            <div data-slot="history-chart" className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" stroke="currentColor" className="text-sm" tickLine={false} />
                  <YAxis
                    stroke="currentColor"
                    className="text-sm"
                    tickLine={false}
                    domain={["auto", "auto"]}
                    tickFormatter={(value) => formatWholeNumber(Number(value))}
                  />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === "number" ? formatWholeNumber(value) : value
                    }
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "none",
                      borderRadius: "var(--radius)",
                      boxShadow: "0 8px 24px rgb(15 23 42 / 0.16)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="calories"
                    name={t("history.chartCalories")}
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={{ fill: "var(--chart-1)", r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="goal"
                    name={t("history.chartGoal")}
                    stroke="var(--muted-foreground)"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div data-slot="history-breakdown" className="space-y-3">
            <Text data-slot="history-panel-title" as="h3">
              {t("history.dailyBreakdown")}
            </Text>
            {[...chartData].reverse().map((day) => (
              <Card key={day.iso} data-slot="history-day-card">
                <button
                  type="button"
                  data-slot="history-day-button"
                  className="flex w-full items-center justify-between gap-3 rounded-[var(--radius)] py-3 text-left transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("history.openDay", {
                    date: formatInlineCalendarDate(day.iso, language),
                  })}
                  onClick={() => setSelectedDay(day.iso)}
                >
                  <div className="min-w-0">
                    <Text>{day.date}</Text>
                    <Text variant="muted" className="tabular-nums">
                      {formatWholeNumber(Math.round(day.calories))} /{" "}
                      {formatWholeNumber(Math.round(day.goal))} {t("history.calShort")}
                    </Text>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge size="sm" variant="secondary" className="tabular-nums">
                        {t("macros.proteinLetter")} {formatLocalizedGrams(day.protein, language)}
                      </Badge>
                      <Badge size="sm" variant="secondary" className="tabular-nums">
                        {t("macros.fatsLetter")} {formatLocalizedGrams(day.fats, language)}
                      </Badge>
                      <Badge size="sm" variant="secondary" className="tabular-nums">
                        {t("macros.carbsLetter")} {formatLocalizedGrams(day.carbs, language)}
                      </Badge>
                      <Badge size="sm" variant="secondary" className="tabular-nums">
                        {t("macros.fiberLetter")} {formatLocalizedGrams(day.fiber, language)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <Text
                        className={`tabular-nums ${day.calories > day.goal ? "text-destructive-ink" : "text-success-ink"}`}
                      >
                        {day.calories > day.goal ? "+" : ""}
                        {formatWholeNumber(Math.round(day.calories - day.goal))}{" "}
                        {t("history.calShort")}
                      </Text>
                      <div
                        data-slot="history-day-progress"
                        className="mt-2 h-2 w-24 overflow-hidden rounded-full bg-secondary"
                      >
                        <div
                          data-slot="history-day-progress-fill"
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${Math.min((day.calories / (day.goal || 1)) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                </button>
              </Card>
            ))}
          </div>
        </AsyncSection>
      </div>
      {selectedDay ? (
        <HistoryDayDetail
          key={selectedDay}
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
          onOpenDay={setSelectedDay}
        />
      ) : null}
    </div>
  );
});

export default HistoryPage;
