import type { MealType } from "@contracts/common";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "./ds/Input";
import { Text } from "./ds/Text";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export type ScheduleInputValue = {
  day: string;
  mealType: MealType;
};

export type ScheduleInputErrors = Partial<Record<keyof ScheduleInputValue, string>>;

export type DateInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
};

export function DateInput({
  value,
  onChange,
  disabled = false,
  error,
}: DateInputProps) {
  const { t } = useTranslation();
  const id = `${useId()}-day`;
  const errorId = `${id}-error`;

  return (
    <div data-slot="date-input" className="flex min-w-0 flex-col gap-1">
      <Text as="label" htmlFor={id} size="sm" weight="medium">
        {t("entryEditor.day")}
      </Text>
      <Input
        id={id}
        type="date"
        value={value}
        required
        disabled={disabled}
        variant={error ? "error" : "default"}
        className="inline-flex h-11 max-h-11 min-w-0 appearance-none px-0 py-0 [-webkit-appearance:none] [&::-webkit-date-and-time-value]:box-border [&::-webkit-date-and-time-value]:h-[1.5em] [&::-webkit-date-and-time-value]:px-3 [&::-webkit-date-and-time-value]:text-left"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <Text id={errorId} variant="error" size="sm" role="alert">
          {t(error)}
        </Text>
      ) : null}
    </div>
  );
}

export type MealInputProps = {
  value: MealType;
  onChange: (value: MealType) => void;
  disabled?: boolean;
  error?: string;
};

export function MealInput({
  value,
  onChange,
  disabled = false,
  error,
}: MealInputProps) {
  const { t } = useTranslation();
  const id = `${useId()}-meal`;
  const errorId = `${id}-error`;

  return (
    <div data-slot="meal-input" className="flex min-w-0 flex-col gap-1">
      <Text as="label" htmlFor={id} size="sm" weight="medium">
        {t("entryEditor.meal")}
      </Text>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(next as MealType)}
      >
        <SelectTrigger
          id={id}
          aria-label={t("entryEditor.meal")}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="min-h-11 min-w-0 whitespace-normal text-left data-[size=default]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal *:data-[slot=select-value]:break-words"
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
      {error ? (
        <Text id={errorId} variant="error" size="sm" role="alert">
          {t(error)}
        </Text>
      ) : null}
    </div>
  );
}

export type ScheduleInputsProps = {
  value: ScheduleInputValue;
  onChange: (value: ScheduleInputValue) => void;
  disabled?: boolean;
  errors?: ScheduleInputErrors;
};

export function ScheduleInputs({
  value,
  onChange,
  disabled = false,
  errors = {},
}: ScheduleInputsProps) {
  return (
    <div data-slot="schedule-inputs" className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2">
      <DateInput
        value={value.day}
        onChange={(day) => onChange({ ...value, day })}
        disabled={disabled}
        error={errors.day}
      />
      <MealInput
        value={value.mealType}
        onChange={(mealType) => onChange({ ...value, mealType })}
        disabled={disabled}
        error={errors.mealType}
      />
    </div>
  );
}
