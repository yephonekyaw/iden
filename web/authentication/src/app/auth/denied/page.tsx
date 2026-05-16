"use client";

import Link from "next/link";
import { XCircle, ArrowRight } from "lucide-react";
import { AuthShell, BrandHeader } from "@/components/auth/shell";
import { Button } from "@/components/ui/button";
import { ATTENDE } from "@/lib/mock-client";

export default function DeniedPage() {
  return (
    <AuthShell>
      <BrandHeader />

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-danger-muted)] text-[var(--color-danger)]">
          <XCircle className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold">Access denied</h1>
      </div>

      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        You declined to share the requested scopes with{" "}
        <span className="font-semibold text-[var(--color-text-primary)]">{ATTENDE.name}</span>. IDEN
        will redirect back with{" "}
        <span className="font-mono text-[var(--color-text-primary)]">error=access_denied</span>.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3">
        <Button asChild size="md">
          <Link href="/">
            <ArrowRight className="h-4 w-4" /> Return to demo client
          </Link>
        </Button>
      </div>
    </AuthShell>
  );
}
