"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronUp, Download, Loader2, RefreshCw } from "lucide-react";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { exportCsv, fmtNum, jvStatusBadge } from "@/components/accounting/shared";

interface JvLine { accountCode: string; accountName?: string; debit: number; credit: number; description?: string; studentRef?: string; }
interface Jv {
  id: string; jvNumber: string; date: string; description: string; reference: string;
  sourceType: string; sourceNumber: string; status: string;
  totalDebit: number; totalCredit: number; lines: JvLine[];
  createdBy: string; postedBy: string;
}

/** Shared list page for Receipts / Invoices — journal entries of one source type. */
export default function EntryListPage({
  sourceType, title, subtitle,
}: {
  sourceType: "Receipt" | "Invoice";
  title: string;
  subtitle: string;
}) {
  const [entries, setEntries] = useState<Jv[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ sourceType, limit: "500" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/accounting/journal-entries?${params}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sourceType, from, to]);

  useEffect(load, [load]);

  const total = entries.filter((e) => e.status === "Posted").reduce((s, e) => s + e.totalDebit, 0);

  const doExport = () => {
    exportCsv(
      `${title.toLowerCase().replace(/\s+/g, "-")}-${from || "all"}-${to || "all"}.csv`,
      ["Date", "Voucher", "Doc No", "Status", "Party", "Description", "Amount"],
      entries.map((e) => [
        e.date, e.jvNumber, e.sourceNumber,
        e.status,
        e.lines.find((l) => l.studentRef)?.studentRef ?? "",
        e.description, e.totalDebit,
      ])
    );
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/accounting" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><ChevronLeft className="h-3 w-3" /> Accounting</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle} · {entries.length} records · total {fmtNum(total)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm dark:border-white/10 dark:bg-white/5"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={doExport} disabled={entries.length === 0} className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-50">
            <Download className="h-4 w-4" /> Excel / CSV
          </button>
        </div>
      </div>

      <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />

      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>
      ) : entries.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 dark:border-white/10">
          No {title.toLowerCase()} in this period.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const open = expanded === e.id;
            const party = e.lines.find((l) => l.studentRef)?.studentRef ?? "";
            return (
              <div key={e.id} className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
                <button onClick={() => setExpanded(open ? null : e.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left">
                  <span className="font-mono text-xs font-bold text-[#2E7D32] dark:text-green-400">{e.sourceNumber || e.jvNumber}</span>
                  <span className="text-xs text-gray-400">{e.date}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${jvStatusBadge[e.status] ?? ""}`}>{e.status}</span>
                  {party && <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{party}</span>}
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-400">{e.description}</span>
                  <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{fmtNum(e.totalDebit)}</span>
                  {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>
                {open && (
                  <div className="border-t border-gray-100 px-4 py-3 dark:border-white/10">
                    <table className="min-w-full text-sm">
                      <tbody>
                        {e.lines.map((l, i) => (
                          <tr key={i} className="border-t border-gray-50 first:border-0 dark:border-white/5">
                            <td className="py-1.5 pr-3">
                              <span className="font-mono text-xs text-gray-400">{l.accountCode}</span>{" "}
                              <span className="text-gray-700 dark:text-gray-300">{l.accountName}</span>
                            </td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{fmtNum(l.debit)}</td>
                            <td className="py-1.5 text-right tabular-nums">{fmtNum(l.credit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-xs text-gray-400">JV {e.jvNumber} · by {e.createdBy}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
