"use client";

import * as React from "react";
import { Camera, Check, ScanFace, Shield, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";

type Stage = "idle" | "detecting" | "liveness" | "processing" | "success";

const STAGE_TEXT: Record<Stage, string> = {
  idle: "Position your face in the oval",
  detecting: "Face detected — hold still",
  liveness: "Blink slowly",
  processing: "Verifying…",
  success: "Identity confirmed",
};

export default function BiometricPage() {
  const [enrolled, setEnrolled] = React.useState(false);
  const [capture, setCapture] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  function onCaptured() {
    setCapture(false);
    setEnrolled(true);
  }

  return (
    <>
      <PageHeader title="Biometric Authentication" subtitle="Facial recognition — liveness-verified" />

      <Card className="p-6 max-w-2xl">
        {enrolled ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success-muted)] p-4">
              <Shield className="mt-0.5 h-4 w-4 text-[var(--color-success)]" />
              <div>
                <div className="text-sm font-semibold text-[var(--color-success)]">Face enrolled</div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  You can now sign in with your face on any IDEN-integrated app.
                </div>
              </div>
            </div>
            <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] p-4 text-sm text-[var(--color-text-secondary)]">
              <p className="mb-2 text-[var(--color-text-primary)]">What's stored</p>
              <ul className="space-y-1 text-xs">
                <li>· A numeric face embedding (irreversible, ~512 floats)</li>
                <li>· A single reference image, encrypted at rest in MinIO</li>
                <li>· Enrollment timestamp and device user-agent</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setCapture(true)}>Re-enroll</Button>
              <Button variant="danger-outline" onClick={() => setConfirmRemove(true)}>Remove biometric</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
              <ScanFace className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Enroll your face</h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Sign in by looking at your camera — no password required. Liveness detection prevents photo and screen attacks.
              </p>
            </div>
            <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] p-4 text-xs text-[var(--color-text-secondary)]">
              Your face data stays inside your organization. It is never sent to third parties and can be removed any time.
            </div>
            <Button onClick={() => setCapture(true)}>
              <Camera className="h-4 w-4" /> Start enrollment
            </Button>
          </div>
        )}
      </Card>

      <CameraCaptureDialog open={capture} onOpenChange={setCapture} onCaptured={onCaptured} />

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove biometric enrollment?"
        description="Your face embedding and reference image will be deleted. You can re-enroll any time."
        confirmLabel="Remove biometric"
        destructive
        onConfirm={async () => setEnrolled(false)}
      />
    </>
  );
}

function CameraCaptureDialog({
  open,
  onOpenChange,
  onCaptured,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCaptured: () => void;
}) {
  const [stage, setStage] = React.useState<Stage>("idle");

  React.useEffect(() => {
    if (!open) {
      setStage("idle");
      return;
    }
    const t1 = setTimeout(() => setStage("detecting"), 800);
    const t2 = setTimeout(() => setStage("liveness"), 2000);
    const t3 = setTimeout(() => setStage("processing"), 3600);
    const t4 = setTimeout(() => setStage("success"), 4600);
    const t5 = setTimeout(() => onCaptured(), 5400);
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
  }, [open, onCaptured]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-[#070912]">
        <DialogTitle className="sr-only">Camera capture</DialogTitle>
        <div className="relative aspect-[3/4] w-full">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0e1428] via-[#070912] to-[#0e1428]">
            <div className="absolute inset-0 opacity-30" style={{
              background: "radial-gradient(circle at 50% 45%, rgba(255,122,26,0.4), transparent 60%)"
            }} />
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                "h-[260px] w-[200px] rounded-[50%] border-2 transition-all duration-300",
                stage === "idle"
                  ? "border-dashed border-white/40"
                  : stage === "detecting"
                  ? "border-[var(--color-primary)] shadow-[0_0_40px_rgba(255,122,26,0.35)] animate-pulse"
                  : stage === "liveness"
                  ? "border-[var(--color-info)] shadow-[0_0_40px_rgba(56,189,248,0.35)]"
                  : stage === "processing"
                  ? "border-[var(--color-primary)] shadow-[0_0_40px_rgba(255,122,26,0.5)]"
                  : "border-[var(--color-success)] shadow-[0_0_60px_rgba(52,211,153,0.55)]"
              )}
            />
            {stage === "liveness" ? (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-1/2 top-1/2 h-[260px] w-[200px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[50%]">
                  <div className="absolute inset-x-0 h-0.5 bg-[var(--color-info)]/80 animate-[scan_1.4s_ease-in-out_infinite]" />
                </div>
              </div>
            ) : null}
            {stage === "success" ? (
              <div className="absolute flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)] text-[var(--color-text-inverse)]">
                <Check className="h-8 w-8" />
              </div>
            ) : null}
          </div>

          <div className="absolute inset-x-0 bottom-0 p-6 text-center">
            <div className="text-lg font-medium text-white">{STAGE_TEXT[stage]}</div>
            <div className="mt-1 text-xs text-white/50">Use password instead — bottom of the auth page</div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 rounded-full bg-black/40 p-2 text-white/70 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </DialogContent>
      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </Dialog>
  );
}
