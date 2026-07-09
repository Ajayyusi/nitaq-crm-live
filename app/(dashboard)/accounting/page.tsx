"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight, BookOpen, Building2, Calculator, Database, FileSpreadsheet,
  Landmark, ListChecks, Loader2, Receipt, RefreshCw, Scale, Settings2, Users, Wallet,
} from "lucide-react";
import { fmtAED } from "@/components/accounting/shared";

interface Dash {
  cashBalance: number; bankBalance: number;
  accountsReceivable: number; accountsPayable: number;
  revenueThisMonth: number; expensesThisMonth: number;
  vatPayable: number; netProfit: number; netProfitThisMonth: number;
}

const MODULES = [
  { label: "Financial Register",  href: "/accounting/register",      icon: ListChecks,      desc: "Every voucher, filterable + export" },
  { label: "Chart of Accounts",   href: "/accounting/coa",           icon: BookOpen,        desc: "Account structure & balances" },
  { label: "Journal Vouchers",    href: "/accounting/journal",       icon: Calculator,      desc: "Manual entries, post & reverse" },
  { label: "Receipts",            href: "/accounting/receipts",      icon: Wallet,          desc: "Money received from students" },
  { label: "Invoices",            href: "/accounting/invoices",      icon: Receipt,         desc: "Student fee invoices" },
  { label: "Student Receivables", href: "/accounting/receivables",   icon: Users,           desc: "Per-student balances" },
  { label: "Suppliers",           href: "/accounting/suppliers",     icon: Building2,       desc: "Bills, payments, statements" },
  { label: "Trial Balance",       href: "/accounting/trial-balance", icon: Scale,           desc: "Debits = credits check" },
  { label: "General Ledger",      href: "/accounting/ledger",        icon: FileSpreadsheet, desc: "Per-account transactions" },
  { label: "VAT Report",          href: "/accounting/vat",           icon: Landmark,        desc: "Input / Output VAT" },
  { label: "Settings",            href: "/accounting/settings",      icon: Settings2,       desc: "Account mappings" },
];

export default function AccountingDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [coaCount, setCoaCount] = useState<number | null>(null);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/accounting/dashboard").then((r) => r.json()),
      fetch("/api/accounting/accounts").then((r) => r.json()),
      fetch("/api/accounting/journal-entries?limit=1").then((r) => r.json()),
    ])
      .then(([dash, coa, jv]) => {
        setData(dash);
        setCoaCount((coa.accounts ?? []).length);
        setEntryCount((jv.entries ?? []).length);
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

  const backfill = async () => {
    setBackfilling(true);
    setBackfillMsg("");
    try {
      const res = await fetch("/api/accounting/backfill", { method: "POST" });
      const d = await res.json();
      setBackfillMsg(d.message ?? "Done.");
      load();
    } catch {
      setBackfillMsg("Backfill failed.");
    } finally {
      setBackfilling(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>;
  }

  const cards = data ? [
    { label: "Cash Balance",        value: data.cashBalance,       icon: Wallet,   color: "text-green-600", href: "/accounting/register?group=cash" },
    { label: "Bank Balance",        value: data.bankBalance,       icon: Landmark, color: "text-blue-600", href: "/accounting/register?group=bank" },
    { label: "Receivable (A/R)",    value: data.accountsReceivable, icon: Receipt, color: "text-teal-600", href: "/accounting/receivables" },
    { label: "Payable (A/P)",       value: data.accountsPayable,   icon: Building2, color: "text-amber-600", href: "/accounting/suppliers" },
    { label: "Revenue This Month",  value: data.revenueThisMonth,  icon: Calculator, color: "text-green-600", href: "/accounting/invoices" },
    { label: "Expenses This Month", value: data.expensesThisMonth, icon: Receipt,  color: "text-red-600", href: "/accounting/register?sourceType=Expense" },
    { label: "VAT Payable",         value: data.vatPayable,        icon: Landmark, color: data.vatPayable > 0 ? "text-red-600" : "text-green-600", href: "/accounting/vat" },
    { label: "Net Profit (All)",    value: data.netProfit,         icon: Scale,    color: data.netProfit >= 0 ? "text-green-600" : "text-red-600", href: "/accounting/trial-balance" },
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

      {/* COA seeded but no entries yet: offer CRM history backfill */}
      {coaCount !== null && coaCount > 0 && entryCount === 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800/40 dark:bg-blue-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-blue-600" />
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-300">No journal entries yet</p>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Import your existing CRM history — every enrollment, payment and expense
                  gets its double-entry journal entry. Safe to run more than once.
                </p>
              </div>
            </div>
            <button
              onClick={backfill}
              disabled={backfilling}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {backfilling ? "Importing…" : "Import CRM History"}
            </button>
          </div>
          {backfillMsg && <p className="mt-2 text-sm font-medium text-blue-800 dark:text-blue-400">{backfillMsg}</p>}
        </div>
      )}
      {/* Show result even after entries exist */}
      {backfillMsg && entryCount !== 0 && (
        <p className="rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-800 dark:bg-green-950/30 dark:text-green-400">{backfillMsg}</p>
      )}

      {/* KPI cards — each drills into its register/report */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}
            className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#2E7D32]/40 hover:shadow-md dark:border-white/10 dark:bg-white/5">
            <div className="flex items-start justify-between">
              <c.icon className={`mb-2 h-5 w-5 ${c.color}`} />
              <ArrowRight className="h-3.5 w-3.5 text-gray-200 transition group-hover:text-[#2E7D32]" />
            </div>
            <p className={`text-lg font-extrabold ${c.color}`}>{fmtAED(c.value)}</p>
            <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">{c.label}</p>
          </Link>
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
