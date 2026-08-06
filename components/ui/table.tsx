"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/*
 * Flight-log tables: sunken placard header, hairline rows, tabular numerals.
 * Long text wraps; numeric cells stay right-aligned and mono.
 */

export function TableShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("face overflow-hidden", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Table({
  className,
  children,
}: React.TableHTMLAttributes<HTMLTableElement> & { children: React.ReactNode }) {
  return <table className={cn("w-full text-sm", className)}>{children}</table>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="sticky top-0 z-10 bg-well">{children}</thead>;
}

export function Th({
  className,
  numeric,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        "placard whitespace-nowrap border-b border-bezel px-3 py-2.5 text-left first:pl-4 last:pr-4",
        numeric && "text-right",
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Tr({
  className,
  clickable,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { clickable?: boolean }) {
  return (
    <tr
      className={cn(
        "border-b border-bezel/60 last:border-0",
        clickable && "cursor-pointer transition-colors hover:bg-well focus-within:bg-well",
        className
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 align-middle text-ink first:pl-4 last:pr-4",
        numeric && "readout text-right",
        className
      )}
      data-numeric={numeric || undefined}
      {...props}
    >
      {children}
    </td>
  );
}

/** Footer strip with count + slot for actions. */
export function TableFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-t border-bezel px-4 py-2.5 text-xs text-dim",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Client-side pagination over any array. */
export function usePagination<T>(rows: T[], pageSize = 50) {
  const [page, setPage] = React.useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const clamped = Math.min(page, pages - 1);
  const slice = React.useMemo(
    () => rows.slice(clamped * pageSize, (clamped + 1) * pageSize),
    [rows, clamped, pageSize]
  );
  React.useEffect(() => {
    if (page > pages - 1) setPage(0);
  }, [pages, page]);
  return { slice, page: clamped, pages, setPage, total: rows.length };
}

export function Pagination({
  page,
  pages,
  setPage,
  total,
  shown,
}: {
  page: number;
  pages: number;
  setPage: (p: number) => void;
  total: number;
  shown: number;
}) {
  if (pages <= 1)
    return (
      <span data-numeric>
        {total} record{total === 1 ? "" : "s"}
      </span>
    );
  return (
    <div className="flex w-full items-center justify-between gap-2">
      <span data-numeric>
        {shown} of {total} records
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="readout px-1 text-xs" data-numeric>
          {page + 1} / {pages}
        </span>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => setPage(Math.min(pages - 1, page + 1))}
          disabled={page >= pages - 1}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
