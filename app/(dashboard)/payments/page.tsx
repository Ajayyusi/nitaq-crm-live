"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, CreditCard, DollarSign, Clock, AlertCircle,
  X, ChevronDown, Trash2,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { courseList } from "@/constants/leads";
import {
  paymentMethods, paymentTypes, txStatuses,
} from "@/constants/modelConstants";
import { thisMonthRange, describeRange } from "@/lib/dateRange";

type Payment = {
  id: string; paymentId: string; studentName: string; studentPhone: string;
  course: string; amount: number; paymentType: string; paymentMethod: string;
  status: string; datePaid: string; dueDate: string; receiptRef: string;
  notes: string; recordedBy: string; createdAt: string;
  enrollmentId: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
};

type Enrollment = {
  id: string; enrollmentId: string; fullName: string; phone: string;
  course: string; totalFee: number; amountPaid: number; balanceDue: number;
};

const today = new Date().toISOString().slice(0, 10);

const fmt = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const methodConfig: Record<string, string> = {
  "Bank Transfer": "bg-blue-100 text-blue-700",
  "Cash": "bg-emerald-100 text-emerald-700",
  "Card": "bg-purple-100 text-purple-700",
  "Cheque": "bg-amber-100 text-amber-700",
  "Online": "bg-teal-100 text-teal-700",
};

const statusConfig: Record<string, string> = {
  "Received": "bg-[#E8F5E9] text-[#1B5E20]",
  "Pending": "bg-amber-50 text-amber-700",
  "Overdue": "bg-red-50 text-red-700",
  "Refunded": "bg-slate-100 text-slate-500",
};

const typeConfig: Record<string, string> = {
  "Full Payment": "bg-[#E8F5E9] text-[#2E7D32]",
  "Instalment 1 of 2": "bg-teal-50 text-teal-700",
  "Instalment 2 of 2": "bg-cyan-50 text-cyan-700",
  "Deposit": "bg-indigo-50 text-indigo-700",
  "Refund": "bg-red-50 text-red-700",
};

const cls =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E7D32] bg-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

const BLANK = {
  studentName: "", studentPhone: "", course: "", amount: "",
  paymentType: "Full Payment", paymentMethod: "Cash", status: "Received",
  datePaid: today, dueDate: "", receiptRef: "", notes: "", recordedBy: "",
  enrollmentId: "",
  installmentNumber: "", totalInstallments: "",
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(() => thisMonthRange().from);
  const [dateTo, setDateTo] = useState(() => thisMonthRange().to);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Payment | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [expandEnrolment, setExpandEnrolment] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (methodFilter !== "All") params.set("method", methodFilter);
      if (search) params.set("search", search);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/payments?${params}`);
      const data = await res.json();
      setPayments(data.payments ?? []);
      setTotalRevenue(data.totalRevenue ?? 0);
      setTotalPending(data.totalPending ?? 0);
    } catch {
      setError("Could not load payments. Please check your connection.");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, methodFilter, search, dateFrom, dateTo]);

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await fetch("/api/enrollments");
      const data = await res.json();
      setEnrollments(data.enrollments ?? []);
    } catch {
      setEnrollments([]);
    }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  function openNew() {
    setEditTarget(null);
    setForm({ ...BLANK });
    setError("");
    setDrawerOpen(true);
  }

  function openEdit(p: Payment) {
    setEditTarget(p);
    setForm({
      studentName: p.studentName, studentPhone: p.studentPhone,
      course: p.course, amount: String(p.amount),
      paymentType: p.paymentType, paymentMethod: p.paymentMethod,
      status: p.status, datePaid: p.datePaid, dueDate: p.dueDate,
      receiptRef: p.receiptRef, notes: p.notes, recordedBy: p.recordedBy,
      enrollmentId: p.enrollmentId ?? "",
      installmentNumber: p.installmentNumber != null ? String(p.installmentNumber) : "",
      totalInstallments: p.totalInstallments != null ? String(p.totalInstallments) : "",
    });
    setError("");
    setDrawerOpen(true);
  }

  function fillFromEnrollment(eid: string) {
    const e = enrollments.find((en) => en.id === eid);
    if (!e) return;
    // Count payments already linked to this enrollment to suggest next installment number
    const existingCount = payments.filter((p) => p.enrollmentId === eid).length;
    setForm((f) => ({
      ...f,
      enrollmentId: eid,
      studentName: e.fullName,
      studentPhone: e.phone,
      course: e.course,
      amount: String(e.balanceDue > 0 ? e.balanceDue : e.totalFee),
      installmentNumber: String(existingCount + 1),
    }));
  }

  async function save() {
    if (!form.studentName.trim()) { setError("Student name is required."); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError("Amount must be greater than 0."); return; }
    setSaving(true);
    setError("");
    const payload = {
      studentName: form.studentName,
      studentPhone: form.studentPhone,
      course: form.course,
      amount: Number(form.amount),
      paymentType: form.paymentType,
      paymentMethod: form.paymentMethod,
      status: form.status,
      datePaid: form.datePaid || undefined,
      dueDate: form.dueDate || undefined,
      receiptRef: form.receiptRef,
      notes: form.notes,
      recordedBy: form.recordedBy,
      enrollmentId: form.enrollmentId || undefined,
      installmentNumber: form.installmentNumber ? Number(form.installmentNumber) : undefined,
      totalInstallments: form.totalInstallments ? Number(form.totalInstallments) : undefined,
    };
    try {
      const url = editTarget ? `/api/payments/${editTarget.id}` : "/api/payments";
      const method = editTarget ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (res.message && !res.payment) throw new Error(res.message);
      setDrawerOpen(false);
      fetchPayments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save payment.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePayment(p: Payment) {
    if (!confirm(`Delete payment ${p.paymentId} (${p.studentName})? This will permanently remove this financial record and cannot be undone.`)) return;
    try {
      await fetch(`/api/payments/${p.id}`, { method: "DELETE" });
      void fetchPayments();
    } catch {
      setError("Failed to delete payment.");
    }
  }

  const overdue = payments.filter((p) => p.status === "Overdue");
  const periodLabel = describeRange(dateFrom, dateTo);

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Payments"
        subtitle="Track income, instalments and overdue balances"
        actions={
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-[#2E7D32] text-white text-sm font-medium rounded-lg hover:bg-[#1B5E20] transition"
          >
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        }
      />

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-700">
            <span className="font-semibold">{overdue.length} overdue payment{overdue.length > 1 ? "s" : ""}:</span>{" "}
            {overdue.slice(0, 3).map((p) => p.studentName).join(", ")}
            {overdue.length > 3 && ` +${overdue.length - 3} more`}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: DollarSign, label: `Received (${periodLabel})`, value: fmt(totalRevenue), cls: "text-[#2E7D32]" },
          { icon: Clock, label: "Pending / Overdue", value: fmt(totalPending), cls: "text-amber-600" },
          { icon: AlertCircle, label: "Overdue Records", value: String(overdue.length), cls: "text-red-600" },
          { icon: CreditCard, label: "Total Records", value: String(payments.length), cls: "text-slate-700" },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#E8F5E9] flex items-center justify-center">
              <k.icon className={`w-4 h-4 ${k.cls}`} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">{k.label}</p>
              <p className={`text-sm font-bold ${k.cls}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="px-6 pb-3 flex flex-wrap gap-3 items-center">
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
        />
        <input
          type="search"
          placeholder="Search name, ID, receipt…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
        >
          <option value="All">All Statuses</option>
          {txStatuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
        >
          <option value="All">All Methods</option>
          {paymentMethods.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 px-6 pb-8 overflow-auto">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payments found"
            description="Record your first payment to start tracking revenue."
            action={
              <button onClick={openNew} className="px-4 py-2 bg-[#2E7D32] text-white text-sm rounded-lg">
                Record Payment
              </button>
            }
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {["ID", "Student", "Course", "Amount", "Type / Inst", "Method", "Status", "Date", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const isOverdue = p.status === "Overdue";
                  const isPending = p.status === "Pending";
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[#E8F5E9]/30 transition-colors cursor-pointer ${isOverdue ? "bg-red-50/50" : isPending ? "bg-amber-50/30" : ""}`}
                      onClick={() => openEdit(p)}
                    >
                      <td className="px-4 py-3 text-xs font-mono text-slate-400">{p.paymentId}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#0D1F0E]">{p.studentName}</div>
                        {p.studentPhone && (
                          <div className="text-xs text-slate-400">{p.studentPhone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate">{p.course || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-[#1B5E20] whitespace-nowrap">
                        {fmt(p.amount)}
                        {p.paymentType === "Refund" && <span className="text-red-500 text-xs ml-1">(refund)</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig[p.paymentType] ?? "bg-slate-100 text-slate-600"}`}>
                          {p.paymentType}
                        </span>
                        {p.installmentNumber != null && p.totalInstallments != null && (
                          <span className="ml-1.5 text-[10px] font-bold text-slate-400">
                            {p.installmentNumber}/{p.totalInstallments}
                          </span>
                        )}
                        {p.installmentNumber != null && p.totalInstallments == null && (
                          <span className="ml-1.5 text-[10px] font-bold text-slate-400">
                            #{p.installmentNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${methodConfig[p.paymentMethod] ?? "bg-slate-100 text-slate-600"}`}>
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[p.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {p.datePaid || (p.dueDate ? `Due ${p.dueDate}` : "—")}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => deletePayment(p)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-[#0D1F0E]">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {editTarget ? `Edit ${editTarget.paymentId}` : "Record Payment"}
                </h2>
                <p className="text-xs text-white/60">
                  {editTarget ? "Update payment details" : "Add a new payment record"}
                </p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}

              {/* Link to enrollment */}
              <div className="border border-[#2E7D32]/30 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-[#E8F5E9] text-sm font-semibold text-[#1B5E20]">
                  Link to Enrollment (optional)
                </div>
                <div className="px-4 py-3 space-y-2">
                  <select
                    className={cls}
                    value={form.enrollmentId}
                    onChange={(e) => {
                      if (e.target.value) fillFromEnrollment(e.target.value);
                      else setForm((f) => ({ ...f, enrollmentId: "" }));
                    }}
                  >
                    <option value="">— No enrollment linked —</option>
                    {enrollments.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName} · {e.course} · bal: {fmt(e.balanceDue)}
                      </option>
                    ))}
                  </select>
                  {form.enrollmentId && (() => {
                    const enr = enrollments.find((e) => e.id === form.enrollmentId);
                    if (!enr) return null;
                    return (
                      <div className="flex gap-3 text-xs text-[#1B5E20]">
                        <span>Total: <strong>{fmt(enr.totalFee)}</strong></span>
                        <span>·</span>
                        <span>Paid: <strong>{fmt(enr.amountPaid)}</strong></span>
                        <span>·</span>
                        <span className={enr.balanceDue > 0 ? "text-rose-600" : ""}>
                          Balance: <strong>{fmt(enr.balanceDue)}</strong>
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Student Name *">
                    <input
                      className={cls}
                      value={form.studentName}
                      onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))}
                      placeholder="Full name"
                    />
                  </Field>
                </div>
                <Field label="Phone">
                  <input
                    className={cls}
                    value={form.studentPhone}
                    onChange={(e) => setForm((f) => ({ ...f, studentPhone: e.target.value }))}
                    placeholder="+971…"
                  />
                </Field>
                <Field label="Amount (AED) *">
                  <input
                    className={cls}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </Field>
              </div>

              <Field label="Course">
                <select
                  className={cls}
                  value={form.course}
                  onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}
                >
                  <option value="">— Select course —</option>
                  {courseList.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Payment Type">
                  <select
                    className={cls}
                    value={form.paymentType}
                    onChange={(e) => setForm((f) => ({ ...f, paymentType: e.target.value }))}
                  >
                    {paymentTypes.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Method">
                  <select
                    className={cls}
                    value={form.paymentMethod}
                    onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                  >
                    {paymentMethods.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
              </div>

              {/* Installment fields */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Instalment # (optional)">
                  <div className="flex items-center gap-2">
                    <input
                      className={cls}
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 1"
                      value={form.installmentNumber}
                      onChange={(e) => setForm((f) => ({ ...f, installmentNumber: e.target.value }))}
                    />
                    <span className="text-xs text-slate-400 whitespace-nowrap">of</span>
                    <input
                      className={cls}
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 3"
                      value={form.totalInstallments}
                      onChange={(e) => setForm((f) => ({ ...f, totalInstallments: e.target.value }))}
                    />
                  </div>
                </Field>
                <Field label="Status">
                  <select
                    className={cls}
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    {txStatuses.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Date Paid">
                <input
                  className={cls}
                  type="date"
                  value={form.datePaid}
                  onChange={(e) => setForm((f) => ({ ...f, datePaid: e.target.value }))}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Due Date">
                  <input
                    className={cls}
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  />
                </Field>
                <Field label="Receipt Ref">
                  <input
                    className={cls}
                    value={form.receiptRef}
                    onChange={(e) => setForm((f) => ({ ...f, receiptRef: e.target.value }))}
                    placeholder="e.g. RCT-001"
                  />
                </Field>
              </div>

              <Field label="Recorded By">
                <input
                  className={cls}
                  value={form.recordedBy}
                  onChange={(e) => setForm((f) => ({ ...f, recordedBy: e.target.value }))}
                  placeholder="Staff name"
                />
              </Field>

              <Field label="Notes">
                <textarea
                  className={cls}
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes…"
                />
              </Field>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 bg-[#2E7D32] text-white text-sm font-semibold rounded-lg hover:bg-[#1B5E20] transition disabled:opacity-50"
              >
                {saving ? "Saving…" : editTarget ? "Update Payment" : "Record Payment"}
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="px-5 py-2.5 border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
