import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import type { PageMeta } from "../api/page";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Hidden below `sm`, where the row becomes a stacked card. */
  secondary?: boolean;
  className?: string;
}

/**
 * A list of records. Below 640px each row becomes a stacked card rather than a
 * horizontally scrolling table — a table you have to scroll sideways to read is
 * a table you cannot scan.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  caption: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="hidden sm:table-header-group">
          <tr className="border-b border-hairline bg-surface-soft">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-2.5 text-caption-upper font-medium uppercase text-muted",
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="flex flex-col sm:table-row-group">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === "Enter") onRowClick(row);
                    }
                  : undefined
              }
              className={cn(
                "flex flex-col gap-1 border-b border-hairline-soft p-4 last:border-b-0",
                "sm:table-row sm:gap-0 sm:p-0",
                onRowClick && "cursor-pointer hover:bg-row-hover",
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={column.header}
                  className={cn(
                    "text-body-sm text-body sm:h-row sm:px-4 sm:py-2.5 sm:align-middle",
                    "before:mr-2 before:text-caption-upper before:uppercase before:text-muted-soft before:content-[attr(data-label)] sm:before:content-none",
                    column.secondary && "hidden sm:table-cell",
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  meta,
  onOffsetChange,
}: {
  meta: PageMeta;
  onOffsetChange: (offset: number) => void;
}) {
  const first = meta.total === 0 ? 0 : meta.offset + 1;
  const last = Math.min(meta.offset + meta.limit, meta.total);

  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <p className="text-caption text-muted" aria-live="polite">
        {first}–{last} of {meta.total}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={meta.offset === 0}
          onClick={() => onOffsetChange(Math.max(0, meta.offset - meta.limit))}
        >
          Previous
        </Button>
        <Button
          size="sm"
          disabled={last >= meta.total}
          onClick={() => onOffsetChange(meta.offset + meta.limit)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
