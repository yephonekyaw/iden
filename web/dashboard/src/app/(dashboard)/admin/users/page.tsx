import Link from "next/link";
import { Plus, Users as UsersIcon } from "lucide-react";
import { listUsers } from "@/lib/api/users";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge, UserStatusBadge } from "@/components/shared/status-badge";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { initials, relativeTime } from "@/lib/utils";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1");
  const page_size = 10;
  const { items, total } = await listUsers({ page, page_size, query: sp.q });
  const totalPages = Math.max(1, Math.ceil(total / page_size));
  const start = (page - 1) * page_size + 1;
  const end = Math.min(page * page_size, total);

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={`${total} total entities`}
        actions={
          <Button>
            <Plus className="h-4 w-4" /> Create user
          </Button>
        }
      />

      <SearchInput placeholder="Search by name or email..." className="mb-4" />

      {items.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={sp.q ? "No users match your search" : "No users yet"}
          description={sp.q ? `Nothing matched “${sp.q}”.` : undefined}
        />
      ) : (
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>User</TH>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((u) => (
              <TR key={u.id}>
                <TD>
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{initials(u.display_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-[var(--color-text-primary)]">{u.display_name}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {u.last_login_at ? relativeTime(u.last_login_at) : "Never logged in"}
                      </div>
                    </div>
                  </Link>
                </TD>
                <TD className="font-mono text-sm text-[var(--color-text-secondary)]">{u.email}</TD>
                <TD><RoleBadge role={u.role} /></TD>
                <TD><UserStatusBadge status={u.status} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      )}

      {items.length > 0 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
          <div>
            Showing {start}–{end} of {total}
          </div>
          <Pagination page={page} totalPages={totalPages} q={sp.q} />
        </div>
      ) : null}
    </>
  );
}

function Pagination({ page, totalPages, q }: { page: number; totalPages: number; q?: string }) {
  const qs = (n: number) => `/admin/users?page=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }
  return (
    <div className="flex items-center gap-1">
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-2 text-[var(--color-text-tertiary)]">…</span>
        ) : (
          <Link
            key={p}
            href={qs(p)}
            className={
              p === page
                ? "inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--color-primary)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
                : "inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]"
            }
          >
            {p}
          </Link>
        )
      )}
      {page < totalPages ? (
        <Link
          href={qs(page + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]"
        >
          →
        </Link>
      ) : null}
    </div>
  );
}
