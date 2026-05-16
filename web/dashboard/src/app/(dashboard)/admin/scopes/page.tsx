import { listScopes } from "@/lib/api/scopes";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Mono } from "@/components/shared/mono";
import { ActionBadge, ResourceBadge, RoleBadge } from "@/components/shared/status-badge";
import type { ScopeResource } from "@/lib/types";

const RESOURCE_LABEL: Record<ScopeResource, string> = {
  admin: "Admin Scopes",
  entity: "Entity Scopes",
  biometric: "Biometric Scopes",
  openid: "OIDC Standard Scopes",
};

export default async function ScopesPage() {
  const scopes = await listScopes();
  const grouped = scopes.reduce<Record<string, typeof scopes>>((acc, s) => {
    (acc[s.resource] ||= []).push(s);
    return acc;
  }, {});

  return (
    <>
      <PageHeader title="Scopes Catalog" subtitle="Read-only reference" />

      <div className="space-y-6">
        {Object.entries(grouped).map(([resource, list]) => (
          <Card key={resource} className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-overlay)] px-5 py-3">
              <ResourceBadge resource={resource as ScopeResource} />
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {RESOURCE_LABEL[resource as ScopeResource]}
              </span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {list.length} scope{list.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="divide-y divide-[var(--color-border-subtle)]">
              {list.map((s) => (
                <li key={s.name} className="flex items-center gap-4 px-5 py-3">
                  <Mono className="w-72 shrink-0 text-[var(--color-primary)]">{s.name}</Mono>
                  <div className="flex-1 text-sm text-[var(--color-text-secondary)]">{s.description}</div>
                  <div className="flex items-center gap-1">
                    {s.allowed_roles.map((r) => (
                      <RoleBadge key={r} role={r} />
                    ))}
                    <ActionBadge action={s.action} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
