import { useTranslation } from "react-i18next";
import type { MacroGramTotals } from "@/utils/macroTotals";
import { formatMacroGrams } from "@/utils/macroTotals";
import { Text } from "./ds/Text";

type DayMacrosLabelsProps = {
  totals: MacroGramTotals;
  className?: string;
};

/** Compact Б / Ж / У (or localized letters) with gram values in two rows */
export function DayMacrosLabels({ totals, className }: DayMacrosLabelsProps) {
  const { t } = useTranslation();
  const labels = [t("macros.proteinLetter"), t("macros.fatsLetter"), t("macros.carbsLetter")] as const;
  const values = [totals.protein, totals.fats, totals.carbs].map(formatMacroGrams);

  return (
    <div className={className}>
      <div className="flex justify-between gap-4 tabular-nums">
        {labels.map((letter, i) => (
          <Text key={i} variant="muted" size="xs" className="min-w-[2rem] text-center">
            {letter}
          </Text>
        ))}
      </div>
      <div className="mt-0.5 flex justify-between gap-4 tabular-nums">
        {values.map((v, i) => (
          <Text key={i} size="sm" weight="medium" className="min-w-[2rem] text-center">
            {v}
          </Text>
        ))}
      </div>
    </div>
  );
}
