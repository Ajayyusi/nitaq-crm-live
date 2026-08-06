"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight, BookOpen, Building2, Calculator, Database, FileSpreadsheet,
  Landmark, ListChecks, Receipt, RefreshCw, Scale, Settings2, Users, Wallet,
} from "lucide-react";
import { fmtAED } from "@/components/accounting/shared";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Instrument } from "@/components/ui/instrument";
import { PanelLoading, LoadError } from "@/components/ui/feedback";

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
  const [loadError, setLoadError] = useState(false);
  const [coaCount, setCoaCount] = useState<number | null>(null);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
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
      .catch(() => setLoadError(true))
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
      setSeedMsg("Seeding failed. Retry, or contact your administrator.");
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
      setBackfillMsg("Backfill failed. Retry, or contact your administrator.");
    } finally {
      setBackfilling(false);
    }
  };

  const header = (
    <PageHeader
      title="Accounting"
      subtitle="Double-entry accounting linked to the CRM"
      actions={
        <Button variant="ghost" size="icon" onClick={load} aria-label="Refresh accounting data">
          <RefreshCw className="h-4 w-4" />
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        {header}
        <PanelLoading label="Reading instruments" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 sm:p-6">
        {header}
        <LoadError message="Couldn't load the accounting overview." onRetry={load} />
      </div>
    );
  }

  const cards = data ? [
    { label: "Cash Balance",        value: data.cashBalance,        tone: "phos" as const,                                    href: "/accounting/register?group=cash" },
    { label: "Bank Balance",        value: data.bankBalance,        tone: "ink" as const,                                     href: "/accounting/register?group=bank" },
    { label: "Receivable (A/R)",    value: data.accountsReceivable, tone: "ink" as const,                                     href: "/accounting/receivables" },
    { label: "Payable (A/P)",       value: data.accountsPayable,    tone: "ink" as const,                                     href: "/accounting/suppliers" },
    { label: "Revenue This Month",  value: data.revenueThisMonth,   tone: "ink" as const,                                     href: "/accounting/invoices" },
    { label: "Expenses This Month", value: data.expensesThisMonth,  tone: "ink" as const,                                     href: "/accounting/register?sourceType=Expense" },
    { label: "VAT Payable",         value: data.vatPayable,         tone: data.vatPayable > 0 ? ("caution" as const) : ("ink" as const), href: "/accounting/vat" },
    { label: "Net Profit (All)",    value: data.netProfit,          tone: data.netProfit >= 0 ? ("phos" as const) : ("alert" as const),  href: "/accounting/trial-balance" },
  ] : [];

  return (
    <div className="p-4 sm:p-6">
      {header}
      <div className="space-y-6">
        {/* First-run: seed COA */}
        {coaCount === 0 && (
          <div role="alert" className="rounded-card border border-caution/30 bg-[var(--lamp-caution-bg)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Database className="h-6 w-6 flex-shrink-0 text-caution" aria-hidden />
                <div>
                  <p className="text-sm font-bold text-ink">Chart of Accounts is empty</p>
                  <p className="text-sm text-dim">Load the official NITAQ chart of accounts (114 accounts + 3 suppliers) from the accountant&apos;s Excel.</p>
                </div>
              </div>
              <Button variant="solid" onClick={seedCoa} disabled={seeding}>
                {seeding ? "Seeding…" : "Seed Chart of Accounts"}
              </Button>
            </div>
            {seedMsg && <p role="status" className="mt-2 text-sm font-semibold text-caution">{seedMsg}</p>}
          </div>
        )}

        {/* COA seeded but no entries yet: offer CRM history backfill */}
        {coaCount !== null && coaCount > 0 && entryCount === 0 && (
          <div role="status" className="rounded-card border border-advisory/30 bg-[var(--lamp-advisory-bg)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Database className="h-6 w-6 flex-shrink-0 text-advisory" aria-hidden />
                <div>
                  <p className="text-sm font-bold text-ink">No journal entries yet</p>
                  <p className="text-sm text-dim">
                    Import your existing CRM history — every enrollment, payment and expense
                    gets its double-entry journal entry. Safe to run more than once.
                  </p>
                </div>
              </div>
              <Button variant="primary" onClick={backfill} disabled={backfilling}>
                {backfilling ? "Importing…" : "Import CRM History"}
              </Button>
            </div>
            {backfillMsg && <p role="status" className="mt-2 text-sm font-semibold text-advisory">{backfillMsg}</p>}
          </div>
        )}
        {/* Show result even after entries exist */}
        {backfillMsg && entryCount !== 0 && (
          <p role="status" className="rounded-ctl border border-advisory/30 bg-[var(--lamp-advisory-bg)] px-4 py-2 text-sm font-semibold text-advisory">{backfillMsg}</p>
        )}

        {/* KPI instruments — each drills into its register/report */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((c) => (
            <Instrument
              key={c.label}
              label={c.label}
              value={fmtAED(c.value)}
              tone={c.tone}
              href={c.href}
              corner={<ArrowRight aria-hidden className="h-3.5 w-3.5 text-faint transition-colors group-hover:text-phos" />}
            />
          ))}
        </div>

        {/* Module links */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="face group flex items-center gap-3 p-4 transition-all duration-150 hover:border-bezel-strong hover:shadow-raise"
            >
              <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-ctl border border-bezel bg-well">
                <m.icon className="h-5 w-5 text-phos" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink transition-colors group-hover:text-phos">{m.label}</p>
                <p className="truncate text-xs text-faint">{m.desc}</p>
              </div>
              <ArrowRight aria-hidden className="h-4 w-4 flex-shrink-0 text-faint transition-colors group-hover:text-phos" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
