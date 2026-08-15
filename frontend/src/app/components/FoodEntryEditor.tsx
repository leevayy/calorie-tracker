import type { MealType } from "@contracts/common";
import type { FoodEntryResponse, UpdateFoodEntryBody } from "@contracts/food-log";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
    <div className="flex flex-col gap-1.5">
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
  const { t } = useTranslation();
  const [draft, setDraft] = useState<FoodEntryDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<FoodEntryDraftErrors>({});

  useEffect(() => {
    if (!entry) return;
    setDraft(foodEntryDraftFromEntry(entry));
    setErrors({});
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
    if (!entry || busy) return;
    const parsed = parseFoodEntryDraft(draft);
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }
    if (await onSave(entry, parsed.data)) onClose();
  };

  const handleDelete = async () => {
    if (!entry || busy) return;
    if (await onDelete(entry)) onClose();
  };

  return (
    <Dialog open={entry != null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("entryEditor.title")}</DialogTitle>
          <DialogDescription>{t("entryEditor.description")}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
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

          <div className="grid grid-cols-2 gap-3">
            <EditorField
              field="day"
              label={t("entryEditor.day")}
              value={draft.day}
              errors={errors}
              onChange={(value) => setField("day", value)}
              type="date"
            />
            <div className="flex flex-col gap-1.5">
              <Text as="label" size="sm" weight="medium">
                {t("entryEditor.meal")}
              </Text>
              <Select
                value={draft.mealType}
                onValueChange={(value) => setField("mealType", value as MealType)}
              >
                <SelectTrigger aria-label={t("entryEditor.meal")}>
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

          {errorKey ? (
            <Text variant="error" role="alert">
              {t(errorKey)}
            </Text>
          ) : null}

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void handleDelete()}
            >
              {t("entryEditor.delete")}
            </Button>
            <Button type="submit" loading={busy}>
              {t("entryEditor.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
