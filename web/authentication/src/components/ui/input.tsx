"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  startIcon?: React.ReactNode;
  endSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, startIcon, endSlot, ...props }, ref) => {
    if (!startIcon && !endSlot) {
      return (
        <input
          ref={ref}
          className={cn(
            "flex h-11 w-full rounded-md bg-[var(--color-surface-sunken)] border px-3 py-2 text-sm",
            "placeholder:text-[var(--color-text-tertiary)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 focus:border-[var(--color-primary)]/60",
            "disabled:cursor-not-allowed disabled:opacity-50",
            invalid
              ? "border-[var(--color-danger)]/60"
              : "border-[var(--color-border-default)]",
            className
          )}
          {...props}
        />
      );
    }
    return (
      <div
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-md bg-[var(--color-surface-sunken)] border px-3 text-sm",
          "focus-within:ring-2 focus-within:ring-[var(--color-primary)]/40 focus-within:border-[var(--color-primary)]/60",
          invalid ? "border-[var(--color-danger)]/60" : "border-[var(--color-border-default)]",
          className
        )}
      >
        {startIcon ? (
          <span className="shrink-0 text-[var(--color-text-tertiary)]">{startIcon}</span>
        ) : null}
        <input
          ref={ref}
          className="flex-1 bg-transparent py-2 outline-none placeholder:text-[var(--color-text-tertiary)] disabled:opacity-50"
          {...props}
        />
        {endSlot}
      </div>
    );
  }
);
Input.displayName = "Input";
