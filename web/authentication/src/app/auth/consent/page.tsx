"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ExternalLink, Info, Key, User, Monitor, Shield } from "lucide-react";
import { AuthShell, BrandHeader } from "@/components/auth/shell";
import { ClientTile } from "@/components/auth/client-badge";
import { Button } from "@/components/ui/button";
import { ATTENDE, ORG } from "@/lib/mock-client";
import { acrFromAmr, readFlow, updateFlow } from "@/lib/flow";

const SCOPE_ICONS = [User, Key, Monitor];

export default function ConsentPage() {
  return (
    <Suspense fallback={null}>
      <ConsentInner />
    </Suspense>
  );
}

function ConsentInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const challenge = sp.get("challenge") ?? "demo";

  const [submitting, setSubmitting] = React.useState<"allow" | "deny" | null>(null);
  const flow = typeof window !== "undefined" ? readFlow() : null;
  const acr = acrFromAmr(flow?.amr ?? []);

  async function allow() {
    setSubmitting("allow");
    updateFlow({ consented: true });
    await new Promise((r) => setTimeout(r, 600));
    router.push(`/auth/success?challenge=${challenge}`);
  }

  async function deny() {
    setSubmitting("deny");
    await new Promise((r) => setTimeout(r, 500));
    router.push(`/auth/denied?challenge=${challenge}`);
  }

  return (
    <AuthShell width="lg">
      <BrandHeader />

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border-default)] bg-white">
          <Shield className="h-5 w-5 text-[var(--color-primary)]" />
        </div>
        <span className="text-[var(--color-text-tertiary)]">···</span>
        <ClientTile client={ATTENDE} />
      </div>

      <h1 className="text-2xl font-semibold leading-snug">
        <span style={{ color: ATTENDE.brand_color }}>{ATTENDE.name}</span> wants to access your
        account
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Signed in as{" "}
        <span className="font-mono text-[var(--color-text-primary)]">{flow?.email ?? "akari.k@ubk.ac.th"}</span>
        {" · "}
        <a href={`/auth/login?challenge=${challenge}`} className="text-[var(--color-info)] hover:underline">
          Not you?
        </a>
      </p>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          This will share
        </p>
        <ul className="mt-3 space-y-2">
          {ATTENDE.scopes.map((s, i) => {
            const Icon = SCOPE_ICONS[i % SCOPE_ICONS.length];
            return (
              <li
                key={s.key}
                className="flex items-start gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/60 p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {s.label}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[var(--color-text-tertiary)]">
                    {s.key}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/50 p-3 text-sm">
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
          <Info className="h-4 w-4" />
          Want to know how your data is handled?
        </div>
        <a href="#" className="inline-flex items-center gap-1 text-[var(--color-info)] hover:underline">
          Privacy policy <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-6 grid grid-cols-[auto_1fr] gap-3">
        <Button
          variant="secondary"
          size="lg"
          onClick={deny}
          loading={submitting === "deny"}
          disabled={submitting !== null}
        >
          Deny
        </Button>
        <Button
          size="lg"
          onClick={allow}
          loading={submitting === "allow"}
          disabled={submitting !== null}
        >
          <Check className="h-4 w-4" /> Allow access
        </Button>
      </div>

      <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">
        You&apos;ll be redirected to{" "}
        <span className="font-mono text-[var(--color-text-secondary)]">admin.{ORG.domain}</span>. Access
        can be revoked anytime from your IDEN dashboard.
      </p>

      <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-4 text-[11px] text-[var(--color-text-tertiary)]">
        <span>
          Assurance: <span className="font-mono text-[var(--color-text-secondary)]">{acr}</span>
        </span>
        <span>
          amr:{" "}
          <span className="font-mono text-[var(--color-text-secondary)]">
            [{(flow?.amr ?? []).map((m) => `"${m}"`).join(", ")}]
          </span>
        </span>
      </div>
    </AuthShell>
  );
}
