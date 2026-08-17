import type { FoodEntryResponse, UpdateFoodEntryBody } from "@contracts/food-log";
import type { FormEvent } from "react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiCorrectFoodEntry } from "@/api/aiFood";
import { errorMessageKey } from "@/api/errors";
import {
  foodEntryDraftFromEntry,
  parseFoodEntryDraft,
  type FoodEntryDraft,
  type FoodEntryDraftErrors,
  type FoodEntryDraftField,
} from "@/utils/foodEntryDraft";
import { coercePreferredLanguage } from "@/utils/preferredLanguage";
import { Button } from "./ds/Button";
import { Input } from "./ds/Input";
import { Text } from "./ds/Text";
import { ScheduleInputs, type ScheduleInputValue } from "./ScheduleInputs";

type DesktopFoodEntryEditorProps = {
  entry: FoodEntryResponse;
  busy: boolean;
  errorKey?: string;
  onClose: () => void;
  onSave: (entry: FoodEntryResponse, body: UpdateFoodEntryBody) => Promise<boolean>;
  onDelete: (entry: FoodEntryResponse) => Promise<boolean>;
};

type InlineFieldProps = {
  idPrefix: string;
  field: FoodEntryDraftField;
  label: string;
  value: string;
  errors: FoodEntryDraftErrors;
  onChange: (value: string) => void;
  type?: "text" | "number";
};

function InlineField({ idPrefix, field, label, value, errors, onChange, type = "text" }: InlineFieldProps) {
  const { t } = useTranslation();
  const id = `${idPrefix}-${field}`;
  const error = errors[field];
  return (
    <div className="min-w-0 space-y-1">
      <Text as="label" htmlFor={id} size="xs" weight="medium">{label}</Text>
      <Input
        id={id}
        value={value}
        type={type}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "any" : undefined}
        inputMode={type === "number" ? "decimal" : undefined}
        variant={error ? "error" : "default"}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <Text id={`${id}-error`} size="xs" variant="error" role="alert">{t(error)}</Text> : null}
    </div>
  );
}

/** Desktop-only editor embedded directly after the selected ledger row. */
export function DesktopFoodEntryEditor({ entry, busy, errorKey, onClose, onSave, onDelete }: DesktopFoodEntryEditorProps) {
  const { t, i18n } = useTranslation();
  const idPrefix = `desktop-food-entry-${useId().replaceAll(":", "")}`;
  const [draft, setDraft] = useState<FoodEntryDraft>(() => foodEntryDraftFromEntry(entry));
  const [errors, setErrors] = useState<FoodEntryDraftErrors>({});
  const [instruction, setInstruction] = useState("");
  const [correctionErrorKey, setCorrectionErrorKey] = useState("");
  const [correctionLoading, setCorrectionLoading] = useState(false);

  useEffect(() => {
    setDraft(foodEntryDraftFromEntry(entry));
    setErrors({});
    setInstruction("");
    setCorrectionErrorKey("");
    setCorrectionLoading(false);
  }, [entry]);

  const setField = <Field extends FoodEntryDraftField>(field: Field, value: FoodEntryDraft[Field]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const setSchedule = (schedule: ScheduleInputValue) => {
    setDraft((current) => ({ ...current, ...schedule }));
    setErrors((current) => {
      if (!current.day && !current.mealType) return current;
      const next = { ...current };
      delete next.day;
      delete next.mealType;
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || correctionLoading) return;
    const normalizedInstruction = instruction.trim();
    if (normalizedInstruction) {
      setCorrectionLoading(true);
      setCorrectionErrorKey("");
      try {
        // The correction API reads the persisted entry by id. Do not send the
        // editable draft: when both paths contain changes, the AI path wins.
        const response = await apiCorrectFoodEntry(entry.id, {
          instruction: normalizedInstruction,
          preferredLanguage: coercePreferredLanguage(i18n.language),
        });
        if (await onSave(entry, response.draft)) onClose();
      } catch (error) {
        // Preserve both inputs so the user can retry or clear AI and save manually.
        setCorrectionErrorKey(errorMessageKey(error));
      } finally {
        setCorrectionLoading(false);
      }
      return;
    }

    const parsed = parseFoodEntryDraft(draft);
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }
    if (await onSave(entry, parsed.data)) onClose();
  };

  const handleDelete = async () => {
    if (busy || correctionLoading) return;
    if (await onDelete(entry)) onClose();
  };

  const editorBusy = busy || correctionLoading;
  const actionErrorKey = correctionErrorKey || errorKey;

  return (
    <form
      aria-label={t("entryEditor.editEntry", { name: entry.name, defaultValue: `Edit ${entry.name}` })}
      className="rounded-xl bg-muted/35 p-3"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
    >
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <Text as="label" htmlFor={`${idPrefix}-instruction`} size="xs" weight="medium">{t("entryEditor.instruction")}</Text>
            {instruction ? (
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                disabled={editorBusy}
                onClick={() => { setInstruction(""); setCorrectionErrorKey(""); }}
              >
                {t("entryEditor.clearInstruction", { defaultValue: "Clear instruction" })}
              </button>
            ) : null}
          </div>
          <Input
            id={`${idPrefix}-instruction`}
            value={instruction}
            placeholder={t("entryEditor.instructionPlaceholder")}
            disabled={editorBusy}
            aria-describedby={actionErrorKey ? `${idPrefix}-action-error` : undefined}
            onChange={(event) => { setInstruction(event.target.value); if (correctionErrorKey) setCorrectionErrorKey(""); }}
          />
        </div>

        <div className="col-span-6"><InlineField idPrefix={idPrefix} field="name" label={t("entryEditor.name")} value={draft.name} errors={errors} onChange={(value) => setField("name", value)} /></div>
        <div className="col-span-3"><InlineField idPrefix={idPrefix} field="portion" label={t("entryEditor.portion")} value={draft.portion} errors={errors} onChange={(value) => setField("portion", value)} /></div>
        <div className="col-span-3"><InlineField idPrefix={idPrefix} field="calories" label={t("entryEditor.calories")} value={draft.calories} errors={errors} onChange={(value) => setField("calories", value)} type="number" /></div>

        {(["protein", "carbs", "fats", "fiber"] as const).map((field) => (
          <div key={field} className="col-span-2"><InlineField idPrefix={idPrefix} field={field} label={t(`entryEditor.${field}`)} value={draft[field]} errors={errors} onChange={(value) => setField(field, value)} type="number" /></div>
        ))}
        <div className="col-span-4">
          <ScheduleInputs value={{ day: draft.day, mealType: draft.mealType }} onChange={setSchedule} disabled={editorBusy} errors={{ day: errors.day, mealType: errors.mealType }} />
        </div>
      </div>

      <div className="mt-3 flex min-h-11 items-center gap-2">
        <div className="min-w-0 flex-1">
          {actionErrorKey ? <Text id={`${idPrefix}-action-error`} variant="error" size="sm" role="alert">{t(actionErrorKey)}</Text> : null}
        </div>
        <Button type="button" size="sm" variant="ghost" disabled={editorBusy} onClick={onClose}>{t("common.cancel", { defaultValue: "Cancel" })}</Button>
        <Button type="button" size="sm" variant="ghost" className="text-destructive-ink hover:bg-destructive/10 hover:text-destructive-ink" disabled={editorBusy} onClick={() => void handleDelete()}>{t("entryEditor.delete")}</Button>
        <Button type="submit" size="sm" loading={editorBusy}>
          {instruction.trim() ? t("entryEditor.sendAndSave", { defaultValue: "Send & save" }) : t("entryEditor.save")}
        </Button>
      </div>
    </form>
  );
}
