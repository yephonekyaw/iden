import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-button font-medium transition-colors duration-100 disabled:pointer-events-none disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        // The coral is scarce on individual elements: one primary per view.
        primary:
          "bg-primary text-on-primary hover:bg-primary-active disabled:bg-primary-disabled disabled:text-muted",
        secondary:
          "border border-hairline bg-canvas text-ink hover:bg-surface-soft disabled:text-muted-soft",
        // DESIGN.md: the system never inverts to a light secondary on dark.
        onDark:
          "bg-surface-dark-elevated text-on-dark hover:bg-surface-dark-soft disabled:text-on-dark-soft",
        ghost: "text-ink hover:bg-surface-soft disabled:text-muted-soft",
        danger: "bg-error text-on-primary hover:brightness-90 disabled:bg-primary-disabled",
      },
      size: {
        md: "h-control px-5",
        sm: "h-8 px-3",
        icon: "h-9 w-9 rounded-full",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof button> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(button({ variant, size }), className)} {...props} />;
}
