"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ATTENDE } from "@/lib/mock-client";
import { ClientTile } from "@/components/auth/client-badge";
import { clearFlow, updateFlow } from "@/lib/flow";

export default function DemoClientPage() {
  const router = useRouter();
  const [redirecting, setRedirecting] = React.useState(false);

  function startLogin() {
    clearFlow();
    const next = updateFlow({
      client_id: ATTENDE.id,
      amr: [],
      needs_step_up: false,
      consented: false,
    });
    setRedirecting(true);
    setTimeout(() => {
      router.push(`/auth/login?challenge=${next.challenge}&client_id=${ATTENDE.id}`);
    }, 600);
  }

  return (
    <div className="grid-bg relative flex min-h-screen items-center justify-center p-6">
      <div className="relative w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
          <span className="uppercase tracking-[0.18em]">Demo · Connected client</span>
          <Link href="/" className="hover:text-[var(--color-text-secondary)]">
            attende.ubk.ac.th
          </Link>
        </div>
        <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface)]/85 p-10 shadow-2xl shadow-black/40 backdrop-blur-sm">
          <div className="flex items-start gap-5">
            <ClientTile client={ATTENDE} size="lg" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{ATTENDE.name}</h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Attendance tracking for the University of Bangkok
              </p>
            </div>
          </div>

          <div className="mt-10 space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Sign in to record today&apos;s class attendance. Use your university account.
            </p>
            <Button size="lg" className="w-full" onClick={startLogin} loading={redirecting}>
              {redirecting ? (
                "Redirecting to IDEN…"
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Continue with IDEN
                  <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-center text-xs text-[var(--color-text-tertiary)]">
              You will be redirected to <span className="font-mono">id.ubk.ac.th</span> to authenticate.
            </p>
          </div>

          <div className="mt-10 grid gap-3 border-t border-[var(--color-border-subtle)] pt-6 sm:grid-cols-3">
            <DemoStep n={1} title="IDEN login" body="Pick password, TOTP, or face." />
            <DemoStep n={2} title="Step-up if required" body="ATTENDE asks for LoA 2." />
            <DemoStep n={3} title="Consent & redirect" body="Approve scopes, return to app." />
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/50 p-3">
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary-muted)] text-[10px] font-semibold text-[var(--color-primary)]">
          {n}
        </span>
        <span className="font-semibold uppercase tracking-wider">{title}</span>
      </div>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{body}</p>
    </div>
  );
}
