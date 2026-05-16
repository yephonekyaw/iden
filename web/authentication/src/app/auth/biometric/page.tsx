"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Camera, CheckCircle2, ScanFace, ShieldAlert } from "lucide-react";
import { AuthShell, BrandHeader } from "@/components/auth/shell";
import { Button } from "@/components/ui/button";
import { ATTENDE } from "@/lib/mock-client";
import { addAmr, meetsRequired, readFlow } from "@/lib/flow";
import { cn } from "@/lib/utils";

type Stage = "intro" | "detecting" | "liveness" | "processing" | "success" | "fail";

export default function BiometricPage() {
  return (
    <Suspense fallback={null}>
      <BiometricInner />
    </Suspense>
  );
}

function BiometricInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const challenge = sp.get("challenge") ?? "demo";

  const [stage, setStage] = React.useState<Stage>("intro");

  React.useEffect(() => {
    if (stage === "intro" || stage === "success" || stage === "fail") return;
    const timers: number[] = [];
    if (stage === "detecting") timers.push(window.setTimeout(() => setStage("liveness"), 1200));
    if (stage === "liveness") timers.push(window.setTimeout(() => setStage("processing"), 1600));
    if (stage === "processing") timers.push(window.setTimeout(() => setStage("success"), 900));
    return () => timers.forEach(clearTimeout);
  }, [stage]);

  React.useEffect(() => {
    if (stage !== "success") return;
    const t = window.setTimeout(() => {
      const flow = addAmr("face");
      if (!meetsRequired(flow.amr, ATTENDE.acr_required)) {
        router.push(`/auth/totp?challenge=${challenge}`);
      } else {
        router.push(`/auth/consent?challenge=${challenge}`);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [stage, router, challenge]);

  const flow = typeof window !== "undefined" ? readFlow() : null;

  return (
    <AuthShell>
      <BrandHeader />

      <Link
        href={`/auth/login?challenge=${challenge}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-info)] hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Use a different sign-in method
      </Link>

      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
        <ScanFace className="h-5 w-5" />
      </div>

      <h1 className="mt-4 text-2xl font-semibold">Face sign-in</h1>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Look directly into your camera. We&apos;ll verify it&apos;s really you with a liveness check.
      </p>
      {flow?.email ? (
        <p className="mt-1 font-mono text-xs text-[var(--color-text-tertiary)]">{flow.email}</p>
      ) : null}

      <ReticleStage stage={stage} />

      <div className="mt-6 space-y-3">
        {stage === "intro" ? (
          <Button size="lg" className="w-full" onClick={() => setStage("detecting")}>
            <Camera className="h-4 w-4" /> Start face capture
          </Button>
        ) : stage === "fail" ? (
          <Button size="lg" className="w-full" onClick={() => setStage("detecting")}>
            Try again
          </Button>
        ) : (
          <Button size="lg" className="w-full" disabled>
            {stage === "success" ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Verified
              </>
            ) : (
              <>Hold still…</>
            )}
          </Button>
        )}

        <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/50 p-3 text-xs text-[var(--color-text-tertiary)]">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-info)]" />
            Your face data never leaves IDEN. We compare against an encrypted embedding — not a stored
            photo.
          </div>
        </div>
      </div>
    </AuthShell>
  );
}

const STAGE_LABEL: Record<Stage, string> = {
  intro: "Camera idle",
  detecting: "Detecting face…",
  liveness: "Liveness check — blink slowly",
  processing: "Matching against your profile…",
  success: "Match confirmed",
  fail: "Could not verify",
};

function ReticleStage({ stage }: { stage: Stage }) {
  return (
    <div className="mt-6">
      <div
        className={cn(
          "relative mx-auto flex h-64 w-64 items-center justify-center rounded-full",
          "border bg-[var(--color-surface-sunken)]",
          stage === "success"
            ? "border-[var(--color-success)]/60"
            : stage === "fail"
            ? "border-[var(--color-danger)]/60"
            : "border-[var(--color-border-default)]"
        )}
      >
        <div
          className={cn(
            "absolute inset-3 rounded-full border-2 border-dashed",
            stage === "success"
              ? "border-[var(--color-success)]/60"
              : stage === "fail"
              ? "border-[var(--color-danger)]/60"
              : "border-[var(--color-primary)]/40",
            stage === "detecting" || stage === "liveness" || stage === "processing"
              ? "animate-pulse-ring"
              : ""
          )}
        />
        <ScanFace
          className={cn(
            "h-20 w-20",
            stage === "success"
              ? "text-[var(--color-success)]"
              : stage === "fail"
              ? "text-[var(--color-danger)]"
              : "text-[var(--color-text-secondary)]"
          )}
        />
        {stage === "liveness" || stage === "processing" ? (
          <div className="pointer-events-none absolute left-3 right-3 top-1/2 h-px bg-[var(--color-primary)] shadow-[0_0_12px_2px_var(--color-primary)] animate-scan" />
        ) : null}
      </div>
      <p className="mt-3 text-center text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {STAGE_LABEL[stage]}
      </p>
    </div>
  );
}
