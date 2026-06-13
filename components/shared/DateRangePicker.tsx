"use client";

import { DATE_PRESETS, DatePreset, detectPreset, getPresetRange } from "@/lib/dateRange";

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

const cls =
  "px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32]";

export default function DateRangePicker({ from, to, onChange }: Props) {
  const preset = detectPreset(from, to);

  function handlePreset(value: string) {
    if (value === "all") {
      onChange("", "");
    } else if (value === "custom") {
      // Keep existing dates when switching to custom
    } else {
      const r = getPresetRange(value as DatePreset);
      onChange(r.from, r.to);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={preset}
        onChange={(e) => handlePreset(e.target.value)}
        className={cls}
        aria-label="Date range preset"
      >
        {DATE_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      {preset === "custom" && (
        <>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onChange(e.target.value, to)}
            className={cls}
            aria-label="Start date"
          />
          <span className="text-xs text-slate-400">→</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => onChange(from, e.target.value)}
            className={cls}
            aria-label="End date"
          />
        </>
      )}
    </div>
  );
}
