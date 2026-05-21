"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download, Edit3, Loader2, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { leadSources, leadStatuses, type LeadSource, type LeadStatus } from "@/constants/leads";

type SortOrder = "newest" | "oldest";

type Lead = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  interestedCourse: string;
  source: LeadSource;
  status: LeadStatus;
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
  interestedCourse: string;
  source: LeadSource;
  status: LeadStatus;
  nextFollowUpDate: string;
  assignedTo: string;
  notes: string;
};

const emptyForm: LeadFormState = {
  fullName: "",
  phone: "",
  email: "",
  interestedCourse: "",
  source: "WhatsApp",
  status: "New",
  nextFollowUpDate: "",
  assignedTo: "",
  notes: "",
};

const statusStyles: Record<LeadStatus, string> = {
  New: "bg-sky-50 text-sky-700 ring-sky-200",
  Contacted: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  Interested: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Follow Up": "bg-amber-50 text-amber-800 ring-amber-200",
  Converted: "bg-teal-50 text-teal-700 ring-teal-200",
  Lost: "bg-rose-50 text-rose-700 ring-rose-200",
};

function getErrorMessage(value: unknown, fallback: string) {
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") return value.message;
  return fallback;
}

function asLeadForm(lead: Lead): LeadFormState {
  return {
    fullName: lead.fullName,
    phone: lead.phone,
    email: lead.email,
    interestedCourse: lead.interestedCourse,
    source: lead.source,
    status: lead.status,
    nextFollowUpDate: lead.nextFollowUpDate,
    assignedTo: lead.assignedTo,
    notes: lead.notes,
  };
}

export default function LeadsClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadFormState>(emptyForm);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (status !== "all") params.set("status", status);
    if (source !== "all") params.set("source", source);
    params.set("sort", sort);
    return params.toString();
  }, [search, status, source, sort]);

  async function loadLeads() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/leads?${queryString}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw data;
      setLeads(data.leads ?? []);
    } catch (caught) {
      setError(getErrorMessage(caught, "Unable to load leads."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadLeads();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [queryString]);

  function openCreateForm() {
    setEditingLead(null);
    setForm(emptyForm);
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  function openEditForm(lead: Lead) {
    setEditingLead(lead);
    setForm(asLeadForm(lead));
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  function updateForm(field: keyof LeadFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(editingLead ? `/api/leads/${editingLead.id}` : "/api/leads", {
        method: editingLead ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw data;

      setNotice(editingLead ? "Lead updated successfully." : "Lead added successfully.");
      setFormOpen(false);
      setEditingLead(null);
      setForm(emptyForm);
      await loadLeads();
    } catch (caught) {
      setError(getErrorMessage(caught, "Unable to save lead."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead(lead: Lead) {
    const confirmed = window.confirm(`Delete lead for ${lead.fullName}?`);
    if (!confirmed) return;

    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw data;
      setNotice("Lead deleted successfully.");
      await loadLeads();
    } catch (caught) {
      setError(getErrorMessage(caught, "Unable to delete lead."));
    }
  }

  async function exportLeads() {
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/leads/export");
      if (!response.ok) throw await response.json();
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "nitaq-leads.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setNotice("Leads exported successfully.");
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
      const response = await fetch("/api/leads/import", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw data;
      const detail = data.failed ? ` ${data.failed} row(s) failed.` : "";
      setNotice(`Imported ${data.created} lead(s).${detail}`);
      if (data.errors?.length) setError(data.errors.slice(0, 4).join(" "));
      await loadLeads();
    } catch (caught) {
      setError(getErrorMessage(caught, "Unable to import leads."));
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-700">Nitaq Academy</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Leads</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Manage inquiries, follow-ups, sources, and admissions pipeline activity from one working CRM screen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} className="hidden" type="file" accept=".csv,text/csv" onChange={importLeads} />
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import Leads
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={exportLeads}
            type="button"
          >
            <Download className="h-4 w-4" />
            Export Leads
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
            onClick={openCreateForm}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_160px]">
          <label className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input
              className="w-full bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone, course, or status"
              value={search}
            />
          </label>
          <select className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700" onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="all">All statuses</option>
            {leadStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700" onChange={(event) => setSource(event.target.value)} value={source}>
            <option value="all">All sources</option>
            {leadSources.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700" onChange={(event) => setSort(event.target.value as SortOrder)} value={sort}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      {(notice || error) && (
        <div className="space-y-2">
          {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{notice}</div>}
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</div>}
        </div>
      )}

      {formOpen && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{editingLead ? "Edit lead" : "Add lead"}</h2>
              <p className="text-sm text-slate-500">Capture the inquiry details and next follow-up owner.</p>
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={() => setFormOpen(false)} type="button" aria-label="Close form">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={saveLead}>
            <Field label="Full name" required value={form.fullName} onChange={(value) => updateForm("fullName", value)} />
            <Field label="Phone" required value={form.phone} onChange={(value) => updateForm("phone", value)} />
            <Field label="Email" type="email" value={form.email} onChange={(value) => updateForm("email", value)} />
            <Field label="Interested course" required value={form.interestedCourse} onChange={(value) => updateForm("interestedCourse", value)} />
            <SelectField label="Source" value={form.source} options={leadSources} onChange={(value) => updateForm("source", value)} />
            <SelectField label="Status" value={form.status} options={leadStatuses} onChange={(value) => updateForm("status", value)} />
            <Field label="Next follow-up date" type="date" value={form.nextFollowUpDate} onChange={(value) => updateForm("nextFollowUpDate", value)} />
            <Field label="Assigned to" value={form.assignedTo} onChange={(value) => updateForm("assignedTo", value)} />
            <label className="lg:col-span-2">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                className="mt-1 min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-4"
                onChange={(event) => updateForm("notes", event.target.value)}
                value={form.notes}
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2 lg:col-span-2">
              <button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setFormOpen(false)} type="button">
                Cancel
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} type="submit">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingLead ? "Save changes" : "Create lead"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Lead pipeline</p>
          <p className="text-xs font-medium text-slate-500">{leads.length} result(s)</p>
        </div>

        {loading ? (
          <div className="grid min-h-72 place-items-center text-sm text-slate-500">
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading leads...</span>
          </div>
        ) : leads.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 text-center">
            <div>
              <p className="text-sm font-semibold text-slate-900">No leads found</p>
              <p className="mt-1 text-sm text-slate-500">Add a lead or import a CSV to start building the admissions pipeline.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Follow-up</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{lead.fullName}</p>
                      <p className="mt-1 text-xs text-slate-500">{lead.phone}{lead.email ? ` / ${lead.email}` : ""}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{lead.interestedCourse}</td>
                    <td className="px-4 py-4 text-slate-600">{lead.source}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[lead.status]}`}>{lead.status}</span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{lead.nextFollowUpDate || "Not set"}</td>
                    <td className="px-4 py-4 text-slate-600">{lead.assignedTo || "Unassigned"}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" onClick={() => openEditForm(lead)} type="button" aria-label={`Edit ${lead.fullName}`}>
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => void deleteLead(lead)} type="button" aria-label={`Delete ${lead.fullName}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-700">{label}{required ? " *" : ""}</span>
      <input
        className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-4"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-4"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
