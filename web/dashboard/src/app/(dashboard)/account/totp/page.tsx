"use client";

import * as React from "react";
import { Check, Shield, Smartphone, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/components/shared/copy-button";
import { Mono } from "@/components/shared/mono";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

type View = "enrolled" | "intro" | "scan" | "verify" | "success";

const SECRET = "JBSWY3DPEHPK3PXP";

export default function TotpPage() {
  const [view, setView] = React.useState<View>("enrolled");
  const [code, setCode] = React.useState("");
  const [confirmRevoke, setConfirmRevoke] = React.useState(false);

  return (
    <>
      <PageHeader title="Two-Factor Authentication" subtitle="Authenticator app (TOTP)" />

      <Card className="p-6 max-w-2xl">
        {view === "enrolled" ? <EnrolledView onRevoke={() => setConfirmRevoke(true)} /> : null}
        {view === "intro" ? <IntroStep onContinue={() => setView("scan")} /> : null}
        {view === "scan" ? <ScanStep onContinue={() => setView("verify")} /> : null}
        {view === "verify" ? (
          <VerifyStep
            code={code}
            setCode={setCode}
            onConfirm={() => {
              setView("success");
              setCode("");
            }}
          />
        ) : null}
        {view === "success" ? <SuccessStep onDone={() => setView("enrolled")} /> : null}
      </Card>

      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title="Remove authenticator app?"
        description="You'll no longer be required to enter a 6-digit code at sign-in. You can re-enroll any time."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => setView("intro")}
      />
    </>
  );
}

function EnrolledView({ onRevoke }: { onRevoke: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success-muted)] p-4">
        <Shield className="mt-0.5 h-4 w-4 text-[var(--color-success)]" />
        <div>
          <div className="text-sm font-semibold text-[var(--color-success)]">TOTP is active</div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            Set up March 12, 2025 · Google Authenticator
          </div>
        </div>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Each sign-in requires a 6-digit code after your password.
      </p>
      <Button variant="danger-outline" onClick={onRevoke}>
        Remove authenticator app
      </Button>
    </div>
  );
}

function IntroStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
        <Smartphone className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-base font-semibold">Install an authenticator app</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Google Authenticator, Authy, or 1Password work great.
        </p>
      </div>
      <Button onClick={onContinue}>I already have one</Button>
    </div>
  );
}

function ScanStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold">Scan this QR code with your authenticator app</h3>
      <div className="flex items-center justify-center rounded-md border border-[var(--color-border-subtle)] bg-white p-6">
        <FakeQR />
      </div>
      <div className="space-y-2">
        <Label>Can't scan? Enter this code manually:</Label>
        <div className="flex items-center gap-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] px-3 py-2">
          <Mono className="flex-1 text-base tracking-[0.2em]">
            {SECRET.match(/.{1,4}/g)?.join(" ")}
          </Mono>
          <CopyButton value={SECRET} />
        </div>
      </div>
      <Button onClick={onContinue}>I've scanned it</Button>
    </div>
  );
}

function VerifyStep({
  code,
  setCode,
  onConfirm,
}: {
  code: string;
  setCode: (v: string) => void;
  onConfirm: () => void;
}) {
  React.useEffect(() => {
    if (code.length === 6) {
      const t = setTimeout(onConfirm, 200);
      return () => clearTimeout(t);
    }
  }, [code, onConfirm]);

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold">Enter the 6-digit code from your app</h3>
      <Input
        autoFocus
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
        placeholder="••••••"
      />
      <Button onClick={onConfirm} disabled={code.length !== 6}>
        Verify
      </Button>
    </div>
  );
}

function SuccessStep({ onDone }: { onDone: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success-muted)] text-[var(--color-success)]">
        <Check className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-base font-semibold">Two-factor authentication is now active</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Next time you sign in, you'll be asked for a code after your password.
        </p>
      </div>
      <Button onClick={onDone}>Done</Button>
    </div>
  );
}

function FakeQR() {
  // Decorative grid that reads as a QR code.
  const grid = Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21;
    const y = Math.floor(i / 21);
    if ((x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13)) {
      const inner = (x >= 1 && x <= 5 && y >= 1 && y <= 5) || (x >= 15 && x <= 19 && y >= 1 && y <= 5) || (x >= 1 && x <= 5 && y >= 15 && y <= 19);
      const outer = x === 0 || x === 6 || y === 0 || y === 6 || x === 14 || x === 20 || y === 14;
      return outer ? true : inner ? (x === 2 || x === 3 || x === 4) && (y === 2 || y === 3 || y === 4) : false;
    }
    return ((x * 7 + y * 13) % 5) % 2 === 0;
  });
  return (
    <div className="grid grid-cols-[repeat(21,1fr)] gap-px w-[220px]">
      {grid.map((on, i) => (
        <div key={i} className={`aspect-square ${on ? "bg-black" : "bg-white"}`} />
      ))}
    </div>
  );
}
