"use client";

import * as React from "react";
import { AlertTriangle, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import { useRoleSession } from "@/lib/role-context";
import { setUserAttributes } from "@/lib/api/user-schema";
import { ADMIN_SESSION_USER } from "@/lib/mock-data";
import type { OrgUserField, UserAttributes } from "@/lib/types";

export function ProfileForm({
  fields,
  initialAttributes,
}: {
  fields: OrgUserField[];
  initialAttributes: UserAttributes;
}) {
  const { session } = useRoleSession();
  const [form, setForm] = React.useState({
    display_name: session.user.display_name,
    email: session.user.email,
    organization: session.user.org_name,
  });
  const [attrs, setAttrs] = React.useState<UserAttributes>(initialAttributes);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const missingRequired = fields.filter(
    (f) => f.required && (attrs[f.key] === undefined || attrs[f.key] === null || attrs[f.key] === "")
  );

  function setAttr(key: string, value: string | number | boolean | null) {
    setAttrs((a) => ({ ...a, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await setUserAttributes(ADMIN_SESSION_USER.id, attrs);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Manage your account information"
        actions={
          <Button loading={saving} onClick={save}>
            {savedAt && Date.now() - savedAt < 2500 ? (
              <>
                <Check className="h-4 w-4" /> Saved
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        }
      />

      {missingRequired.length > 0 ? (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-[var(--color-warning)]/30 bg-[var(--color-warning-muted)] p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
          <div className="text-sm">
            <div className="font-semibold text-[var(--color-text-primary)]">
              Please complete your profile
            </div>
            <div className="mt-0.5 text-[var(--color-text-secondary)]">
              Your organization requires{" "}
              {missingRequired.map((f, i) => (
                <React.Fragment key={f.id}>
                  <strong className="text-[var(--color-text-primary)]">{f.label}</strong>
                  {i < missingRequired.length - 2
                    ? ", "
                    : i === missingRequired.length - 2
                    ? " and "
                    : ""}
                </React.Fragment>
              ))}
              .
            </div>
          </div>
        </div>
      ) : null}

      <Card className="p-6">
        <div className="mb-6 flex items-center gap-4">
          <Avatar className="h-20 w-20 text-xl">
            <AvatarFallback>{initials(form.display_name)}</AvatarFallback>
          </Avatar>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={form.email} disabled className="font-mono" />
            <p className="text-xs text-[var(--color-text-tertiary)]">Requires verification to change</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Organization</Label>
            <Input value={form.organization} disabled />
          </div>
        </div>

        {fields.length > 0 ? (
          <div className="mt-8 border-t border-[var(--color-border-subtle)] pt-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Additional information
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Required by {session.user.org_name}.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {fields.map((f) => (
                <SchemaField key={f.id} field={f} value={attrs[f.key]} onChange={(v) => setAttr(f.key, v)} />
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    </>
  );
}

function SchemaField({
  field,
  value,
  onChange,
}: {
  field: OrgUserField;
  value: string | number | boolean | null | undefined;
  onChange: (v: string | number | boolean | null) => void;
}) {
  const missing = field.required && (value === undefined || value === null || value === "");
  const wrap = (input: React.ReactNode) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>{field.label}</Label>
        {field.required ? <Badge tone="accent">required</Badge> : null}
      </div>
      {input}
      {field.help_text ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">{field.help_text}</p>
      ) : null}
      {missing ? <p className="text-xs text-[var(--color-warning)]">This field is required.</p> : null}
    </div>
  );

  if (field.type === "boolean") {
    return wrap(
      <div className="flex h-10 items-center gap-3">
        <Switch checked={value === true} onCheckedChange={(v) => onChange(v)} />
        <span className="text-sm text-[var(--color-text-secondary)]">{value === true ? "Yes" : "No"}</span>
      </div>
    );
  }

  if (field.type === "select") {
    return wrap(
      <Select value={typeof value === "string" ? value : ""} onValueChange={(v) => onChange(v)}>
        <SelectTrigger><SelectValue placeholder={field.placeholder ?? "Select..."} /></SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "number") {
    return wrap(
      <Input
        type="number"
        value={typeof value === "number" ? value : value === null || value === undefined ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder={field.placeholder ?? undefined}
        invalid={missing}
      />
    );
  }

  const htmlType =
    field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "date" ? "date" : "text";

  return wrap(
    <Input
      type={htmlType}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? undefined}
      invalid={missing}
    />
  );
}
