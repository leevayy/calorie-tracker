import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Card } from "./ds/Card";
import { Text } from "./ds/Text";
import { cn } from "./ui/utils";
import { motion, AnimatePresence } from "motion/react";
import { useIsMobile } from "./ui/use-mobile";

export interface MealFoodItem {
  id?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface MealSectionProps {
  title: string;
  foods: MealFoodItem[];
  onRemove: (food: MealFoodItem) => void;
  /** Shown when expanded and there are no foods */
  emptyLabel?: string;
  /** Disables remove actions (e.g. while a delete request is in flight) */
  removeDisabled?: boolean;
}

export function MealSection({ title, foods, onRemove, emptyLabel, removeDisabled }: MealSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const isMobile = useIsMobile();
  const [activeFoodKey, setActiveFoodKey] = useState<string | null>(null);

  const totalCalories = foods.reduce((sum, food) => sum + food.calories, 0);
  const totalProtein = foods.reduce((sum, food) => sum + food.protein, 0);
  const totalCarbs = foods.reduce((sum, food) => sum + food.carbs, 0);
  const totalFats = foods.reduce((sum, food) => sum + food.fats, 0);

  useEffect(() => {
    if (!expanded) setActiveFoodKey(null);
  }, [expanded]);

  useEffect(() => {
    // Only "tap to reveal" on mobile; on larger screens we rely on hover.
    if (!isMobile) setActiveFoodKey(null);
  }, [isMobile]);

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
              {totalCalories} cal • P: {totalProtein}g • C: {totalCarbs}g • F: {totalFats}g
            </Text>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

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
              {foods.map((food, idx) => {
                const foodKey = food.id ?? String(idx);

                return (
                  <div
                    key={food.id ?? idx}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 active:bg-accent/50 group"
                    role="button"
                    tabIndex={isMobile ? 0 : -1}
                    onClick={() => {
                      if (!isMobile) return;
                      setActiveFoodKey((prev) => (prev === foodKey ? null : foodKey));
                    }}
                    onKeyDown={(e) => {
                      if (!isMobile) return;
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      setActiveFoodKey((prev) => (prev === foodKey ? null : foodKey));
                    }}
                  >
                    <div className="flex-1">
                      <Text>{food.name}</Text>
                      <Text variant="muted">
                        {food.calories} cal • P: {food.protein}g • C: {food.carbs}g • F: {food.fats}g
                      </Text>
                    </div>
                    <button
                      type="button"
                      disabled={removeDisabled || !food.id}
                      data-active={isMobile && activeFoodKey === foodKey ? "true" : "false"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveFoodKey(null);
                        onRemove(food);
                      }}
                      className="p-1 rounded-full hover:bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 data-[active=true]:opacity-100 transition-opacity disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
