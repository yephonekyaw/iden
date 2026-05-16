"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createKiosk } from "@/lib/api/kiosks";

export function RegisterKioskForm({
  kioskClients,
}: {
  kioskClients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    location: "",
    hw_id: "",
    client_id: kioskClients[0]?.id ?? "",
  });

  function field<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setSubmitting(true);
    try {
      await createKiosk(form);
      router.push("/admin/kiosks");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Link
        href="/admin/kiosks"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to kiosks
      </Link>
      <PageHeader title="Register kiosk" subtitle="Link a physical device to a kiosk-kind OIDC client." />

      <Card className="p-6">
        <div className="space-y-5 max-w-xl">
          <div className="space-y-2">
            <Label>Device name</Label>
            <Input value={form.name} onChange={(e) => field("name", e.target.value)} placeholder="Entry Kiosk A1" />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => field("location", e.target.value)} placeholder="Building A · Floor 1" />
          </div>
          <div className="space-y-2">
            <Label>Hardware ID</Label>
            <Input
              value={form.hw_id}
              onChange={(e) => field("hw_id", e.target.value)}
              placeholder="hw_pi4_..."
              className="font-mono"
            />
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Read from the device's <code className="font-mono">/etc/machine-id</code> on first boot.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Linked OIDC client</Label>
            <Select value={form.client_id} onValueChange={(v) => field("client_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select a kiosk client" /></SelectTrigger>
              <SelectContent>
                {kioskClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" asChild>
              <Link href="/admin/kiosks">Cancel</Link>
            </Button>
            <Button
              onClick={submit}
              loading={submitting}
              disabled={!form.name || !form.hw_id || !form.client_id}
            >
              Register kiosk
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
