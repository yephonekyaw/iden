import {
  Field,
  Input,
  Label,
  SecretRevealOnce,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
  Textarea,
  Button,
  ScopeChip,
} from "@iden/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";
import { useApi } from "../../app/api";
import { NotSet, ReviewItem, ReviewList, Wizard, type Step } from "../../app/wizard";
import { useWrite, type ClientCreated } from "./api";
import { useScopeOptions } from "./options";
import { SetPicker } from "./picker";

const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * The four shapes an OIDC client comes in.
 *
 * One question rather than three. "Can it keep a secret?" and "which grant?"
 * are not independent decisions an administrator makes — they follow from what
 * kind of application this is, and every other OIDC console asks it this way for
 * that reason. The consequences are derived here, once.
 */
const APP_TYPES = {
  web: {
    label: "Web application",
    hint: "Server-side app — Next.js, Django, Rails. Keeps a secret.",
    clientType: "confidential",
    grants: ["authorization_code", "refresh_token"],
    summary: "Confidential · authorization code + PKCE",
  },
  spa: {
    label: "Single-page application",
    hint: "Runs in the browser — React, Vue, Angular. No secret; PKCE proves it.",
    clientType: "public",
    grants: ["authorization_code", "refresh_token"],
    summary: "Public · authorization code + PKCE",
  },
  native: {
    label: "Native or mobile app",
    hint: "iOS, Android, desktop. Anything a user can read the source of is public.",
    clientType: "public",
    grants: ["authorization_code", "refresh_token"],
    summary: "Public · authorization code + PKCE",
  },
  service: {
    label: "Machine-to-machine",
    hint: "A backend job or a kiosk acting as itself. No person signs in.",
    clientType: "confidential",
    grants: ["client_credentials"],
    summary: "Confidential · client credentials",
  },
} as const;

type AppType = keyof typeof APP_TYPES;

const schema = z
  .object({
    name: z.string().min(1, "Give the application a name."),
    clientId: z
      .string()
      .min(1, "Choose a client ID.")
      .regex(/^[a-zA-Z0-9._-]+$/, "Letters, numbers, dots, dashes and underscores only."),
    appType: z.enum(["web", "spa", "native", "service"]),
    redirectUris: z.string(),
    postLogoutRedirectUris: z.string(),
    grantableScopeIds: z.array(z.string()),
    grantedScopeIds: z.array(z.string()),
    backchannelLogoutUri: z.string(),
    backchannelLogoutSessionRequired: z.boolean(),
    skipConsent: z.boolean(),
  })
  .refine((values) => values.appType === "service" || lines(values.redirectUris).length > 0, {
    path: ["redirectUris"],
    message: "A client that signs people in needs at least one redirect URI.",
  })
  .refine((values) => lines(values.redirectUris).every((uri) => uri.includes("://")), {
    path: ["redirectUris"],
    message: "Each URI must be absolute, including the scheme.",
  });

type Values = z.infer<typeof schema>;

export function ClientCreateRoute() {
  const api = useApi();
  const navigate = useNavigate();
  const scopeOptions = useScopeOptions();
  const [created, setCreated] = useState<ClientCreated | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      clientId: "",
      appType: "web",
      redirectUris: "",
      postLogoutRedirectUris: "",
      grantableScopeIds: [],
      grantedScopeIds: [],
      backchannelLogoutUri: "",
      backchannelLogoutSessionRequired: false,
      skipConsent: false,
    },
  });

  const create = useWrite<Values, ClientCreated>(["/admin/clients"], async (values) => {
    const kind = APP_TYPES[values.appType];
    const response = await api.post<ClientCreated>("/admin/clients", {
      clientId: values.clientId,
      name: values.name,
      clientType: kind.clientType,
      allowedGrants: [...kind.grants],
      redirectUris: values.appType === "service" ? [] : lines(values.redirectUris),
      postLogoutRedirectUris: lines(values.postLogoutRedirectUris),
      backchannelLogoutUri: values.backchannelLogoutUri.trim() || null,
      backchannelLogoutSessionRequired: values.backchannelLogoutSessionRequired,
      skipConsent: values.skipConsent,
      grantableScopeIds: values.grantableScopeIds,
      grantedScopeIds: values.grantedScopeIds,
    });
    return response.data;
  });

  const appType = useWatch({ control: form.control, name: "appType" }) as AppType;
  const usesCode = appType !== "service";
  const options = scopeOptions.data ?? [];
  const labelFor = (ids: string[]) =>
    options
      .filter((option) => ids.includes(option.id))
      .map((option) => option.identifier ?? option.label);

  if (created) {
    return <SecretHandover created={created} />;
  }

  const steps: Step<Values>[] = [
    {
      id: "basics",
      label: "Basics",
      title: "What is this application?",
      lede: "The name is what people see on the consent screen. The client ID is what the application sends to IDEN.",
      fields: ["name", "clientId", "appType"],
      render: (f) => (
        <div className="flex max-w-xl flex-col gap-6">
          <Field label="Name" required error={f.formState.errors.name?.message}>
            {(props) => <Input {...props} {...f.register("name")} placeholder="Attendance" />}
          </Field>

          <Field
            label="Client ID"
            required
            hint="Sent at /authorize and /token. Stable — choose something you will still recognise."
            error={f.formState.errors.clientId?.message}
          >
            {(props) => <Input {...props} {...f.register("clientId")} className="font-identity" />}
          </Field>

          <Field label="Application type" hint={APP_TYPES[appType].hint}>
            {(props) => (
              <Controller
                control={f.control}
                name="appType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...props} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(APP_TYPES).map(([value, kind]) => (
                        <SelectItem key={value} value={value}>
                          {kind.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>

          {/* What the choice above decided, so the consequence is visible
              before the review rather than only after it. Neither half can be
              changed once the client exists. */}
          <p className="-mt-3 text-caption text-muted-soft">
            {APP_TYPES[appType].summary} · fixed once registered
          </p>
        </div>
      ),
    },
    {
      id: "uris",
      label: "URIs",
      title: usesCode ? "Where does IDEN send people back?" : "No redirects needed",
      lede: usesCode
        ? "Matched exactly — no wildcards, and no forgiveness for a trailing slash. This is what stops an authorization code being delivered somewhere else."
        : undefined,
      fields: ["redirectUris"],
      render: (f) =>
        usesCode ? (
          <div className="flex max-w-xl flex-col gap-6">
            <Field
              label="Redirect URIs"
              required
              hint="One per line."
              error={f.formState.errors.redirectUris?.message}
            >
              {(props) => (
                <Textarea
                  {...props}
                  {...f.register("redirectUris")}
                  rows={3}
                  className="font-identity"
                  placeholder="https://app.example.org/callback"
                />
              )}
            </Field>
            <Field
              label="Post-logout redirect URIs"
              hint="Where a sign-out may return the browser. Optional; one per line."
            >
              {(props) => (
                <Textarea
                  {...props}
                  {...f.register("postLogoutRedirectUris")}
                  rows={2}
                  className="font-identity"
                />
              )}
            </Field>
          </div>
        ) : (
          <p className="max-w-prose text-body-md text-body">
            This client never sends a browser anywhere — it asks for a token directly with its own
            credentials. Continue.
          </p>
        ),
    },
    {
      id: "permissions",
      label: "Permissions",
      title: usesCode ? "What may it ask for?" : "What does it hold?",
      lede: usesCode
        ? "The ceiling on what a person can delegate to this application. What it actually receives is this set intersected with that person's own permissions."
        : "Scopes this client holds in its own right. There is no user to narrow them against, so this is exactly what its tokens will carry.",
      render: (f) =>
        scopeOptions.isPending ? (
          <Spinner label="Loading scopes" />
        ) : (
          <Controller
            control={f.control}
            name={usesCode ? "grantableScopeIds" : "grantedScopeIds"}
            render={({ field }) => (
              <SetPicker
                legend="Scopes"
                options={options}
                selected={new Set(field.value)}
                onChange={(next) => field.onChange([...next])}
                emptyLabel="No scopes are defined yet. Register an API first."
              />
            )}
          />
        ),
    },
    {
      id: "session",
      label: "Session",
      title: "Consent and sign-out",
      lede: "Both are about how this application behaves inside a session it did not start.",
      render: (f) => (
        <div className="flex max-w-xl flex-col gap-8">
          <Controller
            control={f.control}
            name="skipConsent"
            render={({ field }) => (
              <SwitchRow
                checked={field.value}
                onChange={field.onChange}
                label="Skip the consent screen"
                hint="First-party applications only. Asking someone to consent to your own organization's tool is noise; anything else should ask."
              />
            )}
          />

          {usesCode ? (
            <>
              <Field
                label="Back-channel logout URI"
                hint="Where IDEN POSTs a logout token when a session this client was part of ends. Leave empty and it is never told — it keeps serving its own session until something else fails."
              >
                {(props) => (
                  <Input
                    {...props}
                    {...f.register("backchannelLogoutUri")}
                    className="font-identity"
                    placeholder="https://app.example.org/logout"
                  />
                )}
              </Field>
              <Controller
                control={f.control}
                name="backchannelLogoutSessionRequired"
                render={({ field }) => (
                  <SwitchRow
                    checked={field.value}
                    onChange={field.onChange}
                    label="Logout tokens must name the session"
                    hint="Needed only by an application that can hold several sessions for one person."
                  />
                )}
              />
            </>
          ) : null}
        </div>
      ),
    },
    {
      id: "review",
      label: "Review",
      title: "Check this before it exists",
      lede: "A client ID and a client type cannot be changed afterwards.",
      render: (f) => {
        const v = f.getValues();
        const scopes = labelFor(usesCode ? v.grantableScopeIds : v.grantedScopeIds);
        return (
          <ReviewList>
            <ReviewItem label="Name">{v.name}</ReviewItem>
            <ReviewItem label="Client ID">
              <ScopeChip value={v.clientId} />
            </ReviewItem>
            <ReviewItem label="Type">{APP_TYPES[v.appType].label}</ReviewItem>
            <ReviewItem label="Authentication">{APP_TYPES[v.appType].summary}</ReviewItem>
            {usesCode ? (
              <ReviewItem label="Redirect URIs">
                {lines(v.redirectUris).length ? (
                  <span className="font-identity">{lines(v.redirectUris).join(", ")}</span>
                ) : (
                  <NotSet />
                )}
              </ReviewItem>
            ) : null}
            <ReviewItem label={usesCode ? "May request" : "Holds"}>
              {scopes.length ? (
                <span className="flex flex-wrap justify-end gap-1">
                  {scopes.map((value) => (
                    <ScopeChip key={value} value={value} />
                  ))}
                </span>
              ) : (
                <NotSet />
              )}
            </ReviewItem>
            <ReviewItem label="Consent">
              {v.skipConsent ? "Skipped (first-party)" : "Asked the first time"}
            </ReviewItem>
            {usesCode ? (
              <ReviewItem label="Back-channel logout">
                {v.backchannelLogoutUri.trim() ? (
                  <span className="font-identity">{v.backchannelLogoutUri}</span>
                ) : (
                  <NotSet />
                )}
              </ReviewItem>
            ) : null}
          </ReviewList>
        );
      },
    },
  ];

  return (
    <Wizard
      form={form}
      steps={steps}
      title="Register a client"
      lede="An application allowed to ask IDEN for tokens."
      section={{ label: "Clients", to: "/admin/clients" }}
      backTo="/admin/clients"
      backLabel="Back to clients"
      submitLabel="Register client"
      pending={create.isPending}
      error={create.error}
      onSubmit={(values) =>
        create.mutate(values, {
          onSuccess: (record) => {
            if (record.clientSecret) setCreated(record);
            else void navigate(`/admin/clients/${record.id}`);
          },
        })
      }
    />
  );
}

/** The secret is returned once. That is the whole screen until it is dismissed. */
function SecretHandover({ created }: { created: ClientCreated }) {
  const navigate = useNavigate();
  return (
    <div className="max-w-xl">
      <h1 className="text-display-md">{created.name} registered</h1>
      <p className="mt-2 text-body-md text-body">
        Store the secret now. It is argon2-hashed on the way in and cannot be shown again — only
        rotated.
      </p>
      <div className="mt-6">
        <SecretRevealOnce label="Client secret" secret={created.clientSecret ?? ""} />
      </div>
      <div className="mt-8 flex gap-3">
        <Button variant="outline" onClick={() => void navigate("/admin/clients")}>
          Back to clients
        </Button>
        <Button variant="default" onClick={() => void navigate(`/admin/clients/${created.id}`)}>
          Open this client
        </Button>
      </div>
    </div>
  );
}

/** A boolean whose consequence needs explaining, which is all of them here. */
export function SwitchRow({
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
        <Label htmlFor={label} className="text-body-sm text-foreground">
          {label}
        </Label>
        <p className="mt-1 text-caption text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
