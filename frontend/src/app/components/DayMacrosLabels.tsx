import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import type { MacroGramTotals } from "@/utils/macroTotals";
import { formatLocalizedGrams } from "@/utils/localeFormat";
import { cn } from "./ui/utils";
import { Text } from "./ds/Text";

type DayMacrosLabelsProps = {
  totals: MacroGramTotals;
  className?: string;
};

/**
 * Four compact rows share the fixed summary height supplied by the parent.
 */
export function DayMacrosLabels({ totals, className }: DayMacrosLabelsProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const rows = [
    { letter: t("macros.proteinLetter"), value: formatLocalizedGrams(totals.protein, language), grams: totals.protein },
    { letter: t("macros.fatsLetter"), value: formatLocalizedGrams(totals.fats, language), grams: totals.fats },
    { letter: t("macros.carbsLetter"), value: formatLocalizedGrams(totals.carbs, language), grams: totals.carbs },
    { letter: t("macros.fiberLetter"), value: formatLocalizedGrams(totals.fiber, language), grams: totals.fiber },
  ];

  return (
    <div
      data-slot="macro-liquid-meter"
      className={cn(
        "grid h-full w-full min-h-0 min-w-0 grid-rows-4",
        className,
      )}
    >
      {rows.map((row, i) => (
        <div
          key={i}
          data-slot="macro-liquid-row"
          style={{
            "--aero-liquid-level": `${Math.min(100, Math.max(12, row.grams))}%`,
          } as CSSProperties}
          className="flex min-h-0 min-w-0 items-center justify-between gap-2 px-1 tabular-nums"
        >
          <Text variant="muted" size="sm">
            {row.letter}
          </Text>
          <Text size="sm" weight="medium">
            {row.value}
          </Text>
        </div>
      ))}
    </div>
  );
}
