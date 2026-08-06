import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Instrument } from "@/components/ui/instrument";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  /** Legacy prop, kept for API compatibility — the instrument face ignores it. */
  iconColor?: string;
  /** Legacy prop, kept for API compatibility — the instrument face ignores it. */
  iconBg?: string;
  trend?: { value: number; label: string };
  className?: string;
}

/**
 * KPI stat card — a thin wrapper over the Instrument primitive.
 * Same prop API as the legacy card; renders as a six-pack instrument:
 * mono readout, engraved placard label, icon riding the top-right corner.
 */
export default function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: KPICardProps) {
  return (
    <Instrument
      label={title}
      value={value}
      sub={subtitle}
      className={className}
      corner={<Icon className="h-4 w-4 shrink-0 text-faint" aria-hidden />}
    >
      {trend && (
        <p
          className={cn(
            "mt-1 flex items-center gap-1 text-xs font-semibold",
            trend.value >= 0 ? "text-phos" : "text-alert"
          )}
        >
          {trend.value >= 0 ? (
            <TrendingUp className="h-3 w-3" aria-hidden />
          ) : (
            <TrendingDown className="h-3 w-3" aria-hidden />
          )}
          <span className="readout" data-numeric>
            {Math.abs(trend.value)}%
          </span>
          <span className="font-medium text-dim">{trend.label}</span>
        </p>
      )}
    </Instrument>
  );
}
