const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export type DatePreset =
  | "today" | "yesterday" | "this-week" | "last-week"
  | "this-month" | "last-month" | "this-quarter" | "last-quarter"
  | "this-year" | "last-year" | "all" | "custom";

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today",         label: "Today" },
  { value: "yesterday",     label: "Yesterday" },
  { value: "this-week",     label: "This Week" },
  { value: "last-week",     label: "Last Week" },
  { value: "this-month",    label: "This Month" },
  { value: "last-month",    label: "Last Month" },
  { value: "this-quarter",  label: "This Quarter" },
  { value: "last-quarter",  label: "Last Quarter" },
  { value: "this-year",     label: "This Year" },
  { value: "last-year",     label: "Last Year" },
  { value: "all",           label: "All Time" },
  { value: "custom",        label: "Custom Range" },
];

export function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = fmt(now);

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const d = new Date(y, m, now.getDate() - 1);
      return { from: fmt(d), to: fmt(d) };
    }
    case "this-week": {
      const day = now.getDay();
      const mon = new Date(y, m, now.getDate() - (day === 0 ? 6 : day - 1));
      return { from: fmt(mon), to: today };
    }
    case "last-week": {
      const day = now.getDay();
      const mon = new Date(y, m, now.getDate() - (day === 0 ? 6 : day - 1) - 7);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { from: fmt(mon), to: fmt(sun) };
    }
    case "this-month":
      return { from: fmt(new Date(y, m, 1)), to: today };
    case "last-month": {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { from: fmt(start), to: fmt(end) };
    }
    case "this-quarter": {
      const q = Math.floor(m / 3);
      return { from: fmt(new Date(y, q * 3, 1)), to: today };
    }
    case "last-quarter": {
      const q = Math.floor(m / 3);
      const lq = q === 0 ? 3 : q - 1;
      const ly = q === 0 ? y - 1 : y;
      return { from: fmt(new Date(ly, lq * 3, 1)), to: fmt(new Date(ly, lq * 3 + 3, 0)) };
    }
    case "this-year":
      return { from: fmt(new Date(y, 0, 1)), to: today };
    case "last-year":
      return { from: fmt(new Date(y - 1, 0, 1)), to: fmt(new Date(y - 1, 11, 31)) };
    default:
      return { from: "", to: "" };
  }
}

/** Returns { from, to } for "This Month" — used as default. */
export function thisMonthRange() {
  return getPresetRange("this-month");
}

/** Given from/to strings, return the matching DatePreset value or "custom". */
export function detectPreset(from: string, to: string): DatePreset {
  if (!from && !to) return "all";
  for (const { value } of DATE_PRESETS) {
    if (value === "all" || value === "custom") continue;
    const r = getPresetRange(value);
    if (r.from === from && r.to === to) return value;
  }
  return "custom";
}

/** Given from/to strings, guess the matching preset label or return the range string. */
export function describeRange(from: string, to: string): string {
  if (!from && !to) return "All Time";
  for (const { value, label } of DATE_PRESETS) {
    if (value === "all" || value === "custom") continue;
    const r = getPresetRange(value);
    if (r.from === from && r.to === to) return label;
  }
  return `${from} → ${to}`;
}

/** Build a Mongoose date match object for a field. */
export function buildDateFilter(
  from: string | undefined,
  to: string | undefined
): Record<string, Date> | undefined {
  const f = from ? new Date(from) : null;
  const t = to   ? new Date(to + "T23:59:59.999Z") : null;
  if (!f && !t) return undefined;
  const out: Record<string, Date> = {};
  if (f) out.$gte = f;
  if (t) out.$lte = t;
  return out;
}
