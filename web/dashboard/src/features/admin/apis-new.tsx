import { Button, Field, Input, ScopeChip, Textarea } from "@iden/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";
import { useApi } from "../../app/api";
import { NotSet, ReviewItem, ReviewList, Wizard, type Step } from "../../app/wizard";
import { useWrite, type ApiRecord } from "./api";

const SCOPE_PATTERN = /^[a-z][a-z0-9_-]*(:[a-z0-9_-]+)+$/;

const schema = z.object({
  name: z
    .string()
    .min(1, "Name the API.")
    .regex(/^[a-z][a-z0-9-]*$/, "Lowercase and hyphenated — e.g. `attendance`."),
  audience: z
    .string()
    .min(1, "An audience is required.")
    .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
      message: "Must be an absolute URI.",
    }),
  description: z.string(),
  scopes: z.array(
    z.object({
      value: z
        .string()
        .min(1, "A scope needs a value.")
        .regex(SCOPE_PATTERN, "Namespaced, e.g. `attendance:records:read`."),
      description: z.string().min(1, "Write the sentence a user will read on the consent screen."),
    }),
  ),
});

type Values = z.infer<typeof schema>;

export function ApiCreateRoute() {
  const api = useApi();
  const navigate = useNavigate();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", audience: "", description: "", scopes: [] },
  });

  const scopes = useFieldArray({ control: form.control, name: "scopes" });

  // The API first, then its scopes. A scope cannot exist without the API that
  // defines it, so the order is the dependency rather than a preference.
  const create = useWrite<Values, ApiRecord>(["/admin/apis"], async (values) => {
    const response = await api.post<ApiRecord>("/admin/apis", {
      name: values.name,
      audience: values.audience,
      description: values.description || null,
    });
    for (const scope of values.scopes) {
      await api.post(`/admin/apis/${response.data.id}/scopes`, scope);
    }
    return response.data;
  });

  const steps: Step<Values>[] = [
    {
      id: "basics",
      label: "Basics",
      title: "What backend is this?",
      lede: "Registering an API fixes the `aud` value its tokens will carry. That value is what lets the API reject a token minted for somebody else.",
      fields: ["name", "audience", "description"],
      render: (f) => (
        <div className="flex max-w-xl flex-col gap-6">
          <Field label="Name" required error={f.formState.errors.name?.message}>
            {(props) => (
              <Input
                {...props}
                {...f.register("name")}
                placeholder="attendance"
                className="font-identity"
              />
            )}
          </Field>
          <Field
            label="Audience"
            required
            hint="An absolute URI identifying this API. It does not have to resolve — it is a name, not an address. Immutable once set."
            error={f.formState.errors.audience?.message}
          >
            {(props) => (
              <Input
                {...props}
                {...f.register("audience")}
                className="font-identity"
                placeholder="https://api.example.org/attendance"
              />
            )}
          </Field>
          <Field label="Description" hint="What this backend is for.">
            {(props) => <Textarea {...props} {...f.register("description")} rows={3} />}
          </Field>
        </div>
      ),
    },
    {
      id: "scopes",
      label: "Scopes",
      title: "What permissions does it define?",
      lede: "Optional now, and addable later. Scope values are globally unique, so namespace them by API.",
      fields: ["scopes"],
      render: (f) => (
        <div className="flex flex-col gap-4">
          {scopes.fields.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">
              No scopes yet. An API with none is registered but grants nothing.
            </p>
          ) : null}

          {scopes.fields.map((entry, index) => (
            <div
              key={entry.id}
              className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-start"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <Field
                  label="Value"
                  required
                  error={f.formState.errors.scopes?.[index]?.value?.message}
                >
                  {(props) => (
                    <Input
                      {...props}
                      {...f.register(`scopes.${index}.value`)}
                      className="font-identity"
                      placeholder="attendance:records:read"
                    />
                  )}
                </Field>
                <Field
                  label="Description"
                  required
                  hint="Written for the person reading the consent screen."
                  error={f.formState.errors.scopes?.[index]?.description?.message}
                >
                  {(props) => (
                    <Input
                      {...props}
                      {...f.register(`scopes.${index}.description`)}
                      placeholder="View your attendance records."
                    />
                  )}
                </Field>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove this scope"
                onClick={() => scopes.remove(index)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => scopes.append({ value: "", description: "" })}
          >
            <Plus aria-hidden="true" />
            Add a scope
          </Button>
        </div>
      ),
    },
    {
      id: "review",
      label: "Review",
      title: "Check this before it exists",
      lede: "The audience cannot be changed afterwards — tokens already issued carry it, and resource servers validate against it.",
      render: (f) => {
        const v = f.getValues();
        return (
          <ReviewList>
            <ReviewItem label="Name">{v.name}</ReviewItem>
            <ReviewItem label="Audience">
              <span className="font-identity">{v.audience}</span>
            </ReviewItem>
            <ReviewItem label="Description">{v.description || <NotSet />}</ReviewItem>
            <ReviewItem label={`Scopes (${v.scopes.length})`}>
              {v.scopes.length ? (
                <span className="flex flex-wrap justify-end gap-1">
                  {v.scopes.map((scope) => (
                    <ScopeChip key={scope.value} value={scope.value} />
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
      title="Register an API"
      lede="A backend that will accept IDEN's access tokens."
      section={{ label: "APIs", to: "/admin/apis" }}
      backTo="/admin/apis"
      backLabel="Back to APIs"
      submitLabel="Register API"
      pending={create.isPending}
      error={create.error}
      onSubmit={(values) =>
        create.mutate(values, {
          onSuccess: (record) => void navigate(`/admin/apis/${record.id}`),
        })
      }
    />
  );
}
