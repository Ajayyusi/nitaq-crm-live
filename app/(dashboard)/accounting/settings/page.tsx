"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Save } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import { AccountSelect, usePostingAccounts } from "@/components/accounting/shared";

const MAPPINGS: { key: string; label: string; hint?: string }[] = [
  { key: "defaultCashAccount",   label: "Default Cash Account" },
  { key: "defaultBankAccount",   label: "Default Bank Account" },
  { key: "defaultPosAccount",    label: "POS / Card Collection Account" },
  { key: "tabbyAccount",         label: "Tabby Collection Account" },
  { key: "tamaraAccount",        label: "Tamara Collection Account" },
  { key: "pettyCashAccount",     label: "Petty Cash Account" },
  { key: "accountsReceivable",   label: "Accounts Receivable (Students)" },
  { key: "feesAdvanceAccount",   label: "Fees Received in Advance" },
  { key: "outputVatAccount",     label: "Output VAT" },
  { key: "inputVatAccount",      label: "Input VAT" },
  { key: "defaultRevenueAccount", label: "Default Revenue Account", hint: "Used when a course has no specific mapping" },
  { key: "defaultExpenseAccount", label: "Default Expense Account" },
  { key: "discountAccount",      label: "Sales Discount Account", hint: "optional" },
  { key: "refundAccount",        label: "Refund Account", hint: "optional" },
  { key: "badDebtAccount",       label: "Bad Debt Expense", hint: "optional" },
];

export default function AccountingSettingsPage() {
  const { accounts, loading: accountsLoading } = usePostingAccounts();
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/accounting/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings ?? {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/accounting/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setSettings(d.settings);
      setMsg("Saved.");
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setMsg((err as Error).message);
    } finally { setSaving(false); }
  };

  if (loading || accountsLoading || !settings) {
    return <div className="flex h-64 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-3xl">
      <div>
        <Link href="/accounting" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><ChevronLeft className="h-3 w-3" /> Accounting</Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Accounting Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Map CRM operations to Chart of Accounts — nothing is hardcoded</p>
      </div>

      {/* VAT */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">VAT</h2>
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!settings.vatEnabled} onChange={(e) => setSettings((s) => ({ ...s!, vatEnabled: e.target.checked }))} className="h-4 w-4 accent-[#2E7D32]" />
            <span className="text-gray-700 dark:text-gray-300">VAT enabled (post Output VAT on invoices)</span>
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Rate</span>
            <input type="number" min="0" max="100" value={Number(settings.vatRate) || 5}
              onChange={(e) => setSettings((s) => ({ ...s!, vatRate: Number(e.target.value) }))}
              className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" />
            <span className="text-gray-400">%</span>
          </div>
        </div>
      </section>

      {/* Auto-posting */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">Automatic Posting</h2>
        <div className="space-y-2">
          {[
            ["autoPostInvoices", "Post invoice entries when enrollments are created"],
            ["autoPostPayments", "Post receipt entries when payments are recorded"],
            ["autoPostExpenses", "Post expense entries when expenses are recorded"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!settings[key]} onChange={(e) => setSettings((s) => ({ ...s!, [key]: e.target.checked }))} className="h-4 w-4 accent-[#2E7D32]" />
              <span className="text-gray-700 dark:text-gray-300">{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Period lock */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Books Lock Date</h2>
        <p className="mb-3 text-xs text-gray-400">No journal entries can be posted on or before this date — set it after closing a period so nobody can change closed months.</p>
        <div className="max-w-xs">
          <DatePicker
            value={String(settings.lockDate ?? "")}
            onChange={(v) => setSettings((s) => ({ ...s!, lockDate: v }))}
            placeholder="No lock — all periods open"
          />
        </div>
      </section>

      {/* Account mappings */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">Account Mappings</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {MAPPINGS.map((m) => (
            <div key={m.key}>
              <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                {m.label}{m.hint && <span className="ml-1 font-normal text-gray-400">({m.hint})</span>}
              </label>
              <AccountSelect
                value={String(settings[m.key] ?? "")}
                onChange={(v) => setSettings((s) => ({ ...s!, [m.key]: v }))}
                accounts={accounts}
                placeholder="— not set —"
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#2E7D32] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings
        </button>
        {msg && <span className={`text-sm font-medium ${msg === "Saved." ? "text-green-600" : "text-red-600"}`}>{msg}</span>}
      </div>
    </div>
  );
}
