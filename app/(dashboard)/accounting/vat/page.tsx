"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Landmark, Loader2, RefreshCw } from "lucide-react";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { exportCsv, fmtAED, fmtNum } from "@/components/accounting/shared";
import BackButton from "@/components/shared/BackButton";
import { getPresetRange } from "@/lib/dateRange";

interface VatTx {
  date: string; jvNumber: string; sourceType: string; sourceNumber: string;
  description: string; party: string; kind: "Output" | "Input";
  taxableAmount: number; vatAmount: number; totalAmount: number;
}

export default function VatPage() {
  const [from, setFrom] = useState(() => getPresetRange("this-quarter").from);
  const [to, setTo] = useState(() => getPresetRange("this-quarter").to);
  const [data, setData] = useState<{ outputVat: number; inputVat: number; netVat: number; vatRate: number; vatEnabled: boolean; transactions: VatTx[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/accounting/vat-report?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(load, [load]);

  const txns = (data?.transactions ?? []).filter((t) => !kindFilter || t.kind === kindFilter);

  const doExport = () => {
    exportCsv(
      `vat-report-${from}-${to}.csv`,
      ["Date", "Voucher", "Source", "Doc No", "Type", "Party", "Description", "Taxable", "VAT", "Total"],
      txns.map((t) => [t.date, t.jvNumber, t.sourceType, t.sourceNumber, t.kind, t.party, t.description, t.taxableAmount, t.vatAmount, t.totalAmount])
    );
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <BackButton />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">VAT Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            UAE VAT {data?.vatRate ?? 5}%{data && !data.vatEnabled ? " · VAT posting currently disabled in settings" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm dark:border-white/10 dark:bg-white/5"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={doExport} disabled={txns.length === 0} className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-50">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />

      {loading || !data ? (
        <div className="flex h-40 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold text-gray-500">Output VAT (on sales)</p>
              <p className="mt-1 text-xl font-extrabold text-amber-600">{fmtAED(data.outputVat)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold text-gray-500">Input VAT (recoverable)</p>
              <p className="mt-1 text-xl font-extrabold text-blue-600">{fmtAED(data.inputVat)}</p>
            </div>
            <div className={`rounded-xl border p-4 shadow-sm ${data.netVat > 0 ? "border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/20" : "border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-950/20"}`}>
              <p className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300"><Landmark className="h-3.5 w-3.5" /> Net VAT {data.netVat > 0 ? "Payable" : "Refundable"}</p>
              <p className={`mt-1 text-xl font-extrabold ${data.netVat > 0 ? "text-red-600" : "text-green-600"}`}>{fmtAED(Math.abs(data.netVat))}</p>
            </div>
          </div>

          {/* Kind filter */}
          <div className="flex gap-2">
            {["", "Output", "Input"].map((k) => (
              <button key={k || "all"} onClick={() => setKindFilter(k)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${kindFilter === k ? "bg-[#2E7D32] text-white" : "border border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"}`}>
                {k || "All"} {k && "VAT"}
              </button>
            ))}
          </div>

          {/* Transactions */}
          {txns.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 dark:border-white/10">No VAT transactions in this period.</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-white/10">
                  <thead className="bg-gray-50 dark:bg-white/5">
                    <tr>
                      {["Date", "Doc", "Type", "Party", "Taxable", "VAT", "Total"].map((h) => (
                        <th key={h} className={`px-3 py-2.5 text-xs font-bold uppercase text-gray-500 ${["Taxable", "VAT", "Total"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                    {txns.map((t, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{t.date}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs">
                          <span className="font-mono font-semibold text-[#2E7D32] dark:text-green-400">{t.jvNumber}</span>
                          {t.sourceNumber && <span className="text-gray-400"> · {t.sourceNumber}</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.kind === "Output" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"}`}>{t.kind}</span>
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-2 text-gray-700 dark:text-gray-300">{t.party || t.description}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtNum(t.taxableAmount)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{fmtNum(t.vatAmount)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtNum(t.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400 dark:border-white/10">{txns.length} transactions</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
