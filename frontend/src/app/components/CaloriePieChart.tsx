import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "./ui/utils";
import { Card } from "./ds/Card";
import { Text } from "./ds/Text";

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
  const remaining = Math.max(0, goal - consumed);
  const data = [
    { name: "Consumed", value: consumed },
    { name: "Remaining", value: remaining },
  ];

  const COLORS = ["#0ea5e9", "#e2e8f0"];

  return (
    <Card className={cn("flex h-full flex-col p-4", className)}>
      <div className="flex w-full flex-1 flex-col items-center justify-center">
        <div className="relative h-[140px] w-full shrink-0">
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
        <Text variant="muted" align="center" className="mt-2 w-full">
          {caption}
        </Text>
      </div>
    </Card>
  );
}
