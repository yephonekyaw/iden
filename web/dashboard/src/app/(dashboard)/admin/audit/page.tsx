import Link from "next/link";
import { listAudit } from "@/lib/api/audit";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Mono } from "@/components/shared/mono";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/shared/search-input";
import { formatDate, relativeTime } from "@/lib/utils";

function actionTone(action: string) {
  if (action.includes("failed") || action.includes("revoke") || action.includes("delete")) return "danger" as const;
  if (action.startsWith("auth.login")) return "info" as const;
  if (action.includes("rotate") || action.includes("deactivate")) return "warning" as const;
  return "neutral" as const;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1");
  const { items, total } = await listAudit({ page, page_size: 20, query: sp.q });

  return (
    <>
      <PageHeader title="Audit Log" subtitle={`${total} recorded events`} />

      <SearchInput placeholder="Filter by action, actor, or target..." className="mb-4" />

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Action</TH>
              <TH>Actor</TH>
              <TH>Target</TH>
              <TH>IP</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((e) => (
              <TR key={e.id}>
                <TD className="text-sm text-[var(--color-text-secondary)]" title={formatDate(e.created_at, { hour: "2-digit", minute: "2-digit" })}>
                  {relativeTime(e.created_at)}
                </TD>
                <TD>
                  <Badge tone={actionTone(e.action)}>{e.action}</Badge>
                </TD>
                <TD className="text-sm">{e.actor_label}</TD>
                <TD><Mono>{e.target}</Mono></TD>
                <TD><Mono className="text-[var(--color-text-secondary)]">{e.ip_addr}</Mono></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <div className="mt-4 flex items-center justify-end gap-1 text-sm">
        {page > 1 ? (
          <Link
            href={`/admin/audit?page=${page - 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}
            className="rounded border border-[var(--color-border-default)] px-3 py-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]"
          >
            Previous
          </Link>
        ) : null}
        {page * 20 < total ? (
          <Link
            href={`/admin/audit?page=${page + 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}
            className="rounded border border-[var(--color-border-default)] px-3 py-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]"
          >
            Next
          </Link>
        ) : null}
      </div>
    </>
  );
}
