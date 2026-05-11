"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, CreditCard, DollarSign } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";

const METHODS = ["cash", "bank_transfer", "card", "cheque", "online"];

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studentId: "", enrollmentId: "", amount: "", paymentMethod: "cash",
    paymentDate: new Date().toISOString().split("T")[0], notes: "",
  });
  const [totalRevenue, setTotalRevenue] = useState(0);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [pr, sr, er] = await Promise.all([
      fetch("/api/payments").then((r) => r.json()),
      fetch("/api/students").then((r) => r.json()),
      fetch("/api/enrollments").then((r) => r.json()),
    ]);
    const pmts = pr.payments || [];
    setPayments(pmts);
    setStudents(sr.students || []);
    setEnrollments(er.enrollments || []);
    setTotalRevenue(pmts.reduce((s: number, p: any) => s + (p.amount || 0), 0));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function save() {
    setSaving(true);
    await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    setShowForm(false);
    setForm({ studentId: "", enrollmentId: "", amount: "", paymentMethod: "cash", paymentDate: new Date().toISOString().split("T")[0], notes: "" });
    fetchAll();
    setSaving(false);
  }

  const filteredEnrollments = enrollments.filter(
    (e: any) => !form.studentId || e.studentId?._id === form.studentId
  );

  const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  const methodBadge = (m: string) => {
    const colors: Record<string, string> = {
      cash: "bg-green-100 text-green-700", bank_transfer: "bg-blue-100 text-blue-700",
      card: "bg-purple-100 text-purple-700", cheque: "bg-amber-100 text-amber-700",
      online: "bg-teal-100 text-teal-700",
    };
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[m] || "bg-slate-100 text-slate-600"}`}>{m.replace("_", " ")}</span>;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Payments"
        subtitle="Track all student payments and revenue"
        actions={
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        }
      />

      {/* Summary */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl inline-flex">
          <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-green-700" />
          </div>
          <div>
            <p className="text-xs text-green-600 font-medium">Total Revenue</p>
            <p className="text-xl font-bold text-green-800">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payments recorded"
            description="Record your first payment to start tracking revenue."
            action={<button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">Record Payment</button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Method</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800">{p.studentId?.fullName || "—"}</td>
                  <td className="px-4 py-4 font-semibold text-green-700">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-4">{methodBadge(p.paymentMethod)}</td>
                  <td className="px-4 py-4 text-slate-500 hidden md:table-cell">{formatDate(p.paymentDate)}</td>
                  <td className="px-4 py-4 text-slate-400 text-xs hidden lg:table-cell">{p.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold">Record Payment</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <F label="Student *">
                <select required value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value, enrollmentId: "" }))} className={cls}>
                  <option value="">Select student...</option>
                  {students.map((s) => <option key={s._id} value={s._id}>{s.fullName} · {s.phone}</option>)}
                </select>
              </F>
              <F label="Enrollment *">
                <select required value={form.enrollmentId} onChange={(e) => setForm((f) => ({ ...f, enrollmentId: e.target.value }))} disabled={!form.studentId} className={cls}>
                  <option value="">Select enrollment...</option>
                  {filteredEnrollments.map((e: any) => (
                    <option key={e._id} value={e._id}>{e.courseId?.name} · {formatCurrency(e.finalPrice)}</option>
                  ))}
                </select>
              </F>
              <div className="grid grid-cols-2 gap-4">
                <F label="Amount (AED) *">
                  <input required type="number" min="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" className={cls} />
                </F>
                <F label="Method *">
                  <select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))} className={cls}>
                    {METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                  </select>
                </F>
              </div>
              <F label="Payment Date">
                <input type="date" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} className={cls} />
              </F>
              <F label="Notes">
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={cls} />
              </F>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={save} disabled={saving || !form.studentId || !form.enrollmentId || !form.amount} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? "Saving..." : "Record Payment"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-slate-200 text-sm rounded-lg hover:bg-slate-50 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>{children}</div>;
}
