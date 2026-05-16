"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchInput({
  paramKey = "q",
  placeholder,
  className,
  resetParams = ["page"],
  debounceMs = 250,
}: {
  paramKey?: string;
  placeholder?: string;
  className?: string;
  resetParams?: string[];
  debounceMs?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get(paramKey) ?? "";
  const [value, setValue] = React.useState(initial);

  React.useEffect(() => {
    setValue(params.get(paramKey) ?? "");
  }, [params, paramKey]);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      const current = params.get(paramKey) ?? "";
      if (value === current) return;
      const next = new URLSearchParams(params.toString());
      if (value) next.set(paramKey, value);
      else next.delete(paramKey);
      for (const p of resetParams) next.delete(p);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, debounceMs);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
