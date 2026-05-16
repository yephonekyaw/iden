import { listSessions } from "@/lib/api/sessions";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { SessionRow } from "./row";

export default async function SessionsPage() {
  const sessions = await listSessions();

  return (
    <>
      <PageHeader title="Sessions" subtitle="Devices and browsers currently signed in" />

      <Card className="overflow-hidden">
        <ul className="divide-y divide-[var(--color-border-subtle)]">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </ul>
      </Card>

      <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">
        Revoking a session signs out that device immediately and invalidates its refresh token.
      </p>
    </>
  );
}
