import { cn } from "@/lib/utils";

/*
 * TickGauge — linear gauge with engraved tick marks.
 * Honest zero: a 0% value renders as 0, never a cosmetic minimum.
 * Fill turns caution below `cautionBelow` %, alert below `alertBelow` %.
 */
export function TickGauge({
  percent,
  label,
  detail,
  cautionBelow,
  alertBelow,
  invert = false,
  className,
}: {
  /** 0–100 */
  percent: number;
  label?: string;
  /** Right-aligned reading, e.g. "36 / 48 hrs" */
  detail?: string;
  /** Below this % the fill reads caution (or above, when invert) */
  cautionBelow?: number;
  alertBelow?: number;
  invert?: boolean;
  className?: string;
}) {
  const p = Math.max(0, Math.min(100, percent));
  const breach = (t?: number) =>
    t !== undefined && (invert ? p >= t : p <= t);
  const fill = breach(alertBelow)
    ? "bg-alert"
    : breach(cautionBelow)
      ? "bg-caution-fill"
      : "bg-phos";

  return (
    <div className={className}>
      {(label || detail) && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          {label && <span className="placard">{label}</span>}
          {detail && (
            <span className="readout text-xs text-dim" data-numeric>
              {detail}
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(p)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="relative h-2 overflow-hidden rounded-sm bg-well"
      >
        {/* engraved ticks every 10% */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, transparent 0, transparent calc(10% - 1px), var(--bezel) calc(10% - 1px), var(--bezel) 10%)",
          }}
        />
        <div
          className={cn("animate-sweep relative h-full rounded-sm", fill)}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}
