"use client";

import { TickGauge } from "@/components/ui/tick-gauge";

/**
 * Hours gauge: "12 / 40 hrs" + tick gauge + "28h left".
 * Fill reads phosphor while on track, caution once 5h or fewer remain;
 * the right-hand reading turns phosphor "Done" at zero remaining.
 */
export default function HoursProgress({
  total, completed, compact = false,
}: {
  total: number;
  completed: number;
  compact?: boolean;
}) {
  if (!total || total <= 0) {
    return <span className="text-xs text-faint">No hours set</span>;
  }
  const remaining = Math.max(0, Math.round((total - completed) * 100) / 100);
  const pct = Math.min(100, Math.round((completed / total) * 100));
  const low = remaining > 0 && remaining <= 5;
  const stateColor = remaining === 0 ? "text-phos" : low ? "text-caution" : "text-dim";

  return (
    <div className={compact ? "min-w-[130px]" : "min-w-[170px]"}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span
          className={`readout ${compact ? "text-[11px]" : "text-xs"} font-semibold text-ink`}
          data-numeric
        >
          {completed} / {total} hrs
        </span>
        <span
          className={`readout ${compact ? "text-[10px]" : "text-[11px]"} font-bold ${stateColor}`}
          data-numeric
        >
          {remaining === 0 ? "Done" : `${remaining}h left`}
        </span>
      </div>
      <TickGauge percent={pct} cautionBelow={low ? 100 : undefined} />
    </div>
  );
}
