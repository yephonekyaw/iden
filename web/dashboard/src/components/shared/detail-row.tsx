import * as React from "react";
import { cn } from "@/lib/utils";

export function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[180px_1fr] items-center gap-4 py-3 border-b border-[var(--color-border-subtle)] last:border-0",
        className
      )}
    >
      <dt className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="text-sm text-[var(--color-text-primary)]">{children}</dd>
    </div>
  );
}
