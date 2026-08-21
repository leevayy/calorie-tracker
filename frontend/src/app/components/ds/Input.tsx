import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../ui/utils";

const inputVariants = cva(
  "flex min-h-11 w-full rounded-[var(--radius)] border border-input bg-input-background px-3 py-2 text-base text-foreground transition-colors file:border-0 file:bg-transparent file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        error: "border-destructive focus-visible:ring-destructive",
        success: "border-success focus-visible:ring-success",
      },
      size: {
        sm: "h-11",
        md: "h-11",
        lg: "h-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, size }), className)}
        ref={ref}
        data-aero-component="input"
        data-variant={variant ?? "default"}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
