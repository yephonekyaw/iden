"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  autoFocus?: boolean;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);

  React.useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function setAt(i: number, ch: string) {
    const arr = Array.from({ length }, (_, k) => value[k] ?? "");
    arr[i] = ch;
    onChange(arr.join("").replace(/\s+$/, ""));
  }

  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[i]) {
        setAt(i, "");
      } else if (i > 0) {
        setAt(i - 1, "");
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft") {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight") {
      refs.current[i + 1]?.focus();
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!text) return;
    onChange(text);
    refs.current[Math.min(text.length, length - 1)]?.focus();
  }

  return (
    <div className="flex justify-between gap-2">
      {Array.from({ length }).map((_, i) => {
        const ch = value[i] ?? "";
        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            value={ch}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              if (!v) {
                setAt(i, "");
                return;
              }
              const next = v[v.length - 1];
              setAt(i, next);
              if (i < length - 1) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => onKey(i, e)}
            onPaste={onPaste}
            className={cn(
              "h-14 w-12 rounded-md border bg-[var(--color-surface-sunken)] text-center font-mono text-xl tabular-nums",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40",
              ch
                ? "border-[var(--color-primary)]/60 text-[var(--color-text-primary)]"
                : "border-[var(--color-border-default)] text-[var(--color-text-secondary)]"
            )}
          />
        );
      })}
    </div>
  );
}
