import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { MacroGramTotals } from "@/utils/macroTotals";
import { DayMacrosLabels } from "./DayMacrosLabels";
import { Card } from "./ds/Card";
import { Text } from "./ds/Text";

interface CaloriePieChartProps {
  consumed: number;
  goal: number;
  /** Footer label under the chart row */
  caption?: string;
  /** When set, shown to the right of the pie (Б / Ж / У + grams) */
  macros?: MacroGramTotals | null;
}

export function CaloriePieChart({
  consumed,
  goal,
  caption = "Calories today",
  macros,
}: CaloriePieChartProps) {
  const remaining = Math.max(0, goal - consumed);
  const data = [
    { name: "Consumed", value: consumed },
    { name: "Remaining", value: remaining },
  ];

  const COLORS = ["#0ea5e9", "#e2e8f0"];

  return (
    <Card className="p-4">
      <div className={`flex gap-4 ${macros ? "flex-row items-center" : "flex-col items-center"}`}>
        <div
          className={
            macros
              ? "relative h-[140px] w-full min-w-0 max-w-[200px] shrink-0"
              : "relative h-[140px] w-full shrink-0"
          }
        >
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
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Text size="2xl" weight="semibold" className="leading-none">
              {consumed}
            </Text>
            <Text variant="muted" className="leading-none">
              / {goal}
            </Text>
          </div>
        </div>
        {macros ? (
          <div className="ml-auto shrink-0">
            <DayMacrosLabels totals={macros} />
          </div>
        ) : null}
      </div>
      <Text variant="muted" align="center" className="mt-2">
        {caption}
      </Text>
    </Card>
  );
}
