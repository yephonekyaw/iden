import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getClient } from "@/lib/api/clients";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailRow } from "@/components/shared/detail-row";
import { ClientKindBadge, ClientStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Mono } from "@/components/shared/mono";
import { CopyButton } from "@/components/shared/copy-button";
import { ClientActions } from "./actions";
import { formatDate } from "@/lib/utils";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  return (
    <>
      <Link
        href="/admin/clients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to clients
      </Link>
      <PageHeader
        title={client.name}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <Mono>{client.id}</Mono>
            <CopyButton value={client.id} />
            <ClientStatusBadge status={client.status} />
            <ClientKindBadge kind={client.kind} />
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="uris">URIs</TabsTrigger>
              <TabsTrigger value="scopes">Scopes</TabsTrigger>
              <TabsTrigger value="tokens">Token Policy</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <dl>
                <DetailRow label="Client Name">{client.name}</DetailRow>
                <DetailRow label="Description">{client.description ?? "—"}</DetailRow>
                <DetailRow label="Client Kind">
                  <ClientKindBadge kind={client.kind} />
                </DetailRow>
                <DetailRow label="Public Client">
                  <Badge tone={client.is_public ? "info" : "neutral"}>
                    {client.is_public ? "yes" : "no"}
                  </Badge>
                </DetailRow>
                <DetailRow label="Created">{formatDate(client.created_at, { hour: "2-digit", minute: "2-digit" })}</DetailRow>
                <DetailRow label="Updated">{formatDate(client.updated_at, { hour: "2-digit", minute: "2-digit" })}</DetailRow>
                <DetailRow label="Contacts">
                  {client.contacts.length ? client.contacts.join(", ") : "—"}
                </DetailRow>
              </dl>
            </TabsContent>

            <TabsContent value="security">
              <dl>
                <DetailRow label="Token Endpoint Auth">
                  <Mono>{client.token_endpoint_auth_method}</Mono>
                </DetailRow>
                <DetailRow label="Require PKCE">
                  <Badge tone={client.require_pkce ? "success" : "warning"}>
                    {client.require_pkce ? "enforced" : "optional"}
                  </Badge>
                </DetailRow>
                <DetailRow label="Consent Required">
                  <Badge tone={client.consent_required ? "success" : "neutral"}>
                    {client.consent_required ? "yes" : "no"}
                  </Badge>
                </DetailRow>
                <DetailRow label="Grant Types">
                  <div className="flex flex-wrap gap-1">
                    {client.grant_types.map((g) => (
                      <Mono key={g} className="rounded bg-[var(--color-surface-overlay)] px-2 py-0.5">
                        {g}
                      </Mono>
                    ))}
                  </div>
                </DetailRow>
                <DetailRow label="Response Types">
                  <div className="flex flex-wrap gap-1">
                    {client.response_types.length
                      ? client.response_types.map((r) => (
                          <Mono key={r} className="rounded bg-[var(--color-surface-overlay)] px-2 py-0.5">
                            {r}
                          </Mono>
                        ))
                      : "—"}
                  </div>
                </DetailRow>
              </dl>
            </TabsContent>

            <TabsContent value="uris">
              <dl>
                <DetailRow label="Redirect URIs">
                  {client.redirect_uris.length ? (
                    <ul className="space-y-1">
                      {client.redirect_uris.map((u) => (
                        <li key={u} className="flex items-center gap-2">
                          <Mono className="truncate">{u}</Mono>
                          <CopyButton value={u} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="Post-Logout URIs">
                  {client.post_logout_redirect_uris.length ? (
                    <ul className="space-y-1">
                      {client.post_logout_redirect_uris.map((u) => (
                        <li key={u}>
                          <Mono>{u}</Mono>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="Audience">
                  {client.audience.length ? (
                    <ul className="space-y-1">
                      {client.audience.map((a) => (
                        <li key={a}>
                          <Mono>{a}</Mono>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </DetailRow>
              </dl>
            </TabsContent>

            <TabsContent value="scopes">
              <div className="flex flex-wrap gap-2">
                {client.allowed_scopes.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center rounded border border-[var(--color-border-default)] bg-[var(--color-surface-overlay)] px-2 py-1"
                  >
                    <Mono>{s}</Mono>
                  </span>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="tokens">
              <dl>
                <DetailRow label="Access Token TTL">{client.access_token_ttl_seconds}s</DetailRow>
                <DetailRow label="Refresh Token TTL">{client.refresh_token_ttl_seconds}s</DetailRow>
                <DetailRow label="ID Token TTL">{client.id_token_ttl_seconds}s</DetailRow>
                <DetailRow label="Refresh Rotation">
                  <Badge tone={client.refresh_token_rotation ? "success" : "neutral"}>
                    {client.refresh_token_rotation ? "enabled" : "disabled"}
                  </Badge>
                </DetailRow>
              </dl>
            </TabsContent>
          </Tabs>
        </Card>

        <ClientActions clientId={client.id} clientName={client.name} status={client.status} />
      </div>
    </>
  );
}
