"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { AuthShell, BrandHeader } from "@/components/auth/shell";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/auth/otp-input";
import { ATTENDE, DEMO_USER } from "@/lib/mock-client";
import { addAmr, meetsRequired, readFlow } from "@/lib/flow";

export default function TotpPage() {
  return (
    <Suspense fallback={null}>
      <TotpInner />
    </Suspense>
  );
}

function TotpInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const challenge = sp.get("challenge") ?? "demo";

  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.length < 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    setSubmitting(false);
    if (code !== DEMO_USER.totp) {
      setError(`Incorrect code. Try ${DEMO_USER.totp}.`);
      return;
    }
    const flow = addAmr("otp");
    if (!meetsRequired(flow.amr, ATTENDE.acr_required)) {
      router.push(`/auth/biometric?challenge=${challenge}`);
    } else {
      router.push(`/auth/consent?challenge=${challenge}`);
    }
  }

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
        <ShieldCheck className="h-5 w-5" />
      </div>

      <h1 className="mt-4 text-2xl font-semibold">Two-factor verification</h1>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Open your authenticator app and enter the 6-digit code for{" "}
        <span className="font-semibold text-[var(--color-text-primary)]">{ATTENDE.name}</span>.
      </p>
      {flow?.email ? (
        <p className="mt-1 font-mono text-xs text-[var(--color-text-tertiary)]">
          Signed in as {flow.email}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <OtpInput value={code} onChange={setCode} />
        {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {!submitting ? (
            <>
              <ArrowRight className="h-4 w-4" /> Verify and continue
            </>
          ) : (
            "Verifying…"
          )}
        </Button>
        <p className="text-center text-xs text-[var(--color-text-tertiary)]">
          Lost access to your authenticator?{" "}
          <a href="#" className="text-[var(--color-info)] hover:underline">
            Use a recovery code
          </a>
        </p>
      </form>
    </AuthShell>
  );
}
