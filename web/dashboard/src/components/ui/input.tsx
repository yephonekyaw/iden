"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md bg-[var(--color-surface-sunken)] border px-3 py-2 text-sm",
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
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[80px] w-full rounded-md bg-[var(--color-surface-sunken)] border px-3 py-2 text-sm",
      "placeholder:text-[var(--color-text-tertiary)]",
      "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 focus:border-[var(--color-primary)]/60",
      invalid ? "border-[var(--color-danger)]/60" : "border-[var(--color-border-default)]",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
