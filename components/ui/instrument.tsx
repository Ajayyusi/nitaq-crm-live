import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/*
 * Instrument — the six-pack stat readout.
 * Value reads like a gauge (mono, tabular); the placard label sits beneath
 * it like an engraved plate; an optional lamp/delta rides top-right.
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
    phos: "text-phos",
    caution: "text-caution",
    alert: "text-alert",
    advisory: "text-advisory",
  }[tone];

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={cn("readout text-[26px] font-bold leading-8", toneClass)} data-numeric>
          {value}
        </span>
        {corner}
      </div>
      {children}
      <div className="mt-2 border-t border-bezel pt-2">
        <span className="placard">{label}</span>
        {sub && <p className="mt-0.5 truncate text-xs text-faint">{sub}</p>}
      </div>
    </>
  );

  const cls = cn(
    "face group block p-4 transition-all duration-150",
    href && "hover:border-bezel-strong hover:shadow-raise",
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
    <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6", className)}>
      {children}
    </div>
  );
}
