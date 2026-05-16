import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";
import type { DemoClient } from "@/lib/mock-client";

export function ClientTile({ client, size = "md" }: { client: DemoClient; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-16 w-16 text-lg" : "h-12 w-12 text-sm";
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border border-[var(--color-border-default)] bg-white font-semibold text-[var(--color-text-inverse)]",
        dim
      )}
      style={{ color: client.brand_color }}
    >
      {initials(client.name)}
    </div>
  );
}
