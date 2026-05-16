import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { getUser } from "@/lib/api/users";
import { listAudit } from "@/lib/api/audit";
import { getUserAttributes, listOrgUserFields } from "@/lib/api/user-schema";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { DetailRow } from "@/components/shared/detail-row";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge, UserStatusBadge } from "@/components/shared/status-badge";
import { Mono } from "@/components/shared/mono";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, initials, relativeTime } from "@/lib/utils";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();
  const [audit, fields, attrs] = await Promise.all([
    listAudit({ query: id, page_size: 20 }),
    listOrgUserFields(),
    getUserAttributes(id),
  ]);

  return (
    <>
      <Link
        href="/admin/users"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to users
      </Link>

      <div className="mb-8 flex items-start gap-4">
        <Avatar className="h-16 w-16 text-base">
          <AvatarFallback>{initials(user.display_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold">{user.display_name}</h1>
          <p className="mt-1 font-mono text-sm text-[var(--color-text-secondary)]">{user.email}</p>
          <div className="mt-3 flex items-center gap-2">
            <RoleBadge role={user.role} />
            <UserStatusBadge status={user.status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="attributes">Org attributes</TabsTrigger>
              <TabsTrigger value="audit">Audit log</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <dl>
                <DetailRow label="User ID">
                  <Mono>{user.id}</Mono>
                </DetailRow>
                <DetailRow label="Display name">{user.display_name}</DetailRow>
                <DetailRow label="Email">{user.email}</DetailRow>
                <DetailRow label="Role"><RoleBadge role={user.role} /></DetailRow>
                <DetailRow label="Status"><UserStatusBadge status={user.status} /></DetailRow>
                <DetailRow label="Created">{formatDate(user.created_at)}</DetailRow>
                <DetailRow label="Last login">
                  {user.last_login_at ? relativeTime(user.last_login_at) : "Never"}
                </DetailRow>
              </dl>
            </TabsContent>
            <TabsContent value="attributes">
              {fields.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Your organization has not defined any custom user fields.
                </p>
              ) : (
                <dl>
                  {fields.map((f) => {
                    const value = attrs[f.key];
                    const display =
                      value === undefined || value === null || value === ""
                        ? "—"
                        : typeof value === "boolean"
                        ? value ? "Yes" : "No"
                        : String(value);
                    return (
                      <DetailRow key={f.id} label={f.label}>
                        <span className={display === "—" ? "text-[var(--color-text-tertiary)]" : ""}>
                          {display}
                        </span>
                      </DetailRow>
                    );
                  })}
                </dl>
              )}
            </TabsContent>

            <TabsContent value="audit">
              <ul className="divide-y divide-[var(--color-border-subtle)]">
                {audit.items.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <div className="font-mono text-[var(--color-text-primary)]">{e.action}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        by {e.actor_label} · {e.ip_addr}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">{relativeTime(e.created_at)}</div>
                  </li>
                ))}
              </ul>
            </TabsContent>
          </Tabs>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Enrolled methods
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            <EnrollRow label="Password" enrolled={user.enrolled.password} />
            <EnrollRow label="TOTP authenticator" enrolled={user.enrolled.totp} />
            <EnrollRow label="Biometric (face)" enrolled={user.enrolled.biometric} />
          </ul>
        </Card>
      </div>
    </>
  );
}

function EnrollRow({ label, enrolled }: { label: string; enrolled: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <span>{label}</span>
      {enrolled ? (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--color-success)]">
          <Check className="h-3 w-3" /> Enrolled
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
          <X className="h-3 w-3" /> Not set up
        </span>
      )}
    </li>
  );
}
