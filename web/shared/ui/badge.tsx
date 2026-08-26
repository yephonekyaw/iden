import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn";

const badge = cva(
  [
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 whitespace-nowrap",
    // Badges sit inside serif headings; the face is the badge's own.
    "font-sans text-caption tabular-nums",
  ],
  {
    variants: {
      tone: {
        neutral: "bg-surface-card text-body-strong",
        outline: "border border-hairline text-muted",
        // DESIGN.md: coral is scarce. One coral badge per view, and only when
        // the thing it marks is genuinely the exception on the page.
        coral: "bg-primary text-on-primary text-caption-upper uppercase",
        error: "bg-error/10 text-error",
        onDark: "bg-surface-dark-elevated text-on-dark-soft",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badge>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

/**
 * A state that is either on or off — enabled, active, revoked, expired. The dot
 * carries the colour so the label stays readable type rather than a coloured
 * pill people have to decode.
 */
export function StatusDot({
  tone,
  label,
  className,
}: {
  tone: "success" | "muted" | "error" | "warning";
  label: string;
  className?: string;
}) {
  const colour = {
    success: "bg-success",
    muted: "bg-muted-soft",
    error: "bg-error",
    warning: "bg-warning",
  }[tone];

  return (
    <span className={cn("inline-flex items-center gap-2 text-body-sm text-body", className)}>
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colour)} />
      {label}
    </span>
  );
}
