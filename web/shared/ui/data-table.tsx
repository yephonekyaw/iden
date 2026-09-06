import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
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
 * A list of records, built on shadcn's `Table` primitives.
 *
 * The one thing it adds is the small-screen behaviour: below 640px each row
 * becomes a stacked card rather than a horizontally scrolling table, because a
 * table you have to scroll sideways to read is a table you cannot scan. shadcn's
 * `Table` wraps itself in an `overflow-x-auto` container, which is the opposite
 * choice — so the wrapper is neutralised here rather than fought at every call
 * site.
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
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <Table className="max-sm:block [&_[data-slot=table-container]]:overflow-visible">
        <caption className="sr-only">{caption}</caption>
        <TableHeader className="hidden sm:table-header-group">
          <TableRow className="bg-secondary/70 hover:bg-secondary/70">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  "px-4 text-caption-upper font-medium uppercase text-muted-soft",
                  column.className,
                )}
              >
                {column.header}
              </TableHead>
            ))}
            {onRowClick ? <TableHead className="w-8" aria-hidden="true" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody className="flex flex-col sm:table-row-group">
          {rows.map((row) => (
            <TableRow
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
                "group flex flex-col gap-1 border-b border-hairline-soft p-4 last:border-b-0",
                "sm:table-row sm:gap-0 sm:p-0",
                onRowClick && "cursor-pointer hover:bg-row-hover",
              )}
            >
              {columns.map((column, index) => (
                <TableCell
                  key={column.key}
                  data-label={column.header}
                  className={cn(
                    "text-body-sm text-body sm:h-row sm:px-4 sm:py-2.5 sm:align-middle",
                    index === 0 && "font-medium text-foreground",
                    "before:mr-2 before:text-caption-upper before:uppercase before:text-muted-soft before:content-[attr(data-label)] sm:before:content-none",
                    column.secondary && "hidden sm:table-cell",
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
              {onRowClick ? (
                <TableCell className="hidden w-8 pr-3 align-middle sm:table-cell">
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 text-muted-soft opacity-0 transition-opacity duration-100 group-hover:opacity-100"
                  />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Offset paging over a `PageMeta`.
 *
 * shadcn ships a `Pagination` built from anchors and numbered pages. This is a
 * cursor through a range the caller holds in state, and the count is the part
 * people actually read on these screens, so it stays a composition of `Button`.
 */
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
      <p className="text-caption text-muted-foreground" aria-live="polite">
        {first}–{last} of {meta.total}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={meta.offset === 0}
          onClick={() => onOffsetChange(Math.max(0, meta.offset - meta.limit))}
        >
          <ChevronLeft aria-hidden="true" />
          Previous
        </Button>
        <Button
          size="sm"
          disabled={last >= meta.total}
          onClick={() => onOffsetChange(meta.offset + meta.limit)}
        >
          Next
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
