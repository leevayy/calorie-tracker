import type { FoodEntryResponse } from "@contracts/food-log";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Card } from "./ds/Card";
import { Text } from "./ds/Text";
import { cn } from "./ui/utils";
import { motion, AnimatePresence } from "motion/react";

interface MealSectionProps {
  title: string;
  foods: FoodEntryResponse[];
  onEdit: (food: FoodEntryResponse) => void;
  /** Shown when expanded and there are no foods */
  emptyLabel?: string;
  pendingFoods?: Array<{
    id: string;
    label: string;
    phase: "parsing" | "saving";
  }>;
}

export function MealSection({
  title,
  foods,
  onEdit,
  emptyLabel,
  pendingFoods = [],
}: MealSectionProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const totalCalories = foods.reduce((sum, food) => sum + food.calories, 0);
  const totalProtein = foods.reduce((sum, food) => sum + food.protein, 0);
  const totalCarbs = foods.reduce((sum, food) => sum + food.carbs, 0);
  const totalFats = foods.reduce((sum, food) => sum + food.fats, 0);
  const totalFiber = foods.reduce((sum, food) => sum + food.fiber, 0);

  const macroLine = (p: number, c: number, f: number, fb: number) =>
    `${t("macros.proteinLetter")}: ${p}g • ${t("macros.carbsLetter")}: ${c}g • ${t("macros.fatsLetter")}: ${f}g • ${t("macros.fiberLetter")}: ${fb}g`;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-colors",
        !expanded && "hover:bg-muted/55",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-0 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          expanded && "transition-colors hover:bg-muted/40",
        )}
      >
        <div className="flex items-center gap-3">
          <div>
            <Text as="h3" align="left" weight="medium">
              {title}
            </Text>
            <Text variant="muted">
              {totalCalories} cal • {macroLine(totalProtein, totalCarbs, totalFats, totalFiber)}
            </Text>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {pendingFoods.length > 0 ? (
        <div className="space-y-1 border-t border-border/50 py-2" aria-live="polite">
          {pendingFoods.map((pending) => (
            <div
              key={pending.id}
              className="flex min-h-9 items-center gap-2 rounded-lg bg-muted/40 px-2"
            >
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              <Text as="span" className="min-w-0 flex-1 truncate">
                {pending.label}
              </Text>
              <Text as="span" variant="muted" size="sm" className="shrink-0">
                {t(`main.pending.${pending.phase}`)}
              </Text>
            </div>
          ))}
        </div>
      ) : null}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/50"
          >
            <div className="space-y-2 px-0 pb-4 pt-3">
              {foods.length === 0 && emptyLabel ? (
                <Text variant="muted" className="py-2">
                  {emptyLabel}
                </Text>
              ) : null}
              {foods.map((food) => (
                  <button
                    type="button"
                    key={food.id}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-accent/50 active:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onEdit(food)}
                  >
                    <div className="flex-1">
                      <Text>{food.name}</Text>
                      <Text variant="muted">
                        {food.calories} cal • {macroLine(food.protein, food.carbs, food.fats, food.fiber)}
                      </Text>
                    </div>
                  </button>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
