import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../ui/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:shadow-md active:scale-[0.98]",
        secondary:
          "bg-secondary text-secondary-foreground hover:shadow-sm active:scale-[0.98]",
        success:
          "bg-success text-success-foreground hover:shadow-md active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground hover:shadow-md active:scale-[0.98]",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
        ghost: "hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4",
        lg: "h-13 px-6",
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
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, state, loading, disabled, children, ...props }, ref) => {
    const buttonState = loading ? "loading" : disabled ? "disabled" : state || "initial";
    
    return (
      <button
        className={cn(
          buttonVariants({ variant, size, state: buttonState, className }),
          variant === "primary" && !disabled && !loading && "hover:bg-gradient-to-r hover:from-[#0284c7]/90 hover:to-[#0369a1]/90",
          variant === "secondary" && !disabled && !loading && "hover:bg-gradient-to-r hover:from-[#e2e8f0]/80 hover:to-[#cbd5e1]/80 dark:hover:from-[#334155]/80 dark:hover:to-[#475569]/80"
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };