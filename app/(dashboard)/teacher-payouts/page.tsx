"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, Users, Wallet, X } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DatePicker from "@/components/shared/DatePicker";
import { AccountSelect, usePostingAccounts } from "@/components/accounting/shared";

interface Due {
  teacherId: string; teacherName: string; paymentType: string;
  basis: string; rate: number; quantity: number; quantityLabel: string;
  sessionCount: number; totalHours: number; suggestedAmount: number;
  periodFrom: string; periodTo: string; note: string;
}
interface Payout {
  id: string; payoutNumber: string; teacherName: string; basis: string;
  quantity: number; sessionCount: number; totalHours: number; amount: number;
  paidDate: string; journalEntryId: string; createdBy: string;
}

const fmt = (n: number) => "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TeacherPayoutsPage() {
  const { accounts } = usePostingAccounts();
  const expenseAccounts = accounts.filter((a) => a.type === "Expense");
  const moneyAccounts = accounts.filter((a) => a.mainAccount === "CASH" || a.mainAccount === "BANKS");

  const [due, setDue] = useState<Due[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Due | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [expenseAccountCode, setExpenseAccountCode] = useState("");
  const [paymentAccountCode, setPaymentAccountCode] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/teacher-payouts")
      .then((r) => r.json())
      .then((d) => {
        setDue(d.due ?? []);
        setTotalDue(d.totalDue ?? 0);
        setPayouts(d.payouts ?? []);
        if (d.defaults) {
          setExpenseAccountCode((v) => v || d.defaults.expenseAccountCode || "");
          setPaymentAccountCode((v) => v || d.defaults.paymentAccountCode || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const openPay = (d: Due) => {
    setTarget(d);
    setAmount(String(d.suggestedAmount));
    setPaidDate(new Date().toISOString().slice(0, 10));
    setReason(""); setNotes(""); setError("");
  };

  const submit = async () => {
    if (!target) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/teacher-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: target.teacherId,
          amount: Number(amount) || 0,
          adjustmentReason: reason,
          paidDate, expenseAccountCode, paymentAccountCode, notes,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setNotice(d.warning ? `${d.payout.payoutNumber}: ${d.warning}` : `${d.payout.payoutNumber} recorded and posted to the ledger.`);
      setTarget(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally { setSaving(false); }
  };

  const adjusted = target && Math.abs((Number(amount) || 0) - target.suggestedAmount) > 0.009;

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Teacher Payments"
        subtitle="What each teacher is owed for classes not yet paid"
        actions={
          <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
          </button>
        }
      />

      <div className="space-y-4 px-6 py-4">
        {notice && (
          <div className="flex items-center justify-between rounded-xl border border-green-200 bg-[#E8F5E9] px-4 py-3 text-sm font-semibold text-[#2E7D32]">
            <span>{notice}</span>
            <button onClick={() => setNotice("")}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <Wallet className="mb-2 h-5 w-5 text-[#2E7D32]" />
            <p className="text-lg font-extrabold text-[#2E7D32]">{fmt(totalDue)}</p>
            <p className="text-xs text-slate-500">Total owed to teachers</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <Users className="mb-2 h-5 w-5 text-blue-600" />
            <p className="text-lg font-extrabold text-blue-600">{due.length}</p>
            <p className="text-xs text-slate-500">Teachers awaiting payment</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <Clock className="mb-2 h-5 w-5 text-slate-500" />
            <p className="text-lg font-extrabold text-slate-700">{due.reduce((s, d) => s + d.totalHours, 0).toFixed(2)}h</p>
            <p className="text-xs text-slate-500">Unpaid teaching hours</p>
          </div>
        </div>

        {/* Amounts due */}
        {loading ? (
          <div className="flex h-40 items-center justify-center text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
        ) : due.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-slate-400">
            <CheckCircle2 className="h-8 w-8 text-[#2E7D32]" />
            <p className="text-sm">All teachers are settled — no unpaid classes.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Teacher", "Basis", "Unpaid work", "Period", "Amount due", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {due.map((d) => (
                    <tr key={d.teacherId} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0D1F0E]">{d.teacherName}</p>
                        {d.note && (
                          <p className="flex items-start gap-1 text-[11px] text-amber-700">
                            <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />{d.note}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {d.basis}
                        {d.rate > 0 && <span className="block text-xs text-slate-400">{fmt(d.rate)} each</span>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700">{d.quantityLabel}</p>
                        <p className="text-xs text-slate-400">{d.sessionCount} session{d.sessionCount !== 1 ? "s" : ""} · {d.totalHours}h</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {d.periodFrom ? `${d.periodFrom} → ${d.periodTo}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-base font-extrabold tabular-nums text-[#2E7D32]">{fmt(d.suggestedAmount)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openPay(d)}
                          className="rounded-lg bg-[#2E7D32] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#1B5E20]">
                          Mark Paid
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment history */}
        {payouts.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Payment History</p>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#2E7D32]">{p.payoutNumber}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{p.teacherName}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{p.basis} · {p.sessionCount} session{p.sessionCount !== 1 ? "s" : ""} · {p.totalHours}h</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{p.paidDate}</td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums text-slate-800">{fmt(p.amount)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {p.journalEntryId ? (
                            <a href={`/accounting/voucher/${p.journalEntryId}`} className="text-xs font-semibold text-[#2E7D32] hover:underline">Voucher →</a>
                          ) : (
                            <span className="text-xs text-rose-500">Not posted</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mark paid drawer */}
      {target && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setTarget(null)} />
          <aside className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-bold text-[#0D1F0E]">Pay {target.teacherName}</h2>
                <p className="text-xs text-slate-500">{target.quantityLabel} · {target.basis}</p>
              </div>
              <button onClick={() => setTarget(null)} className="rounded-lg p-1.5 hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}

              <div className="rounded-xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Basis</span><span className="font-semibold">{target.basis}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-slate-500">Rate</span><span className="font-semibold">{fmt(target.rate)}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-slate-500">Quantity</span><span className="font-semibold">{target.quantityLabel}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-slate-500">Sessions covered</span><span className="font-semibold">{target.sessionCount} · {target.totalHours}h</span></div>
                <div className="mt-2 flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-bold text-slate-700">Calculated</span>
                  <span className="font-extrabold text-[#2E7D32]">{fmt(target.suggestedAmount)}</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Amount to pay *</label>
                <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]" />
              </div>

              {adjusted && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-rose-700">Reason for the different amount *</label>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. advance already given, bonus, deduction"
                    className="h-10 w-full rounded-xl border border-rose-200 px-3 text-sm outline-none focus:ring-2 focus:ring-rose-100" />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Payment date *</label>
                <DatePicker value={paidDate} onChange={setPaidDate} required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Expense account (salary)</label>
                <AccountSelect value={expenseAccountCode} onChange={setExpenseAccountCode} accounts={expenseAccounts} placeholder="Salaries…" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Paid from</label>
                <AccountSelect value={paymentAccountCode} onChange={setPaymentAccountCode} accounts={moneyAccounts.length ? moneyAccounts : accounts} placeholder="Cash / Bank…" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Notes</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#2E7D32]" />
              </div>

              <p className="rounded-lg bg-[#E8F5E9] px-3 py-2 text-xs text-[#1B5E20]">
                Marking paid records the payment, locks these {target.sessionCount} session{target.sessionCount !== 1 ? "s" : ""} so they can&apos;t be paid twice,
                and posts the expense to the ledger.
              </p>
            </div>

            <div className="border-t border-slate-200 p-4">
              <button onClick={submit} disabled={saving || !(Number(amount) > 0) || (!!adjusted && reason.trim().length < 3)}
                className="w-full rounded-xl bg-[#2E7D32] py-3 text-sm font-bold text-white hover:bg-[#1B5E20] disabled:opacity-50">
                {saving ? "Recording…" : `Mark Paid · ${fmt(Number(amount) || 0)}`}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
