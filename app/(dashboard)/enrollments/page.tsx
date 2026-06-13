"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ClipboardList, Edit3, Loader2, MessageCircle, Plus, Search, Trash2, X,
} from "lucide-react";
import { enrollmentStatuses, paymentMethods, paymentStatuses, scheduleFormats } from "@/constants/modelConstants";
import { courseList } from "@/constants/leads";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { thisMonthRange } from "@/lib/dateRange";

type Enrollment = {
  id: string; enrollmentId: string; fullName: string; phone: string; email: string;
  course: string; batchName: string; startDate: string; endDate: string; schedule: string;
  format: string; status: string; paymentStatus: string; totalFee: number; amountPaid: number;
  balanceDue: number; notes: string; registrationDate: string;
};

type FormState = {
  fullName: string; phone: string; email: string; emiratesId: string; nationality: string;
  course: string; batchName: string; startDate: string; endDate: string; schedule: string;
  format: string; status: string; paymentStatus: string; totalFee: string; amountPaid: string;
  paymentMethod: string; notes: string;
};

const emptyForm: FormState = {
  fullName: "", phone: "", email: "", emiratesId: "", nationality: "",
  course: "Other", batchName: "", startDate: "", endDate: "", schedule: "",
  format: "In-Person", status: "Active", paymentStatus: "Instalment 1 Paid",
  totalFee: "", amountPaid: "", paymentMethod: "Cash", notes: "",
};

function getErr(v: unknown, fb: string) {
  if (v && typeof v === "object" && "message" in v && typeof v.message === "string") return v.message;
  return fb;
}

function fmtCurrency(n: number) {
  return `AED ${n.toLocaleString()}`;
}

const payStatusColors: Record<string, string> = {
  "Paid Full": "bg-[#E8F5E9] text-[#2E7D32] ring-green-200",
  "Instalment 1 Paid": "bg-sky-50 text-sky-700 ring-sky-200",
  "Instalment 2 Pending": "bg-amber-50 text-amber-800 ring-amber-200",
  Overdue: "bg-rose-50 text-rose-700 ring-rose-200",
  Free: "bg-slate-100 text-slate-600 ring-slate-200",
};

const statusColors: Record<string, string> = {
  Active: "bg-[#E8F5E9] text-[#2E7D32] ring-green-200",
  Completed: "bg-teal-50 text-teal-700 ring-teal-200",
  Dropped: "bg-rose-50 text-rose-700 ring-rose-200",
  "On Hold": "bg-amber-50 text-amber-800 ring-amber-200",
};

const inp = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]";

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payFilter, setPayFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => thisMonthRange().from);
  const [dateTo, setDateTo] = useState(() => thisMonthRange().to);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Pre-fill from lead conversion query params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const name = params.get("name");
    if (!name) return;
    setForm({
      ...emptyForm,
      fullName: name,
      phone: params.get("phone") ?? "",
      email: params.get("email") ?? "",
      course: params.get("course") ?? "Other",
    });
    setEditingEnrollment(null);
    setFormError("");
    setDrawerOpen(true);
    window.history.replaceState({}, "", "/enrollments");
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (payFilter !== "all") params.set("paymentStatus", payFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/enrollments?${params}`, { cache: "no-store" });
      const data = await res.json();
      setEnrollments(data.enrollments ?? []);
    } catch { setError("Failed to load enrollments."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [search, statusFilter, payFilter, dateFrom, dateTo]);

  function set(field: keyof FormState, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  function openCreate() { setEditingEnrollment(null); setForm(emptyForm); setFormError(""); setDrawerOpen(true); }
  function openEdit(e: Enrollment) {
    setEditingEnrollment(e);
    setForm({
      fullName: e.fullName, phone: e.phone, email: e.email, emiratesId: "", nationality: "",
      course: e.course, batchName: e.batchName, startDate: e.startDate, endDate: e.endDate,
      schedule: e.schedule, format: e.format, status: e.status, paymentStatus: e.paymentStatus,
      totalFee: e.totalFee.toString(), amountPaid: e.amountPaid.toString(), paymentMethod: "Cash", notes: e.notes,
    });
    setFormError(""); setDrawerOpen(true);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setFormError("");
    try {
      const url = editingEnrollment ? `/api/enrollments/${editingEnrollment.id}` : "/api/enrollments";
      const method = editingEnrollment ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, totalFee: Number(form.totalFee) || 0, amountPaid: Number(form.amountPaid) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      setNotice(editingEnrollment ? "Enrollment updated." : "Enrollment created.");
      setDrawerOpen(false);
      await load();
    } catch (caught) { setFormError(getErr(caught, "Failed to save enrollment.")); }
    finally { setSaving(false); }
  }

  async function deleteEnrollment(e: Enrollment) {
    if (!window.confirm(`Delete enrollment for ${e.fullName}? This cannot be undone.`)) return;
    try {
      await fetch(`/api/enrollments/${e.id}`, { method: "DELETE" });
      setNotice("Enrollment deleted."); await load();
    } catch { setError("Failed to delete."); }
  }

  const totalRevenue = enrollments.reduce((s, e) => s + e.amountPaid, 0);
  const totalPending = enrollments.reduce((s, e) => s + e.balanceDue, 0);

  return (
    <>
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-[#0D1F0E]/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[580px] flex-col bg-white shadow-2xl">
            <div className="border-b bg-[#0D1F0E] px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#4DB6AC]">Enrollments</p>
                  <h2 className="mt-1 text-xl font-bold">{editingEnrollment ? "Edit Enrollment" : "New Enrollment"}</h2>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <form onSubmit={save} className="flex flex-1 flex-col min-h-0">
              <div className="flex-1 overflow-y-auto space-y-4 p-6">
                {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{formError}</div>}
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Student Details</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Full name *</label><input required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Phone *</label><input required value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inp} placeholder="+971..." /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Email</label><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Emirates ID</label><input value={form.emiratesId} onChange={(e) => set("emiratesId", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Nationality</label><input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} className={inp} /></div>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 pt-2">Course</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Course *</label>
                    <select value={form.course} onChange={(e) => set("course", e.target.value)} className={inp}>
                      {courseList.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Batch</label><input value={form.batchName} onChange={(e) => set("batchName", e.target.value)} className={inp} placeholder="AI-Batch-1" /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Start date</label><input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">End date</label><input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Schedule</label><input value={form.schedule} onChange={(e) => set("schedule", e.target.value)} className={inp} placeholder="Sun/Tue 7pm" /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Format</label><select value={form.format} onChange={(e) => set("format", e.target.value)} className={inp}>{scheduleFormats.map((f) => <option key={f}>{f}</option>)}</select></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Status</label><select value={form.status} onChange={(e) => set("status", e.target.value)} className={inp}>{enrollmentStatuses.map((s) => <option key={s}>{s}</option>)}</select></div>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 pt-2">Payment</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Total fee (AED)</label><input type="number" min="0" value={form.totalFee} onChange={(e) => set("totalFee", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Amount paid (AED)</label><input type="number" min="0" value={form.amountPaid} onChange={(e) => set("amountPaid", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Payment status</label><select value={form.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)} className={inp}>{paymentStatuses.map((s) => <option key={s}>{s}</option>)}</select></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Payment method</label><select value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} className={inp}>{paymentMethods.map((m) => <option key={m}>{m}</option>)}</select></div>
                </div>
                <div><label className="block text-sm font-bold text-slate-700 mb-1">Notes</label><textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={inp} /></div>
              </div>
              <div className="flex gap-3 border-t border-slate-200 bg-slate-50 p-5">
                <button type="button" onClick={() => setDrawerOpen(false)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#2E7D32] text-sm font-bold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingEnrollment ? "Save Changes" : "Create Enrollment"}
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#2E7D32]">Academy Ops</p>
              <h1 className="mt-2 text-3xl font-bold text-[#0D1F0E]">Enrollments</h1>
              <p className="mt-2 text-sm text-slate-500">Track student registrations, payments, and course status.</p>
            </div>
            <button onClick={openCreate} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2E7D32] px-5 text-sm font-bold text-white shadow transition hover:bg-[#1B5E20]">
              <Plus className="h-4 w-4" /> New Enrollment
            </button>
          </div>
        </section>

        {/* Revenue summary */}
        {enrollments.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-green-200 bg-[#E8F5E9] p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#2E7D32]">Collected Revenue</p>
              <p className="mt-2 text-2xl font-bold text-[#0D1F0E]">{fmtCurrency(totalRevenue)}</p>
            </div>
            {totalPending > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-rose-700">Balance Due</p>
                <p className="mt-2 text-2xl font-bold text-rose-800">{fmtCurrency(totalPending)}</p>
              </div>
            )}
          </div>
        )}

        {(notice || error) && (
          <div className="space-y-2">
            {notice && <div className="flex items-center justify-between rounded-xl border border-green-200 bg-[#E8F5E9] px-4 py-3 text-sm font-semibold text-[#2E7D32]"><span>{notice}</span><button onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
            {error && <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><span>{error}</span><button onClick={() => setError("")}><X className="h-4 w-4" /></button></div>}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              from={dateFrom}
              to={dateTo}
              onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
            />
          </div>
          <div className="flex flex-wrap gap-3">
          <label className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search enrollments..." />
          </label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#2E7D32]">
            <option value="all">All statuses</option>
            {enrollmentStatuses.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={payFilter} onChange={(e) => setPayFilter(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#2E7D32]">
            <option value="all">All payment statuses</option>
            {paymentStatuses.map((s) => <option key={s}>{s}</option>)}
          </select>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-60 items-center justify-center gap-3 text-slate-500"><Loader2 className="h-6 w-6 animate-spin text-[#2E7D32]" /><span className="text-sm font-semibold">Loading...</span></div>
          ) : enrollments.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E8F5E9] text-[#2E7D32]"><ClipboardList className="h-6 w-6" /></div>
              <p className="text-lg font-bold text-[#0D1F0E]">No enrollments yet</p>
              <button onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2E7D32] px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" />New Enrollment</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrollments.map((e) => (
                    <tr key={e.id} className={`hover:bg-slate-50 ${e.balanceDue > 0 && e.paymentStatus === "Overdue" ? "bg-rose-50/30" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-400">{e.enrollmentId}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-[#0D1F0E]">{e.fullName}</p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span>{e.phone}</span>
                          <a href={`https://wa.me/${e.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-[#2E7D32] hover:underline"><MessageCircle className="h-3 w-3" /></a>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{e.course}{e.batchName ? ` · ${e.batchName}` : ""}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${statusColors[e.status] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>{e.status}</span></td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${payStatusColors[e.paymentStatus] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>{e.paymentStatus}</span></td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#2E7D32]">{fmtCurrency(e.amountPaid)}</td>
                      <td className="px-4 py-3">
                        {e.balanceDue > 0 ? (
                          <span className="text-sm font-bold text-rose-700">{fmtCurrency(e.balanceDue)}</span>
                        ) : (
                          <span className="text-xs text-slate-400">Cleared</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => openEdit(e)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-[#2E7D32] hover:bg-[#E8F5E9] hover:text-[#2E7D32]"><Edit3 className="h-4 w-4" /></button>
                          <button onClick={() => void deleteEnrollment(e)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
