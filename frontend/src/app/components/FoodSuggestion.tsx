import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ParsedFoodSuggestion } from "@contracts/ai-food";
import { Badge } from "./ds/Badge";
import { Card } from "./ds/Card";
import { Button } from "./ds/Button";
import { Text } from "./ds/Text";
import { formatLocalizedEnergy, formatLocalizedGrams } from "@/utils/localeFormat";

function confidenceBadgeVariant(c: number): "success" | "warning" | "secondary" {
  if (c >= 0.72) return "success";
  if (c >= 0.42) return "warning";
  return "secondary";
}

interface FoodSuggestionProps {
  food: ParsedFoodSuggestion;
  onAccept?: () => void;
  onReject?: () => void;
}

export function FoodSuggestion({ food, onAccept, onReject }: FoodSuggestionProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const macroLine = [
    `${t("macros.proteinLetter")}: ${formatLocalizedGrams(food.protein, language)}`,
    `${t("macros.carbsLetter")}: ${formatLocalizedGrams(food.carbs, language)}`,
    `${t("macros.fatsLetter")}: ${formatLocalizedGrams(food.fats, language)}`,
    `${t("macros.fiberLetter")}: ${formatLocalizedGrams(food.fiber, language)}`,
  ].join(" • ");
  const conf =
    typeof food.confidence === "number" && Number.isFinite(food.confidence)
      ? Math.min(1, Math.max(0, food.confidence))
      : null;
  const pct = conf !== null ? Math.round(conf * 100) : null;

  return (
    <Card data-slot="food-suggestion" className="aero-food-suggestion bg-muted/20 px-0 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <Text weight="medium">{food.name}</Text>
          {conf !== null && pct !== null ? (
            <Badge variant={confidenceBadgeVariant(conf)} size="lg" className="mt-1.5">
              <Text as="span" size="sm" weight="medium" className="text-inherit tabular-nums">
                {t("main.aiConfidence", { pct })}
              </Text>
            </Badge>
          ) : null}
          <Text variant="muted" className="mt-1">
            {food.portion} •{" "}
            {formatLocalizedEnergy(food.calories, language, t("history.calShort"))}
          </Text>
          <Text variant="muted">
            {macroLine}
          </Text>
        </div>
        {onAccept || onReject ? (
          <div className="flex gap-2 shrink-0">
            {onReject ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onReject}
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
            {onAccept ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onAccept}
                className="h-8 w-8 text-success hover:bg-success/10"
              >
                <Check className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
