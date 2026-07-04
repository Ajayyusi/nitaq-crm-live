"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, Download, Loader2, RefreshCw, XCircle } from "lucide-react";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { exportCsv, fmtNum } from "@/components/accounting/shared";

interface TbRow {
  code: string; name: string; type: string; category: string;
  openingDebit: number; openingCredit: number;
  periodDebit: number; periodCredit: number;
  closingDebit: number; closingCredit: number;
}
interface Totals {
  openingDebit: number; openingCredit: number; periodDebit: number; periodCredit: number;
  closingDebit: number; closingCredit: number; balanced: boolean;
}

export default function TrialBalancePage() {
  const [rows, setRows] = useState<TbRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [openingImbalance, setOpeningImbalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (typeFilter) params.set("type", typeFilter);
    fetch(`/api/accounting/trial-balance?${params}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setTotals(d.totals ?? null); setOpeningImbalance(d.openingImbalance ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to, typeFilter]);

  useEffect(load, [load]);

  const doExport = () => {
    exportCsv(
      `trial-balance-${from || "all"}-${to || "all"}.csv`,
      ["Code", "Account Name", "Type", "Opening Dr", "Opening Cr", "Period Dr", "Period Cr", "Closing Dr", "Closing Cr"],
      rows.map((r) => [r.code, r.name, r.type, r.openingDebit, r.openingCredit, r.periodDebit, r.periodCredit, r.closingDebit, r.closingCredit])
    );
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/accounting" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><ChevronLeft className="h-3 w-3" /> Accounting</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Trial Balance</h1>
          {totals && (
            <p className={`mt-0.5 flex items-center gap-1 text-sm font-semibold ${totals.balanced ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {totals.balanced ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {totals.balanced ? "Balanced" : "OUT OF BALANCE"} — Dr {fmtNum(totals.periodDebit)} / Cr {fmtNum(totals.periodCredit)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm dark:border-white/10 dark:bg-white/5"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={doExport} disabled={rows.length === 0} className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-50">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      {openingImbalance !== 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400">
          ⚠ Opening balances entered on the Chart of Accounts don&apos;t balance (off by {fmtNum(Math.abs(openingImbalance))}).
          Fix the opening debit/credit figures in the COA, or enter openings through a balanced Journal Voucher instead.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        {["", "Asset", "Liability", "Equity", "Revenue", "Expense"].map((t) => (
          <button key={t || "all"} onClick={() => setTypeFilter(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${typeFilter === t ? "bg-[#2E7D32] text-white" : "border border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"}`}>
            {t || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>
      ) : rows.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 dark:border-white/10">No balances in this period.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-gray-500">Account</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase text-gray-500">Open Dr</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase text-gray-500">Open Cr</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase text-gray-500">Period Dr</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase text-gray-500">Period Cr</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase text-gray-500">Close Dr</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase text-gray-500">Close Cr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {rows.map((r) => (
                  <tr key={r.code} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-3 py-2">
                      <Link href={`/accounting/ledger?account=${encodeURIComponent(r.code)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}
                        className="hover:text-[#2E7D32] hover:underline dark:hover:text-green-400">
                        <span className="font-mono text-xs text-gray-400">{r.code}</span>{" "}
                        <span className="text-gray-800 dark:text-gray-200">{r.name}</span>
                      </Link>
                    </td>
                    {[r.openingDebit, r.openingCredit, r.periodDebit, r.periodCredit, r.closingDebit, r.closingCredit].map((v, i) => (
                      <td key={i} className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">{fmtNum(v)}</td>
                    ))}
                  </tr>
                ))}
                {totals && (
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold dark:border-white/20 dark:bg-white/5">
                    <td className="px-3 py-2.5 text-gray-900 dark:text-white">TOTAL</td>
                    {[totals.openingDebit, totals.openingCredit, totals.periodDebit, totals.periodCredit, totals.closingDebit, totals.closingCredit].map((v, i) => (
                      <td key={i} className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">{fmtNum(v)}</td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
