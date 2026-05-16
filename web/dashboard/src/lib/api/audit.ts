import { AUDIT } from "@/lib/mock-data";
import type { AuditEvent, Paginated } from "@/lib/types";
import { delay } from "./_delay";

export async function listAudit(params?: {
  query?: string;
  page?: number;
  page_size?: number;
}): Promise<Paginated<AuditEvent>> {
  const page = params?.page ?? 1;
  const page_size = params?.page_size ?? 20;
  const q = params?.query?.toLowerCase().trim();
  let filtered = [...AUDIT].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  if (q)
    filtered = filtered.filter(
      (e) =>
        e.action.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.actor_label.toLowerCase().includes(q)
    );
  const total = filtered.length;
  const start = (page - 1) * page_size;
  return delay({ items: filtered.slice(start, start + page_size), page, page_size, total });
}
