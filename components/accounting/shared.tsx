"use client";

import { useEffect, useRef, useState } from "react";

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
  useEffect(() => {
    fetch("/api/accounting/accounts?posting=true")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return { accounts, loading };
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
  const rootRef = useRef<HTMLDivElement>(null);

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

  const base = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <div ref={rootRef} className="relative">
      {open ? (
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type account name or code…"
          className={`${base} ${className}`}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setOpen(true); setQuery(""); }}
          className={`${base} flex items-center justify-between text-left ${className}`}
        >
          <span className={selected ? "truncate text-slate-900 dark:text-white" : "truncate text-slate-400"}>
            {selected ? `${selected.code} — ${selected.name}` : placeholder}
          </span>
          <span className="ml-1 flex-shrink-0 text-slate-400">▾</span>
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#122B14]">
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
            >
              Clear selection
            </button>
          )}
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-400">No matching accounts.</p>
          ) : (
            matches.map((a) => (
              <button
                key={a.code}
                type="button"
                onClick={() => { onChange(a.code); setOpen(false); }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-[#E8F5E9] dark:hover:bg-green-900/20 ${a.code === value ? "bg-[#E8F5E9] dark:bg-green-900/20" : ""}`}
              >
                <span className="font-mono text-xs text-slate-400">{a.code}</span>{" "}
                <span className="text-slate-800 dark:text-slate-200">{a.name}</span>
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

export const jvStatusBadge: Record<string, string> = {
  Draft:     "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400",
  Posted:    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Reversed:  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};
