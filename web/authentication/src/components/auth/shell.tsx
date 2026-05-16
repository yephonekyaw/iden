import * as React from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORG } from "@/lib/mock-client";
import { ThemeToggle } from "@/components/auth/theme-toggle";

export function AuthShell({
  children,
  width = "md",
}: {
  children: React.ReactNode;
  width?: "md" | "lg";
}) {
  return (
    <div className="grid-bg relative flex min-h-screen w-full items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary-border)] to-transparent" />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div
        className={cn(
          "relative rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface)]/85 p-7 shadow-2xl shadow-black/20 backdrop-blur-sm",
          "w-full",
          width === "md" ? "max-w-md" : "max-w-lg"
        )}
      >
        {children}
      </div>
      <footer className="absolute bottom-4 left-0 right-0 text-center text-xs text-[var(--color-text-tertiary)]">
        Secured by{" "}
        <Link href="/" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
          IDEN
        </Link>{" "}
        · {ORG.name}
      </footer>
    </div>
  );
}

export function BrandHeader() {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
          <Shield className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold tracking-wide text-[var(--color-text-primary)]">IDEN</span>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        {ORG.name}
      </span>
    </div>
  );
}
