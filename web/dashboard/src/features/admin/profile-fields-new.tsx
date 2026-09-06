import {
  Badge,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
  Textarea,
  cn,
  get,
  type components,
} from "@iden/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";
import { useApi } from "../../app/api";
import { NotSet, ReviewItem, ReviewList, Wizard, type Step } from "../../app/wizard";
import { useWrite, type ProfileFieldRecord } from "./api";
import { useGroupOptions } from "./options";

type Preset = components["schemas"]["FieldPresetResponse"];

const DATA_TYPES = [
  { value: "string", label: "Text" },
  { value: "integer", label: "Number" },
  { value: "boolean", label: "Yes or no" },
  { value: "date", label: "Date" },
  { value: "enum", label: "One of a list" },
  { value: "email", label: "Email address" },
  { value: "phone", label: "Phone number" },
  { value: "url", label: "URL" },
] as const;

const schema = z
  .object({
    key: z
      .string()
      .min(1, "A key is required.")
      .regex(/^[a-z][a-z0-9_]*$/, "Lowercase, starting with a letter — e.g. `student_id`."),
    label: z.string().min(1, "Give the field a label."),
    description: z.string(),
    dataType: z.enum(["string", "integer", "boolean", "date", "enum", "email", "phone", "url"]),
    options: z.array(z.object({ value: z.string().min(1, "An option cannot be blank.") })),
    required: z.boolean(),
    unique: z.boolean(),
    userReadable: z.boolean(),
    userWritable: z.boolean(),
    groupId: z.string(),
    claimName: z.string(),
    claimScope: z.string(),
  })
  .refine((v) => v.dataType !== "enum" || v.options.length > 0, {
    path: ["options"],
    message: "A field of this type needs at least one option.",
  })
  .refine((v) => Boolean(v.claimName) === Boolean(v.claimScope), {
    path: ["claimScope"],
    message: "A claim name and a claim scope go together — a claim with no scope reaches everyone.",
  });

type Values = z.infer<typeof schema>;

const BLANK: Values = {
  key: "",
  label: "",
  description: "",
  dataType: "string",
  options: [],
  required: false,
  unique: false,
  userReadable: true,
  userWritable: false,
  groupId: "",
  claimName: "",
  claimScope: "",
};

export function ProfileFieldCreateRoute() {
  const api = useApi();
  const navigate = useNavigate();
  const groupOptions = useGroupOptions();

  const presets = useQuery({
    queryKey: ["profile-field-presets"],
    queryFn: () =>
      get<{ presets: Preset[] }>(api, "/admin/profile-fields/presets").then((r) => r.presets),
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: BLANK,
  });

  const create = useWrite<Values, ProfileFieldRecord>(["/admin/profile-fields"], async (values) => {
    const response = await api.post<ProfileFieldRecord>("/admin/profile-fields", {
      key: values.key,
      label: values.label,
      description: values.description || null,
      dataType: values.dataType,
      options: values.options.map((option) => option.value),
      required: values.required,
      unique: values.unique,
      userReadable: values.userReadable,
      userWritable: values.userWritable,
      groupId: values.groupId || null,
      claimName: values.claimName || null,
      claimScope: values.claimScope || null,
    });
    return response.data;
  });

  const options = useFieldArray({ control: form.control, name: "options" });
  const dataType = useWatch({ control: form.control, name: "dataType" });
  const claimName = useWatch({ control: form.control, name: "claimName" });

  function apply(preset: Preset) {
    form.reset({
      ...BLANK,
      key: preset.key,
      label: preset.label,
      description: preset.description,
      dataType: preset.dataType,
      options: preset.options.map((value) => ({ value })),
      required: preset.required,
      unique: preset.unique,
      userReadable: preset.userReadable,
      userWritable: preset.userWritable,
    });
  }

  const steps: Step<Values>[] = [
    {
      id: "start",
      label: "Start",
      title: "Start from something, or from nothing",
      lede: "Presets are templates — nothing is created until the last step, and you can change every part of one first.",
      render: () =>
        presets.isPending ? (
          <Spinner label="Loading presets" />
        ) : (
          <PresetPicker
            presets={presets.data ?? []}
            onPick={apply}
            onBlank={() => form.reset(BLANK)}
          />
        ),
    },
    {
      id: "definition",
      label: "Definition",
      title: "What is being collected?",
      fields: ["key", "label", "description", "dataType", "options"],
      render: (f) => (
        <div className="flex max-w-xl flex-col gap-6">
          <Field label="Label" required error={f.formState.errors.label?.message}>
            {(props) => <Input {...props} {...f.register("label")} placeholder="Student ID" />}
          </Field>

          <Field
            label="Key"
            required
            hint="The stable identifier. It cannot be changed later, because values are already stored against it."
            error={f.formState.errors.key?.message}
          >
            {(props) => (
              <Input
                {...props}
                {...f.register("key")}
                className="font-identity"
                placeholder="student_id"
              />
            )}
          </Field>

          <Field label="Description" hint="Shown under the field on the person's own profile form.">
            {(props) => <Textarea {...props} {...f.register("description")} rows={2} />}
          </Field>

          <Field
            label="Type"
            hint="Also fixed once values exist — a stored value cannot be recast."
          >
            {(props) => (
              <Controller
                control={f.control}
                name="dataType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...props} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATA_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>

          {dataType === "enum" ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="text-caption font-medium text-body-strong">Allowed values</legend>
              {options.fields.map((entry, index) => (
                <div key={entry.id} className="flex items-center gap-2">
                  <Input {...f.register(`options.${index}.value`)} />
                  <button
                    type="button"
                    aria-label="Remove this option"
                    className="rounded-md p-2 text-muted-soft hover:bg-secondary hover:text-foreground"
                    onClick={() => options.remove(index)}
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {f.formState.errors.options?.message ? (
                <p className="text-caption text-destructive">
                  {f.formState.errors.options.message}
                </p>
              ) : null}
              <button
                type="button"
                className="self-start text-caption text-primary hover:underline"
                onClick={() => options.append({ value: "" })}
              >
                <Plus aria-hidden="true" className="mr-1 inline h-3 w-3" />
                Add an option
              </button>
            </fieldset>
          ) : null}

          <Controller
            control={f.control}
            name="required"
            render={({ field }) => (
              <Toggle
                checked={field.value}
                onChange={field.onChange}
                label="Required"
                hint="An empty value is refused. Existing people are not asked retroactively."
              />
            )}
          />
          <Controller
            control={f.control}
            name="unique"
            render={({ field }) => (
              <Toggle
                checked={field.value}
                onChange={field.onChange}
                label="No two people may share a value"
                hint="Enforced by a database constraint, not a check — two registrations at the same instant cannot both win. Cannot be turned on later."
              />
            )}
          />
        </div>
      ),
    },
    {
      id: "who",
      label: "Who",
      title: "Who has it, and who may change it",
      lede: "The two questions that decide what self-service means for this field.",
      render: (f) => (
        <div className="flex max-w-xl flex-col gap-8">
          <Field
            label="Applies to"
            hint="Bound to a group, the field is part of that group's members' profiles and nobody else's. This is how students and staff get different forms without a second grouping concept."
          >
            {(props) => (
              <Controller
                control={f.control}
                name="groupId"
                render={({ field }) => (
                  <Select
                    value={field.value || "everyone"}
                    onValueChange={(value) => field.onChange(value === "everyone" ? "" : value)}
                  >
                    <SelectTrigger {...props} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">Everyone in the organization</SelectItem>
                      {(groupOptions.data ?? []).map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          Members of {group.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>

          <Controller
            control={f.control}
            name="userReadable"
            render={({ field }) => (
              <Toggle
                checked={field.value}
                onChange={field.onChange}
                label="They can see it"
                hint="Turn this off for something recorded about a person that they should not be shown."
              />
            )}
          />
          <Controller
            control={f.control}
            name="userWritable"
            render={({ field }) => (
              <Toggle
                checked={field.value}
                onChange={field.onChange}
                label="They can change it"
                hint="On means it belongs to the person — a preferred name. Off means it belongs to the organization — a student number, set by whoever issued it."
              />
            )}
          />
        </div>
      ),
    },
    {
      id: "claim",
      label: "Release",
      title: "Should applications receive it?",
      lede: "Fields are invisible to every application until both parts are set, and then only to one holding that scope. Data minimization by default.",
      fields: ["claimName", "claimScope"],
      render: (f) => (
        <div className="flex max-w-xl flex-col gap-6">
          <Field
            label="Claim name"
            hint="The name it takes in an ID token. Leave empty and this field never leaves IDEN."
            error={f.formState.errors.claimName?.message}
          >
            {(props) => <Input {...props} {...f.register("claimName")} className="font-identity" />}
          </Field>
          <Field
            label="Claim scope"
            hint="The scope an application must hold to receive it. Must already exist."
            error={f.formState.errors.claimScope?.message}
          >
            {(props) => (
              <Input
                {...props}
                {...f.register("claimScope")}
                className="font-identity"
                disabled={!claimName}
              />
            )}
          </Field>
        </div>
      ),
    },
    {
      id: "review",
      label: "Review",
      title: "Check this before it applies to anyone",
      lede: "The key, the type and uniqueness cannot be changed once values exist.",
      render: (f) => {
        const v = f.getValues();
        const group = (groupOptions.data ?? []).find((option) => option.id === v.groupId);
        return (
          <ReviewList>
            <ReviewItem label="Label">{v.label}</ReviewItem>
            <ReviewItem label="Key">
              <span className="font-identity">{v.key}</span>
            </ReviewItem>
            <ReviewItem label="Type">
              {DATA_TYPES.find((type) => type.value === v.dataType)?.label}
            </ReviewItem>
            {v.dataType === "enum" ? (
              <ReviewItem label="Options">
                {v.options.map((option) => option.value).join(", ") || <NotSet />}
              </ReviewItem>
            ) : null}
            <ReviewItem label="Applies to">
              {group ? `Members of ${group.label}` : "Everyone"}
            </ReviewItem>
            <ReviewItem label="Owned by">
              {v.userWritable
                ? "The person — they can change it"
                : "The organization — read-only to them"}
            </ReviewItem>
            <ReviewItem label="Visible to them">{v.userReadable ? "Yes" : "No"}</ReviewItem>
            <ReviewItem label="Required">{v.required ? "Yes" : "No"}</ReviewItem>
            <ReviewItem label="Unique">{v.unique ? "Yes" : "No"}</ReviewItem>
            <ReviewItem label="Released to applications">
              {v.claimName ? (
                <span className="font-identity">
                  {v.claimName} under {v.claimScope}
                </span>
              ) : (
                "Never leaves IDEN"
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
      title="Define a profile field"
      lede="Something this organization records about the people in it."
      section={{ label: "Profile fields", to: "/admin/profile-fields" }}
      backTo="/admin/profile-fields"
      backLabel="Back to profile fields"
      submitLabel="Create field"
      pending={create.isPending}
      error={create.error}
      onSubmit={(values) =>
        create.mutate(values, { onSuccess: () => void navigate("/admin/profile-fields") })
      }
    />
  );
}

/**
 * The catalogue, grouped the way the server groups it.
 *
 * Each card leads with `rationale` rather than the field's own description: the
 * reader here is an administrator deciding whether they want the field, not the
 * person who will eventually fill it in.
 */
function PresetPicker({
  presets,
  onPick,
  onBlank,
}: {
  presets: Preset[];
  onPick: (preset: Preset) => void;
  onBlank: () => void;
}) {
  const categories = [...new Set(presets.map((preset) => preset.category))];

  return (
    <div className="flex flex-col gap-8">
      <button
        type="button"
        onClick={onBlank}
        className="rounded-lg border border-dashed border-border px-5 py-4 text-left hover:bg-secondary/40"
      >
        <p className="text-title-sm text-foreground">Start from nothing</p>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Define every part yourself. Continue without picking a preset.
        </p>
      </button>

      {categories.map((category) => (
        <section key={category}>
          <h3 className="mb-3 text-caption-upper uppercase text-muted-foreground">{category}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {presets
              .filter((preset) => preset.category === category)
              .map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => onPick(preset)}
                  className={cn(
                    "rounded-lg border border-border px-4 py-3.5 text-left transition-colors duration-100",
                    "hover:border-primary hover:bg-secondary/40",
                  )}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-title-sm text-foreground">{preset.label}</span>
                    <Badge variant="secondary">{preset.dataType}</Badge>
                    {preset.userWritable ? null : <Badge variant="outline">org-owned</Badge>}
                  </span>
                  <span className="mt-1.5 block text-body-sm text-muted-foreground">
                    {preset.rationale}
                  </span>
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <Switch checked={checked} onCheckedChange={onChange} id={label} className="mt-1" />
      <div className="min-w-0">
        <label htmlFor={label} className="text-body-sm text-foreground">
          {label}
        </label>
        <p className="mt-1 text-caption text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
