"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarDays } from "lucide-react";

const PRESETS = [
  { label: "This Month",   key: "month" },
  { label: "Last 3 Months", key: "quarter" },
  { label: "This Year",    key: "year" },
  { label: "All Time",     key: "all" },
] as const;

type PresetKey = (typeof PRESETS)[number]["key"];

function presetRange(key: PresetKey): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = fmt(now);

  if (key === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: fmt(from), to: today };
  }
  if (key === "quarter") {
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { from: fmt(from), to: today };
  }
  if (key === "year") {
    const from = new Date(now.getFullYear(), 0, 1);
    return { from: fmt(from), to: today };
  }
  return { from: "", to: "" };
}

export default function ReportFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const currentFrom = params.get("from") ?? "";
  const currentTo = params.get("to") ?? "";
  const [custom, setCustom] = useState({ from: currentFrom, to: currentTo });

  function applyPreset(key: PresetKey) {
    const { from, to } = presetRange(key);
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    router.push(`/reports?${p.toString()}`);
  }

  function applyCustom() {
    if (!custom.from && !custom.to) { router.push("/reports"); return; }
    const p = new URLSearchParams();
    if (custom.from) p.set("from", custom.from);
    if (custom.to) p.set("to", custom.to);
    router.push(`/reports?${p.toString()}`);
  }

  const activePreset = PRESETS.find(({ key }) => {
    const { from, to } = presetRange(key);
    return from === currentFrom && to === currentTo;
  })?.key ?? ((!currentFrom && !currentTo) ? "all" : null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarDays className="w-4 h-4 text-slate-400 flex-shrink-0" />
      {PRESETS.map(({ label, key }) => (
        <button
          key={key}
          onClick={() => applyPreset(key)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
            activePreset === key
              ? "bg-[#2E7D32] text-white border-[#2E7D32]"
              : "bg-white text-slate-600 border-slate-200 hover:border-[#2E7D32] hover:text-[#2E7D32]"
          }`}
        >
          {label}
        </button>
      ))}
      <div className="flex items-center gap-1.5 ml-1">
        <input
          type="date"
          value={custom.from}
          onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
          className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#2E7D32]"
        />
        <span className="text-xs text-slate-400">–</span>
        <input
          type="date"
          value={custom.to}
          onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
          className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#2E7D32]"
        />
        <button
          onClick={applyCustom}
          className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg border border-slate-200 hover:border-[#2E7D32] hover:text-[#2E7D32] transition"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
