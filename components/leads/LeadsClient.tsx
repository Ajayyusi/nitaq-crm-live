"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Download,
  Edit3,
  ExternalLink,
  Filter,
  GraduationCap,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  courseList,
  leadSources,
  leadStages,
  type CourseOption,
  type LeadSource,
  type LeadStage,
} from "@/constants/leads";

type SortOrder = "newest" | "oldest";

type Lead = {
  id: string;
  leadId: string;
  fullName: string;
  phone: string;
  email: string;
  course: CourseOption;
  source: LeadSource;
  stage: LeadStage;
  notes: string;
  nextFollowUpDate: string;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
};

type LeadFormState = {
  fullName: string;
  phone: string;
  email: string;
  course: CourseOption;
  source: LeadSource;
  stage: LeadStage;
  nextFollowUpDate: string;
  assignedTo: string;
  notes: string;
};

const emptyForm: LeadFormState = {
  fullName: "",
  phone: "",
  email: "",
  course: "Other",
  source: "WhatsApp",
  stage: "Lead",
  nextFollowUpDate: "",
  assignedTo: "",
  notes: "",
};

const stageConfig: Record<LeadStage, { cls: string; dot: string }> = {
  Lead:       { cls: "bg-sky-50 text-sky-700 ring-sky-200",           dot: "bg-sky-400" },
  Contacted:  { cls: "bg-indigo-50 text-indigo-700 ring-indigo-200",  dot: "bg-indigo-400" },
  Interested: { cls: "bg-[#E8F5E9] text-[#2E7D32] ring-green-200",   dot: "bg-[#2E7D32]" },
  Enrolled:   { cls: "bg-teal-50 text-teal-700 ring-teal-200",        dot: "bg-teal-500" },
  Paid:       { cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  Lost:       { cls: "bg-rose-50 text-rose-700 ring-rose-200",        dot: "bg-rose-400" },
};

const sourceConfig: Record<LeadSource, string> = {
  WhatsApp:     "bg-[#E8F5E9] text-[#2E7D32] ring-green-200",
  Instagram:    "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
  "Google Maps": "bg-blue-50 text-blue-700 ring-blue-200",
  Referral:     "bg-violet-50 text-violet-700 ring-violet-200",
  "Walk-in":    "bg-amber-50 text-amber-800 ring-amber-200",
  "Paid Ads":   "bg-orange-50 text-orange-700 ring-orange-200",
  Other:        "bg-slate-100 text-slate-600 ring-slate-200",
};

function getFollowUpUrgency(dateStr: string): "overdue" | "today" | "upcoming" | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  if (due < today) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  return "upcoming";
}

function getErrorMessage(value: unknown, fallback: string) {
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  )
    return value.message;
  return fallback;
}

function asLeadForm(lead: Lead): LeadFormState {
  return {
    fullName: lead.fullName,
    phone: lead.phone,
    email: lead.email,
    course: lead.course,
    source: lead.source,
    stage: lead.stage,
    nextFollowUpDate: lead.nextFollowUpDate,
    assignedTo: lead.assignedTo,
    notes: lead.notes,
  };
}

function formatDate(value: string) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

export default function LeadsClient() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadFormState>(emptyForm);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (stage !== "all") params.set("stage", stage);
    if (source !== "all") params.set("source", source);
    params.set("sort", sort);
    return params.toString();
  }, [search, stage, source, sort]);

  const hasFilters = Boolean(search.trim() || stage !== "all" || source !== "all");

  async function loadLeads() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/leads?${queryString}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw data;
      setLeads(data.leads ?? []);
    } catch (caught) {
      setError(getErrorMessage(caught, "Unable to load leads."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => void loadLeads(), 250);
    return () => window.clearTimeout(handle);
  }, [queryString]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  function openCreateForm() {
    setEditingLead(null);
    setForm(emptyForm);
    setFormError("");
    setNotice("");
    setDrawerOpen(true);
  }

  function openEditForm(lead: Lead) {
    setEditingLead(lead);
    setForm(asLeadForm(lead));
    setFormError("");
    setNotice("");
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingLead(null);
    setFormError("");
  }

  function updateForm(field: keyof LeadFormState, value: string) {
    setForm((cur) => ({ ...cur, [field]: value }));
  }

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(
        editingLead ? `/api/leads/${editingLead.id}` : "/api/leads",
        {
          method: editingLead ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const data = await res.json();
      if (!res.ok) throw data;
      setNotice(editingLead ? "Lead updated." : "Lead added.");
      closeDrawer();
      setForm(emptyForm);
      await loadLeads();
    } catch (caught) {
      setFormError(getErrorMessage(caught, "Unable to save lead."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead(lead: Lead) {
    if (!window.confirm(`Delete lead for ${lead.fullName}? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw data;
      setNotice("Lead deleted.");
      await loadLeads();
    } catch (caught) {
      setError(getErrorMessage(caught, "Unable to delete lead."));
    }
  }

  async function convertToEnrollment(lead: Lead) {
    setConverting(lead.id);
    setError("");
    try {
      // Mark lead as Enrolled
      await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "Enrolled" }),
      });
      await loadLeads();
      // Navigate to enrollments with pre-filled data
      const params = new URLSearchParams({
        name: lead.fullName,
        phone: lead.phone,
        ...(lead.email ? { email: lead.email } : {}),
        course: lead.course,
      });
      router.push(`/enrollments?${params.toString()}`);
    } catch {
      setError("Could not start conversion. Please try again.");
    } finally {
      setConverting(null);
    }
  }

  async function exportLeads() {
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/leads/export");
      if (!res.ok) throw await res.json();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nitaq-leads.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setNotice("Leads exported.");
    } catch (caught) {
      setError(getErrorMessage(caught, "Unable to export leads."));
    }
  }

  async function importLeads(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError("");
    setNotice("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/leads/import", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw data;
      const detail = data.failed ? ` ${data.failed} row(s) failed.` : "";
      setNotice(`Imported ${data.created ?? 0} lead(s).${detail}`);
      if (data.errors?.length) setError(data.errors.slice(0, 4).join(" "));
      await loadLeads();
    } catch (caught) {
      setError(getErrorMessage(caught, "Unable to import leads."));
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  // Stage pipeline summary
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of leadStages) counts[s] = 0;
    for (const l of leads) counts[l.stage] = (counts[l.stage] ?? 0) + 1;
    return counts;
  }, [leads]);

  return (
    <>
      <LeadDrawer
        open={drawerOpen}
        editingLead={editingLead}
        form={form}
        formError={formError}
        saving={saving}
        onClose={closeDrawer}
        onSubmit={saveLead}
        updateForm={updateForm}
      />

      <div className="space-y-6">
        {/* Header */}
        <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#2E7D32]">
                Admissions CRM
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#0D1F0E]">Leads</h1>
              <p className="mt-2 max-w-2xl text-base text-slate-500">
                Track every inquiry from first contact through enrollment and payment.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept=".csv,text/csv"
                onChange={importLeads}
              />
              <button
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#2E7D32] hover:bg-[#E8F5E9] disabled:opacity-60"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Import CSV
              </button>
              <button
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#2E7D32] hover:bg-[#E8F5E9]"
                onClick={exportLeads}
                type="button"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2E7D32] px-5 text-sm font-bold text-white shadow transition hover:bg-[#1B5E20]"
                onClick={openCreateForm}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Add Lead
              </button>
            </div>
          </div>
        </section>

        {/* Stage pipeline strip */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {leadStages.map((s) => {
            const cfg = stageConfig[s];
            return (
              <button
                key={s}
                onClick={() => setStage(stage === s ? "all" : s)}
                className={`rounded-xl border p-3 text-center transition hover:shadow-sm ${
                  stage === s
                    ? "border-[#2E7D32] bg-[#E8F5E9] shadow-sm"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-xl font-bold text-[#0D1F0E]">
                  {stageCounts[s]}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">{s}</p>
              </button>
            );
          })}
        </div>

        {/* Alerts */}
        {(notice || error) && (
          <div className="space-y-2">
            {notice && (
              <div className="flex items-center justify-between rounded-xl border border-green-200 bg-[#E8F5E9] px-4 py-3 text-sm font-semibold text-[#2E7D32]">
                <span>{notice}</span>
                <button onClick={() => setNotice("")} type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {error && (
              <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                <span>{error}</span>
                <button onClick={() => setError("")} type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_160px_auto]">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, or lead ID"
                value={search}
              />
            </label>
            <Select value={stage} onChange={setStage} label="All stages" options={leadStages} />
            <Select value={source} onChange={setSource} label="All sources" options={leadSources} />
            <select
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]"
              onChange={(e) => setSort(e.target.value as SortOrder)}
              value={sort}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            {hasFilters && (
              <button
                className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
                onClick={() => {
                  setSearch("");
                  setStage("all");
                  setSource("all");
                }}
                type="button"
              >
                <Filter className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        </section>

        {/* Table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-[#0D1F0E]">Lead Pipeline</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {loading
                  ? "Loading..."
                  : `${leads.length} result${leads.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-[#2E7D32]" />
              <p className="text-sm font-semibold">Loading leads...</p>
            </div>
          ) : leads.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#E8F5E9] text-[#2E7D32]">
                <UserPlus className="h-7 w-7" />
              </div>
              <div>
                <p className="text-lg font-bold text-[#0D1F0E]">
                  {hasFilters ? "No matching leads" : "No leads yet"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {hasFilters
                    ? "Try adjusting your filters."
                    : "Add your first lead to start tracking."}
                </p>
              </div>
              {!hasFilters && (
                <button
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2E7D32] px-5 text-sm font-bold text-white"
                  onClick={openCreateForm}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  Add Lead
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Follow-up</th>
                    <th className="px-4 py-3">Assigned</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => {
                    const urgency = getFollowUpUrgency(lead.nextFollowUpDate);
                    return (
                      <tr
                        key={lead.id}
                        className={`transition hover:bg-slate-50/80 ${urgency === "overdue" ? "bg-rose-50/40" : urgency === "today" ? "bg-amber-50/40" : ""}`}
                      >
                        <td className="px-4 py-4 font-mono text-xs font-semibold text-slate-500">
                          {lead.leadId}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-[#0D1F0E]">{lead.fullName}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                            <span>{lead.phone}</span>
                            {lead.phone && (
                              <a
                                href={whatsappUrl(lead.phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[#2E7D32] hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MessageCircle className="h-3 w-3" />
                                WA
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-slate-700">
                          {lead.course}
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={sourceConfig[lead.source]}>
                            {lead.source}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${stageConfig[lead.stage].dot}`}
                            />
                            <Badge className={stageConfig[lead.stage].cls}>
                              {lead.stage}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`text-xs font-semibold ${
                              urgency === "overdue"
                                ? "text-rose-700"
                                : urgency === "today"
                                  ? "text-amber-700"
                                  : "text-slate-600"
                            }`}
                          >
                            {urgency === "overdue" && "⚠ "}
                            {urgency === "today" && "● "}
                            {formatDate(lead.nextFollowUpDate)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs font-medium text-slate-600">
                          {lead.assignedTo || "Unassigned"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-1.5">
                            <a
                              href={whatsappUrl(lead.phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-green-200 bg-[#E8F5E9] text-[#2E7D32] transition hover:bg-green-100"
                              aria-label={`WhatsApp ${lead.fullName}`}
                              title="Open WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-[#2E7D32] hover:bg-[#E8F5E9] hover:text-[#2E7D32]"
                              onClick={() => openEditForm(lead)}
                              type="button"
                              aria-label={`Edit ${lead.fullName}`}
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            {lead.stage !== "Enrolled" && (
                              <button
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-teal-200 text-teal-600 transition hover:bg-teal-50 disabled:opacity-40"
                                onClick={() => void convertToEnrollment(lead)}
                                type="button"
                                disabled={converting === lead.id}
                                title="Convert to Enrollment"
                                aria-label={`Convert ${lead.fullName} to enrollment`}
                              >
                                {converting === lead.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <GraduationCap className="h-4 w-4" />}
                              </button>
                            )}
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50"
                              onClick={() => void deleteLead(lead)}
                              type="button"
                              aria-label={`Delete ${lead.fullName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function LeadDrawer({
  open,
  editingLead,
  form,
  formError,
  saving,
  onClose,
  onSubmit,
  updateForm,
}: {
  open: boolean;
  editingLead: Lead | null;
  form: LeadFormState;
  formError: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  updateForm: (field: keyof LeadFormState, value: string) => void;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-[#0D1F0E]/40 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[540px] flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label={editingLead ? "Edit lead" : "Add lead"}
      >
        <div className="border-b border-slate-200 bg-[#0D1F0E] px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#4DB6AC]">
                Admissions
              </p>
              <h2 className="mt-2 text-xl font-bold">
                {editingLead ? "Edit Lead" : "Add New Lead"}
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                All required fields are marked with *
              </p>
            </div>
            <button
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
              onClick={onClose}
              type="button"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {formError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                {formError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <DrawerField
                label="Full name"
                required
                value={form.fullName}
                onChange={(v) => updateForm("fullName", v)}
                placeholder="Student or parent name"
              />
              <DrawerField
                label="WhatsApp / Phone"
                required
                value={form.phone}
                onChange={(v) => updateForm("phone", v)}
                placeholder="+971..."
              />
              <DrawerField
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => updateForm("email", v)}
                placeholder="name@email.com"
              />
              <DrawerSelect
                label="Course interest"
                value={form.course}
                options={courseList}
                onChange={(v) => updateForm("course", v)}
              />
              <DrawerSelect
                label="Lead source"
                value={form.source}
                options={leadSources}
                onChange={(v) => updateForm("source", v)}
              />
              <DrawerSelect
                label="Stage"
                value={form.stage}
                options={leadStages}
                onChange={(v) => updateForm("stage", v)}
              />
              <DrawerField
                label="Follow-up date"
                type="date"
                value={form.nextFollowUpDate}
                onChange={(v) => updateForm("nextFollowUpDate", v)}
              />
              <DrawerField
                label="Assigned to"
                value={form.assignedTo}
                onChange={(v) => updateForm("assignedTo", v)}
                placeholder="Staff name"
              />
            </div>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">Notes</span>
              <textarea
                className="mt-1.5 min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]"
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                placeholder="Add context, conversation summary, or parent preferences..."
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2E7D32] px-5 text-sm font-bold text-white transition hover:bg-[#1B5E20] disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingLead ? "Save Changes" : "Create Lead"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function DrawerField({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]"
        onChange={(e) => onChange(e.target.value)}
        required={required}
        type={type}
        value={value}
        placeholder={placeholder}
      />
    </label>
  );
}

function DrawerSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <select
        className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]"
        onChange={(e) => onChange(e.target.value)}
        value={value}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function Select({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: readonly string[];
}) {
  return (
    <select
      className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]"
      onChange={(e) => onChange(e.target.value)}
      value={value}
    >
      <option value="all">{label}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${className}`}
    >
      {children}
    </span>
  );
}
