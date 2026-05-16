"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "./copy-button";

export function SecretRevealCard({
  label,
  secret,
  onDismiss,
}: {
  label: string;
  secret: string;
  onDismiss?: () => void;
}) {
  const [saved, setSaved] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) {
    return (
      <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-text-secondary)]">
        Secret was dismissed and cannot be retrieved. If you lost it, rotate the secret to generate a new one.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-muted)] p-5">
      <div className="flex items-center gap-2 text-[var(--color-warning)]">
        <AlertTriangle className="h-4 w-4" />
        <div className="text-sm font-semibold">Save this {label} now — it will not be shown again.</div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] p-3">
        <code className="flex-1 break-all font-mono text-sm text-[var(--color-text-primary)]">{secret}</code>
        <CopyButton value={secret} />
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
        <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
        I have saved this {label} in a safe place
      </label>
      <div className="mt-4 flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          disabled={!saved}
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
