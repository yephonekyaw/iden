import * as LabelPrimitive from "@radix-ui/react-label";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-control w-full rounded-md border border-hairline bg-canvas px-3.5 text-body-md text-ink",
        "placeholder:text-muted-soft",
        "focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15",
        "aria-invalid:border-error aria-invalid:ring-error/15",
        "disabled:bg-surface-soft disabled:text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("text-caption font-medium text-body-strong", className)}
      {...props}
    />
  );
}

/**
 * A label, its control, and the two things that explain it. `hint` describes the
 * field; `error` says what went wrong. Neither ever does the other's job.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: { id: string; "aria-describedby": string | undefined; "aria-invalid": boolean }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-1 text-muted-soft">(required)</span> : null}
      </Label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": Boolean(error) })}
      {error ? (
        <p id={errorId} className="text-caption text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
