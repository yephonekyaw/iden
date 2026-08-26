import {
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  ScopeChip,
  Spinner,
  cn,
} from "@iden/shared";
import { useState } from "react";
import { useApi } from "../../app/api";
import { PageHeader } from "../../app/shell";
import { useList, type AuditEvent } from "./api";

/**
 * Read-only by design: the log is written by the requests it records, and there
 * is no write scope to grant. Rows are ordered by time because that is the
 * information the reader needs — not a rank, not a sequence number.
 */
export function AuditRoute() {
  const api = useApi();
  const [action, setAction] = useState("");
  const [since, setSince] = useState("");
  const [offset, setOffset] = useState(0);

  const events = useList<AuditEvent>(api, "/admin/audit", {
    offset,
    ...(action ? { action } : {}),
    ...(since ? { since: new Date(since).toISOString() } : {}),
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        lede="Every request that changed something, with who made it and what came back."
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Input
          type="search"
          className="max-w-xs font-identity"
          placeholder="Filter by path, e.g. /admin/roles"
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setOffset(0);
          }}
        />
        <Input
          type="datetime-local"
          className="max-w-56"
          aria-label="Only events after"
          value={since}
          onChange={(event) => {
            setSince(event.target.value);
            setOffset(0);
          }}
        />
      </div>

      {events.isPending ? (
        <Spinner label="Loading the log" />
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => void events.refetch()} />
      ) : events.data.items.length === 0 ? (
        <EmptyState
          title="Nothing recorded here"
          body={
            action || since
              ? "No requests match these filters. Widen the path or move the date back."
              : "State-changing requests appear here as they happen."
          }
        />
      ) : (
        <>
          <ul className="m-0 list-none border-t border-hairline p-0">
            {events.data.items.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
          <Pagination meta={events.data.meta} onOffsetChange={setOffset} />
        </>
      )}
    </>
  );
}

function EventRow({ event }: { event: AuditEvent }) {
  const failed = event.statusCode >= 400;
  const detail = Object.keys(event.detail ?? {}).length > 0;

  return (
    <li className="border-b border-hairline py-3">
      <details className="group">
        <summary
          className={cn(
            "flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1",
            detail ? "" : "cursor-default list-none",
          )}
        >
          <time
            dateTime={event.occurredAt}
            className="w-44 shrink-0 text-caption text-muted tabular-nums"
          >
            {new Date(event.occurredAt).toLocaleString(undefined, {
              dateStyle: "short",
              timeStyle: "medium",
            })}
          </time>
          <span
            className={cn(
              "font-identity w-10 shrink-0",
              failed ? "text-error" : "text-accent-teal",
            )}
          >
            {event.statusCode}
          </span>
          <ScopeChip value={event.action} />
          <span className="text-body-sm text-body">
            {event.actorLabel ?? event.actorClient ?? "anonymous"}
          </span>
        </summary>

        {detail ? (
          <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-dark p-4 text-code text-on-dark">
            {JSON.stringify(event.detail, null, 2)}
          </pre>
        ) : null}
      </details>
    </li>
  );
}
