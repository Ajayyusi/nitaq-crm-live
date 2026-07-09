"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, Search, Users, Wand2,
} from "lucide-react";
import { exportCsv, fmtNum } from "@/components/accounting/shared";

interface StudentRow {
  code: string; name: string; isControl: boolean;
  invoiced: number; paid: number; balance: number;
}

export default function ReceivablesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const canEdit = role === "admin" || role === "accountant";

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [totals, setTotals] = useState({ invoiced: 0, paid: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/accounting/receivables")
      .then((r) => r.json())
      .then((d) => { setStudents(d.students ?? []); setTotals(d.totals ?? { invoiced: 0, paid: 0, balance: 0 }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const migrate = async () => {
    if (!confirm("Move historical ledger lines from the Student-1 control account onto each student's own account?")) return;
    setMigrating(true); setMigrateMsg("");
    try {
      const res = await fetch("/api/accounting/receivables", { method: "POST" });
      const d = await res.json();
      setMigrateMsg(d.message ?? "Done.");
      load();
    } catch { setMigrateMsg("Migration failed."); }
    finally { setMigrating(false); }
  };

  const filtered = students.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.code.includes(search));
  const controlHasBalance = students.some((s) => s.isControl && (s.invoiced || s.paid));

  const doExport = () => {
    exportCsv(
      "student-receivables.csv",
      ["Account Code", "Student", "Invoiced", "Paid", "Balance"],
      filtered.map((s) => [s.code, s.name, s.invoiced, s.paid, s.balance])
    );
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/accounting" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><ChevronLeft className="h-3 w-3" /> Accounting</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Student Receivables</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} students · outstanding {fmtNum(totals.balance)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm dark:border-white/10 dark:bg-white/5"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={doExport} disabled={filtered.length === 0} className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-50">
            <Download className="h-4 w-4" /> Excel / CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[["Invoiced", totals.invoiced, "text-gray-900 dark:text-white"], ["Collected", totals.paid, "text-green-600"], ["Outstanding", totals.balance, totals.balance > 0 ? "text-red-600" : "text-green-600"]].map(([label, v, cls]) => (
          <div key={label as string} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold text-gray-500">{label}</p>
            <p className={`mt-1 text-lg font-extrabold tabular-nums ${cls}`}>{fmtNum(Number(v))}</p>
          </div>
        ))}
      </div>

      {/* Migration banner: history still on the control account */}
      {canEdit && controlHasBalance && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/40 dark:bg-blue-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Some history is still on the shared <strong>Student-1</strong> control account.
              Split it so every student has their own ledger.
            </p>
            <button onClick={migrate} disabled={migrating}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              <Wand2 className="h-4 w-4" /> {migrating ? "Splitting…" : "Split by Student"}
            </button>
          </div>
          {migrateMsg && <p className="mt-2 text-sm font-medium text-blue-800 dark:text-blue-400">{migrateMsg}</p>}
        </div>
      )}
      {migrateMsg && !controlHasBalance && (
        <p className="rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-800 dark:bg-green-950/30 dark:text-green-400">{migrateMsg}</p>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input placeholder="Search student…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-white" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 text-gray-400 dark:border-white/10">
          <Users className="h-8 w-8" />
          <p className="text-sm">No student receivables yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-gray-500">Student</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase text-gray-500">Invoiced</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase text-gray-500">Paid</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase text-gray-500">Balance</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {filtered.map((s) => (
                  <tr key={s.code} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-3 py-2.5">
                      <Link href={`/accounting/ledger?account=${encodeURIComponent(s.code)}`} className="font-medium text-gray-900 hover:text-[#2E7D32] hover:underline dark:text-white dark:hover:text-green-400">
                        {s.name}
                      </Link>
                      {s.isControl && <span className="ml-2 rounded bg-gray-100 px-1.5 text-[9px] font-bold text-gray-400 dark:bg-white/10">CONTROL</span>}
                      <p className="font-mono text-[10px] text-gray-400">{s.code}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{fmtNum(s.invoiced)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-green-600">{fmtNum(s.paid)}</td>
                    <td className={`whitespace-nowrap px-3 py-2.5 text-right font-bold tabular-nums ${s.balance > 0 ? "text-red-600 dark:text-red-400" : s.balance < 0 ? "text-amber-600" : "text-gray-300"}`}>{fmtNum(s.balance)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Link href={`/accounting/ledger?account=${encodeURIComponent(s.code)}`}
                        className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#2E7D32] hover:underline dark:text-green-400">
                        Statement <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold dark:border-white/20 dark:bg-white/5">
                  <td className="px-3 py-2.5 text-gray-900 dark:text-white">TOTAL</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(totals.invoiced)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-green-600">{fmtNum(totals.paid)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-red-600">{fmtNum(totals.balance)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
