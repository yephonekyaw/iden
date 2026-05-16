"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mono } from "@/components/shared/mono";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Boxes } from "lucide-react";
import {
  createOrgUserField,
  deleteOrgUserField,
  reorderOrgUserFields,
  updateOrgUserField,
} from "@/lib/api/user-schema";
import type { OrgUserField, OrgUserFieldType } from "@/lib/types";

type Draft = Omit<OrgUserField, "id" | "order">;

const TYPE_OPTIONS: { value: OrgUserFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select (dropdown)" },
  { value: "boolean", label: "Yes / No toggle" },
];

const TYPE_TONE: Record<OrgUserFieldType, "info" | "violet" | "neutral" | "accent"> = {
  text: "neutral",
  number: "neutral",
  email: "info",
  url: "info",
  date: "violet",
  select: "accent",
  boolean: "violet",
};

const EMPTY_DRAFT: Draft = {
  key: "",
  label: "",
  type: "text",
  required: false,
  help_text: null,
  placeholder: null,
  options: null,
};

export function UserSchemaManager({ initialFields }: { initialFields: OrgUserField[] }) {
  const [fields, setFields] = React.useState(initialFields);
  const [editing, setEditing] = React.useState<OrgUserField | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<OrgUserField | null>(null);

  async function move(idx: number, dir: -1 | 1) {
    const next = [...fields];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setFields(next);
    await reorderOrgUserFields(next.map((f) => f.id));
  }

  async function handleCreate(draft: Draft) {
    const field = await createOrgUserField(draft);
    setFields((prev) => [...prev, field]);
    setAdding(false);
  }

  async function handleUpdate(id: string, draft: Draft) {
    const updated = await updateOrgUserField(id, draft);
    setFields((prev) => prev.map((f) => (f.id === id ? updated : f)));
    setEditing(null);
  }

  async function handleDelete(id: string) {
    await deleteOrgUserField(id);
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <>
      <Link
        href="/admin/organization"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to organization
      </Link>
      <PageHeader
        title="User schema"
        subtitle="Custom fields collected from every user in this organization, on top of display name and email."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add field
          </Button>
        }
      />

      {fields.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No custom fields yet"
          description="Add a field to collect organization-specific information like student ID, department, or employee number."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add your first field
            </Button>
          }
        />
      ) : (
        <Card className="divide-y divide-[var(--color-border-subtle)]">
          {fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-4 p-4">
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)] disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === fields.length - 1}
                  className="rounded p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)] disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--color-text-primary)]">{f.label}</span>
                  <Badge tone={TYPE_TONE[f.type]}>{f.type}</Badge>
                  {f.required ? <Badge tone="accent">required</Badge> : null}
                </div>
                <div className="mt-0.5 text-xs">
                  <Mono className="text-[var(--color-text-secondary)]">{f.key}</Mono>
                  {f.help_text ? (
                    <span className="ml-2 text-[var(--color-text-tertiary)]">· {f.help_text}</span>
                  ) : null}
                </div>
                {f.type === "select" && f.options ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {f.options.map((o) => (
                      <span
                        key={o}
                        className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-overlay)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]"
                      >
                        {o}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditing(f)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(f)}>
                  <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <FieldDialog
        open={adding}
        title="Add user schema field"
        onOpenChange={(o) => !o && setAdding(false)}
        initial={EMPTY_DRAFT}
        existingKeys={fields.map((f) => f.key)}
        onSubmit={handleCreate}
      />

      <FieldDialog
        open={editing !== null}
        title="Edit field"
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing ?? EMPTY_DRAFT}
        existingKeys={fields.filter((f) => f.id !== editing?.id).map((f) => f.key)}
        onSubmit={async (draft) => {
          if (editing) await handleUpdate(editing.id, draft);
        }}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete this field?"
        description={
          <>
            Removes <strong>{confirmDelete?.label}</strong> from the schema. Existing user values for this field
            will become inaccessible from the UI but remain in the database until purged.
          </>
        }
        confirmLabel="Delete field"
        destructive
        onConfirm={async () => {
          if (confirmDelete) await handleDelete(confirmDelete.id);
        }}
      />
    </>
  );
}

function FieldDialog({
  open,
  title,
  onOpenChange,
  initial,
  existingKeys,
  onSubmit,
}: {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  initial: Draft;
  existingKeys: string[];
  onSubmit: (draft: Draft) => void | Promise<void>;
}) {
  const [draft, setDraft] = React.useState<Draft>(initial);
  const [optionsText, setOptionsText] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDraft(initial);
      setOptionsText((initial.options ?? []).join("\n"));
    }
  }, [open, initial]);

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  const keyTaken = existingKeys.includes(draft.key);
  const keyValid = /^[a-z][a-z0-9_]*$/.test(draft.key);
  const canSave = draft.label.trim().length > 0 && draft.key.trim().length > 0 && keyValid && !keyTaken;

  async function handleSubmit() {
    setSaving(true);
    try {
      const payload: Draft = {
        ...draft,
        options:
          draft.type === "select"
            ? optionsText.split("\n").map((s) => s.trim()).filter(Boolean)
            : null,
        help_text: draft.help_text?.trim() || null,
        placeholder: draft.placeholder?.trim() || null,
      };
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Fields are shown on every user's profile page and exposed as OIDC custom claims in id_tokens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input value={draft.label} onChange={(e) => set("label", e.target.value)} placeholder="Student ID" />
            </div>
            <div className="space-y-2">
              <Label>Key</Label>
              <Input
                value={draft.key}
                onChange={(e) => set("key", e.target.value)}
                placeholder="student_id"
                className="font-mono"
                invalid={!!draft.key && (!keyValid || keyTaken)}
              />
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {keyTaken
                  ? "This key is already in use."
                  : !keyValid && draft.key
                  ? "Lowercase letters, digits, and underscores. Must start with a letter."
                  : "Used as the OIDC claim name. Cannot be changed easily after creation."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={draft.type} onValueChange={(v) => set("type", v as OrgUserFieldType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Required</Label>
              <div className="flex h-10 items-center gap-3">
                <Switch checked={draft.required} onCheckedChange={(v) => set("required", v)} />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {draft.required ? "Must be filled in" : "Optional"}
                </span>
              </div>
            </div>
          </div>

          {draft.type === "select" ? (
            <div className="space-y-2">
              <Label>Options</Label>
              <Textarea
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder={"Engineering\nScience\nArts"}
                rows={4}
              />
              <p className="text-xs text-[var(--color-text-tertiary)]">One option per line.</p>
            </div>
          ) : null}

          {draft.type !== "boolean" ? (
            <div className="space-y-2">
              <Label>Placeholder</Label>
              <Input
                value={draft.placeholder ?? ""}
                onChange={(e) => set("placeholder", e.target.value)}
                placeholder="Shown inside the empty input"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Help text</Label>
            <Input
              value={draft.help_text ?? ""}
              onChange={(e) => set("help_text", e.target.value)}
              placeholder="Optional. Shown under the field."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving} disabled={!canSave}>
            Save field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
