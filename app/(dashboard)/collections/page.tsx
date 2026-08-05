"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Coins, Download, Loader2, MessageCircle, RefreshCw, Search, Wallet } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

interface Row {
  id: string; enrollmentId: string; fullName: string; phone: string; email: string;
  course: string; totalFee: number; amountPaid: number; balanceDue: number;
  paymentStatus: string; status: string; lastPaid: string;
  daysSince: number | null; isOverdue: boolean;
}
interface Totals { count: number; outstanding: number; overdueCount: number; overdueAmount: number }

const fmt = (n: number) => "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Polite, ready-to-send reminder. Staff can edit before sending in WhatsApp. */
function reminderText(r: Row) {
  return `Hello ${r.fullName}, this is Nitaq Academy. 😊
A friendly reminder about the outstanding balance for your ${r.course} course: ${fmt(r.balanceDue)}.
Paid so far: ${fmt(r.amountPaid)} of ${fmt(r.totalFee)}.
Please let us know if you'd like to arrange the payment or discuss an instalment plan. Thank you!`;
}

export default function CollectionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [chased, setChased] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/collections")
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setTotals(d.totals ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const filtered = rows.filter((r) => {
    if (onlyOverdue && !r.isOverdue) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return r.fullName.toLowerCase().includes(q) || r.course.toLowerCase().includes(q) || r.phone.includes(q);
  });

  const exportCsv = () => {
    const headers = ["Enrollment", "Student", "Phone", "Course", "Total Fee", "Paid", "Balance", "Payment Status", "Last Paid", "Days Since"];
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(","), ...filtered.map((r) => [
      r.enrollmentId, r.fullName, r.phone, r.course, r.totalFee, r.amountPaid, r.balanceDue,
      r.paymentStatus, r.lastPaid, r.daysSince ?? "",
    ].map(esc).join(","))].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `collections-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const cards = totals ? [
    { label: "Total Outstanding", value: fmt(totals.outstanding), icon: Wallet, color: "text-[#2E7D32]" },
    { label: "Students Owing", value: String(totals.count), icon: Coins, color: "text-blue-600" },
    { label: "Overdue Amount", value: fmt(totals.overdueAmount), icon: AlertTriangle, color: "text-rose-600" },
    { label: "Overdue Students", value: String(totals.overdueCount), icon: AlertTriangle, color: totals.overdueCount > 0 ? "text-rose-600" : "text-slate-400" },
  ] : [];

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Money to Collect"
        subtitle="Outstanding balances, ordered by who to chase first"
        actions={
          <div className="flex gap-2">
            <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={exportCsv} disabled={filtered.length === 0}
              className="flex items-center gap-2 rounded-lg bg-[#2E7D32] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B5E20] disabled:opacity-50">
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        }
      />

      <div className="px-6 py-4 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <c.icon className={`mb-2 h-5 w-5 ${c.color}`} />
              <p className={`text-lg font-extrabold ${c.color}`}>{c.value}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input placeholder="Search student, course or phone…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#2E7D32]" />
          </div>
          <button onClick={() => setOnlyOverdue((v) => !v)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${onlyOverdue ? "bg-rose-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            Overdue only
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex h-40 items-center justify-center text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-slate-400">
            <Wallet className="h-8 w-8" />
            <p className="text-sm">{rows.length === 0 ? "Nothing outstanding — everyone is paid up." : "No matches."}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Student", "Course", "Paid / Total", "Balance", "Last Paid", "Chase"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((r) => {
                    const waUrl = buildWhatsAppUrl(r.phone, reminderText(r));
                    const done = chased.has(r.id);
                    return (
                      <tr key={r.id} className={r.isOverdue ? "bg-rose-50/50" : "hover:bg-slate-50"}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[#0D1F0E]">{r.fullName}</p>
                            {r.isOverdue && (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">Overdue</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{r.enrollmentId}{r.phone ? ` · ${r.phone}` : ""}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{r.course}</td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-slate-500">{fmt(r.amountPaid)} / {fmt(r.totalFee)}</p>
                          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-[#2E7D32]"
                              style={{ width: `${r.totalFee > 0 ? Math.min(100, Math.round((r.amountPaid / r.totalFee) * 100)) : 0}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold tabular-nums text-rose-700">{fmt(r.balanceDue)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {r.lastPaid || "Never"}
                          {r.daysSince !== null && <span className="block text-slate-400">{r.daysSince}d ago</span>}
                        </td>
                        <td className="px-4 py-3">
                          {waUrl ? (
                            <a href={waUrl} target="_blank" rel="noopener noreferrer"
                              onClick={() => setChased((s) => new Set(s).add(r.id))}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                done ? "border border-slate-200 bg-white text-slate-500" : "bg-[#25D366] text-white hover:brightness-95"
                              }`}>
                              <MessageCircle className="h-3.5 w-3.5" /> {done ? "Sent" : "Remind"}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">No phone</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
              {filtered.length} student{filtered.length !== 1 ? "s" : ""} · {fmt(filtered.reduce((s, r) => s + r.balanceDue, 0))} outstanding
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
