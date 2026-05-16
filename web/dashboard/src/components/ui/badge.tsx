import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        success: "bg-[var(--color-success-muted)] text-[var(--color-success)] border-[var(--color-success)]/30",
        warning: "bg-[var(--color-warning-muted)] text-[var(--color-warning)] border-[var(--color-warning)]/30",
        danger: "bg-[var(--color-danger-muted)] text-[var(--color-danger)] border-[var(--color-danger)]/30",
        info: "bg-[var(--color-info-muted)] text-[var(--color-info)] border-[var(--color-info)]/30",
        violet: "bg-[var(--color-violet-muted)] text-[var(--color-violet)] border-[var(--color-violet)]/30",
        accent: "bg-[var(--color-primary-muted)] text-[var(--color-primary)] border-[var(--color-primary-border)]",
        neutral: "bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, className }))} {...props} />;
}
