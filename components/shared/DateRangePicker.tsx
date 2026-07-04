"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { DATE_PRESETS, DatePreset, describeRange, getPresetRange } from "@/lib/dateRange";

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Build the 6x7 day grid for a month (Monday first). */
function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function DateRangePicker({ from, to, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  // In-progress custom selection: first click = start, second click = end
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // When opening, focus the calendar on the current "from" (or today)
  useEffect(() => {
    if (!open) return;
    const anchor = from ? new Date(from) : new Date();
    if (!isNaN(anchor.getTime())) {
      setViewYear(anchor.getFullYear());
      setViewMonth(anchor.getMonth());
    }
    setPendingStart(null);
  }, [open, from]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = describeRange(from, to);
  const todayStr = fmt(new Date());

  function applyPreset(value: DatePreset) {
    if (value === "custom") return; // custom = pick on the calendar
    if (value === "all") onChange("", "");
    else {
      const r = getPresetRange(value);
      onChange(r.from, r.to);
    }
    setOpen(false);
  }

  function clickDay(d: Date) {
    const s = fmt(d);
    if (!pendingStart) {
      setPendingStart(s);
    } else {
      // Second click completes the range (swap if clicked backwards)
      const [a, b] = pendingStart <= s ? [pendingStart, s] : [s, pendingStart];
      onChange(a, b);
      setPendingStart(null);
      setOpen(false);
    }
  }

  function prevMonth() {
    setViewMonth((m) => (m === 0 ? (setViewYear((y) => y - 1), 11) : m - 1));
  }
  function nextMonth() {
    setViewMonth((m) => (m === 11 ? (setViewYear((y) => y + 1), 0) : m + 1));
  }

  // Range highlighting: while picking, show pendingStart→hover-free preview via pendingStart only
  const rangeFrom = pendingStart ?? from;
  const rangeTo = pendingStart ? pendingStart : to;

  function dayClasses(d: Date): string {
    const s = fmt(d);
    const inRange = rangeFrom && rangeTo && s >= rangeFrom && s <= rangeTo;
    const isEdge = s === rangeFrom || s === rangeTo;
    const isToday = s === todayStr;
    if (isEdge)
      return "bg-[#2E7D32] text-white font-bold";
    if (inRange)
      return "bg-[#E8F5E9] text-[#1B5E20] dark:bg-green-900/40 dark:text-green-200";
    if (isToday)
      return "ring-1 ring-inset ring-[#2E7D32] text-[#2E7D32] font-semibold dark:text-green-400";
    return "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10";
  }

  const cells = monthGrid(viewYear, viewMonth);

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-[#2E7D32]/50 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays className="h-4 w-4 text-[#2E7D32] dark:text-green-400" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute left-0 z-50 mt-2 w-[calc(100vw-2rem)] max-w-[560px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#122B14] sm:w-[560px]">
          <div className="flex flex-col sm:flex-row">
            {/* Presets */}
            <div className="border-b border-slate-100 p-2 dark:border-white/10 sm:w-40 sm:border-b-0 sm:border-r">
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-1">
                {DATE_PRESETS.filter((p) => p.value !== "custom").map((p) => {
                  const active = label === p.label;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => applyPreset(p.value)}
                      className={`rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition sm:text-[13px] ${
                        active
                          ? "bg-[#2E7D32] text-white"
                          : "text-slate-600 hover:bg-[#E8F5E9] hover:text-[#1B5E20] dark:text-slate-300 dark:hover:bg-green-900/30 dark:hover:text-green-200"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calendar */}
            <div className="flex-1 p-3">
              {/* Month navigation */}
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2">
                  <select
                    value={viewMonth}
                    onChange={(e) => setViewMonth(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-800 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                    aria-label="Month"
                  >
                    {MONTHS.map((mn, i) => (
                      <option key={mn} value={i}>{mn}</option>
                    ))}
                  </select>
                  <select
                    value={viewYear}
                    onChange={(e) => setViewYear(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-800 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                    aria-label="Year"
                  >
                    {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 8 + i).map((yy) => (
                      <option key={yy} value={yy}>{yy}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Weekday header */}
              <div className="grid grid-cols-7 text-center">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="py-1 text-[11px] font-bold uppercase text-slate-400">{w}</span>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7">
                {cells.map((d, i) =>
                  d ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => clickDay(d)}
                      className={`m-0.5 grid h-9 place-items-center rounded-lg text-sm transition ${dayClasses(d)}`}
                    >
                      {d.getDate()}
                    </button>
                  ) : (
                    <span key={i} />
                  )
                )}
              </div>

              {/* Hint / status row */}
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/10">
                <p className="text-xs text-slate-400">
                  {pendingStart
                    ? <>Start: <span className="font-semibold text-[#2E7D32] dark:text-green-400">{pendingStart}</span> — now tap the end date</>
                    : "Tap a start date, then an end date"}
                </p>
                {(from || to || pendingStart) && (
                  <button
                    type="button"
                    onClick={() => { setPendingStart(null); onChange("", ""); setOpen(false); }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-white/10"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
