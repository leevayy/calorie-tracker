import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../ui/utils";

const textVariants = cva("", {
  variants: {
    variant: {
      body: "text-foreground",
      muted: "text-muted-foreground",
      error: "text-destructive-ink",
      success: "text-success-ink",
      warning: "text-warning-ink",
      primary: "text-primary-ink",
    },
    size: {
      xs: "text-xs leading-4",
      sm: "text-sm leading-5",
      base: "text-base leading-6",
      lg: "text-lg leading-6",
      xl: "text-xl leading-7",
      "2xl": "text-2xl leading-8",
      "3xl": "text-3xl leading-9",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
  },
  defaultVariants: {
    variant: "body",
    size: "base",
    weight: "normal",
    align: "left",
  },
});

export type TextAs = "p" | "span" | "div" | "label" | "h1" | "h2" | "h3" | "h4" | "a";

type TextSize = NonNullable<VariantProps<typeof textVariants>["size"]>;
type TextWeight = NonNullable<VariantProps<typeof textVariants>["weight"]>;

const semanticTextDefaults: Partial<Record<TextAs, { size: TextSize; weight: TextWeight }>> = {
  h1: { size: "2xl", weight: "semibold" },
  h2: { size: "xl", weight: "semibold" },
  h3: { size: "lg", weight: "semibold" },
  h4: { size: "base", weight: "semibold" },
  label: { size: "sm", weight: "medium" },
};

export interface TextProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof textVariants> {
  as?: TextAs;
}

const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ className, variant, size, weight, align, as: Component = "p", ...props }, ref) => {
    const semanticDefaults = semanticTextDefaults[Component];
    return (
      <Component
        data-aero-component="text"
        className={cn(
          textVariants({
            variant,
            size: size ?? semanticDefaults?.size,
            weight: weight ?? semanticDefaults?.weight,
            align,
          }),
          className,
        )}
        ref={ref as React.Ref<never>}
        {...props}
      />
    );
  }
);
Text.displayName = "Text";

export { Text, textVariants };
