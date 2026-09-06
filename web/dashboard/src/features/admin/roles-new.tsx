import { Field, Input, ScopeChip, Spinner, Textarea } from "@iden/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";
import { useApi } from "../../app/api";
import { NotSet, ReviewItem, ReviewList, Wizard, type Step } from "../../app/wizard";
import { useWrite, type RoleRecord } from "./api";
import { useScopeOptions } from "./options";
import { SetPicker } from "./picker";

const schema = z.object({
  name: z.string().min(1, "Name the job function."),
  description: z.string(),
  scopeIds: z.array(z.string()),
});

type Values = z.infer<typeof schema>;

export function RoleCreateRoute() {
  const api = useApi();
  const navigate = useNavigate();
  const scopeOptions = useScopeOptions();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", description: "", scopeIds: [] },
  });

  const create = useWrite<Values, RoleRecord>(["/admin/roles"], async (values) => {
    const response = await api.post<RoleRecord>("/admin/roles", {
      name: values.name,
      description: values.description || null,
      scopeIds: values.scopeIds,
    });
    return response.data;
  });

  const steps: Step<Values>[] = [
    {
      id: "basics",
      label: "Basics",
      title: "What is this role for?",
      lede: "Name it the way the organization says it out loud — a job, not a permission list.",
      fields: ["name", "description"],
      render: (f) => (
        <div className="flex max-w-xl flex-col gap-6">
          <Field label="Name" required error={f.formState.errors.name?.message}>
            {(props) => (
              <Input {...props} {...f.register("name")} placeholder="attendance-officer" />
            )}
          </Field>
          <Field
            label="Description"
            hint="Who holds this, and why. The next administrator will thank you."
          >
            {(props) => <Textarea {...props} {...f.register("description")} rows={3} />}
          </Field>
        </div>
      ),
    },
    {
      id: "scopes",
      label: "Permissions",
      title: "What does it allow?",
      lede: "Scopes from any API. One role can span several — a real job rarely stops at one system's boundary.",
      render: (f) =>
        scopeOptions.isPending ? (
          <Spinner label="Loading scopes" />
        ) : (
          <Controller
            control={f.control}
            name="scopeIds"
            render={({ field }) => (
              <SetPicker
                legend="Scopes"
                options={scopeOptions.data ?? []}
                selected={new Set(field.value)}
                onChange={(next) => field.onChange([...next])}
                emptyLabel="No scopes are defined yet. Register an API first."
              />
            )}
          />
        ),
    },
    {
      id: "review",
      label: "Review",
      title: "Check this before it can be assigned",
      lede: "Assigning this role to anyone grants everything listed here at their next sign-in.",
      render: (f) => {
        const v = f.getValues();
        const chosen = (scopeOptions.data ?? []).filter((option) => v.scopeIds.includes(option.id));
        return (
          <ReviewList>
            <ReviewItem label="Name">{v.name}</ReviewItem>
            <ReviewItem label="Description">{v.description || <NotSet />}</ReviewItem>
            <ReviewItem label={`Permissions (${chosen.length})`}>
              {chosen.length ? (
                <span className="flex flex-wrap justify-end gap-1">
                  {chosen.map((option) => (
                    <ScopeChip key={option.id} value={option.identifier ?? option.label} />
                  ))}
                </span>
              ) : (
                <NotSet />
              )}
            </ReviewItem>
          </ReviewList>
        );
      },
    },
  ];

  return (
    <Wizard
      form={form}
      steps={steps}
      title="Create a role"
      lede="A named bundle of permissions, assignable to people and to groups."
      section={{ label: "Roles", to: "/admin/roles" }}
      backTo="/admin/roles"
      backLabel="Back to roles"
      submitLabel="Create role"
      pending={create.isPending}
      error={create.error}
      onSubmit={(values) =>
        create.mutate(values, {
          onSuccess: (record) => void navigate(`/admin/roles/${record.id}`),
        })
      }
    />
  );
}
