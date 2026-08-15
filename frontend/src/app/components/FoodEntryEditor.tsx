import type { MealType } from "@contracts/common";
import type { FoodEntryResponse, UpdateFoodEntryBody } from "@contracts/food-log";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
    <div className="flex min-w-0 flex-col gap-1.5">
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

  useEffect(() => {
    if (!entry) return;
    setDraft(foodEntryDraftFromEntry(entry));
    setErrors({});
    setMode("ai");
    setInstruction("");
    setCorrectionState("initial");
    setCorrectionErrorKey("");
    setHasProposal(false);
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

  return (
    <Dialog open={entry != null} onOpenChange={(open) => !open && !editorBusy && onClose()}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("entryEditor.aiTitle")}</DialogTitle>
          <DialogDescription>{t("entryEditor.aiDescription")}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="flex items-center justify-between gap-3">
            <Text weight="medium">
              {mode === "ai" ? t("entryEditor.aiMode") : t("entryEditor.fieldsMode")}
            </Text>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={editorBusy}
              onClick={() => setMode((current) => (current === "ai" ? "fields" : "ai"))}
            >
              {mode === "ai" ? t("entryEditor.editFields") : t("entryEditor.backToAi")}
            </Button>
          </div>

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
                  aria-describedby={correctionErrorKey ? "food-entry-correction-error" : undefined}
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

              <div className="rounded-xl border border-border bg-secondary/30 p-3" aria-live="polite">
                <Text size="sm" variant="muted">
                  {hasProposal ? t("entryEditor.proposedResult") : t("entryEditor.currentResult")}
                </Text>
                <Text weight="medium">{draft.name}</Text>
                <Text size="sm" className="tabular-nums">
                  {draft.portion || t("entryEditor.noPortion")} · {draft.calories} {t("history.calShort")}
                </Text>
                <Text size="sm" variant="muted" className="tabular-nums">
                  {t("macros.proteinLetter")} {draft.protein} · {t("macros.carbsLetter")} {draft.carbs} · {t("macros.fatsLetter")} {draft.fats} · {t("macros.fiberLetter")} {draft.fiber}
                </Text>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <EditorField
                field="name"
                label={t("entryEditor.name")}
                value={draft.name}
                errors={errors}
                onChange={(value) => setField("name", value)}
              />
              <div className="grid grid-cols-2 gap-3">
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

              <Accordion type="single" collapsible>
                <AccordionItem value="details">
                  <AccordionTrigger>{t("entryEditor.details")}</AccordionTrigger>
                  <AccordionContent className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
            <EditorField
              field="day"
              label={t("entryEditor.day")}
              value={draft.day}
              errors={errors}
              onChange={(value) => setField("day", value)}
              type="date"
            />
            <div className="flex min-w-0 flex-col gap-1.5">
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
          </div>

          {errorKey ? (
            <Text variant="error" role="alert">
              {t(errorKey)}
            </Text>
          ) : null}

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              disabled={editorBusy}
              onClick={() => void handleDelete()}
            >
              {t("entryEditor.delete")}
            </Button>
            <Button type="submit" loading={busy} disabled={correctionState === "loading"}>
              {t("entryEditor.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
