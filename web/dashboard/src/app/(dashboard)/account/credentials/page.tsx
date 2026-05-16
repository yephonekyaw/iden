"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function strengthOf(s: string): { score: 0 | 1 | 2 | 3 | 4; label: string; hint: string } {
  let score = 0;
  if (s.length >= 8) score++;
  if (s.length >= 12) score++;
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) score++;
  if (/\d/.test(s) && /[^a-zA-Z0-9]/.test(s)) score++;
  const labels = ["Too short", "Weak", "Fair — add numbers and symbols", "Good", "Strong"];
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score], hint: labels[score] };
}

export default function CredentialsPage() {
  const [reveal, setReveal] = React.useState(false);
  const [form, setForm] = React.useState({ current: "", next: "", confirm: "" });
  const strength = strengthOf(form.next);
  const mismatch = form.confirm.length > 0 && form.next !== form.confirm;

  return (
    <>
      <PageHeader title="Credentials" subtitle="Change your password" />

      <Card className="p-6 max-w-2xl">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Current password</Label>
            <Input
              type={reveal ? "text" : "password"}
              value={form.current}
              onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
              placeholder="Enter current password"
            />
          </div>

          <div className="relative my-6 text-center">
            <span className="absolute inset-x-0 top-1/2 h-px bg-[var(--color-border-subtle)]" />
            <span className="relative inline-block bg-[var(--color-surface)] px-3 text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
              New password
            </span>
          </div>

          <div className="space-y-2">
            <Label>New password</Label>
            <div className="relative">
              <Input
                type={reveal ? "text" : "password"}
                value={form.next}
                onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))}
                placeholder="Min. 12 characters"
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                aria-label={reveal ? "Hide password" : "Show password"}
              >
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < strength.score
                      ? strength.score >= 3
                        ? "bg-[var(--color-success)]"
                        : "bg-[var(--color-primary)]"
                      : "bg-[var(--color-surface-overlay)]"
                  )}
                />
              ))}
            </div>
            {form.next ? (
              <p
                className={cn(
                  "text-xs",
                  strength.score >= 3
                    ? "text-[var(--color-success)]"
                    : strength.score >= 2
                    ? "text-[var(--color-primary)]"
                    : "text-[var(--color-warning)]"
                )}
              >
                {strength.label}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Confirm password</Label>
            <Input
              type={reveal ? "text" : "password"}
              value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
              placeholder="Repeat new password"
              invalid={mismatch}
            />
            {mismatch ? (
              <p className="text-xs text-[var(--color-danger)]">Passwords don't match.</p>
            ) : null}
          </div>

          <div>
            <Button disabled={!form.current || !form.next || mismatch || strength.score < 2}>
              Update password
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
