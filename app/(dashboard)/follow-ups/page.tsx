"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  BellRing,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  followUpStatuses,
  followUpTypes,
  type FollowUpStatus,
  type FollowUpType,
} from "@/constants/modelConstants";
import { courseList } from "@/constants/leads";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { getPresetRange } from "@/lib/dateRange";

type FollowUp = {
  id: string;
  contactName: string;
  phone: string;
  course: string;
  followUpDate: string;
  type: FollowUpType;
  notes: string;
  status: FollowUpStatus;
  assignedTo: string;
  createdAt: string;
};

type FormState = {
  contactName: string;
  phone: string;
  course: string;
  followUpDate: string;
  type: FollowUpType;
  notes: string;
  status: FollowUpStatus;
  assignedTo: string;
  leadId: string;
};

type LeadOption = { id: string; fullName: string; phone: string; course: string; stage: string };

const emptyForm: FormState = {
  contactName: "",
  phone: "",
  course: "Other",
  followUpDate: new Date().toISOString().slice(0, 10),
  type: "WhatsApp Message",
  notes: "",
  status: "Pending",
  assignedTo: "",
  leadId: "",
};

const statusConfig: Record<FollowUpStatus, string> = {
  Pending:       "bg-amber-50 text-amber-800 ring-amber-200",
  Done:          "bg-[#E8F5E9] text-[#2E7D32] ring-green-200",
  "No Response": "bg-rose-50 text-rose-700 ring-rose-200",
  Rescheduled:   "bg-slate-100 text-slate-600 ring-slate-200",
};

function getUrgency(dateStr: string, status: FollowUpStatus) {
  if (status === "Done" || !dateStr) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  if (d < today) return "overdue";
  if (d.getTime() === today.getTime()) return "today";
  return "upcoming";
}

function formatDate(v: string) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function whatsappUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

function getErr(v: unknown, fallback: string) {
  if (v && typeof v === "object" && "message" in v && typeof v.message === "string")
    return v.message;
  return fallback;
}

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  // Lead search for auto-fill
  const [leadSearch, setLeadSearch] = useState("");
  const [leadResults, setLeadResults] = useState<LeadOption[]>([]);
  const [leadSearchLoading, setLeadSearchLoading] = useState(false);
  const leadSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [viewFilter, setViewFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");

  const searchLeads = useCallback((q: string) => {
    if (leadSearchRef.current) clearTimeout(leadSearchRef.current);
    if (!q.trim()) { setLeadResults([]); return; }
    leadSearchRef.current = setTimeout(async () => {
      setLeadSearchLoading(true);
      try {
        const res = await fetch(`/api/leads?search=${encodeURIComponent(q.trim())}&sort=newest`);
        const data = await res.json();
        setLeadResults((data.leads ?? []).slice(0, 6));
      } catch { /* ignore */ }
      finally { setLeadSearchLoading(false); }
    }, 300);
  }, []);

  function pickLead(lead: LeadOption) {
    setForm((f) => ({
      ...f,
      contactName: lead.fullName,
      phone: lead.phone,
      course: lead.course || f.course,
      leadId: lead.id,
    }));
    setLeadSearch(`${lead.fullName} — ${lead.phone}`);
    setLeadResults([]);
  }

  async function loadFollowUps() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (viewFilter !== "all") params.set("view", viewFilter);
      // Date range applies only when no specific view is selected
      if (viewFilter === "all") {
        if (dateFrom) params.set("from", dateFrom);
        if (dateTo) params.set("to", dateTo);
      }
      const res = await fetch(`/api/follow-ups?${params}`, { cache: "no-store" });
      const data = await res.json();
      setFollowUps(data.followUps ?? []);
    } catch {
      setError("Failed to load follow-ups.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadFollowUps(); }, [statusFilter, viewFilter, dateFrom, dateTo]);

  async function markDone(id: string) {
    try {
      await fetch(`/api/follow-ups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Done" }),
      });
      setNotice("Marked as done.");
      await loadFollowUps();
    } catch {
      setError("Failed to update.");
    }
  }

  async function deleteFollowUp(id: string, name: string) {
    if (!window.confirm(`Delete follow-up for ${name}? This cannot be undone.`)) return;
    try {
      await fetch(`/api/follow-ups/${id}`, { method: "DELETE" });
      setNotice("Follow-up deleted.");
      await loadFollowUps();
    } catch {
      setError("Failed to delete.");
    }
  }

  async function createFollowUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, leadId: form.leadId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      setNotice("Follow-up created.");
      setDrawerOpen(false);
      setForm(emptyForm);
      setLeadSearch("");
      setLeadResults([]);
      await loadFollowUps();
    } catch (caught) {
      setFormError(getErr(caught, "Failed to create follow-up."));
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      overdue: followUps.filter(
        (f) => f.status === "Pending" && new Date(f.followUpDate) < today
      ).length,
      today: followUps.filter((f) => {
        const d = new Date(f.followUpDate); d.setHours(0,0,0,0);
        return d.getTime() === today.getTime() && f.status === "Pending";
      }).length,
    };
  }, [followUps]);

  return (
    <>
      {/* Drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-[#0D1F0E]/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[500px] flex-col bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-[#0D1F0E] px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#4DB6AC]">New Task</p>
                  <h2 className="mt-1 text-xl font-bold">Add Follow-Up</h2>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <form onSubmit={createFollowUp} className="flex flex-1 flex-col min-h-0">
              <div className="flex-1 overflow-y-auto space-y-4 p-6">
                {formError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {formError}
                  </div>
                )}
                {/* Lead search picker */}
                <div className="relative">
                  <F label="Search existing lead (optional — auto-fills details)">
                    <div className="relative">
                      <input
                        value={leadSearch}
                        onChange={(e) => { setLeadSearch(e.target.value); searchLeads(e.target.value); }}
                        className={inp}
                        placeholder="Type name or phone to search leads..."
                        autoComplete="off"
                      />
                      {leadSearchLoading && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                          <svg className="h-4 w-4 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                        </span>
                      )}
                    </div>
                  </F>
                  {leadResults.length > 0 && (
                    <div className="absolute left-0 right-0 z-10 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                      {leadResults.map((lead) => (
                        <button key={lead.id} type="button" onClick={() => pickLead(lead)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[#E8F5E9] transition border-b border-slate-100 last:border-0">
                          <div>
                            <p className="font-bold text-[#0D1F0E]">{lead.fullName}</p>
                            <p className="text-xs text-slate-500">{lead.phone} · {lead.course} · <span className="font-semibold text-slate-600">{lead.stage}</span></p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {form.leadId && (
                    <p className="mt-1 text-xs text-[#2E7D32] font-semibold">✓ Linked to lead — details auto-filled below</p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <F label="Contact name *">
                    <input required value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} className={inp} placeholder="Lead or student name" />
                  </F>
                  <F label="Phone *">
                    <input required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inp} placeholder="+971..." />
                  </F>
                  <F label="Course">
                    <select value={form.course} onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))} className={inp}>
                      {courseList.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </F>
                  <F label="Follow-up date *">
                    <input required type="date" value={form.followUpDate} onChange={(e) => setForm((f) => ({ ...f, followUpDate: e.target.value }))} className={inp} />
                  </F>
                  <F label="Type">
                    <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FollowUpType }))} className={inp}>
                      {followUpTypes.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </F>
                  <F label="Assigned to">
                    <input value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))} className={inp} placeholder="Staff name" />
                  </F>
                </div>
                <F label="Notes / What to say">
                  <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className={inp} placeholder="Script, key points, context..." />
                </F>
              </div>
              <div className="flex gap-3 border-t border-slate-200 bg-slate-50 p-5">
                <button type="button" onClick={() => setDrawerOpen(false)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#2E7D32] text-sm font-bold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Follow-Up
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      <div className="space-y-6">
        {/* Page header */}
        <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#2E7D32]">Daily Tasks</p>
              <h1 className="mt-2 text-3xl font-bold text-[#0D1F0E]">Follow-Ups</h1>
              <p className="mt-2 text-sm text-slate-500">
                Track every call, message, and meeting. Start here every morning.
              </p>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2E7D32] px-5 text-sm font-bold text-white shadow transition hover:bg-[#1B5E20]"
            >
              <Plus className="h-4 w-4" />
              Add Follow-Up
            </button>
          </div>
        </section>

        {/* Summary cards */}
        {(counts.overdue > 0 || counts.today > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {counts.overdue > 0 && (
              <button
                onClick={() => { setStatusFilter("Pending"); setViewFilter("overdue"); }}
                className="flex items-center gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-left transition hover:border-rose-300"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-100 text-rose-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-rose-800">{counts.overdue}</p>
                  <p className="text-xs font-semibold text-rose-600">Overdue follow-up{counts.overdue !== 1 ? "s" : ""}</p>
                </div>
              </button>
            )}
            {counts.today > 0 && (
              <button
                onClick={() => { setStatusFilter("Pending"); setViewFilter("today"); }}
                className="flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left transition hover:border-amber-300"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-800">{counts.today}</p>
                  <p className="text-xs font-semibold text-amber-600">Due today</p>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Alerts */}
        {(notice || error) && (
          <div className="space-y-2">
            {notice && (
              <div className="flex items-center justify-between rounded-xl border border-green-200 bg-[#E8F5E9] px-4 py-3 text-sm font-semibold text-[#2E7D32]">
                <span>{notice}</span>
                <button onClick={() => setNotice("")}><X className="h-4 w-4" /></button>
              </div>
            )}
            {error && (
              <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                <span>{error}</span>
                <button onClick={() => setError("")}><X className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              from={dateFrom}
              to={dateTo}
              onChange={(f, t) => { setDateFrom(f); setDateTo(t); setViewFilter("all"); }}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap gap-1">
              {(["all", "Pending", "Done", "No Response", "Rescheduled"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${statusFilter === s ? "bg-[#2E7D32] text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 sm:ml-auto">
              {(["all", "today", "overdue", "upcoming"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewFilter(v)}
                  className={`h-9 rounded-lg px-3 text-sm font-semibold capitalize transition ${viewFilter === v ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-60 items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-[#2E7D32]" />
              <span className="text-sm font-semibold">Loading...</span>
            </div>
          ) : followUps.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E8F5E9] text-[#2E7D32]">
                <BellRing className="h-6 w-6" />
              </div>
              <p className="text-lg font-bold text-[#0D1F0E]">No follow-ups</p>
              <p className="text-sm text-slate-500">Adjust filters or add a new follow-up.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {followUps.map((f) => {
                const urgency = getUrgency(f.followUpDate, f.status);
                return (
                  <div
                    key={f.id}
                    className={`flex items-start gap-4 px-6 py-4 transition hover:bg-slate-50/80 ${urgency === "overdue" ? "bg-rose-50/30" : urgency === "today" ? "bg-amber-50/30" : ""}`}
                  >
                    <div className={`mt-0.5 h-3 w-3 flex-shrink-0 rounded-full ${urgency === "overdue" ? "bg-rose-500" : urgency === "today" ? "bg-amber-500" : "bg-slate-300"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-[#0D1F0E]">{f.contactName}</p>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${statusConfig[f.status]}`}>
                          {f.status}
                        </span>
                        {urgency === "overdue" && (
                          <span className="text-xs font-bold text-rose-600">OVERDUE</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{f.course}</span>
                        <span>·</span>
                        <span>{f.type}</span>
                        <span>·</span>
                        <span className={urgency === "overdue" ? "font-semibold text-rose-600" : urgency === "today" ? "font-semibold text-amber-700" : ""}>
                          {formatDate(f.followUpDate)}
                        </span>
                        {f.assignedTo && <><span>·</span><span>{f.assignedTo}</span></>}
                      </div>
                      {f.notes && (
                        <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">{f.notes}</p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {f.phone && (
                        <a
                          href={whatsappUrl(f.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-green-200 bg-[#E8F5E9] text-[#2E7D32] transition hover:bg-green-100"
                          title="Open WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                      {f.status !== "Done" && (
                        <button
                          onClick={() => void markDone(f.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-green-200 bg-[#E8F5E9] px-2.5 text-xs font-bold text-[#2E7D32] transition hover:bg-green-100"
                          title="Mark as done"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Done
                        </button>
                      )}
                      <button
                        onClick={() => void deleteFollowUp(f.id, f.contactName)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-500 transition hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

const inp = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
