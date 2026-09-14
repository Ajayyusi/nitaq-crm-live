import Link from "next/link";
import { ArrowRight } from "lucide-react";
import CountUp from "@/components/motion/CountUp";
import { stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { MetricBasis } from "@/lib/finance/owner-metrics";

const basisStyle: Record<MetricBasis, string> = {
  Accrual: "text-info bg-[var(--info-soft)]",
  Cash: "text-ok bg-[var(--ok-soft)]",
  Balance: "text-dim bg-well",
};

/**
 * One owner finance figure. The document behind this page requires every card
 * to say what it measures, on what basis, and for which period — "how much did
 * we make?" has several honest answers, so the card never shows an unlabelled
 * number. The click-through only appears for roles that can open the target.
 */
export default function OwnerMetricCard({
  label,
  value,
  basis,
  periodLabel,
  definition,
  sub,
  href,
  hrefLabel = "View detail",
  tone = "ink",
  index = 0,
}: {
  label: string;
  value: number;
  basis: MetricBasis;
  periodLabel: string;
  definition: string;
  sub?: string;
  href?: string;
  hrefLabel?: string;
  tone?: "ink" | "accent" | "warn" | "danger";
  index?: number;
}) {
  const toneClass = { ink: "text-ink", accent: "text-accent", warn: "text-warn", danger: "text-danger" }[tone];

  return (
    <div
      className="motion-rise flex h-full flex-col rounded-neo border border-edge bg-face p-5 shadow-neo-sm"
      style={stagger(index)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="placard leading-4">{label}</span>
        <span
          className={cn("shrink-0 rounded-neo-xs px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]", basisStyle[basis])}
          title={basis === "Balance" ? `Balance at the end of ${periodLabel}` : `${basis} basis · ${periodLabel}`}
        >
          {basis === "Balance" ? "As of end" : basis}
        </span>
      </div>

      {/* One line always: a figure broken as "AED / 1,234,567.89" is misread.
          At xl four cards share a row (~258px each), so the size steps down
          there and back up once 2xl gives the cards room again. */}
      <span
        className={cn(
          "readout mt-3 block whitespace-nowrap text-[26px] font-extrabold leading-8 xl:text-[20px] 2xl:text-[26px]",
          toneClass
        )}
        data-numeric
      >
        <CountUp value={value} format="aed2" delay={index * 50} />
      </span>
      {sub && <p className="readout mt-1 text-xs font-semibold text-dim" data-numeric>{sub}</p>}

      <p className="mt-3 flex-1 text-xs leading-relaxed text-faint">{definition}</p>

      {href && (
        <Link
          href={href}
          className="group mt-3 inline-flex items-center gap-1 self-start text-xs font-bold uppercase tracking-[0.06em] text-accent hover:underline"
        >
          {hrefLabel}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden />
        </Link>
      )}
    </div>
  );
}
