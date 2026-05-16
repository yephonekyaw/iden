import { cn } from "@/lib/utils";

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <code className={cn("font-mono text-[13px] text-[var(--color-text-primary)]", className)}>
      {children}
    </code>
  );
}
