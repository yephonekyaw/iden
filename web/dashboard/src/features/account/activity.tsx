import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IdenError,
  ProvenanceTrace,
  ScopeChip,
  Spinner,
} from "@iden/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useApi } from "../../app/api";
import { useStepUp } from "../../app/session";
import { PageHeader } from "../../app/shell";
import { useConnections, usePermissions, useSessions } from "./api";

const AMR_LABELS: Record<string, string> = {
  pwd: "Password",
  otp: "Authenticator app",
  face: "Face",
  mfa: "Two factors",
};

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function SessionsRoute() {
  const api = useApi();
  const sessions = useSessions(api);
  const queryClient = useQueryClient();
  const stepUp = useStepUp();
  const [pending, setPending] = useState<string | null>(null);

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/entity/sessions/${id}`),
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });

  const problem = revoke.error instanceof IdenError ? revoke.error : null;
  const maxAge = problem?.stepUpMaxAge;

  if (sessions.isPending) return <Spinner label="Loading your sessions" />;
  if (sessions.isError)
    return <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />;

  return (
    <>
      <PageHeader
        title="Sessions"
        lede="Every browser you are currently signed in from. Sign out the ones you don't recognize."
      />

      {maxAge ? (
        <div className="mb-6 rounded-lg border border-hairline bg-surface-soft p-5">
          <p className="text-title-sm text-ink">Confirm it's you first</p>
          <p className="mt-1 text-body-sm text-body">
            Signing out a session needs a recent sign-in.
          </p>
          <Button className="mt-4" size="sm" variant="primary" onClick={() => stepUp(maxAge)}>
            Enter your password
          </Button>
        </div>
      ) : null}

      <ul className="m-0 list-none border-t border-hairline p-0">
        {sessions.data.sessions.map((session) => (
          <li
            key={session.id}
            className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline py-4"
          >
            <div className="min-w-0">
              <p className="text-body-sm text-ink">
                {session.current ? "This browser" : "Another browser"}
                <span className="ml-2 text-caption text-muted">
                  signed in {when(session.authenticatedAt)}
                </span>
              </p>
              <p className="mt-1 text-caption text-muted">
                {session.amr.map((method) => AMR_LABELS[method] ?? method).join(" + ")}
                {session.clients.length > 0 ? ` · used by ${session.clients.join(", ")}` : ""}
              </p>
            </div>
            {session.current ? (
              <span className="text-caption text-muted">Current</span>
            ) : (
              <Button size="sm" onClick={() => setPending(session.id)}>
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Sign out this session?"
        body="That browser will have to sign in again. Applications it opened lose their refresh tokens."
        confirmLabel="Sign it out"
        pending={revoke.isPending}
        onConfirm={() => pending && revoke.mutate(pending)}
      />
    </>
  );
}

export function ConnectionsRoute() {
  const api = useApi();
  const connections = useConnections(api);
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const withdraw = useMutation({
    mutationFn: (clientId: string) => api.delete(`/entity/connections/${clientId}`),
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["connections"] });
    },
  });

  if (connections.isPending) return <Spinner label="Loading your connections" />;
  if (connections.isError)
    return <ErrorState error={connections.error} onRetry={() => void connections.refetch()} />;

  return (
    <>
      <PageHeader title="Connections" lede="Applications you have allowed to act on your behalf." />

      {connections.data.connections.length === 0 ? (
        <EmptyState
          title="Nothing has asked for access"
          body="Applications appear here after you allow them on the consent screen. Your organization's own tools don't ask, so they aren't listed."
        />
      ) : (
        <ul className="m-0 list-none border-t border-hairline p-0">
          {connections.data.connections.map((connection) => (
            <li key={connection.clientId} className="border-b border-hairline py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-title-sm text-ink">{connection.name}</p>
                  <p className="mt-0.5 text-caption text-muted">
                    Allowed {when(connection.grantedAt)}
                  </p>
                </div>
                <Button size="sm" onClick={() => setPending(connection.clientId)}>
                  Withdraw access
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {connection.scopes.map((scope) => (
                  <ScopeChip key={scope} value={scope} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Withdraw this application's access?"
        body="It will have to ask you again the next time you use it."
        confirmLabel="Withdraw access"
        pending={withdraw.isPending}
        onConfirm={() => pending && withdraw.mutate(pending)}
      />
    </>
  );
}

export function PermissionsRoute() {
  const api = useApi();
  const permissions = usePermissions(api);

  if (permissions.isPending) return <Spinner label="Working out your permissions" />;
  if (permissions.isError)
    return <ErrorState error={permissions.error} onRetry={() => void permissions.refetch()} />;

  const { groups, roles, scopes } = permissions.data;

  return (
    <>
      <PageHeader
        title="Permissions"
        lede="What you are allowed to do, and where each permission comes from."
      />

      <dl className="mb-10 flex flex-wrap gap-x-12 gap-y-4">
        <div>
          <dt className="text-caption-upper uppercase text-muted">Groups</dt>
          <dd className="mt-1 text-body-md text-ink">{groups.join(", ") || "None"}</dd>
        </div>
        <div>
          <dt className="text-caption-upper uppercase text-muted">Roles</dt>
          <dd className="mt-1 text-body-md text-ink">{roles.join(", ") || "None"}</dd>
        </div>
      </dl>

      {scopes.length === 0 ? (
        <EmptyState
          title="No permissions yet"
          body="An administrator assigns permissions through roles and groups. Ask yours if you expected access to something."
        />
      ) : (
        <ProvenanceTrace scopes={scopes} className="border-t border-hairline" />
      )}
    </>
  );
}
