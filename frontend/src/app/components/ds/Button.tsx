import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../ui/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "relative inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.98] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        success: "bg-success text-success-foreground hover:bg-success-hover",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive-hover",
        outline:
          "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "h-11 px-3",
        md: "h-11 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
      state: {
        initial: "",
        loading: "opacity-80",
        error: "",
        success: "",
        disabled: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      state: "initial",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, state, loading, disabled, children, ...props }, ref) => {
    const buttonState = loading ? "loading" : disabled ? "disabled" : state || "initial";
    
    return (
      <button
        className={cn(buttonVariants({ variant, size, state: buttonState }), className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        data-state={buttonState}
        data-aero-component="button"
        data-variant={variant ?? "primary"}
        {...props}
      >
        {loading ? <Loader2 className="absolute h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        <span
          className={cn(
            "inline-flex items-center justify-center gap-2",
            loading && "opacity-0",
          )}
        >
          {children}
        </span>
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
