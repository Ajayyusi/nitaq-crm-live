import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/*
 * Stat card — the KPI tile.
 * Label first so a row of tiles can be scanned by name, then the figure at
 * display size. Cards in a row are forced to equal height by the grid; the
 * flex column pins the footer to the bottom regardless of content length.
 */
export function Instrument({
  label,
  value,
  sub,
  tone = "ink",
  corner,
  href,
  className,
  children,
}: {
  /** Placard plate text, e.g. "TOTAL LEADS" */
  label: string;
  /** The reading, e.g. "AED 42,300" or 17 */
  value: React.ReactNode;
  /** Small line under the placard, e.g. "All enquiries" */
  sub?: string;
  /** Color of the reading */
  tone?: "ink" | "phos" | "caution" | "alert" | "advisory";
  /** Element in the top-right corner (Lamp, delta, icon) */
  corner?: React.ReactNode;
  href?: string;
  className?: string;
  /** Optional gauge strip (TickGauge) under the reading */
  children?: React.ReactNode;
}) {
  const toneClass = {
    ink: "text-ink",
    phos: "text-accent",
    caution: "text-warn",
    alert: "text-danger",
    advisory: "text-info",
  }[tone];

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="placard leading-4">{label}</span>
        {corner && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-neo-xs bg-well text-dim shadow-neo-inset-sm">
            {corner}
          </span>
        )}
      </div>
      <span
        className={cn("readout mt-3 block text-[28px] font-extrabold leading-9", toneClass)}
        data-numeric
      >
        {value}
      </span>
      {children}
      {sub && <p className="mt-1 truncate text-xs text-dim">{sub}</p>}
    </>
  );

  const cls = cn(
    "group flex h-full flex-col rounded-neo border border-edge bg-face p-5 shadow-neo-sm",
    "transition-[box-shadow,transform] duration-200 ease-out",
    href && "hover:-translate-y-0.5 hover:shadow-neo focus-visible:-translate-y-0.5",
    className
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** Responsive grid for a ranked row of instruments. */
export function InstrumentRow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid grid-cols-2 items-stretch gap-4 md:grid-cols-3 xl:grid-cols-6", className)}>
      {children}
    </div>
  );
}
