import {
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  IdenError,
  Input,
  SearchInput,
  StatusDot,
  Pagination,
  ProvenanceTrace,
  SecretRevealOnce,
  Spinner,
  type Column,
} from "@iden/shared";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { useApi } from "../../app/api";
import { PageHeader } from "../../app/shell";
import {
  useList,
  useRecord,
  useWrite,
  type EffectiveScopes,
  type UserCreated,
  type UserRecord,
} from "./api";
import { SetPicker } from "./picker";
import { useRoleOptions, useScopeOptions } from "./options";

const columns: Column<UserRecord>[] = [
  {
    key: "name",
    header: "Person",
    cell: (user) => user.displayName ?? user.username,
  },
  { key: "email", header: "Email", cell: (user) => user.email },
  {
    key: "roles",
    header: "Roles",
    secondary: true,
    cell: (user) => user.roles.map((role) => role.name).join(", ") || "—",
  },
  {
    key: "status",
    header: "Status",
    cell: (user) =>
      user.isActive ? (
        <StatusDot tone="success" label="Active" />
      ) : (
        <StatusDot tone="muted" label="Deactivated" />
      ),
  },
];

export function UsersRoute() {
  const api = useApi();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);

  const users = useList<UserRecord>(api, "/admin/users", {
    offset,
    ...(search ? { search } : {}),
  });

  return (
    <>
      <PageHeader
        title="Users"
        lede="Everyone with an account in this organization, and what each of them can do."
        count={users.data?.meta.total}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Add user
          </Button>
        }
      />

      <div className="mb-6">
        <SearchInput
          className="max-w-sm"
          placeholder="Search by name, username or email"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOffset(0);
          }}
        />
      </div>

      {users.isPending ? (
        <Spinner label="Loading users" />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : users.data.items.length === 0 ? (
        <EmptyState
          title={search ? "No one matches that search" : "No users yet"}
          body={
            search
              ? "Try a different name, username, or email address."
              : "Add the people who need accounts. You can assign their roles as you go."
          }
          action={
            search ? undefined : (
              <Button variant="primary" onClick={() => setCreating(true)}>
                Add user
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataTable
            caption="Users"
            columns={columns}
            rows={users.data.items}
            rowKey={(user) => user.id}
            onRowClick={(user) => void navigate(`/admin/users/${user.id}`)}
          />
          <Pagination meta={users.data.meta} onOffsetChange={setOffset} />
        </>
      )}

      <CreateUserDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const api = useApi();
  const form = useForm({ defaultValues: { email: "", username: "", displayName: "" } });
  const [created, setCreated] = useState<UserCreated | null>(null);

  const create = useWrite<{ email: string; username: string; displayName: string }, UserCreated>(
    ["/admin/users"],
    async (body) => {
      const response = await api.post<UserCreated>("/admin/users", {
        ...body,
        displayName: body.displayName || null,
      });
      return response.data;
    },
  );

  const problem = create.error instanceof IdenError ? create.error : null;

  function close() {
    onOpenChange(false);
    setCreated(null);
    create.reset();
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <Dialog.Content>
        {created ? (
          <>
            <Dialog.Title className="text-display-sm font-display text-ink">
              {created.displayName ?? created.username} added
            </Dialog.Title>
            {created.generatedPassword ? (
              <div className="mt-5">
                <SecretRevealOnce
                  label="One-time password"
                  secret={created.generatedPassword}
                  note="Give this to them directly. It is not stored and cannot be shown again — you can issue a new one from their page."
                />
              </div>
            ) : null}
            <div className="mt-8 flex justify-end">
              <Button variant="primary" onClick={close}>
                Done
              </Button>
            </div>
          </>
        ) : (
          <form
            noValidate
            onSubmit={form.handleSubmit((values) =>
              create.mutate(values, { onSuccess: setCreated }),
            )}
          >
            <Dialog.Title className="text-display-sm font-display text-ink">
              Add a user
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-body-sm text-body">
              A one-time password is generated for them. Roles can be assigned afterwards.
            </Dialog.Description>

            <div className="mt-6 flex flex-col gap-5">
              <Field label="Email" required error={fieldMessage(problem, "email")}>
                {(props) => <Input {...props} {...form.register("email")} type="email" />}
              </Field>
              <Field
                label="Username"
                required
                hint="Letters, numbers, dots, dashes and underscores."
                error={fieldMessage(problem, "username")}
              >
                {(props) => <Input {...props} {...form.register("username")} />}
              </Field>
              <Field label="Display name" error={fieldMessage(problem, "displayName")}>
                {(props) => <Input {...props} {...form.register("displayName")} />}
              </Field>
            </div>

            {problem && problem.fieldErrors.length === 0 && !isTaken(problem) ? (
              <p role="alert" className="mt-4 text-body-sm text-error">
                {problem.message}
              </p>
            ) : null}

            <div className="mt-8 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={create.isPending}>
                {create.isPending ? "Adding…" : "Add user"}
              </Button>
            </div>
          </form>
        )}
      </Dialog.Content>
    </Dialog>
  );
}

export function UserDetailRoute() {
  const { userId = "" } = useParams();
  const api = useApi();
  const navigate = useNavigate();

  const user = useRecord<UserRecord>(api, `/admin/users/${userId}`);
  const scopes = useRecord<EffectiveScopes>(api, `/admin/users/${userId}/effective-scopes`);
  const roleOptions = useRoleOptions();
  const scopeOptions = useScopeOptions();

  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  const setRoles = useWrite<string[], void>(
    [`/admin/users/${userId}`, `/admin/users/${userId}/effective-scopes`],
    async (roleIds) => {
      await api.put(`/admin/users/${userId}/roles`, { roleIds });
    },
  );

  const setScopes = useWrite<string[], void>(
    [`/admin/users/${userId}`, `/admin/users/${userId}/effective-scopes`],
    async (scopeIds) => {
      await api.put(`/admin/users/${userId}/scopes`, { scopeIds });
    },
  );

  const resetPassword = useWrite<void, { password: string | null }>(
    [`/admin/users/${userId}`],
    async () => {
      const response = await api.post<{ password: string | null }>(
        `/admin/users/${userId}/reset-password`,
        {},
      );
      return response.data;
    },
  );

  const remove = useWrite<void, void>(["/admin/users"], async () => {
    await api.delete(`/admin/users/${userId}`);
  });

  if (user.isPending) return <Spinner label="Loading this person" />;
  if (user.isError) return <ErrorState error={user.error} onRetry={() => void user.refetch()} />;

  const record = user.data;
  const selectedScopeIds = new Set(
    (scopeOptions.data ?? [])
      .filter((option) => option.identifier && record.directScopes.includes(option.identifier))
      .map((option) => option.id),
  );

  return (
    <>
      <Link to="/admin/users" className="text-caption text-muted hover:text-ink">
        ← Users
      </Link>

      <PageHeader
        title={record.displayName ?? record.username}
        lede={`${record.email} · ${record.isActive ? "active" : "deactivated"}`}
      />

      <section className="mb-12">
        <h2 className="mb-3 text-title-lg text-ink">Roles</h2>
        <p className="mb-4 max-w-prose text-body-sm text-muted">
          Roles bundle permissions. Saving replaces the whole set.
        </p>
        {roleOptions.data ? (
          <RoleEditor
            key={record.roles.map((role) => role.id).join(",")}
            options={roleOptions.data}
            initial={new Set(record.roles.map((role) => role.id))}
            onSave={(ids) => setRoles.mutate([...ids])}
            pending={setRoles.isPending}
          />
        ) : (
          <Spinner label="Loading roles" />
        )}
      </section>

      <section className="mb-12">
        <h2 className="mb-3 text-title-lg text-ink">Direct grants</h2>
        <p className="mb-4 max-w-prose text-body-sm text-muted">
          One-off exceptions that bypass roles. Prefer a role when more than one person needs the
          same thing.
        </p>
        {scopeOptions.data ? (
          <RoleEditor
            key={record.directScopes.join(",")}
            options={scopeOptions.data}
            initial={selectedScopeIds}
            onSave={(ids) => setScopes.mutate([...ids])}
            pending={setScopes.isPending}
            legend="Scopes"
          />
        ) : (
          <Spinner label="Loading scopes" />
        )}
      </section>

      <section className="mb-12">
        <h2 className="mb-3 text-title-lg text-ink">Groups</h2>
        <p className="text-body-sm text-body">
          {record.groups.length > 0
            ? record.groups.map((group) => group.name).join(", ")
            : "Not a member of any group."}
        </p>
        <p className="mt-1 text-caption text-muted">Membership is managed from the group's page.</p>
      </section>

      <section className="mb-12">
        <h2 className="mb-3 text-title-lg text-ink">Everything they can do</h2>
        {scopes.isPending ? (
          <Spinner label="Resolving permissions" />
        ) : scopes.isError ? (
          <ErrorState error={scopes.error} />
        ) : scopes.data.scopes.length === 0 ? (
          <p className="text-body-sm text-muted">No permissions yet.</p>
        ) : (
          <ProvenanceTrace scopes={scopes.data.scopes} />
        )}
      </section>

      <section className="border-t border-hairline pt-8">
        <h2 className="mb-4 text-title-lg text-ink">Account actions</h2>
        {issued ? (
          <div className="mb-6">
            <SecretRevealOnce label="New one-time password" secret={issued} />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setResetting(true)}>Issue a new password</Button>
          <Button variant="danger" onClick={() => setDeleting(true)}>
            Delete user
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        title="Issue a new password?"
        body="Their current password stops working immediately and every session they have is signed out. You'll get a one-time password to hand over."
        confirmLabel="Issue password"
        destructive={false}
        pending={resetPassword.isPending}
        onConfirm={() =>
          resetPassword.mutate(undefined, {
            onSuccess: (result) => {
              setIssued(result.password);
              setResetting(false);
            },
          })
        }
      />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${record.displayName ?? record.username}?`}
        body="Their account, sessions and grants are removed. This cannot be undone — deactivating them instead keeps the record."
        confirmLabel="Delete user"
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(undefined, { onSuccess: () => void navigate("/admin/users") })
        }
      />
    </>
  );
}

/** A picker with its own save button, since these endpoints replace the whole set. */
function RoleEditor({
  options,
  initial,
  onSave,
  pending,
  legend = "Roles",
}: {
  options: { id: string; label: string; identifier?: string; hint?: string }[];
  initial: Set<string>;
  onSave: (ids: Set<string>) => void;
  pending: boolean;
  legend?: string;
}) {
  const [selected, setSelected] = useState(initial);
  const changed = selected.size !== initial.size || [...selected].some((id) => !initial.has(id));

  return (
    <>
      <SetPicker
        legend={legend}
        options={options}
        selected={selected}
        onChange={setSelected}
        emptyLabel={`No ${legend.toLowerCase()} defined yet.`}
      />
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" disabled={!changed || pending} onClick={() => onSave(selected)}>
          {pending ? "Saving…" : `Save ${legend.toLowerCase()}`}
        </Button>
        {changed ? (
          <Button variant="ghost" onClick={() => setSelected(initial)}>
            Discard
          </Button>
        ) : null}
      </div>
    </>
  );
}

function isTaken(problem: IdenError): boolean {
  return problem.code === "email_taken" || problem.code === "username_taken";
}

/**
 * Field-level messages, not a toast: `email_taken` belongs beside the email
 * input, where the person can fix it.
 */
function fieldMessage(problem: IdenError | null, field: string): string | undefined {
  if (!problem) return undefined;
  if (problem.code === "email_taken" && field === "email")
    return "That address already belongs to an account.";
  if (problem.code === "username_taken" && field === "username") return "That username is taken.";
  return problem.fieldErrors.find((entry) => entry.field === field)?.message;
}
