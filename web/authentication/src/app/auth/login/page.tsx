"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail, ScanFace } from "lucide-react";
import { AuthShell, BrandHeader } from "@/components/auth/shell";
import { ClientTile } from "@/components/auth/client-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ATTENDE, DEMO_USER } from "@/lib/mock-client";
import { addAmr, meetsRequired, updateFlow } from "@/lib/flow";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const challenge = sp.get("challenge") ?? "demo";

  const [email, setEmail] = React.useState(DEMO_USER.email);
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function next() {
    const flow = addAmr("pwd");
    updateFlow({ email });
    if (!meetsRequired(flow.amr, ATTENDE.acr_required)) {
      router.push(`/auth/totp?challenge=${challenge}`);
    } else {
      router.push(`/auth/consent?challenge=${challenge}`);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Enter your password to continue.");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    setSubmitting(false);
    if (password !== DEMO_USER.password) {
      setError("Incorrect password. Try “demo-password”.");
      return;
    }
    updateFlow({ email });
    next();
  }

  function useFaceId() {
    updateFlow({ email });
    router.push(`/auth/biometric?challenge=${challenge}`);
  }

  return (
    <AuthShell>
      <BrandHeader />

      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <ClientTile client={ATTENDE} size="lg" />
        <h2 className="text-xl font-semibold" style={{ color: ATTENDE.brand_color }}>
          {ATTENDE.name.charAt(0) + ATTENDE.name.slice(1).toLowerCase()}
        </h2>
        <div>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Use your organization credentials to continue to{" "}
            <span className="font-semibold text-[var(--color-text-primary)]">{ATTENDE.name}</span>.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            startIcon={<Mail className="h-4 w-4" />}
            className="font-mono text-[13px]"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <a href="#" className="text-xs font-medium text-[var(--color-info)] hover:underline">
              Forgot password?
            </a>
          </div>
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            startIcon={<Lock className="h-4 w-4" />}
            invalid={!!error}
            endSlot={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="text-xs font-medium text-[var(--color-info)] hover:underline"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            }
          />
          {error ? (
            <p className="text-xs text-[var(--color-danger)]">{error}</p>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          Remember this device for 30 days
        </label>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {!submitting ? (
            <>
              <ArrowRight className="h-4 w-4" /> Sign in
            </>
          ) : (
            "Verifying…"
          )}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-5">
        <span className="text-sm text-[var(--color-text-secondary)]">Or sign in with</span>
        <Button variant="secondary" size="md" onClick={useFaceId}>
          <ScanFace className="h-4 w-4" /> Face ID
        </Button>
      </div>
    </AuthShell>
  );
}
