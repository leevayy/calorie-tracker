import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../ui/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full font-medium leading-none",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary-ink",
        secondary: "bg-secondary text-secondary-foreground",
        success: "bg-success/15 text-success-ink",
        destructive: "bg-destructive/15 text-destructive-ink",
        warning: "bg-warning/15 text-warning-ink",
        outline: "border border-input bg-background",
      },
      size: {
        sm: "px-2.5 py-0.5 text-xs min-h-[1.25rem]",
        md: "px-3 py-1 text-sm min-h-[1.75rem]",
        lg: "px-3.5 py-1.5 text-base min-h-[2.25rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

/** `size` is both a CVA variant and a valid DOM prop on some elements — omit DOM `size` so TS merges cleanly. */
export type BadgeProps = Omit<React.ComponentProps<"div">, "size"> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
