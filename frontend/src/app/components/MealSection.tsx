import type { FoodEntryResponse } from "@contracts/food-log";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Card } from "./ds/Card";
import { Text } from "./ds/Text";
import { cn } from "./ui/utils";
import { motion, AnimatePresence } from "motion/react";
import { formatLocalizedEnergy, formatLocalizedGrams } from "@/utils/localeFormat";

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
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const totalCalories = foods.reduce((sum, food) => sum + food.calories, 0);
  const totalProtein = foods.reduce((sum, food) => sum + food.protein, 0);
  const totalCarbs = foods.reduce((sum, food) => sum + food.carbs, 0);
  const totalFats = foods.reduce((sum, food) => sum + food.fats, 0);
  const totalFiber = foods.reduce((sum, food) => sum + food.fiber, 0);

  const macroLine = (p: number, c: number, f: number, fb: number) =>
    [
      `${t("macros.proteinLetter")}: ${formatLocalizedGrams(p, language)}`,
      `${t("macros.carbsLetter")}: ${formatLocalizedGrams(c, language)}`,
      `${t("macros.fatsLetter")}: ${formatLocalizedGrams(f, language)}`,
      `${t("macros.fiberLetter")}: ${formatLocalizedGrams(fb, language)}`,
    ].join(" • ");

  return (
    <Card
      data-slot="mobile-meal-section"
      data-expanded={expanded || undefined}
      className={cn(
        "overflow-hidden rounded-xl transition-colors",
        !expanded && "hover:bg-muted/45",
      )}
    >
      <button
        data-slot="meal-section-trigger"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          expanded && "transition-colors hover:bg-muted/40",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div>
            <Text as="h3" align="left" weight="medium">
              {title}
            </Text>
            <Text variant="muted">
              {formatLocalizedEnergy(totalCalories, language, t("history.calShort"))} •{" "}
              {macroLine(totalProtein, totalCarbs, totalFats, totalFiber)}
            </Text>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {pendingFoods.length > 0 ? (
        <div data-slot="meal-pending-list" className="mx-2 space-y-1 rounded-xl bg-muted/30 p-2" aria-live="polite">
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
            data-slot="meal-food-list"
            className="mx-2 overflow-hidden rounded-xl bg-muted/25"
          >
            <div className="space-y-1 p-2">
              {foods.length === 0 && emptyLabel ? (
                <Text variant="muted" className="py-2">
                  {emptyLabel}
                </Text>
              ) : null}
              {foods.map((food) => (
                  <button
                    type="button"
                    key={food.id}
                    className="flex min-h-11 w-full items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-accent/50 active:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onEdit(food)}
                  >
                    <div className="flex-1">
                      <Text>{food.name}</Text>
                      <Text variant="muted">
                        {formatLocalizedEnergy(
                          food.calories,
                          language,
                          t("history.calShort"),
                        )} • {macroLine(food.protein, food.carbs, food.fats, food.fiber)}
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
