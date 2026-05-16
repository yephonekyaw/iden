"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mono } from "@/components/shared/mono";
import { CopyButton } from "@/components/shared/copy-button";
import { updateOrganization } from "@/lib/api/organization";
import type { Organization } from "@/lib/types";
import Link from "next/link";
import { ChevronRight, ListChecks } from "lucide-react";

export function OrganizationForm({
  org,
  userFieldCount,
}: {
  org: Organization;
  userFieldCount: number;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: org.name,
    primary_color: org.primary_color ?? "#ff7a1a",
    default_access_token_ttl_seconds: org.default_access_token_ttl_seconds,
    default_refresh_token_ttl_seconds: org.default_refresh_token_ttl_seconds,
  });

  async function save() {
    setSaving(true);
    try {
      await updateOrganization(form);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Organization"
        subtitle="Tenant identity, branding, and default token policy"
        actions={
          <Button onClick={save} loading={saving}>
            Save changes
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6 space-y-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Identity
          </h3>
          <div className="space-y-2">
            <Label>Organization name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <div className="flex items-center gap-2">
              <Input value={org.slug} readOnly className="font-mono" />
              <CopyButton value={org.slug} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Organization ID</Label>
            <div className="flex items-center gap-2">
              <Mono className="block w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] px-3 py-2">
                {org.id}
              </Mono>
              <CopyButton value={org.id} />
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Branding
          </h3>
          <div className="space-y-2">
            <Label>Primary accent color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) =>
                  setForm((f) => ({ ...f, primary_color: e.target.value }))
                }
                className="h-10 w-12 cursor-pointer"
              />
              <Input
                value={form.primary_color}
                onChange={(e) =>
                  setForm((f) => ({ ...f, primary_color: e.target.value }))
                }
                className="font-mono"
              />
            </div>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Applied to the auth UI for relying parties branded under this
              organization.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-3 rounded-md border border-dashed border-[var(--color-border-default)] px-4 py-6 text-sm text-[var(--color-text-secondary)]">
              <span className="flex-1">Upload PNG or SVG — max 1 MB</span>
              <Button variant="secondary" size="sm">
                Browse
              </Button>
            </div>
          </div>
        </Card>

        <Link
          href="/admin/organization/user-schema"
          className="group lg:col-span-2 block rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-raised)]/40"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
              <ListChecks className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                User schema
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                {userFieldCount} custom field{userFieldCount === 1 ? "" : "s"}{" "}
                collected from every user, on top of display name and email.
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--color-text-tertiary)] transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>

        <Card className="p-6 space-y-5 lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Default token policy
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Used as the default when registering a new OIDC client. Individual
            clients may override.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Access token TTL (seconds)</Label>
              <Input
                type="number"
                value={form.default_access_token_ttl_seconds}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    default_access_token_ttl_seconds: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Refresh token TTL (seconds)</Label>
              <Input
                type="number"
                value={form.default_refresh_token_ttl_seconds}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    default_refresh_token_ttl_seconds: Number(e.target.value),
                  }))
                }
              />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
