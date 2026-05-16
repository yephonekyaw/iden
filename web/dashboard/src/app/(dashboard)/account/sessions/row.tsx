"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Laptop, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { revokeSession } from "@/lib/api/sessions";
import { relativeTime } from "@/lib/utils";
import type { Session_Device } from "@/lib/types";

function iconFor(label: string) {
  const l = label.toLowerCase();
  if (l.includes("iphone") || l.includes("android")) return Smartphone;
  if (l.includes("windows")) return Monitor;
  return Laptop;
}

export function SessionRow({ session }: { session: Session_Device }) {
  const Icon = iconFor(session.device_label);
  const router = useRouter();
  const [confirm, setConfirm] = React.useState(false);
  return (
    <>
      <li className="flex items-center gap-4 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">{session.device_label}</span>
            {session.current ? <Badge tone="success">this device</Badge> : null}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            {session.browser} · {session.city} · {session.ip_addr}
          </div>
          <div className="text-xs text-[var(--color-text-tertiary)]">
            Last active {relativeTime(session.last_seen_at)} · signed in {relativeTime(session.created_at)}
          </div>
        </div>
        {!session.current ? (
          <Button variant="danger-outline" size="sm" onClick={() => setConfirm(true)}>
            Revoke
          </Button>
        ) : null}
      </li>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Revoke this session?"
        description={`${session.device_label} will be signed out immediately.`}
        confirmLabel="Revoke"
        destructive
        onConfirm={async () => {
          await revokeSession(session.id);
          router.refresh();
        }}
      />
    </>
  );
}
