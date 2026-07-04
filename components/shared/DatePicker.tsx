"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

interface Props {
  value: string;                    // ISO yyyy-mm-dd or ""
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  min?: string;
  max?: string;
  className?: string;               // extra classes for the trigger
  compact?: boolean;                // smaller trigger (for inline table rows)
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function displayLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function DatePicker({
  value, onChange, placeholder = "Select date", required, min, max, className = "", compact,
}: Props) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const anchor = value ? new Date(value + "T00:00:00") : new Date();
    if (!isNaN(anchor.getTime())) {
      setViewYear(anchor.getFullYear());
      setViewMonth(anchor.getMonth());
    }
  }, [open, value]);

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

  const todayStr = fmt(new Date());

  function disabled(s: string) {
    if (min && s < min) return true;
    if (max && s > max) return true;
    return false;
  }

  function pick(d: Date) {
    const s = fmt(d);
    if (disabled(s)) return;
    onChange(s);
    setOpen(false);
  }

  function prevMonth() {
    setViewMonth((m) => (m === 0 ? (setViewYear((y) => y - 1), 11) : m - 1));
  }
  function nextMonth() {
    setViewMonth((m) => (m === 11 ? (setViewYear((y) => y + 1), 0) : m + 1));
  }

  const cells = monthGrid(viewYear, viewMonth);

  const triggerBase = compact
    ? "flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5"
    : "flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${triggerBase} text-left transition focus:outline-none focus:ring-2 focus:ring-[#2E7D32] hover:border-[#2E7D32]/50 ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} flex-shrink-0 text-[#2E7D32] dark:text-green-400`} />
        {value ? (
          <span className="flex-1 truncate text-slate-900 dark:text-slate-100">{displayLabel(value)}</span>
        ) : (
          <span className="flex-1 truncate text-slate-400">{placeholder}{required ? " *" : ""}</span>
        )}
        {value && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="grid h-4 w-4 flex-shrink-0 place-items-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-white/10"
            aria-label="Clear date"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-[290px] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-[#122B14]">
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
            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-sm font-semibold text-slate-800 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                aria-label="Month"
              >
                {MONTHS.map((mn, i) => (
                  <option key={mn} value={i}>{mn}</option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-sm font-semibold text-slate-800 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                aria-label="Year"
              >
                {Array.from({ length: 41 }, (_, i) => new Date().getFullYear() - 30 + i).map((yy) => (
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
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const s = fmt(d);
              const isSelected = s === value;
              const isToday = s === todayStr;
              const isDisabled = disabled(s);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(d)}
                  disabled={isDisabled}
                  className={`m-0.5 grid h-9 place-items-center rounded-lg text-sm transition ${
                    isSelected
                      ? "bg-[#2E7D32] font-bold text-white"
                      : isDisabled
                        ? "cursor-not-allowed text-slate-300 dark:text-slate-600"
                        : isToday
                          ? "font-semibold text-[#2E7D32] ring-1 ring-inset ring-[#2E7D32] dark:text-green-400"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/10">
            <button
              type="button"
              onClick={() => { const t = fmt(new Date()); if (!disabled(t)) { onChange(t); setOpen(false); } }}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-[#2E7D32] hover:bg-[#E8F5E9] dark:text-green-400 dark:hover:bg-green-900/30"
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-white/10"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
