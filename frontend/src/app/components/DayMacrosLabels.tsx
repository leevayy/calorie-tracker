import { useTranslation } from "react-i18next";
import type { MacroGramTotals } from "@/utils/macroTotals";
import { formatMacroGrams } from "@/utils/macroTotals";
import { cn } from "./ui/utils";
import { Text } from "./ds/Text";

type DayMacrosLabelsProps = {
  totals: MacroGramTotals;
  className?: string;
};

/**
 * Три строки Б/Ж/У в фиксированном блоке (родитель задаёт размер, напр. 140×140).
 * Сетка `grid-rows-3` и разделители — как у таблицы.
 */
export function DayMacrosLabels({ totals, className }: DayMacrosLabelsProps) {
  const { t } = useTranslation();
  const rows = [
    { letter: t("macros.proteinLetter"), value: formatMacroGrams(totals.protein) },
    { letter: t("macros.fatsLetter"), value: formatMacroGrams(totals.fats) },
    { letter: t("macros.carbsLetter"), value: formatMacroGrams(totals.carbs) },
  ];

  return (
    <div
      className={cn(
        "grid h-full w-full min-h-0 min-w-0 grid-rows-3 divide-y divide-border/60",
        className,
      )}
    >
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex min-h-0 min-w-0 items-center justify-between gap-2 px-0.5 tabular-nums"
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
