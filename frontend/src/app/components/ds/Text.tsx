import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../ui/utils";

const textVariants = cva("leading-normal", {
  variants: {
    variant: {
      body: "text-foreground",
      muted: "text-muted-foreground",
      error: "text-destructive",
      success: "text-success",
      warning: "text-warning",
      primary: "text-primary",
    },
    size: {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-2xl",
      "3xl": "text-3xl",
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

export interface TextProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof textVariants> {
  as?: TextAs;
}

const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ className, variant, size, weight, align, as: Component = "p", ...props }, ref) => {
    return (
      <Component
        className={cn(textVariants({ variant, size, weight, align }), className)}
        ref={ref as React.Ref<never>}
        {...props}
      />
    );
  }
);
Text.displayName = "Text";

export { Text, textVariants };
