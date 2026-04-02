import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card } from "./ds/Card";

interface CaloriePieChartProps {
  consumed: number;
  goal: number;
  /** Footer label under the chart */
  caption?: string;
}

export function CaloriePieChart({ consumed, goal, caption = "Calories today" }: CaloriePieChartProps) {
  const remaining = Math.max(0, goal - consumed);
  const data = [
    { name: "Consumed", value: consumed },
    { name: "Remaining", value: remaining },
  ];

  const COLORS = ["#0ea5e9", "#e2e8f0"];

  return (
    <Card className="p-4 flex flex-col">
      <div className="relative flex-1 min-h-[140px]">
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
          <p className="text-2xl font-semibold">{consumed}</p>
          <p className="text-xs text-muted-foreground">/ {goal}</p>
        </div>
      </div>
      <p className="text-xs text-center text-muted-foreground mt-2">{caption}</p>
    </Card>
  );
}
