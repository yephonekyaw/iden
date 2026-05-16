import Link from "next/link";
import { Info, Plus } from "lucide-react";
import { listKiosks } from "@/lib/api/kiosks";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { KioskStatusBadge } from "@/components/shared/status-badge";
import { Mono } from "@/components/shared/mono";
import { relativeTime, truncate } from "@/lib/utils";

const STATUS_DOT = {
  active: "bg-[var(--color-success)]",
  inactive: "bg-[var(--color-warning)]",
  never_connected: "bg-[var(--color-text-tertiary)]",
} as const;

export default async function KiosksPage() {
  const kiosks = await listKiosks();

  return (
    <>
      <PageHeader
        title="Kiosk Devices"
        subtitle={`${kiosks.length} registered physical devices`}
        actions={
          <Button asChild>
            <Link href="/admin/kiosks/new">
              <Plus className="h-4 w-4" /> Register kiosk
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex items-start gap-3 rounded-md border border-[var(--color-info)]/30 bg-[var(--color-info-muted)] px-4 py-3 text-sm text-[var(--color-text-primary)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-info)]" />
        <div>
          Kiosks communicate via a provisioned OIDC client. Register a kiosk-kind client first, then link it here.
        </div>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>Device Name</TH>
              <TH>Hardware ID</TH>
              <TH>Status</TH>
              <TH>Last Seen</TH>
            </TR>
          </THead>
          <TBody>
            {kiosks.map((k) => (
              <TR key={k.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[k.status]}`} />
                    <div>
                      <div className="font-medium text-[var(--color-text-primary)]">{k.name}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">{k.location}</div>
                    </div>
                  </div>
                </TD>
                <TD><Mono>{truncate(k.hw_id, 22)}</Mono></TD>
                <TD><KioskStatusBadge status={k.status} /></TD>
                <TD className="text-sm text-[var(--color-text-secondary)]">
                  {k.last_seen_at ? relativeTime(k.last_seen_at) : "—"}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
