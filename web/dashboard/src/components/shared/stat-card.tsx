import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "danger" | "info";
}) {
  const accentClass =
    accent === "primary"
      ? "text-[var(--color-primary)]"
      : accent === "success"
      ? "text-[var(--color-success)]"
      : accent === "warning"
      ? "text-[var(--color-warning)]"
      : accent === "danger"
      ? "text-[var(--color-danger)]"
      : accent === "info"
      ? "text-[var(--color-info)]"
      : "text-[var(--color-text-primary)]";

  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</div>
      <div className={cn("mt-2 text-4xl font-semibold tabular-nums", accentClass)}>{value}</div>
      {hint ? <div className="mt-2 text-xs text-[var(--color-text-tertiary)]">{hint}</div> : null}
    </Card>
  );
}
