import { Field, Input, Spinner, Textarea } from "@iden/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";
import { useApi } from "../../app/api";
import { NotSet, ReviewItem, ReviewList, Wizard, type Step } from "../../app/wizard";
import { useWrite, type GroupRecord } from "./api";
import { useRoleOptions } from "./options";
import { SetPicker } from "./picker";

const schema = z.object({
  name: z.string().min(1, "Name the group."),
  description: z.string(),
  roleIds: z.array(z.string()),
});

type Values = z.infer<typeof schema>;

export function GroupCreateRoute() {
  const api = useApi();
  const navigate = useNavigate();
  const roleOptions = useRoleOptions();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", description: "", roleIds: [] },
  });

  // Two requests, because roles are set on their own endpoint. The group is
  // created first, so a failure to attach roles leaves a group that exists and
  // can be fixed rather than nothing at all.
  const create = useWrite<Values, GroupRecord>(["/admin/groups"], async (values) => {
    const response = await api.post<GroupRecord>("/admin/groups", {
      name: values.name,
      description: values.description || null,
    });
    if (values.roleIds.length) {
      await api.put(`/admin/groups/${response.data.id}/roles`, { roleIds: values.roleIds });
    }
    return response.data;
  });

  const steps: Step<Values>[] = [
    {
      id: "basics",
      label: "Basics",
      title: "What does this group represent?",
      lede: "A department, a team, a cohort. Groups are flat — they do not nest, because recursive membership is hard to explain and harder to audit.",
      fields: ["name", "description"],
      render: (f) => (
        <div className="flex max-w-xl flex-col gap-6">
          <Field label="Name" required error={f.formState.errors.name?.message}>
            {(props) => <Input {...props} {...f.register("name")} placeholder="Students" />}
          </Field>
          <Field label="Description" hint="Who belongs in here.">
            {(props) => <Textarea {...props} {...f.register("description")} rows={3} />}
          </Field>
        </div>
      ),
    },
    {
      id: "roles",
      label: "Roles",
      title: "What does membership grant?",
      lede: "Every member inherits these. This is how one change reaches a whole department.",
      render: (f) =>
        roleOptions.isPending ? (
          <Spinner label="Loading roles" />
        ) : (
          <Controller
            control={f.control}
            name="roleIds"
            render={({ field }) => (
              <SetPicker
                legend="Roles"
                options={roleOptions.data ?? []}
                selected={new Set(field.value)}
                onChange={(next) => field.onChange([...next])}
                emptyLabel="No roles are defined yet."
              />
            )}
          />
        ),
    },
    {
      id: "review",
      label: "Review",
      title: "Check this before it exists",
      lede: "Members are added afterwards, from the group's own page.",
      render: (f) => {
        const v = f.getValues();
        const roles = (roleOptions.data ?? [])
          .filter((option) => v.roleIds.includes(option.id))
          .map((option) => option.label);
        return (
          <ReviewList>
            <ReviewItem label="Name">{v.name}</ReviewItem>
            <ReviewItem label="Description">{v.description || <NotSet />}</ReviewItem>
            <ReviewItem label="Roles">{roles.length ? roles.join(", ") : <NotSet />}</ReviewItem>
          </ReviewList>
        );
      },
    },
  ];

  return (
    <Wizard
      form={form}
      steps={steps}
      title="Create a group"
      lede="A set of people who should be treated the same way."
      section={{ label: "Groups", to: "/admin/groups" }}
      backTo="/admin/groups"
      backLabel="Back to groups"
      submitLabel="Create group"
      pending={create.isPending}
      error={create.error}
      onSubmit={(values) =>
        create.mutate(values, {
          onSuccess: (record) => void navigate(`/admin/groups/${record.id}`),
        })
      }
    />
  );
}
