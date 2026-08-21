import type { FoodEntryResponse } from "@contracts/food-log";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { Fragment, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatLocalizedEnergy, formatLocalizedGrams } from "@/utils/localeFormat";
import { Text } from "./ds/Text";
import { cn } from "./ui/utils";

export interface DesktopPendingFood {
  id: string;
  label: string;
  phase: "parsing" | "saving" | "failed";
  errorLabel?: string;
  onRetry?: () => void;
  onEdit?: () => void;
  onClear?: () => void;
}

interface DesktopMealSectionProps {
  title: string;
  foods: FoodEntryResponse[];
  onAdd: () => void;
  onEdit: (food: FoodEntryResponse) => void;
  emptyLabel?: string;
  pendingFoods?: DesktopPendingFood[];
  renderEditor?: (food: FoodEntryResponse) => ReactNode;
}

const ledgerColumns = "grid-cols-[minmax(12rem,1fr)_4rem_repeat(4,3.25rem)]";

export function DesktopLedgerHeader() {
  const { t } = useTranslation();
  return (
    <div data-slot="desktop-ledger-header" className={cn("grid min-w-[36rem] items-center gap-2 px-3 py-1 text-xs text-muted-foreground", ledgerColumns)}>
      <span>{t("main.foodAndPortion")}</span>
      <span className="text-right">{t("history.calShort")}</span>
      <span className="text-right">{t("macros.proteinLetter")}</span>
      <span className="text-right">{t("macros.carbsLetter")}</span>
      <span className="text-right">{t("macros.fatsLetter")}</span>
      <span className="text-right">{t("macros.fiberLetter")}</span>
    </div>
  );
}

/** Desktop-only continuous ledger presentation. MainPage owns logging and editing behavior. */
export function DesktopMealSection({
  title,
  foods,
  onAdd,
  onEdit,
  emptyLabel,
  pendingFoods = [],
  renderEditor,
}: DesktopMealSectionProps) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const metric = (value: number) => formatLocalizedGrams(value, language);

  return (
    <section data-slot="desktop-meal-section" data-expanded={expanded || undefined} aria-label={title} className="space-y-1">
      <div data-slot="desktop-meal-header" className="flex min-h-11 items-center gap-2 rounded-xl bg-muted/40 px-3">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <Text as="h3" size="base" weight="semibold" className="truncate">
            {title}
          </Text>
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary-ink transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" />
          {t("main.addFood")}
        </button>
      </div>

      {expanded ? (
        <div data-slot="desktop-meal-table" role="table" aria-label={`${title} foods`} className="min-w-[36rem]">
          {pendingFoods.map((pending) => pending.phase === "failed" ? (
            <div
              role="row"
              data-state="failed"
              key={pending.id}
              className={cn(
                "grid min-h-11 items-center gap-2 rounded-lg bg-destructive/10 px-3 py-1.5",
                ledgerColumns,
              )}
            >
              <span role="cell" className="min-w-0 whitespace-pre-wrap break-words">
                {pending.label}
              </span>
              <span role="cell" className="col-span-5 flex min-w-0 items-center justify-end gap-1.5">
                <span role="alert" className="mr-1 min-w-0 truncate text-xs text-destructive">
                  {pending.errorLabel}
                </span>
                <button
                  type="button"
                  onClick={pending.onRetry}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("main.retrySubmission")}
                </button>
                <button
                  type="button"
                  onClick={pending.onEdit}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("main.editFailedSubmission")}
                </button>
                <button
                  type="button"
                  onClick={pending.onClear}
                  aria-label={t("main.clear")}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </div>
          ) : (
            <div
              role="row"
              data-state="pending"
              key={pending.id}
              aria-live="polite"
              className={cn("grid min-h-11 items-center gap-2 rounded-lg bg-muted/30 px-3", ledgerColumns)}
            >
              <span role="cell" className="flex min-w-0 items-center gap-2">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                <span className="truncate">{pending.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t(`main.pending.${pending.phase}`)}
                </span>
              </span>
              {[0, 1, 2, 3, 4].map((column) => <span role="cell" key={column} />)}
            </div>
          ))}

          {foods.map((food) => {
            const editor = renderEditor?.(food);
            return (
              <Fragment key={food.id}>
                <button
                  type="button"
                  role="row"
                  data-state="saved"
                  aria-expanded={editor ? true : undefined}
                  onClick={() => onEdit(food)}
                  className={cn(
                    "grid min-h-12 w-full items-center gap-2 rounded-lg px-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    ledgerColumns,
                  )}
                >
                  <span role="cell" className="min-w-0">
                    <span className="block truncate">{food.name}</span>
                    {food.portion ? <span className="block truncate text-xs text-muted-foreground">{food.portion}</span> : null}
                  </span>
                  <span role="cell" className="text-right tabular-nums">
                    {formatLocalizedEnergy(food.calories, language, t("history.calShort"))}
                  </span>
                  {[food.protein, food.carbs, food.fats, food.fiber].map((value, index) => (
                    <span role="cell" key={index} className="text-right tabular-nums">{metric(value)}</span>
                  ))}
                </button>
                {editor ? <div role="row"><div role="cell" className="px-1 pb-2">{editor}</div></div> : null}
              </Fragment>
            );
          })}

          {foods.length === 0 && pendingFoods.length === 0 && emptyLabel ? (
            <Text variant="muted" size="sm" className="px-3 py-2">
              {emptyLabel}
            </Text>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
