import * as React from "react";
import { Link, type LinkProps } from "react-router";
import { cn } from "../ui/utils";
import { buttonVariants, type ButtonProps } from "./Button";

interface LinkButtonProps extends LinkProps, Pick<ButtonProps, "variant" | "size"> {
  className?: string;
}

const LinkButton = React.forwardRef<HTMLAnchorElement, LinkButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <Link
        ref={ref}
        className={cn(
          buttonVariants({ variant, size, className }),
          variant === "primary" && "hover:bg-gradient-to-b hover:from-[#0284c7] hover:to-[#0369a1]",
          variant === "secondary" && "hover:bg-gradient-to-b hover:from-[#e2e8f0] hover:to-[#cbd5e1] dark:hover:from-[#334155] dark:hover:to-[#475569]"
        )}
        {...props}
      />
    );
  }
);
LinkButton.displayName = "LinkButton";

export { LinkButton };
