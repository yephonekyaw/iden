import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "./cn";

/**
 * shadcn's Button, with the four places DESIGN.md is explicit changed and
 * nothing else:
 *
 * - **Height.** Controls are 40px (`--spacing-control`), not shadcn's 36.
 * - **Disabled.** DESIGN.md gives the disabled primary its own fill rather than
 *   dimming the live one, so `opacity-50` is replaced per variant.
 * - **Transition.** Colour only, 100ms — the system encodes a press state and
 *   nothing else.
 * - **`onDark`.** A variant shadcn has no equivalent for: DESIGN.md's secondary
 *   on a dark surface stays dark, because the system never inverts to a light
 *   secondary on dark.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-button font-medium whitespace-nowrap transition-colors duration-100 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // The coral is scarce on individual elements: one primary per view.
        default:
          "bg-primary text-primary-foreground hover:bg-primary-active disabled:bg-primary-disabled disabled:text-muted-foreground",
        destructive:
          "bg-destructive text-primary-foreground hover:brightness-90 disabled:bg-primary-disabled disabled:text-muted-foreground",
        outline:
          "border border-border bg-background text-foreground hover:bg-secondary disabled:text-muted-soft",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-surface-card disabled:text-muted-soft",
        ghost: "text-foreground hover:bg-secondary disabled:text-muted-soft",
        onDark:
          "bg-surface-dark-elevated text-on-dark hover:bg-surface-dark-soft disabled:text-on-dark-soft",
        link: "text-primary underline-offset-4 hover:underline disabled:text-muted-soft",
      },
      size: {
        default: "h-control px-5",
        sm: "h-8 px-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-6",
        // DESIGN.md's button-icon-circular: 36px, round, hairline.
        icon: "size-9 rounded-full",
        "icon-sm": "size-8 rounded-full [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export type ButtonProps = React.ComponentProps<typeof Button>;
export { Button, buttonVariants };
