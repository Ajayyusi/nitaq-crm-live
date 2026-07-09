"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Download, Loader2, RefreshCw, Search } from "lucide-react";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { AccountSelect, exportCsv, fmtNum, usePostingAccounts } from "@/components/accounting/shared";

interface GlRow {
  date: string; jvNumber: string; status: string; sourceType: string; sourceNumber: string;
  reference: string; accountCode: string; accountName: string; description: string;
  debit: number; credit: number; student: string; supplier: string; course: string;
  createdBy: string; postedBy: string;
}

const SOURCE_TYPES = ["JV", "Invoice", "Receipt", "Expense", "SupplierBill", "SupplierPayment", "Advance", "Reversal", "Opening"];

function RegisterInner() {
  const params = useSearchParams();
  const { accounts } = usePostingAccounts();

  const [rows, setRows] = useState<GlRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [sourceType, setSourceType] = useState(params.get("sourceType") ?? "");
  const [account, setAccount] = useState(params.get("account") ?? "");
  const [group, setGroup] = useState(params.get("group") ?? "");   // cash | bank | ""
  const [drcr, setDrcr] = useState("");                             // debit | credit | ""
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    fetch(`/api/accounting/gl-dump?${q}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(load, [load]);

  // Account groups for cash/bank drill-downs from the dashboard
  const groupCodes = useMemo(() => {
    if (!group) return null;
    const main = group === "cash" ? "CASH" : group === "bank" ? "BANKS" : "";
    return new Set(accounts.filter((a) => a.mainAccount === main).map((a) => a.code));
  }, [group, accounts]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (sourceType && r.sourceType !== sourceType) return false;
      if (account && r.accountCode !== account) return false;
      if (groupCodes && !groupCodes.has(r.accountCode)) return false;
      if (drcr === "debit" && !r.debit) return false;
      if (drcr === "credit" && !r.credit) return false;
      if (s && ![r.jvNumber, r.sourceNumber, r.reference, r.accountName, r.description, r.student, r.supplier, r.course]
        .some((v) => (v ?? "").toLowerCase().includes(s))) return false;
      return true;
    });
  }, [rows, sourceType, account, groupCodes, drcr, search]);

  const totalDebit = filtered.reduce((t, r) => t + r.debit, 0);
  const totalCredit = filtered.reduce((t, r) => t + r.credit, 0);

  const doExport = () => {
    exportCsv(
      `financial-register-${from || "all"}-${to || "all"}.csv`,
      ["Date", "Voucher", "Status", "Source", "Doc No", "Reference", "Account Code", "Account", "Description", "Debit", "Credit", "Student", "Supplier", "Course", "Created By", "Posted By"],
      filtered.map((r) => [r.date, r.jvNumber, r.status, r.sourceType, r.sourceNumber, r.reference, r.accountCode, r.accountName, r.description, r.debit, r.credit, r.student, r.supplier, r.course, r.createdBy, r.postedBy])
    );
  };

  const sel = "h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/accounting" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><ChevronLeft className="h-3 w-3" /> Accounting</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Financial Register</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filtered.length} of {rows.length} lines · Dr {fmtNum(totalDebit)} / Cr {fmtNum(totalCredit)}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm dark:border-white/10 dark:bg-white/5"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={doExport} disabled={filtered.length === 0} className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-50">
            <Download className="h-4 w-4" /> Excel / CSV
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={sel}>
          <option value="">All Types</option>
          {SOURCE_TYPES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={group} onChange={(e) => { setGroup(e.target.value); setAccount(""); }} className={sel}>
          <option value="">All Groups</option>
          <option value="cash">Cash accounts</option>
          <option value="bank">Bank accounts</option>
        </select>
        <div className="w-56">
          <AccountSelect value={account} onChange={(v) => { setAccount(v); setGroup(""); }} accounts={accounts} placeholder="Any account" />
        </div>
        <select value={drcr} onChange={(e) => setDrcr(e.target.value)} className={sel}>
          <option value="">Debit + Credit</option>
          <option value="debit">Debits only</option>
          <option value="credit">Credits only</option>
        </select>
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input placeholder="Voucher no, name, description…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-white" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 dark:border-white/10">No lines match these filters.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  {["Date", "Voucher", "Type", "Account", "Description", "Party", "Debit", "Credit"].map((h) => (
                    <th key={h} className={`whitespace-nowrap px-3 py-2.5 text-xs font-bold uppercase text-gray-500 ${["Debit", "Credit"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {filtered.slice(0, 1000).map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{r.date}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      <span className="font-mono font-semibold text-[#2E7D32] dark:text-green-400">{r.jvNumber}</span>
                      {r.sourceNumber && <span className="text-gray-400"> · {r.sourceNumber}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-400">{r.sourceType}</span>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-gray-700 dark:text-gray-300">
                      <Link href={`/accounting/ledger?account=${encodeURIComponent(r.accountCode)}`} className="hover:text-[#2E7D32] hover:underline dark:hover:text-green-400">
                        {r.accountName}
                      </Link>
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2 text-xs text-gray-500">{r.description}</td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-xs text-gray-500">{r.student || r.supplier || ""}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtNum(r.debit)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtNum(r.credit)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold dark:border-white/20 dark:bg-white/5">
                  <td className="px-3 py-2.5 text-gray-900 dark:text-white" colSpan={6}>TOTAL ({filtered.length} lines{filtered.length > 1000 ? ", showing first 1000 — export for all" : ""})</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(totalDebit)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(totalCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FinancialRegisterPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>}>
      <RegisterInner />
    </Suspense>
  );
}
