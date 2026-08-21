import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "./ui/utils";
import { Card } from "./ds/Card";
import { Text } from "./ds/Text";
import { useTranslation } from "react-i18next";
import { formatLocalizedNumber } from "@/utils/localeFormat";

interface CaloriePieChartProps {
  consumed: number;
  goal: number;
  /** Footer label under the pie */
  caption?: string;
  className?: string;
}

export function CaloriePieChart({
  consumed,
  goal,
  caption = "Calories today",
  className,
}: CaloriePieChartProps) {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const remaining = Math.max(0, goal - consumed);
  const data = [
    { name: "Consumed", value: consumed },
    { name: "Remaining", value: remaining },
  ];

  const COLORS = ["var(--chart-1)", "var(--secondary)"];

  return (
    <Card data-slot="calorie-gauge" className={cn("aero-calorie-gauge flex h-full flex-col px-0 py-2", className)}>
      <div className="flex w-full flex-1 flex-col items-center justify-center">
        <div data-slot="calorie-gauge-dial" className="relative h-[140px] w-full shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Text size="2xl" weight="semibold" className="leading-none">
              {formatLocalizedNumber(consumed, language)}
            </Text>
            <Text variant="muted" className="leading-none">
              / {formatLocalizedNumber(goal, language)}
            </Text>
          </div>
        </div>
        <Text variant="muted" align="center" className="mt-2 w-full">
          {caption}
        </Text>
      </div>
    </Card>
  );
}
