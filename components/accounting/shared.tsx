"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface CoaAccount {
  code: string; name: string; type: string; category: string;
  subCategory: string; mainAccount: string; parentCode: string | null;
  isPosting: boolean; isActive: boolean; isSystem: boolean;
  openingDebit: number; openingCredit: number;
  currentDebit: number; currentCredit: number; closingBalance: number;
}

export const fmtAED = (n: number) =>
  (n < 0 ? "-" : "") + "AED " + Math.abs(n).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtNum = (n: number) =>
  n === 0 ? "—" : n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Fetch posting accounts once for dropdowns. */
export function usePostingAccounts() {
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setLoading(true);
    setError("");
    fetch("/api/accounting/accounts?posting=true")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []))
      .catch(() => setError("Couldn't load the account list. Retry, or contact your administrator."))
      .finally(() => setLoading(false));
  }, [tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { accounts, loading, error, reload };
}

/**
 * Searchable account picker — type any part of the account NAME or CODE and
 * matching accounts appear. Falls back to showing the selected account label.
 */
export function AccountSelect({
  value, onChange, accounts, typeFilter, placeholder = "Search account…", className = "",
}: {
  value: string;
  onChange: (code: string) => void;
  accounts: CoaAccount[];
  typeFilter?: string[];
  placeholder?: string;
  className?: string;
}) {
  const pool = typeFilter ? accounts.filter((a) => typeFilter.includes(a.type)) : accounts;
  const selected = pool.find((a) => a.code === value) || accounts.find((a) => a.code === value);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    function onDoc(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, []);

  const q = query.trim().toLowerCase();
  const matches = (q
    ? pool.filter((a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q))
    : pool
  ).slice(0, 50);

  // Reset keyboard cursor when the option list changes; keep it in view.
  useEffect(() => { setActiveIdx(0); }, [q, open]);
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const pick = (code: string) => { onChange(code); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, Math.max(0, matches.length - 1))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const m = matches[activeIdx]; if (m) pick(m.code); }
  };

  const base = "h-9 w-full rounded-ctl border border-bezel-strong bg-well px-3 text-sm text-ink transition-colors focus:border-phos focus:outline-none focus:ring-2 focus:ring-phos/25";

  return (
    <div ref={rootRef} className="relative">
      {open ? (
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={placeholder}
          placeholder="Type account name or code…"
          className={`${base} placeholder:text-faint ${className}`}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setOpen(true); setQuery(""); }}
          aria-haspopup="listbox"
          aria-expanded="false"
          aria-label={selected ? `${placeholder} Selected: ${selected.code} ${selected.name}` : placeholder}
          className={`${base} flex items-center justify-between gap-1 text-left ${className}`}
        >
          <span className={selected ? "truncate text-ink" : "truncate text-faint"}>
            {selected ? `${selected.code} — ${selected.name}` : placeholder}
          </span>
          <ChevronDown aria-hidden className="h-3.5 w-3.5 flex-shrink-0 text-faint" />
        </button>
      )}

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-ctl border border-bezel bg-raised shadow-raise"
        >
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="block w-full border-b border-bezel px-3 py-2 text-left text-xs text-dim hover:bg-well"
            >
              Clear selection
            </button>
          )}
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-xs text-faint">No matching accounts.</p>
          ) : (
            matches.map((a, i) => (
              <button
                key={a.code}
                type="button"
                role="option"
                aria-selected={a.code === value}
                data-active={i === activeIdx || undefined}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => pick(a.code)}
                className={`block w-full px-3 py-2 text-left text-sm transition-colors ${i === activeIdx ? "bg-well" : ""} ${a.code === value ? "text-phos" : "text-ink"}`}
              >
                <span className="readout text-xs text-faint" data-numeric>{a.code}</span>{" "}
                <span>{a.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Download rows as CSV. */
export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/*
 * JV status → annunciator-lamp classes (same recipe as <Lamp/>).
 * Kept as a className map so existing call sites keep working:
 * Draft = caution · Posted = ok · Reversed = off · Cancelled = alert.
 */
const lampBase = "inline-flex items-center rounded-lamp border px-1.5 py-0.5 font-bold uppercase tracking-[0.1em]";
export const jvStatusBadge: Record<string, string> = {
  Draft:     `${lampBase} border-caution/30 bg-[var(--lamp-caution-bg)] text-caution`,
  Posted:    `${lampBase} border-phos/30 bg-[var(--lamp-ok-bg)] text-phos`,
  Reversed:  `${lampBase} border-bezel bg-[var(--lamp-off-bg)] text-dim`,
  Cancelled: `${lampBase} border-alert/30 bg-[var(--lamp-alert-bg)] text-alert`,
};
