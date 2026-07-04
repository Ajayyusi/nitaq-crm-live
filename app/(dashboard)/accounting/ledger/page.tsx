"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Download, Loader2, RefreshCw } from "lucide-react";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { AccountSelect, exportCsv, fmtNum, usePostingAccounts } from "@/components/accounting/shared";

interface LedgerRow {
  entryId: string; date: string; jvNumber: string; sourceType: string; sourceNumber: string;
  description: string; debit: number; credit: number; balance: number;
}

function LedgerInner() {
  const searchParams = useSearchParams();
  const { accounts } = usePostingAccounts();
  const [account, setAccount] = useState(searchParams.get("account") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [sourceType, setSourceType] = useState("");
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [accountInfo, setAccountInfo] = useState<{ code: string; name: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!account) { setRows([]); setAccountInfo(null); return; }
    setLoading(true);
    const params = new URLSearchParams({ account });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (sourceType) params.set("sourceType", sourceType);
    fetch(`/api/accounting/ledger?${params}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setAccountInfo(d.account ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [account, from, to, sourceType]);

  useEffect(load, [load]);

  const doExport = () => {
    exportCsv(
      `ledger-${account}.csv`,
      ["Date", "Voucher", "Source", "Source No", "Description", "Debit", "Credit", "Balance"],
      rows.map((r) => [r.date, r.jvNumber, r.sourceType, r.sourceNumber, r.description, r.debit, r.credit, r.balance])
    );
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/accounting" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><ChevronLeft className="h-3 w-3" /> Accounting</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">General Ledger</h1>
          {accountInfo && <p className="text-sm text-gray-500 dark:text-gray-400">{accountInfo.code} — {accountInfo.name} ({accountInfo.type})</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm dark:border-white/10 dark:bg-white/5"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={doExport} disabled={rows.length === 0} className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-50">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-80">
          <AccountSelect value={account} onChange={setAccount} accounts={accounts} placeholder="Choose an account…" />
        </div>
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white">
          <option value="">All Sources</option>
          {["JV", "Invoice", "Receipt", "Expense", "SupplierBill", "SupplierPayment", "Refund", "Reversal"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {!account ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 dark:border-white/10">Choose an account to view its ledger.</div>
      ) : loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>
      ) : rows.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 dark:border-white/10">No transactions for this account.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  {["Date", "Voucher", "Source", "Description", "Debit", "Credit", "Balance"].map((h) => (
                    <th key={h} className={`px-3 py-2.5 text-xs font-bold uppercase text-gray-500 ${["Debit", "Credit", "Balance"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{r.date}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-[#2E7D32] dark:text-green-400">{r.jvNumber}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{r.sourceType}{r.sourceNumber ? ` · ${r.sourceNumber}` : ""}</td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-gray-700 dark:text-gray-300">{r.description}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtNum(r.debit)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtNum(r.credit)}</td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${r.balance < 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>{fmtNum(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400 dark:border-white/10">{rows.length} transactions</div>
        </div>
      )}
    </div>
  );
}

export default function LedgerPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>}>
      <LedgerInner />
    </Suspense>
  );
}
