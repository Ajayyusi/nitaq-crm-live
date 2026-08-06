import { cn } from "@/lib/utils";

/*
 * Dial — a real circular gauge for a 0–100 reading. The world's native
 * instrument. Sweep runs 225° → -45° (the classic 270° gauge arc).
 * All computed coordinates are fixed to 2 decimals so SSR and client
 * hydration always agree.
 */
const R = 40;
const CX = 50;
const CY = 50;

function polar(angleDeg: number, radius: number): [string, string] {
  const a = (angleDeg * Math.PI) / 180;
  return [(CX + radius * Math.cos(a)).toFixed(2), (CY - radius * Math.sin(a)).toFixed(2)];
}

/** Angle for a 0–100 value across the 270° sweep (225° at 0 → -45° at 100). */
const valueAngle = (v: number) => 225 - (Math.max(0, Math.min(100, v)) / 100) * 270;

function arcPath(fromDeg: number, toDeg: number, radius: number) {
  const [x1, y1] = polar(fromDeg, radius);
  const [x2, y2] = polar(toDeg, radius);
  const large = fromDeg - toDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
}

export function Dial({
  value,
  label,
  detail,
  size = 148,
  cautionBelow,
  alertBelow,
  className,
}: {
  /** 0–100 */
  value: number;
  /** Placard under the dial */
  label: string;
  /** Line under the placard, e.g. "12 of 40 learners at risk" */
  detail?: string;
  size?: number;
  cautionBelow?: number;
  alertBelow?: number;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const tone =
    alertBelow !== undefined && v <= alertBelow
      ? "var(--alert)"
      : cautionBelow !== undefined && v <= cautionBelow
        ? "var(--caution-fill)"
        : "var(--phos)";

  const ticks: React.ReactNode[] = [];
  for (let i = 0; i <= 10; i++) {
    const angle = 225 - i * 27;
    const major = i % 5 === 0;
    const [x1, y1] = polar(angle, R + 4);
    const [x2, y2] = polar(angle, major ? R - 3 : R - 1);
    ticks.push(
      <line
        key={i}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={major ? "var(--dim)" : "var(--bezel-strong)"}
        strokeWidth={major ? 1.5 : 1}
      />
    );
  }

  const [nx, ny] = polar(valueAngle(v), R - 10);

  return (
    <div
      className={cn("flex flex-col items-center", className)}
      role="meter"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        {/* bezel */}
        <circle cx={CX} cy={CY} r="48" fill="var(--well)" stroke="var(--bezel-strong)" />
        <circle cx={CX} cy={CY} r="44" fill="none" stroke="var(--bezel)" strokeWidth="0.75" />
        {/* track + value arcs */}
        <path d={arcPath(225, -45, R)} fill="none" stroke="var(--bezel)" strokeWidth="3" strokeLinecap="round" />
        {v > 0 && (
          <path
            d={arcPath(225, valueAngle(v), R)}
            fill="none"
            stroke={tone}
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
        {ticks}
        {/* needle */}
        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke={tone} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="3.5" fill={tone} />
        {/* reading */}
        <text
          x={CX}
          y="82"
          textAnchor="middle"
          fill="var(--ink)"
          fontSize="15"
          fontWeight="bold"
          fontFamily="var(--font-b612-mono), monospace"
        >
          {Math.round(v)}
        </text>
      </svg>
      <span className="placard mt-1">{label}</span>
      {detail && <p className="mt-0.5 text-xs text-faint">{detail}</p>}
    </div>
  );
}
