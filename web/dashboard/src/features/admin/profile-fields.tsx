import {
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  IdenError,
  Input,
  Pagination,
  ScopeChip,
  Spinner,
  type Column,
} from "@iden/shared";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useApi } from "../../app/api";
import { PageHeader } from "../../app/shell";
import { useList, useWrite, type ProfileFieldRecord } from "./api";
import { SystemTag } from "./roles";

const DATA_TYPES = [
  "string",
  "integer",
  "boolean",
  "date",
  "enum",
  "email",
  "phone",
  "url",
] as const;

export function ProfileFieldsRoute() {
  const api = useApi();
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ProfileFieldRecord | null>(null);

  const fields = useList<ProfileFieldRecord>(api, "/admin/profile-fields", { offset });

  const remove = useWrite<string, void>(["/admin/profile-fields"], async (id) => {
    await api.delete(`/admin/profile-fields/${id}`);
  });

  const columns: Column<ProfileFieldRecord>[] = [
    {
      key: "label",
      header: "Field",
      cell: (field) => (
        <span className="text-body-sm text-ink">
          {field.label}
          {field.isSystem ? <SystemTag /> : null}
        </span>
      ),
    },
    { key: "key", header: "Key", cell: (field) => <ScopeChip value={field.key} /> },
    { key: "type", header: "Type", secondary: true, cell: (field) => field.dataType },
    {
      key: "access",
      header: "Who can edit",
      cell: (field) => (field.userWritable ? "The person" : "Administrators only"),
    },
    {
      key: "actions",
      header: "",
      cell: (field) =>
        field.isSystem ? null : (
          <Button size="sm" onClick={() => setDeleting(field)}>
            Delete
          </Button>
        ),
    },
  ];

  const problem = remove.error instanceof IdenError ? remove.error : null;

  return (
    <>
      <PageHeader
        title="Profile fields"
        lede="What this organization records about people, beyond name and email. The self-service profile form is built from this."
        count={fields.data?.meta.total}
        actions={
          <Button variant="default" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Add field
          </Button>
        }
      />

      {problem ? (
        <p role="alert" className="mb-4 max-w-prose text-body-sm text-error">
          {problem.message}
        </p>
      ) : null}

      {fields.isPending ? (
        <Spinner label="Loading fields" />
      ) : fields.isError ? (
        <ErrorState error={fields.error} onRetry={() => void fields.refetch()} />
      ) : fields.data.items.length === 0 ? (
        <EmptyState
          title="No fields defined"
          body="Add the things you need to know about people — a department, a student number, a phone extension. They appear on everyone's profile straight away."
          action={
            <Button variant="default" onClick={() => setCreating(true)}>
              Add field
            </Button>
          }
        />
      ) : (
        <>
          <DataTable
            caption="Profile fields"
            columns={columns}
            rows={fields.data.items}
            rowKey={(field) => field.id}
          />
          <Pagination meta={fields.data.meta} onOffsetChange={setOffset} />
        </>
      )}

      <CreateFieldDialog open={creating} onOpenChange={setCreating} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.label ?? "this field"}?`}
        body="Every value anyone has entered for it is removed with it."
        confirmLabel="Delete field"
        pending={remove.isPending}
        onConfirm={() =>
          deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </>
  );
}

interface FieldForm {
  key: string;
  label: string;
  description: string;
  dataType: (typeof DATA_TYPES)[number];
  options: string;
  required: boolean;
  unique: boolean;
  userWritable: boolean;
}

function CreateFieldDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const api = useApi();
  const form = useForm<FieldForm>({
    defaultValues: {
      key: "",
      label: "",
      description: "",
      dataType: "string",
      options: "",
      required: false,
      unique: false,
      userWritable: false,
    },
  });

  const dataType = useWatch({ control: form.control, name: "dataType" });

  const create = useWrite<FieldForm, void>(["/admin/profile-fields"], async (values) => {
    await api.post("/admin/profile-fields", {
      key: values.key,
      label: values.label,
      description: values.description || null,
      dataType: values.dataType,
      options: values.options
        .split("\n")
        .map((option) => option.trim())
        .filter(Boolean),
      required: values.required,
      unique: values.unique,
      userWritable: values.userWritable,
      validators: {},
      displayOrder: 0,
    });
  });

  const problem = create.error instanceof IdenError ? create.error : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form
          noValidate
          onSubmit={form.handleSubmit((values) =>
            create.mutate(values, {
              onSuccess: () => {
                onOpenChange(false);
                form.reset();
              },
            }),
          )}
        >
          <DialogTitle className="text-display-sm font-display text-ink">
            Add a profile field
          </DialogTitle>
          <DialogDescription className="mt-2 text-body-sm text-body">
            The key and type are fixed once created, because existing values are stored against
            them.
          </DialogDescription>

          <div className="mt-6 flex flex-col gap-5">
            <Field label="Label" required hint="What people see on the form.">
              {(props) => <Input {...props} {...form.register("label")} />}
            </Field>

            <Field
              label="Key"
              required
              hint="Lowercase with underscores — e.g. student_number"
              error={
                problem?.code === "profile_field_key_taken"
                  ? "A field with that key already exists."
                  : problem?.fieldErrors.find((entry) => entry.field === "key")?.message
              }
            >
              {(props) => <Input {...props} {...form.register("key")} className="font-identity" />}
            </Field>

            <Field label="Description" hint="Shown under the field as help text.">
              {(props) => <Input {...props} {...form.register("description")} />}
            </Field>

            <Field label="Type">
              {(props) => (
                <select
                  {...props}
                  {...form.register("dataType")}
                  className="h-control w-full rounded-md border border-hairline bg-canvas px-3 text-body-md text-ink focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15"
                >
                  {DATA_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            {dataType === "enum" ? (
              <Field
                label="Choices"
                required
                hint="One per line."
                error={
                  problem?.code === "enum_needs_options"
                    ? "A list field needs its choices."
                    : undefined
                }
              >
                {(props) => (
                  <textarea
                    {...props}
                    {...form.register("options")}
                    rows={4}
                    className="w-full rounded-md border border-hairline bg-canvas p-3 text-body-md text-ink focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15"
                  />
                )}
              </Field>
            ) : null}

            <div className="flex flex-col gap-3">
              <Checkbox
                label="People can edit this themselves"
                hint="Off means administrators maintain it — right for anything that decides what someone is allowed to do."
                {...form.register("userWritable")}
              />
              <Checkbox label="Required" {...form.register("required")} />
              <Checkbox
                label="Must be unique across everyone"
                hint="Fixed after creation."
                {...form.register("unique")}
              />
            </div>
          </div>

          {problem && problem.fieldErrors.length === 0 && !problem.code.includes("taken") ? (
            <p role="alert" className="mt-4 text-body-sm text-error">
              {problem.message}
            </p>
          ) : null}

          <div className="mt-8 flex justify-end gap-3">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="default" disabled={create.isPending}>
              {create.isPending ? "Adding…" : "Add field"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Checkbox({
  label,
  hint,
  ...props
}: React.ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" {...props} />
      <span>
        <span className="block text-body-sm text-ink">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-caption text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}
