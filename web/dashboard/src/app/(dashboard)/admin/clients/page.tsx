import Link from "next/link";
import { Globe, Boxes, MonitorSmartphone, Cog, Plus } from "lucide-react";
import { listClients } from "@/lib/api/clients";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ClientStatusBadge, ClientKindBadge } from "@/components/shared/status-badge";
import { Mono } from "@/components/shared/mono";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/utils";

const KIND_ICON = {
  web: Globe,
  spa: Boxes,
  kiosk: MonitorSmartphone,
  service: Cog,
} as const;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const all = await listClients({ page_size: 100 });
  const { items } = await listClients({ page_size: 100, query: sp.q });
  const total = all.items.length;
  const active = all.items.filter((c) => c.status === "active").length;
  const kiosk = all.items.filter((c) => c.kind === "kiosk").length;
  const disabled = all.items.filter((c) => c.status === "disabled").length;

  return (
    <>
      <PageHeader
        title="OIDC Clients"
        subtitle={`${total} registered clients · ${active} active`}
        actions={
          <Button asChild>
            <Link href="/admin/clients/new">
              <Plus className="h-4 w-4" /> Register client
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={total} hint="All clients" />
        <StatCard label="Active" value={active} hint="Serving tokens" accent="success" />
        <StatCard label="Kiosk" value={kiosk} hint="Physical devices" accent="primary" />
        <StatCard label="Disabled" value={disabled} hint="Inactive" accent="danger" />
      </div>

      <SearchInput placeholder="Search clients by name or ID..." className="mb-4" />

      {items.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={sp.q ? "No clients match your search" : "No clients registered yet"}
          description={sp.q ? `Nothing matched “${sp.q}”.` : "Register your first OIDC client to start delegating authentication."}
          action={
            !sp.q ? (
              <Button asChild>
                <Link href="/admin/clients/new">Register your first client →</Link>
              </Button>
            ) : null
          }
        />
      ) : (
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>Client Name</TH>
              <TH>Client ID</TH>
              <TH>Kind</TH>
              <TH>Status</TH>
              <TH>Created</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((c) => {
              const Icon = KIND_ICON[c.kind];
              return (
                <TR key={c.id} className="cursor-pointer">
                  <TD>
                    <Link href={`/admin/clients/${c.id}`} className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-[var(--color-text-primary)]">{c.name}</div>
                        {c.description ? (
                          <div className="text-xs text-[var(--color-text-secondary)]">{c.description}</div>
                        ) : null}
                      </div>
                    </Link>
                  </TD>
                  <TD>
                    <Mono>{c.id.length > 24 ? c.id.slice(0, 22) + "…" : c.id}</Mono>
                  </TD>
                  <TD>
                    <ClientKindBadge kind={c.kind} />
                  </TD>
                  <TD>
                    <ClientStatusBadge status={c.status} />
                  </TD>
                  <TD className="text-sm text-[var(--color-text-secondary)]">{formatDate(c.created_at)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
      )}
    </>
  );
}
