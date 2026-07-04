"use client";

import { useEffect, useState } from "react";

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

export function AccountSelect({
  value, onChange, accounts, typeFilter, placeholder = "Select account…", className = "",
}: {
  value: string;
  onChange: (code: string) => void;
  accounts: CoaAccount[];
  typeFilter?: string[];
  placeholder?: string;
  className?: string;
}) {
  const filtered = typeFilter ? accounts.filter((a) => typeFilter.includes(a.type)) : accounts;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-white ${className}`}
    >
      <option value="">{placeholder}</option>
      {filtered.map((a) => (
        <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
      ))}
    </select>
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
