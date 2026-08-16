import type { MealType } from "@contracts/common";
import type { FoodEntryResponse, UpdateFoodEntryBody } from "@contracts/food-log";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PencilLine, Sparkles } from "lucide-react";
import { apiCorrectFoodEntry } from "@/api/aiFood";
import { errorMessageKey } from "@/api/errors";
import { Button } from "./ds/Button";
import { Input } from "./ds/Input";
import { Text } from "./ds/Text";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  foodEntryDraftFromEntry,
  parseFoodEntryDraft,
  type FoodEntryDraft,
  type FoodEntryDraftErrors,
  type FoodEntryDraftField,
} from "@/utils/foodEntryDraft";
import { coercePreferredLanguage } from "@/utils/preferredLanguage";
import {
  formatInlineCalendarDate,
  formatLocalizedEnergy,
  formatLocalizedGrams,
} from "@/utils/localeFormat";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const EMPTY_DRAFT: FoodEntryDraft = {
  name: "",
  portion: "",
  calories: "",
  protein: "",
  carbs: "",
  fats: "",
  fiber: "",
  day: "",
  mealType: "breakfast",
};

type FoodEntryEditorProps = {
  entry: FoodEntryResponse | null;
  busy: boolean;
  errorKey?: string;
  onClose: () => void;
  onSave: (entry: FoodEntryResponse, body: UpdateFoodEntryBody) => Promise<boolean>;
  onDelete: (entry: FoodEntryResponse) => Promise<boolean>;
};

type EditorMode = "ai" | "fields";

function formatDraftDay(day: string, language: string): string {
  if (!day) return "—";
  try {
    return formatInlineCalendarDate(day, language);
  } catch {
    return day;
  }
}

function previewDraftNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function formatDraftEnergy(value: string, language: string, localizedUnit: string): string {
  const number = previewDraftNumber(value);
  return number == null ? "—" : formatLocalizedEnergy(number, language, localizedUnit);
}

function formatDraftGrams(value: string, language: string): string {
  const number = previewDraftNumber(value);
  return number == null ? "—" : formatLocalizedGrams(number, language);
}

function draftFromUpdate(entry: FoodEntryResponse, update: UpdateFoodEntryBody): FoodEntryDraft {
  return {
    ...foodEntryDraftFromEntry({ ...entry, ...update }),
    // The correction response is a complete editable replacement. An omitted
    // optional portion therefore means "clear it", not "keep the old value".
    portion: update.portion ?? "",
  };
}

type EditorFieldProps = {
  field: FoodEntryDraftField;
  label: string;
  value: string;
  errors: FoodEntryDraftErrors;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date";
  inputMode?: "text" | "decimal";
};

function EditorField({
  field,
  label,
  value,
  errors,
  onChange,
  type = "text",
  inputMode,
}: EditorFieldProps) {
  const { t } = useTranslation();
  const inputId = `food-entry-${field}`;
  const error = errors[field];
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Text as="label" htmlFor={inputId} size="sm" weight="medium">
        {label}
      </Text>
      <Input
        id={inputId}
        type={type}
        inputMode={inputMode}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "any" : undefined}
        value={value}
        variant={error ? "error" : "default"}
        className={
          type === "date"
            ? "inline-flex h-11 max-h-11 min-w-0 appearance-none px-0 py-0 [-webkit-appearance:none] [&::-webkit-date-and-time-value]:box-border [&::-webkit-date-and-time-value]:h-[1.5em] [&::-webkit-date-and-time-value]:px-3 [&::-webkit-date-and-time-value]:text-left"
            : "min-w-0"
        }
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <Text id={`${inputId}-error`} variant="error" size="sm" role="alert">
          {t(error)}
        </Text>
      ) : null}
    </div>
  );
}

export function FoodEntryEditor({
  entry,
  busy,
  errorKey,
  onClose,
  onSave,
  onDelete,
}: FoodEntryEditorProps) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<FoodEntryDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<FoodEntryDraftErrors>({});
  const [mode, setMode] = useState<EditorMode>("ai");
  const [instruction, setInstruction] = useState("");
  const [correctionState, setCorrectionState] = useState<"initial" | "loading" | "success" | "error">(
    "initial",
  );
  const [correctionErrorKey, setCorrectionErrorKey] = useState("");
  const [hasProposal, setHasProposal] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setDraft(foodEntryDraftFromEntry(entry));
    setErrors({});
    setMode("ai");
    setInstruction("");
    setCorrectionState("initial");
    setCorrectionErrorKey("");
    setHasProposal(false);
    setDetailsOpen(false);
    setScheduleOpen(false);
  }, [entry]);

  const setField = <Field extends FoodEntryDraftField>(
    field: Field,
    value: FoodEntryDraft[Field],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!entry || busy || correctionState === "loading") return;
    const parsed = parseFoodEntryDraft(draft);
    if (!parsed.success) {
      setErrors(parsed.errors);
      const fieldErrors = parsed.errors;
      if (fieldErrors.protein || fieldErrors.carbs || fieldErrors.fats || fieldErrors.fiber) {
        setDetailsOpen(true);
      }
      if (fieldErrors.day || fieldErrors.mealType) setScheduleOpen(true);
      if (
        fieldErrors.name ||
        fieldErrors.portion ||
        fieldErrors.calories ||
        fieldErrors.protein ||
        fieldErrors.carbs ||
        fieldErrors.fats ||
        fieldErrors.fiber
      ) {
        setMode("fields");
      }
      return;
    }
    if (await onSave(entry, parsed.data)) onClose();
  };

  const handleDelete = async () => {
    if (!entry || busy || correctionState === "loading") return;
    if (await onDelete(entry)) onClose();
  };

  const handleCorrection = async () => {
    if (!entry || busy || correctionState === "loading") return;
    if (!instruction.trim()) {
      setCorrectionState("error");
      setCorrectionErrorKey("errors.correction_instruction_required");
      return;
    }

    setCorrectionState("loading");
    setCorrectionErrorKey("");
    try {
      const response = await apiCorrectFoodEntry(entry.id, {
        instruction,
        preferredLanguage: coercePreferredLanguage(i18n.language),
      });
      setDraft((current) => ({
        ...draftFromUpdate(entry, response.draft),
        // Date and meal are explicit UI scheduling choices. The correction
        // service works from the persisted entry and must not silently undo a
        // move the user selected before previewing the nutrition proposal.
        day: current.day,
        mealType: current.mealType,
      }));
      setErrors({});
      setHasProposal(true);
      setCorrectionState("success");
    } catch (error) {
      setCorrectionState("error");
      setCorrectionErrorKey(errorMessageKey(error));
    }
  };

  const handleInstructionKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void handleCorrection();
  };

  const editorBusy = busy || correctionState === "loading";
  const language = i18n.resolvedLanguage ?? i18n.language;

  return (
    <Dialog open={entry != null} onOpenChange={(open) => !open && !editorBusy && onClose()}>
      <DialogContent
        className="bottom-0 left-0 top-auto flex max-h-[calc(100dvh-max(0.5rem,env(safe-area-inset-top,0px)))] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-2xl p-0 sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 gap-1.5 px-4 pb-3 pt-4 pr-14 sm:px-5 sm:pb-4 sm:pt-5 sm:pr-14">
          <DialogTitle>
            {mode === "ai" ? t("entryEditor.aiTitle") : t("entryEditor.title")}
          </DialogTitle>
          <DialogDescription className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            {entry ? (
              <>
                <span className="min-w-0 truncate font-medium text-foreground">{entry.name}</span>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap tabular-nums">
                  {formatLocalizedEnergy(entry.calories, language, t("history.calShort"))}
                </span>
              </>
            ) : null}
          </DialogDescription>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-ml-3 mt-1 w-fit px-3 text-primary-ink hover:text-primary-ink"
            disabled={editorBusy}
            onClick={() => setMode((current) => (current === "ai" ? "fields" : "ai"))}
          >
            {mode === "ai" ? (
              <PencilLine className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {mode === "ai" ? t("entryEditor.editFields") : t("entryEditor.backToAi")}
          </Button>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-4 pb-4 sm:px-5">
            {mode === "ai" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Text as="label" htmlFor="food-entry-correction" size="sm" weight="medium">
                    {t("entryEditor.instruction")}
                  </Text>
                  <Input
                    id="food-entry-correction"
                    value={instruction}
                    placeholder={t("entryEditor.instructionPlaceholder")}
                    disabled={editorBusy}
                    aria-describedby={
                      correctionErrorKey ? "food-entry-correction-error" : undefined
                    }
                    onChange={(event) => {
                      setInstruction(event.target.value);
                      if (correctionErrorKey) setCorrectionErrorKey("");
                    }}
                    onKeyDown={handleInstructionKeyDown}
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  variant="secondary"
                  loading={correctionState === "loading"}
                  onClick={() => void handleCorrection()}
                >
                  {t("entryEditor.previewCorrection")}
                </Button>

                {correctionErrorKey ? (
                  <Text id="food-entry-correction-error" variant="error" role="alert">
                    {t(correctionErrorKey)}
                  </Text>
                ) : null}

                {hasProposal ? (
                  <div className="rounded-xl bg-secondary/45 p-3" aria-live="polite">
                    <Text size="xs" weight="medium" variant="muted">
                      {t("entryEditor.proposedResult")}
                    </Text>
                    <Text weight="medium" className="mt-0.5 break-words leading-snug">
                      {draft.name}
                    </Text>
                    <Text size="sm" className="tabular-nums">
                      {draft.portion || t("entryEditor.noPortion")} ·{" "}
                      {formatDraftEnergy(draft.calories, language, t("history.calShort"))}
                    </Text>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {([
                        ["protein", "macros.proteinLetter"],
                        ["carbs", "macros.carbsLetter"],
                        ["fats", "macros.fatsLetter"],
                        ["fiber", "macros.fiberLetter"],
                      ] as const).map(([field, labelKey]) => (
                        <Text
                          key={field}
                          as="span"
                          size="sm"
                          variant="muted"
                          className="whitespace-nowrap tabular-nums"
                        >
                          {t(labelKey)} {formatDraftGrams(draft[field], language)}
                        </Text>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <EditorField
                  field="name"
                  label={t("entryEditor.name")}
                  value={draft.name}
                  errors={errors}
                  onChange={(value) => setField("name", value)}
                />
                <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                  <EditorField
                    field="portion"
                    label={t("entryEditor.portion")}
                    value={draft.portion}
                    errors={errors}
                    onChange={(value) => setField("portion", value)}
                  />
                  <EditorField
                    field="calories"
                    label={t("entryEditor.calories")}
                    value={draft.calories}
                    errors={errors}
                    onChange={(value) => setField("calories", value)}
                    type="number"
                    inputMode="decimal"
                  />
                </div>

                <Accordion
                  type="single"
                  collapsible
                  value={detailsOpen ? "details" : ""}
                  onValueChange={(value) => setDetailsOpen(value === "details")}
                >
                  <AccordionItem value="details">
                    <AccordionTrigger>{t("entryEditor.details")}</AccordionTrigger>
                    <AccordionContent className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                      {(["protein", "carbs", "fats", "fiber"] as const).map((field) => (
                        <EditorField
                          key={field}
                          field={field}
                          label={t(`entryEditor.${field}`)}
                          value={draft[field]}
                          errors={errors}
                          onChange={(value) => setField(field, value)}
                          type="number"
                          inputMode="decimal"
                        />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}

            <Accordion
              type="single"
              collapsible
              value={scheduleOpen ? "schedule" : ""}
              onValueChange={(value) => setScheduleOpen(value === "schedule")}
            >
              <AccordionItem value="schedule">
                <AccordionTrigger
                  className="py-2"
                  aria-label={`${t("entryEditor.day")} · ${t("entryEditor.meal")}`}
                  aria-describedby="food-entry-schedule-summary"
                >
                  <span className="min-w-0 text-left">
                    <Text as="span" size="sm" weight="medium" className="block">
                      {t("entryEditor.day")} · {t("entryEditor.meal")}
                    </Text>
                    <Text
                      id="food-entry-schedule-summary"
                      as="span"
                      size="sm"
                      variant="muted"
                      className="block truncate font-normal"
                    >
                      {formatDraftDay(draft.day, language)} · {t(`meals.${draft.mealType}`)}
                    </Text>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="grid grid-cols-1 gap-3 pt-2 min-[360px]:grid-cols-2">
                  <EditorField
                    field="day"
                    label={t("entryEditor.day")}
                    value={draft.day}
                    errors={errors}
                    onChange={(value) => setField("day", value)}
                    type="date"
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <Text as="label" size="sm" weight="medium">
                      {t("entryEditor.meal")}
                    </Text>
                    <Select
                      value={draft.mealType}
                      onValueChange={(value) => setField("mealType", value as MealType)}
                    >
                      <SelectTrigger
                        aria-label={t("entryEditor.meal")}
                        className="data-[size=default]:h-11"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEAL_TYPES.map((mealType) => (
                          <SelectItem key={mealType} value={mealType}>
                            {t(`meals.${mealType}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {errorKey ? (
              <Text variant="error" role="alert">
                {t(errorKey)}
              </Text>
            ) : null}
          </div>

          <DialogFooter className="grid shrink-0 grid-cols-1 gap-2 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 min-[360px]:grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)] sm:justify-stretch sm:px-5 sm:pb-5">
            <Button
              type="button"
              variant="ghost"
              className="w-full text-destructive-ink hover:bg-destructive/10 hover:text-destructive-ink min-[360px]:w-auto"
              disabled={editorBusy}
              onClick={() => void handleDelete()}
            >
              {t("entryEditor.delete")}
            </Button>
            <Button
              type="submit"
              className="w-full"
              loading={busy}
              disabled={correctionState === "loading"}
            >
              {t("entryEditor.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
