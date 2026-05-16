"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Mono } from "@/components/shared/mono";
import { SecretRevealCard } from "@/components/shared/secret-reveal-card";
import { createClient } from "@/lib/api/clients";
import type { ClientKind, Scope } from "@/lib/types";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  description: string;
  kind: ClientKind;
  is_public: boolean;
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  grant_types: string[];
  require_pkce: boolean;
  consent_required: boolean;
  allowed_scopes: string[];
  audience: string[];
  access_token_ttl_seconds: number;
  refresh_token_ttl_seconds: number;
  id_token_ttl_seconds: number;
  refresh_token_rotation: boolean;
  client_uri: string;
  contacts: string[];
};

const STEPS = [
  { id: "basics", label: "Basics" },
  { id: "auth", label: "Auth Config" },
  { id: "uris", label: "URIs" },
  { id: "scopes", label: "Scopes & Audience" },
  { id: "tokens", label: "Token Policy" },
  { id: "display", label: "Display Info" },
  { id: "review", label: "Review" },
] as const;

const ALL_GRANTS = ["authorization_code", "refresh_token", "client_credentials"];

export function CreateClientWizard({ scopes }: { scopes: Scope[] }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [createdSecret, setCreatedSecret] = React.useState<string | null>(null);
  const [createdId, setCreatedId] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<FormState>({
    name: "",
    description: "",
    kind: "web",
    is_public: false,
    redirect_uris: [],
    post_logout_redirect_uris: [],
    grant_types: ["authorization_code", "refresh_token"],
    require_pkce: true,
    consent_required: true,
    allowed_scopes: ["openid", "profile", "email"],
    audience: [],
    access_token_ttl_seconds: 3600,
    refresh_token_ttl_seconds: 1_209_600,
    id_token_ttl_seconds: 3600,
    refresh_token_rotation: true,
    client_uri: "",
    contacts: [],
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canContinue = step !== 0 || form.name.trim().length > 0;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const { client, client_secret } = await createClient(form);
      setCreatedId(client.id);
      setCreatedSecret(client_secret);
    } finally {
      setSubmitting(false);
    }
  }

  if (createdSecret && createdId) {
    return (
      <>
        <PageHeader title="Client created" subtitle="Save the client secret before navigating away." />
        <div className="space-y-4">
          <SecretRevealCard label="client secret" secret={createdSecret} />
          <div className="flex justify-end">
            <Button asChild>
              <Link href={`/admin/clients/${createdId}`}>Go to client</Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Link
        href="/admin/clients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to clients
      </Link>
      <PageHeader title="Register OIDC client" subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step].label}`} />

      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
                i === step
                  ? "bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
                  : i < step
                  ? "text-[var(--color-success)]"
                  : "text-[var(--color-text-tertiary)]"
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px] font-semibold">
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s.label}
            </div>
            {i < STEPS.length - 1 ? <div className="h-px flex-1 bg-[var(--color-border-subtle)]" /> : null}
          </React.Fragment>
        ))}
      </div>

      <Card className="p-6">
        {step === 0 ? <BasicsStep form={form} update={update} /> : null}
        {step === 1 ? <AuthStep form={form} update={update} /> : null}
        {step === 2 ? <UrisStep form={form} update={update} /> : null}
        {step === 3 ? <ScopesStep form={form} update={update} scopes={scopes} /> : null}
        {step === 4 ? <TokensStep form={form} update={update} /> : null}
        {step === 5 ? <DisplayStep form={form} update={update} /> : null}
        {step === 6 ? <ReviewStep form={form} /> : null}
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
            Continue
          </Button>
        ) : (
          <Button onClick={handleSubmit} loading={submitting}>
            Create client
          </Button>
        )}
      </div>
    </>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-[var(--color-text-tertiary)]">{hint}</p> : null}
    </div>
  );
}

function BasicsStep({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="space-y-5">
      <Field label="Client name">
        <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Attende" />
      </Field>
      <Field label="Description" hint="Optional. Visible in admin list.">
        <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={2} />
      </Field>
      <Field label="Client kind">
        <Select value={form.kind} onValueChange={(v) => update("kind", v as ClientKind)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="web">Web — server-side app with secret</SelectItem>
            <SelectItem value="spa">SPA — public browser app</SelectItem>
            <SelectItem value="kiosk">Kiosk — physical device (client_credentials)</SelectItem>
            <SelectItem value="service">Service — M2M backend</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Public client" hint="Public clients have no secret and must use PKCE.">
        <div className="flex items-center gap-3">
          <Switch checked={form.is_public} onCheckedChange={(v) => update("is_public", v)} />
          <span className="text-sm">{form.is_public ? "Public" : "Confidential"}</span>
        </div>
      </Field>
    </div>
  );
}

function AuthStep({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  function toggleGrant(g: string) {
    update(
      "grant_types",
      form.grant_types.includes(g) ? form.grant_types.filter((x) => x !== g) : [...form.grant_types, g]
    );
  }
  return (
    <div className="space-y-5">
      <Field label="Grant types">
        <div className="flex flex-wrap gap-2">
          {ALL_GRANTS.map((g) => {
            const on = form.grant_types.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGrant(g)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  on
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
                    : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]"
                )}
              >
                <Mono>{g}</Mono>
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Require PKCE" hint="Required for SPA and recommended for all confidential clients.">
        <div className="flex items-center gap-3">
          <Switch checked={form.require_pkce} onCheckedChange={(v) => update("require_pkce", v)} />
          <span className="text-sm">{form.require_pkce ? "Enforced" : "Optional"}</span>
        </div>
      </Field>
      <Field label="Consent required" hint="Force the consent screen even for org-internal clients.">
        <div className="flex items-center gap-3">
          <Switch checked={form.consent_required} onCheckedChange={(v) => update("consent_required", v)} />
          <span className="text-sm">{form.consent_required ? "Required" : "Skipped"}</span>
        </div>
      </Field>
    </div>
  );
}

function ListEditor({
  label,
  values,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  hint?: string;
}) {
  const [draft, setDraft] = React.useState("");
  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              onChange([...values, draft.trim()]);
              setDraft("");
            }
          }}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (draft.trim()) {
              onChange([...values, draft.trim()]);
              setDraft("");
            }
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {values.length ? (
        <ul className="mt-2 space-y-1">
          {values.map((v, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] px-3 py-2"
            >
              <Mono className="truncate">{v}</Mono>
              <button
                type="button"
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                onClick={() => onChange(values.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Field>
  );
}

function UrisStep({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="space-y-5">
      <ListEditor
        label="Redirect URIs"
        values={form.redirect_uris}
        onChange={(v) => update("redirect_uris", v)}
        placeholder="https://app.example.com/callback"
        hint="Used by authorization_code flow. http/https only."
      />
      <ListEditor
        label="Post-logout redirect URIs"
        values={form.post_logout_redirect_uris}
        onChange={(v) => update("post_logout_redirect_uris", v)}
        placeholder="https://app.example.com/"
      />
    </div>
  );
}

function ScopesStep({
  form,
  update,
  scopes,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  scopes: Scope[];
}) {
  function toggle(name: string) {
    update(
      "allowed_scopes",
      form.allowed_scopes.includes(name)
        ? form.allowed_scopes.filter((s) => s !== name)
        : [...form.allowed_scopes, name]
    );
  }
  const grouped = scopes.reduce<Record<string, Scope[]>>((acc, s) => {
    (acc[s.resource] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Field label="Allowed scopes" hint="Clients may request any subset; the AuthZ server filters by user role at token issuance.">
        <div className="space-y-4">
          {Object.entries(grouped).map(([resource, list]) => (
            <div key={resource}>
              <div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                {resource}
              </div>
              <div className="flex flex-wrap gap-2">
                {list.map((s) => {
                  const on = form.allowed_scopes.includes(s.name);
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => toggle(s.name)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs transition-colors",
                        on
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
                          : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]"
                      )}
                    >
                      <Mono>{s.name}</Mono>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Field>

      <ListEditor
        label="Audience"
        values={form.audience}
        onChange={(v) => update("audience", v)}
        placeholder="https://api.example.com"
        hint="Resource identifiers this client may target."
      />
    </div>
  );
}

function TokensStep({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="space-y-5">
      <Field label="Access token TTL (seconds)">
        <Input
          type="number"
          value={form.access_token_ttl_seconds}
          onChange={(e) => update("access_token_ttl_seconds", Number(e.target.value))}
        />
      </Field>
      <Field label="Refresh token TTL (seconds)">
        <Input
          type="number"
          value={form.refresh_token_ttl_seconds}
          onChange={(e) => update("refresh_token_ttl_seconds", Number(e.target.value))}
        />
      </Field>
      <Field label="ID token TTL (seconds)">
        <Input
          type="number"
          value={form.id_token_ttl_seconds}
          onChange={(e) => update("id_token_ttl_seconds", Number(e.target.value))}
        />
      </Field>
      <Field label="Refresh token rotation" hint="Issues a new refresh token on each refresh; previous becomes invalid.">
        <div className="flex items-center gap-3">
          <Switch
            checked={form.refresh_token_rotation}
            onCheckedChange={(v) => update("refresh_token_rotation", v)}
          />
          <span className="text-sm">{form.refresh_token_rotation ? "Enabled" : "Disabled"}</span>
        </div>
      </Field>
    </div>
  );
}

function DisplayStep({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="space-y-5">
      <Field label="Client URI">
        <Input
          value={form.client_uri}
          onChange={(e) => update("client_uri", e.target.value)}
          placeholder="https://app.example.com"
        />
      </Field>
      <ListEditor
        label="Contacts"
        values={form.contacts}
        onChange={(v) => update("contacts", v)}
        placeholder="ops@example.com"
        hint="Email addresses to notify on security events."
      />
    </div>
  );
}

function ReviewStep({ form }: { form: FormState }) {
  return (
    <div className="space-y-2 text-sm">
      <h3 className="text-base font-semibold">Review</h3>
      <p className="text-[var(--color-text-secondary)]">
        Confirm before creating. The client secret will be generated and shown once.
      </p>
      <pre className="mt-4 max-h-[360px] overflow-auto rounded-md bg-[var(--color-surface-sunken)] p-4 font-mono text-xs text-[var(--color-text-secondary)]">
        {JSON.stringify(form, null, 2)}
      </pre>
    </div>
  );
}
