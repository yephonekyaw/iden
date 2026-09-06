import { cn } from "./cn";

/**
 * A state that is either on or off — enabled, active, revoked, expired.
 *
 * Deliberately not a `Badge`. A badge is a label with a fill, and filling one
 * per row turns a table into a colour chart; the dot carries the colour so the
 * label stays readable type rather than a pill people have to decode.
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
    error: "bg-destructive",
    warning: "bg-warning",
  }[tone];

  return (
    <span className={cn("inline-flex items-center gap-2 text-body-sm text-body", className)}>
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colour)} />
      {label}
    </span>
  );
}
