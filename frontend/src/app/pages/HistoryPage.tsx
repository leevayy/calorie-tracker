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
import { formatCalendarDate, localIsoDate, parseIsoDateLocal } from "@/utils/date";
import { formatMacroGrams } from "@/utils/macroTotals";

const HistoryPage = observer(function HistoryPage() {
  useRequireAuth();
  const { t, i18n } = useTranslation();
  const { history } = useRootStore();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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
      date: parseIsoDateLocal(d.date).toLocaleDateString(i18n.language, { weekday: "short" }),
      iso: d.date,
      calories: d.calories,
      goal: d.goal,
      protein: d.protein,
      fats: d.fats,
      carbs: d.carbs,
      fiber: d.fiber,
    }));
  }, [history.data?.days, i18n.language]);

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
    <div className="relative mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col bg-background">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain p-4 pb-[max(7rem,calc(env(safe-area-inset-bottom)+5.25rem))]">
        <AsyncSection
          fetchState={history.fetchState}
          errorKey={history.errorKey}
          onRetry={() => void history.loadRange(from, to, today)}
          empty={isEmptySuccess}
          emptyContent={
            <Card className="px-0 py-8">
              <Text variant="muted" align="center">
                {t("states.emptyHistory")}
              </Text>
            </Card>
          }
        >
          <Card>
            <Text as="h2" weight="medium" className="mb-4">
              {t("history.weeklySummary")}
            </Text>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Text variant="muted">{t("history.average")}</Text>
                <Text size="2xl" weight="semibold" className="tabular-nums leading-tight">
                  {displayAverage}
                </Text>
                <Text variant="muted">{t("history.calPerDay")}</Text>
              </div>
              <div>
                <Text variant="muted">{t("history.vsGoal")}</Text>
                <div className="flex items-center gap-2">
                  {difference > 0 ? (
                    <TrendingUp className="h-5 w-5 text-destructive" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-success" />
                  )}
                  <Text size="2xl" weight="semibold" className="tabular-nums leading-tight">
                    {displayVsGoal}
                  </Text>
                </div>
                <Text variant="muted">
                  {difference > 0 ? t("history.over") : t("history.under")}
                </Text>
              </div>
            </div>

            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" stroke="currentColor" className="text-sm" tickLine={false} />
                  <YAxis stroke="currentColor" className="text-sm" tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip
                    formatter={(value) => (typeof value === "number" ? Math.round(value) : value)}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="calories"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={{ fill: "#0ea5e9", r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="goal"
                    stroke="#94a3b8"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="space-y-4">
            <Text as="h3" weight="medium">
              {t("history.dailyBreakdown")}
            </Text>
            {[...chartData].reverse().map((day) => (
              <Card key={day.iso}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-[var(--radius)] py-3 text-left transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("history.openDay", {
                    date: formatCalendarDate(day.iso, i18n.language),
                  })}
                  onClick={() => setSelectedDay(day.iso)}
                >
                  <div className="min-w-0">
                    <Text>{day.date}</Text>
                    <Text variant="muted" className="tabular-nums">
                      {Math.round(day.calories)} / {Math.round(day.goal)} {t("history.calShort")}
                    </Text>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge size="sm" variant="secondary" className="tabular-nums">
                        {t("macros.proteinLetter")} {formatMacroGrams(day.protein)}
                      </Badge>
                      <Badge size="sm" variant="secondary" className="tabular-nums">
                        {t("macros.fatsLetter")} {formatMacroGrams(day.fats)}
                      </Badge>
                      <Badge size="sm" variant="secondary" className="tabular-nums">
                        {t("macros.carbsLetter")} {formatMacroGrams(day.carbs)}
                      </Badge>
                      <Badge size="sm" variant="secondary" className="tabular-nums">
                        {t("macros.fiberLetter")} {formatMacroGrams(day.fiber)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <Text
                        className={`tabular-nums ${day.calories > day.goal ? "text-destructive" : "text-success"}`}
                      >
                        {day.calories > day.goal ? "+" : ""}
                        {Math.round(day.calories - day.goal)} {t("history.calShort")}
                      </Text>
                      <div className="mt-2 h-2 w-24 overflow-hidden rounded-full bg-secondary">
                        <div
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
