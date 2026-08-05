"use client";

/**
 * Hours progress: "12 of 40 hours completed" + bar + "28 hours remaining".
 * Colors: green = all done, blue = on track, orange = ≤5h left, red = 0h left.
 */
export default function HoursProgress({
  total, completed, compact = false,
}: {
  total: number;
  completed: number;
  compact?: boolean;
}) {
  if (!total || total <= 0) {
    return <span className="text-xs text-slate-400">No hours set</span>;
  }
  const remaining = Math.max(0, Math.round((total - completed) * 100) / 100);
  const pct = Math.min(100, Math.round((completed / total) * 100));
  const color =
    remaining === 0 ? "bg-emerald-500" :
    remaining <= 5 ? "bg-orange-500" :
    "bg-blue-500";
  const textColor =
    remaining === 0 ? "text-emerald-600" :
    remaining <= 5 ? "text-orange-600" :
    "text-blue-600";

  return (
    <div className={compact ? "min-w-[130px]" : "min-w-[170px]"}>
      <div className="flex items-center justify-between gap-2">
        <span className={`${compact ? "text-[11px]" : "text-xs"} font-semibold text-slate-700 dark:text-slate-300`}>
          {completed} of {total} hrs
        </span>
        <span className={`${compact ? "text-[10px]" : "text-[11px]"} font-bold tabular-nums ${textColor}`}>
          {remaining === 0 ? "Done" : `${remaining}h left`}
        </span>
      </div>
      <div className={`mt-1 ${compact ? "h-1.5" : "h-2"} w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10`}>
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
