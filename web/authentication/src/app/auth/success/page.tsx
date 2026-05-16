"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Copy } from "lucide-react";
import { AuthShell, BrandHeader } from "@/components/auth/shell";
import { Button } from "@/components/ui/button";
import { ATTENDE } from "@/lib/mock-client";
import { acrFromAmr, readFlow } from "@/lib/flow";

export default function SuccessPage() {
  const flow = typeof window !== "undefined" ? readFlow() : null;
  const code = React.useMemo(() => Math.random().toString(36).slice(2, 30), []);
  const state = React.useMemo(() => Math.random().toString(36).slice(2, 12), []);
  const acr = acrFromAmr(flow?.amr ?? []);
  const redirect = `${ATTENDE.redirect_uri}?code=${code}&state=${state}`;

  const [copied, setCopied] = React.useState(false);
  function copy() {
    navigator.clipboard.writeText(redirect);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <AuthShell width="lg">
      <BrandHeader />

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-success-muted)] text-[var(--color-success)]">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold">Sign-in complete</h1>
      </div>

      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        IDEN issued an authorization code for{" "}
        <span className="font-semibold text-[var(--color-text-primary)]">{ATTENDE.name}</span>. In a
        real flow your browser would now redirect back to the client&apos;s callback URL.
      </p>

      <div className="mt-5 space-y-3">
        <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] p-3 font-mono text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
            302 redirect
          </div>
          <div className="mt-1 break-all">{redirect}</div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <Pair k="acr" v={acr} />
          <Pair k="amr" v={`[${(flow?.amr ?? []).join(", ")}]`} />
          <Pair k="client" v={ATTENDE.id} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[auto_1fr] gap-3">
        <Button variant="secondary" size="md" onClick={copy}>
          <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy URL"}
        </Button>
        <Button asChild size="md">
          <Link href="/">
            <ArrowRight className="h-4 w-4" /> Back to demo client
          </Link>
        </Button>
      </div>
    </AuthShell>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/50 p-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">{k}</div>
      <div className="mt-1 truncate font-mono text-[11px] text-[var(--color-text-secondary)]">{v}</div>
    </div>
  );
}
