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
          buttonVariants({ variant, size }),
          className,
        )}
        {...props}
      />
    );
  }
);
LinkButton.displayName = "LinkButton";

export { LinkButton };
