import {
  DateRangePicker,
  EmptyState,
  ErrorState,
  Pagination,
  SearchInput,
  Spinner,
  cn,
  type DateRange,
} from "@iden/shared";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useApi } from "../../app/api";
import { PageHeader } from "../../app/shell";
import { useList, type AuditEvent } from "./api";

/** The picked day runs to its last moment — `until` on the API is inclusive. */
function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Read-only by design: the log is written by the requests it records, and there
 * is no write scope to grant. Rows are ordered by time because that is the
 * information the reader needs — not a rank, not a sequence number.
 */
export function AuditRoute() {
  const api = useApi();
  const [action, setAction] = useState("");
  const [span, setSpan] = useState<DateRange | undefined>();
  const [offset, setOffset] = useState(0);

  const events = useList<AuditEvent>(api, "/admin/audit", {
    offset,
    ...(action ? { action } : {}),
    ...(span?.from
      ? {
          since: span.from.toISOString(),
          until: endOfDay(span.to ?? span.from).toISOString(),
        }
      : {}),
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        lede="Every request that changed something, with who made it and what came back."
        count={events.data?.meta.total}
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <SearchInput
          className="w-full max-w-sm"
          placeholder="Filter by path, e.g. /admin/roles"
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setOffset(0);
          }}
        />
        <DateRangePicker
          label="Limit to these days"
          value={span}
          disabled={{ after: new Date() }}
          onChange={(range) => {
            setSpan(range);
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
            action || span
              ? "No requests match these filters. Widen the path or the dates."
              : "State-changing requests appear here as they happen."
          }
        />
      ) : (
        <>
          <ul className="m-0 list-none rounded-lg border border-hairline bg-canvas p-2">
            {events.data.items.map((event, index) => (
              <EventRow
                key={event.id}
                event={event}
                isLast={index === events.data.items.length - 1}
              />
            ))}
          </ul>
          <Pagination meta={events.data.meta} onOffsetChange={setOffset} />
        </>
      )}
    </>
  );
}

function EventRow({ event, isLast }: { event: AuditEvent; isLast?: boolean }) {
  const failed = event.statusCode >= 400;
  const detail = Object.keys(event.detail ?? {}).length > 0;

  return (
    <li className={cn("border-hairline-soft py-2.5", isLast ? "" : "border-b")}>
      <details className="group">
        <summary
          className={cn(
            "flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md px-2 py-1",
            detail ? "cursor-pointer hover:bg-row-hover" : "cursor-default list-none",
          )}
        >
          {detail ? (
            <ChevronRight
              aria-hidden="true"
              className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-soft transition-transform duration-100 group-open:rotate-90"
            />
          ) : (
            <span aria-hidden="true" className="w-3.5 shrink-0" />
          )}
          <time
            dateTime={event.occurredAt}
            className="w-44 shrink-0 text-caption tabular-nums text-muted"
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
          <span className="font-identity min-w-0 flex-1 truncate text-body-strong">
            {event.action}
          </span>
          <span className="text-body-sm text-muted">
            {event.actorLabel ?? event.actorClient ?? "anonymous"}
          </span>
        </summary>

        {detail ? (
          <pre className="ml-7 mt-3 overflow-x-auto rounded-lg bg-surface-dark p-4 text-code text-on-dark">
            {JSON.stringify(event.detail, null, 2)}
          </pre>
        ) : null}
      </details>
    </li>
  );
}
