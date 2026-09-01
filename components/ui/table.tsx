"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/*
 * Tables. The CONTAINER is raised; the rows inside stay flat.
 * Extruding each row or cell is what makes soft UI unreadable at data
 * density, so depth stops at the shell. Rows separate with a hairline and
 * respond to hover with a tint, never with a shadow.
 */

export function TableShell({
  className,
  /** Cap the body height so the sticky header has something to stick to. */
  maxHeight,
  children,
}: {
  className?: string;
  maxHeight?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("overflow-hidden rounded-neo border border-edge bg-face shadow-neo-sm", className)}>
      {/* The horizontal scroller is the scrollport for `sticky` headers.
          Without a bounded height it never scrolls vertically, so the header
          has no travel and appears not to stick — pass maxHeight for long
          lists that should keep their column labels visible. */}
      <div className="overflow-x-auto" style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}>
        {children}
      </div>
    </div>
  );
}

export function Table({
  className,
  children,
}: React.TableHTMLAttributes<HTMLTableElement> & { children: React.ReactNode }) {
  return <table className={cn("w-full border-collapse text-sm", className)}>{children}</table>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="sticky top-0 z-10 bg-well shadow-[0_1px_0_var(--edge)]">{children}</thead>;
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
        "placard whitespace-nowrap border-b border-edge px-4 py-3 text-start first:ps-5 last:pe-5",
        numeric && "text-end",
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
        "border-b border-edge/60 last:border-0",
        clickable && "cursor-pointer transition-colors duration-150 hover:bg-well focus-within:bg-well",
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
        "px-4 py-3 align-middle text-ink first:ps-5 last:pe-5",
        numeric && "readout text-end",
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
        "flex flex-wrap items-center justify-between gap-2 border-t border-edge bg-well/50 px-5 py-3 text-xs text-dim",
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
