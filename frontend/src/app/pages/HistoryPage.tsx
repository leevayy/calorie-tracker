import { observer } from "mobx-react-lite";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { AsyncSection } from "../components/AsyncSection";
import { Card } from "../components/ds/Card";
import { Text } from "../components/ds/Text";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useRootStore } from "@/stores/StoreContext";
import { localIsoDate, parseIsoDateLocal } from "@/utils/date";

const HistoryPage = observer(function HistoryPage() {
  useRequireAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { history } = useRootStore();

  const { from, to } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return { from: localIsoDate(start), to: localIsoDate(end) };
  }, []);

  useEffect(() => {
    void history.loadRange(from, to);
  }, [history, from, to]);

  const chartData = useMemo(() => {
    const days = history.data?.days ?? [];
    return days.map((d) => ({
      date: parseIsoDateLocal(d.date).toLocaleDateString(i18n.language, { weekday: "short" }),
      iso: d.date,
      calories: d.calories,
      goal: d.goal,
    }));
  }, [history.data?.days, i18n.language]);

  const weeklyAverage =
    history.data?.weeklyAverageCalories ??
    (chartData.length
      ? Math.round(chartData.reduce((s, d) => s + d.calories, 0) / chartData.length)
      : 0);

  const weeklyGoal = chartData[0]?.goal ?? history.data?.days[0]?.goal ?? 0;
  const difference = weeklyAverage - weeklyGoal;
  const displayAverage = Math.round(weeklyAverage);
  const displayVsGoal = Math.round(Math.abs(difference));
  const isEmptySuccess = history.fetchState === "success" && chartData.length === 0;

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/app")}
          className="p-2 -ml-2 rounded-full hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Text as="h1" size="xl" weight="medium">
          {t("history.title")}
        </Text>
      </div>

      <div className="p-4 space-y-4">
        <AsyncSection
          fetchState={history.fetchState}
          errorKey={history.errorKey}
          onRetry={() => void history.loadRange(from, to)}
          empty={isEmptySuccess}
          emptyContent={
            <Card className="p-8">
              <Text variant="muted" align="center">
                {t("states.emptyHistory")}
              </Text>
            </Card>
          }
        >
          <Card className="p-4">
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

          <div className="space-y-2">
            <Text as="h3" weight="medium">
              {t("history.dailyBreakdown")}
            </Text>
            {[...chartData].reverse().map((day) => (
              <Card key={day.iso} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Text>{day.date}</Text>
                    <Text variant="muted" className="tabular-nums">
                      {Math.round(day.calories)} / {Math.round(day.goal)} {t("history.calShort")}
                    </Text>
                  </div>
                  <div className="text-right">
                    <Text
                      className={`tabular-nums ${day.calories > day.goal ? "text-destructive" : "text-success"}`}
                    >
                      {day.calories > day.goal ? "+" : ""}
                      {Math.round(day.calories - day.goal)} {t("history.calShort")}
                    </Text>
                    <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{
                          width: `${Math.min((day.calories / (day.goal || 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </AsyncSection>
      </div>
    </div>
  );
});

export default HistoryPage;
