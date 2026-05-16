import { CLIENTS } from "@/lib/mock-data";
import type { OIDCClient, Paginated } from "@/lib/types";
import { delay } from "./_delay";

export async function listClients(params?: {
  query?: string;
  kind?: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<Paginated<OIDCClient>> {
  const page = params?.page ?? 1;
  const page_size = params?.page_size ?? 20;
  const q = params?.query?.toLowerCase().trim();
  let filtered = CLIENTS;
  if (q) filtered = filtered.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  if (params?.kind && params.kind !== "all") filtered = filtered.filter((c) => c.kind === params.kind);
  if (params?.status && params.status !== "all") filtered = filtered.filter((c) => c.status === params.status);
  const total = filtered.length;
  const start = (page - 1) * page_size;
  return delay({ items: filtered.slice(start, start + page_size), page, page_size, total });
}

export async function getClient(id: string): Promise<OIDCClient | null> {
  return delay(CLIENTS.find((c) => c.id === id) ?? null);
}

export async function createClient(input: Partial<OIDCClient> & { name: string }): Promise<{
  client: OIDCClient;
  client_secret: string;
}> {
  const newClient: OIDCClient = {
    id: `iden_clt_${Math.random().toString(36).slice(2, 14)}`,
    name: input.name,
    description: input.description ?? null,
    kind: input.kind ?? "web",
    status: "active",
    is_public: input.is_public ?? false,
    redirect_uris: input.redirect_uris ?? [],
    post_logout_redirect_uris: input.post_logout_redirect_uris ?? [],
    grant_types: input.grant_types ?? ["authorization_code", "refresh_token"],
    response_types: input.response_types ?? ["code"],
    token_endpoint_auth_method: input.token_endpoint_auth_method ?? "client_secret_basic",
    require_pkce: input.require_pkce ?? true,
    allowed_scopes: input.allowed_scopes ?? ["openid", "profile", "email"],
    audience: input.audience ?? [],
    access_token_ttl_seconds: input.access_token_ttl_seconds ?? 3600,
    refresh_token_ttl_seconds: input.refresh_token_ttl_seconds ?? 1_209_600,
    id_token_ttl_seconds: input.id_token_ttl_seconds ?? 3600,
    refresh_token_rotation: input.refresh_token_rotation ?? true,
    consent_required: input.consent_required ?? true,
    logo_uri: input.logo_uri ?? null,
    client_uri: input.client_uri ?? null,
    tos_uri: input.tos_uri ?? null,
    policy_uri: input.policy_uri ?? null,
    contacts: input.contacts ?? [],
    org_id: "org_ubk",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  CLIENTS.unshift(newClient);
  return delay({ client: newClient, client_secret: `secret_${Math.random().toString(36).slice(2, 18)}` });
}

export async function rotateClientSecret(id: string): Promise<{ client_secret: string }> {
  const client = CLIENTS.find((c) => c.id === id);
  if (!client) throw new Error("Client not found");
  client.updated_at = new Date().toISOString();
  return delay({ client_secret: `secret_${Math.random().toString(36).slice(2, 18)}` });
}

export async function setClientStatus(id: string, status: "active" | "disabled"): Promise<OIDCClient> {
  const client = CLIENTS.find((c) => c.id === id);
  if (!client) throw new Error("Client not found");
  client.status = status;
  client.updated_at = new Date().toISOString();
  return delay(client);
}

export async function deleteClient(id: string): Promise<void> {
  const idx = CLIENTS.findIndex((c) => c.id === id);
  if (idx >= 0) CLIENTS.splice(idx, 1);
  return delay(undefined);
}
