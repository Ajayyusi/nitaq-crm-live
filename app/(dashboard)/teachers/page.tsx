"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle, Edit3, Loader2, MessageCircle, Plus, Search, Trash2, UserCheck, X,
} from "lucide-react";
import { trainerStatuses, tamamStatuses, contractStatuses, trainerPaymentTypes as paymentTypes } from "@/constants/modelConstants";

type Trainer = {
  id: string; fullName: string; fullNameAr: string; phone: string; email: string;
  emiratesId: string; nationality: string; specialisation: string; qualifications: string;
  tamamStatus: string; tamamNumber: string; contractStatus: string; contractStartDate: string;
  contractEndDate: string; paymentRate: number | null; paymentType: string; status: string;
  notes: string; contractExpiring: boolean; tamamAlert: boolean; contractAlert: boolean;
};

type FormState = {
  fullName: string; fullNameAr: string; phone: string; email: string; emiratesId: string;
  nationality: string; specialisation: string; qualifications: string; tamamStatus: string;
  tamamNumber: string; contractStatus: string; contractStartDate: string; contractEndDate: string;
  paymentRate: string; paymentType: string; status: string; notes: string;
};

const emptyForm: FormState = {
  fullName: "", fullNameAr: "", phone: "", email: "", emiratesId: "",
  nationality: "", specialisation: "", qualifications: "", tamamStatus: "Not Registered",
  tamamNumber: "", contractStatus: "No Contract", contractStartDate: "", contractEndDate: "",
  paymentRate: "", paymentType: "Per Session", status: "Active", notes: "",
};

function getErr(v: unknown, fb: string) {
  if (v && typeof v === "object" && "message" in v && typeof v.message === "string") return v.message;
  return fb;
}

const inp = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]";

export default function TrainersPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/teachers?${params}`, { cache: "no-store" });
      const data = await res.json();
      setTrainers(data.trainers ?? []);
    } catch { setError("Failed to load trainers."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [search, statusFilter]);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openCreate() { setEditingTrainer(null); setForm(emptyForm); setFormError(""); setDrawerOpen(true); }
  function openEdit(t: Trainer) {
    setEditingTrainer(t);
    setForm({
      fullName: t.fullName, fullNameAr: t.fullNameAr, phone: t.phone, email: t.email,
      emiratesId: t.emiratesId, nationality: t.nationality, specialisation: t.specialisation,
      qualifications: t.qualifications, tamamStatus: t.tamamStatus, tamamNumber: t.tamamNumber,
      contractStatus: t.contractStatus, contractStartDate: t.contractStartDate,
      contractEndDate: t.contractEndDate, paymentRate: t.paymentRate?.toString() ?? "",
      paymentType: t.paymentType, status: t.status, notes: t.notes,
    });
    setFormError(""); setDrawerOpen(true);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setFormError("");
    try {
      const url = editingTrainer ? `/api/teachers/${editingTrainer.id}` : "/api/teachers";
      const method = editingTrainer ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, paymentRate: form.paymentRate || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      setNotice(editingTrainer ? "Trainer updated." : "Trainer added.");
      setDrawerOpen(false);
      await load();
    } catch (caught) { setFormError(getErr(caught, "Failed to save trainer.")); }
    finally { setSaving(false); }
  }

  async function deleteTrainer(t: Trainer) {
    if (!window.confirm(`Delete trainer ${t.fullName}? This cannot be undone.`)) return;
    try {
      await fetch(`/api/teachers/${t.id}`, { method: "DELETE" });
      setNotice("Trainer deleted."); await load();
    } catch { setError("Failed to delete."); }
  }

  const alerts = trainers.filter((t) => t.tamamAlert || t.contractAlert || t.contractExpiring);

  return (
    <>
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-[#0D1F0E]/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[580px] flex-col bg-white shadow-2xl">
            <div className="border-b bg-[#0D1F0E] px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#4DB6AC]">Trainers</p>
                  <h2 className="mt-1 text-xl font-bold">{editingTrainer ? "Edit Trainer" : "Add Trainer"}</h2>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <form onSubmit={save} className="flex flex-1 flex-col min-h-0">
              <div className="flex-1 overflow-y-auto space-y-4 p-6">
                {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{formError}</div>}
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Personal Details</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Full name (EN) *</label><input required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Full name (AR)</label><input dir="rtl" value={form.fullNameAr} onChange={(e) => set("fullNameAr", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Phone *</label><input required value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inp} placeholder="+971..." /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Email</label><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Emirates ID</label><input value={form.emiratesId} onChange={(e) => set("emiratesId", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Nationality</label><input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} className={inp} /></div>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 pt-2">Professional</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><label className="block text-sm font-bold text-slate-700 mb-1">Specialisation / Subjects</label><input value={form.specialisation} onChange={(e) => set("specialisation", e.target.value)} className={inp} /></div>
                  <div className="sm:col-span-2"><label className="block text-sm font-bold text-slate-700 mb-1">Qualifications</label><textarea rows={2} value={form.qualifications} onChange={(e) => set("qualifications", e.target.value)} className={inp} /></div>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 pt-2">Tamam &amp; Contract</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Tamam status</label><select value={form.tamamStatus} onChange={(e) => set("tamamStatus", e.target.value)} className={inp}>{tamamStatuses.map((s) => <option key={s}>{s}</option>)}</select></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Tamam number</label><input value={form.tamamNumber} onChange={(e) => set("tamamNumber", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Contract status</label><select value={form.contractStatus} onChange={(e) => set("contractStatus", e.target.value)} className={inp}>{contractStatuses.map((s) => <option key={s}>{s}</option>)}</select></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Status</label><select value={form.status} onChange={(e) => set("status", e.target.value)} className={inp}>{trainerStatuses.map((s) => <option key={s}>{s}</option>)}</select></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Contract start</label><input type="date" value={form.contractStartDate} onChange={(e) => set("contractStartDate", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Contract end</label><input type="date" value={form.contractEndDate} onChange={(e) => set("contractEndDate", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Payment rate (AED)</label><input type="number" min="0" value={form.paymentRate} onChange={(e) => set("paymentRate", e.target.value)} className={inp} /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1">Payment type</label><select value={form.paymentType} onChange={(e) => set("paymentType", e.target.value)} className={inp}>{paymentTypes.map((p) => <option key={p}>{p}</option>)}</select></div>
                </div>
                <div><label className="block text-sm font-bold text-slate-700 mb-1">Notes</label><textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={inp} /></div>
              </div>
              <div className="flex gap-3 border-t border-slate-200 bg-slate-50 p-5">
                <button type="button" onClick={() => setDrawerOpen(false)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#2E7D32] text-sm font-bold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingTrainer ? "Save Changes" : "Add Trainer"}
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
              <h1 className="mt-2 text-3xl font-bold text-[#0D1F0E]">Trainers</h1>
              <p className="mt-2 text-sm text-slate-500">Manage trainer profiles, contracts, Tamam status, and payment rates.</p>
            </div>
            <button onClick={openCreate} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2E7D32] px-5 text-sm font-bold text-white shadow transition hover:bg-[#1B5E20]">
              <Plus className="h-4 w-4" /> Add Trainer
            </button>
          </div>
        </section>

        {alerts.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-800 mb-2"><AlertTriangle className="h-4 w-4" />Trainer Alerts</div>
            <div className="space-y-1">
              {alerts.map((t) => (
                <p key={t.id} className="text-xs text-amber-700">
                  <span className="font-semibold">{t.fullName}:</span>{" "}
                  {t.tamamAlert && "Tamam registration pending. "}
                  {t.contractAlert && "Contract expired. "}
                  {t.contractExpiring && !t.contractAlert && "Contract expiring within 30 days. "}
                </p>
              ))}
            </div>
          </div>
        )}

        {(notice || error) && (
          <div className="space-y-2">
            {notice && <div className="flex items-center justify-between rounded-xl border border-green-200 bg-[#E8F5E9] px-4 py-3 text-sm font-semibold text-[#2E7D32]"><span>{notice}</span><button onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
            {error && <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><span>{error}</span><button onClick={() => setError("")}><X className="h-4 w-4" /></button></div>}
          </div>
        )}

        <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search trainers..." />
          </label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#2E7D32]">
            <option value="all">All statuses</option>
            {trainerStatuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-60 items-center justify-center gap-3 text-slate-500"><Loader2 className="h-6 w-6 animate-spin text-[#2E7D32]" /><span className="text-sm font-semibold">Loading...</span></div>
          ) : trainers.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E8F5E9] text-[#2E7D32]"><UserCheck className="h-6 w-6" /></div>
              <p className="text-lg font-bold text-[#0D1F0E]">No trainers yet</p>
              <button onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2E7D32] px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" />Add Trainer</button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {trainers.map((t) => (
                <div key={t.id} className={`flex items-start gap-4 px-6 py-4 hover:bg-slate-50 ${t.contractAlert ? "bg-rose-50/30" : t.contractExpiring ? "bg-amber-50/30" : ""}`}>
                  <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-[#E8F5E9] text-sm font-bold text-[#2E7D32]">
                    {t.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-[#0D1F0E]">{t.fullName}</p>
                      {t.fullNameAr && <p className="text-sm text-slate-500" dir="rtl">{t.fullNameAr}</p>}
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${t.status === "Active" ? "bg-[#E8F5E9] text-[#2E7D32] ring-green-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{t.status}</span>
                      {t.tamamAlert && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">Tamam Pending</span>}
                      {t.contractAlert && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">Contract Expired</span>}
                      {t.contractExpiring && !t.contractAlert && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">Contract Expiring</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>{t.phone}</span>
                      {t.specialisation && <><span>·</span><span>{t.specialisation}</span></>}
                      {t.paymentRate && <><span>·</span><span>AED {t.paymentRate} / {t.paymentType}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a href={`https://wa.me/${t.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-green-200 bg-[#E8F5E9] text-[#2E7D32] hover:bg-green-100"><MessageCircle className="h-4 w-4" /></a>
                    <button onClick={() => openEdit(t)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-[#2E7D32] hover:bg-[#E8F5E9] hover:text-[#2E7D32]"><Edit3 className="h-4 w-4" /></button>
                    <button onClick={() => void deleteTrainer(t)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
