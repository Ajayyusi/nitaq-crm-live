"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight, BookOpen, Building2, Calculator, Database, FileSpreadsheet,
  Landmark, Loader2, Receipt, RefreshCw, Scale, Settings2, Wallet,
} from "lucide-react";
import { fmtAED } from "@/components/accounting/shared";

interface Dash {
  cashBalance: number; bankBalance: number;
  accountsReceivable: number; accountsPayable: number;
  revenueThisMonth: number; expensesThisMonth: number;
  vatPayable: number; netProfit: number; netProfitThisMonth: number;
}

const MODULES = [
  { label: "Chart of Accounts", href: "/accounting/coa",           icon: BookOpen,        desc: "Account structure & balances" },
  { label: "Journal Vouchers",  href: "/accounting/journal",       icon: Calculator,      desc: "Manual entries, post & reverse" },
  { label: "Suppliers",         href: "/accounting/suppliers",     icon: Building2,       desc: "Bills, payments, statements" },
  { label: "Trial Balance",     href: "/accounting/trial-balance", icon: Scale,           desc: "Debits = credits check" },
  { label: "General Ledger",    href: "/accounting/ledger",        icon: FileSpreadsheet, desc: "Per-account transactions" },
  { label: "VAT Report",        href: "/accounting/vat",           icon: Landmark,        desc: "Input / Output VAT" },
  { label: "Settings",          href: "/accounting/settings",      icon: Settings2,       desc: "Account mappings" },
];

export default function AccountingDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [coaCount, setCoaCount] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/accounting/dashboard").then((r) => r.json()),
      fetch("/api/accounting/accounts").then((r) => r.json()),
    ])
      .then(([dash, coa]) => {
        setData(dash);
        setCoaCount((coa.accounts ?? []).length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const seedCoa = async () => {
    setSeeding(true);
    setSeedMsg("");
    try {
      const res = await fetch("/api/accounting/seed-coa", { method: "POST" });
      const d = await res.json();
      setSeedMsg(d.message ?? "Done.");
      load();
    } catch {
      setSeedMsg("Seeding failed.");
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>;
  }

  const cards = data ? [
    { label: "Cash Balance",        value: data.cashBalance,       icon: Wallet,   color: "text-green-600" },
    { label: "Bank Balance",        value: data.bankBalance,       icon: Landmark, color: "text-blue-600" },
    { label: "Receivable (A/R)",    value: data.accountsReceivable, icon: Receipt, color: "text-teal-600" },
    { label: "Payable (A/P)",       value: data.accountsPayable,   icon: Building2, color: "text-amber-600" },
    { label: "Revenue This Month",  value: data.revenueThisMonth,  icon: Calculator, color: "text-green-600" },
    { label: "Expenses This Month", value: data.expensesThisMonth, icon: Receipt,  color: "text-red-600" },
    { label: "VAT Payable",         value: data.vatPayable,        icon: Landmark, color: data.vatPayable > 0 ? "text-red-600" : "text-green-600" },
    { label: "Net Profit (All)",    value: data.netProfit,         icon: Scale,    color: data.netProfit >= 0 ? "text-green-600" : "text-red-600" },
  ] : [];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Accounting</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Double-entry accounting linked to the CRM</p>
        </div>
        <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* First-run: seed COA */}
      {coaCount === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800/40 dark:bg-amber-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-300">Chart of Accounts is empty</p>
                <p className="text-sm text-amber-700 dark:text-amber-500">Load the official NITAQ chart of accounts (114 accounts + 3 suppliers) from the accountant's Excel.</p>
              </div>
            </div>
            <button
              onClick={seedCoa}
              disabled={seeding}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {seeding ? "Seeding…" : "Seed Chart of Accounts"}
            </button>
          </div>
          {seedMsg && <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-400">{seedMsg}</p>}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <c.icon className={`mb-2 h-5 w-5 ${c.color}`} />
            <p className={`text-lg font-extrabold ${c.color}`}>{fmtAED(c.value)}</p>
            <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Module links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5"
          >
            <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-[#E8F5E9] dark:bg-green-900/30">
              <m.icon className="h-5 w-5 text-[#2E7D32] dark:text-green-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[#2E7D32] dark:text-white dark:group-hover:text-green-400">{m.label}</p>
              <p className="truncate text-xs text-gray-400">{m.desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-300 group-hover:text-[#2E7D32]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
