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
  BellRing,
  CalendarDays,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  GraduationCap,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCheck,
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
import { followUpTypes, followUpStatuses } from "@/constants/modelConstants";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { thisMonthRange } from "@/lib/dateRange";

type SortOrder = "newest" | "oldest";
type SalesUser = { id: string; name: string; email: string };

type NoteEntry = { text: string; by: string; at: string };

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
  noteLog: NoteEntry[];
  customCourse: string;
  nextFollowUpDate: string;
  assignedTo: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type FollowUpEntry = {
  id: string;
  followUpDate: string;
  type: string;
  notes: string;
  status: string;
  assignedTo: string;
  createdAt: string;
};

type LeadFormState = {
  fullName: string;
  phone: string;
  email: string;
  course: CourseOption;
  customCourse: string;
  source: LeadSource;
  stage: LeadStage;
  nextFollowUpDate: string;
  assignedTo: string;
  notes: string;
};

type FuFormState = {
  followUpDate: string;
  type: string;
  notes: string;
  status: string;
  assignedTo: string;
};

const emptyForm: LeadFormState = {
  fullName: "",
  phone: "",
  email: "",
  course: "Other",
  customCourse: "",
  source: "WhatsApp",
  stage: "Lead",
  nextFollowUpDate: "",
  assignedTo: "",
  notes: "",
};

const emptyFuForm: FuFormState = {
  followUpDate: new Date().toISOString().slice(0, 10),
  type: "WhatsApp Message",
  notes: "",
  status: "Pending",
  assignedTo: "",
};

const stageConfig: Record<LeadStage, { cls: string; dot: string }> = {
  Lead:             { cls: "bg-sky-50 text-sky-700 ring-sky-200",             dot: "bg-sky-400" },
  Contacted:        { cls: "bg-indigo-50 text-indigo-700 ring-indigo-200",    dot: "bg-indigo-400" },
  Interested:       { cls: "bg-[#E8F5E9] text-[#2E7D32] ring-green-200",     dot: "bg-[#2E7D32]" },
  "Not Connecting": { cls: "bg-orange-50 text-orange-700 ring-orange-200",    dot: "bg-orange-400" },
  "Not Answering":  { cls: "bg-amber-50 text-amber-800 ring-amber-200",       dot: "bg-amber-500" },
  "Invalid Number": { cls: "bg-slate-100 text-slate-600 ring-slate-200",      dot: "bg-slate-400" },
  Enrolled:         { cls: "bg-teal-50 text-teal-700 ring-teal-200",          dot: "bg-teal-500" },
  Paid:             { cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  Lost:             { cls: "bg-rose-50 text-rose-700 ring-rose-200",          dot: "bg-rose-400" },
};

const sourceConfig: Record<LeadSource, string> = {
  WhatsApp:      "bg-[#E8F5E9] text-[#2E7D32] ring-green-200",
  Instagram:     "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
  "Google Maps": "bg-blue-50 text-blue-700 ring-blue-200",
  Referral:      "bg-violet-50 text-violet-700 ring-violet-200",
  "Walk-in":     "bg-amber-50 text-amber-800 ring-amber-200",
  "Paid Ads":    "bg-orange-50 text-orange-700 ring-orange-200",
  Other:         "bg-slate-100 text-slate-600 ring-slate-200",
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
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string")
    return value.message;
  return fallback;
}

function asLeadForm(lead: Lead): LeadFormState {
  return {
    fullName: lead.fullName,
    phone: lead.phone,
    email: lead.email,
    course: lead.course,
    customCourse: lead.customCourse ?? "",
    source: lead.source,
    stage: lead.stage,
    nextFollowUpDate: lead.nextFollowUpDate,
    assignedTo: lead.assignedTo,
    notes: lead.notes,
  };
}

function formatDate(value: string) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits || digits.length < 7) return null;
  return `https://wa.me/${digits}`;
}

function leadAgeDays(updatedAt: string): number {
  if (!updatedAt) return 0;
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000);
}

export default function LeadsClient({ role = "sales", userName = "" }: { role?: string; userName?: string }) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [dateFrom, setDateFrom] = useState(() => thisMonthRange().from);
  const [dateTo, setDateTo] = useState(() => thisMonthRange().to);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  // Lead detail view panel
  const [viewLead, setViewLead] = useState<Lead | null>(null);
  const [viewTimeline, setViewTimeline] = useState<FollowUpEntry[]>([]);
  const [viewTimelineLoading, setViewTimelineLoading] = useState(false);

  // Lead edit/create drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadFormState>(emptyForm);
  // Timeline inside edit drawer
  const [timeline, setTimeline] = useState<FollowUpEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Follow-up add/edit drawer
  const [fuDrawerOpen, setFuDrawerOpen] = useState(false);
  const [fuLead, setFuLead] = useState<Lead | null>(null);
  const [fuEditId, setFuEditId] = useState<string | null>(null);
  const [fuForm, setFuForm] = useState<FuFormState>(emptyFuForm);
  const [fuSaving, setFuSaving] = useState(false);
  const [fuError, setFuError] = useState("");

  // Enrollment request modal (sales only)
  const [erModalOpen, setErModalOpen] = useState(false);
  const [erLead, setErLead] = useState<Lead | null>(null);
  const [erNotes, setErNotes] = useState("");
  const [erStartDate, setErStartDate] = useState("");
  const [erSaving, setErSaving] = useState(false);
  const [erError, setErError] = useState("");

  const isSales = role === "sales";
  const canDelete = role === "admin" || role === "manager";

  // Sales users list for assignment dropdown (admin/manager only)
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  useEffect(() => {
    if (isSales) return;
    fetch("/api/users?role=sales")
      .then((r) => r.json())
      .then((d) => setSalesUsers(d.users ?? []))
      .catch(() => {});
  }, [isSales]);

  // WhatsApp template dropdown
  const [waMenuId, setWaMenuId] = useState<string | null>(null);

  // Duplicate warning
  const [dupWarning, setDupWarning] = useState<{ message: string; duplicate?: Lead } | null>(null);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignTo, setBulkAssignTo] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (stage !== "all") params.set("stage", stage);
    if (source !== "all") params.set("source", source);
    params.set("sort", sort);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    return params.toString();
  }, [search, stage, source, sort, dateFrom, dateTo]);

  const defaultRange = thisMonthRange();
  const hasFilters = Boolean(
    search.trim() || stage !== "all" || source !== "all" ||
    dateFrom !== defaultRange.from || dateTo !== defaultRange.to
  );

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
    if (!drawerOpen && !fuDrawerOpen && !viewLead) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (fuDrawerOpen) setFuDrawerOpen(false);
        else if (drawerOpen) closeDrawer();
        else setViewLead(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, fuDrawerOpen, viewLead]);

  // ── Lead detail view ─────────────────────────────────────────────────────────

  function openViewPanel(lead: Lead) {
    setViewLead(lead);
    setViewTimeline([]);
    setViewTimelineLoading(true);
    fetch(`/api/leads/${lead.id}/follow-ups`)
      .then((r) => r.json())
      .then((d) => setViewTimeline(d.followUps ?? []))
      .catch(() => {})
      .finally(() => setViewTimelineLoading(false));
  }

  // ── Lead drawer ──────────────────────────────────────────────────────────────

  function openCreateForm() {
    setEditingLead(null);
    setForm(emptyForm);
    setFormError("");
    setNotice("");
    setTimeline([]);
    setDrawerOpen(true);
  }

  function openEditForm(lead: Lead) {
    setEditingLead(lead);
    setForm(asLeadForm(lead));
    setFormError("");
    setNotice("");
    setTimeline([]);
    setDrawerOpen(true);
    // Load timeline
    setTimelineLoading(true);
    fetch(`/api/leads/${lead.id}/follow-ups`)
      .then((r) => r.json())
      .then((d) => setTimeline(d.followUps ?? []))
      .catch(() => {})
      .finally(() => setTimelineLoading(false));
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingLead(null);
    setFormError("");
    setTimeline([]);
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
      if (!editingLead && res.status === 409) {
        setDupWarning({ message: data.message, duplicate: data.duplicate });
        setSaving(false);
        return;
      }
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

  // ── Follow-up drawer ─────────────────────────────────────────────────────────

  function openFollowUpFor(lead: Lead) {
    setFuLead(lead);
    setFuEditId(null);
    setFuForm(emptyFuForm);
    setFuError("");
    setFuDrawerOpen(true);
  }

  function openEditFollowUp(fu: FollowUpEntry, lead: Lead) {
    setFuLead(lead);
    setFuEditId(fu.id);
    setFuForm({
      followUpDate: fu.followUpDate.slice(0, 10),
      type: fu.type,
      notes: fu.notes,
      status: fu.status,
      assignedTo: fu.assignedTo,
    });
    setFuError("");
    setFuDrawerOpen(true);
  }

  async function saveFollowUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fuLead) return;
    setFuSaving(true);
    setFuError("");
    try {
      if (fuEditId) {
        // Editing existing follow-up
        const res = await fetch(`/api/follow-ups/${fuEditId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fuForm),
        });
        const data = await res.json();
        if (!res.ok) throw data;
        setNotice(`Follow-up updated for ${fuLead.fullName}.`);
      } else {
        // Creating new follow-up
        const res = await fetch("/api/follow-ups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactName: fuLead.fullName,
            phone: fuLead.phone,
            course: fuLead.course,
            leadId: fuLead.id,
            ...fuForm,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw data;
        // Update lead's nextFollowUpDate
        await fetch(`/api/leads/${fuLead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nextFollowUpDate: fuForm.followUpDate }),
        });
        setNotice(`Follow-up added for ${fuLead.fullName}.`);
      }
      setFuDrawerOpen(false);
      setFuEditId(null);
      // Reload timelines if a lead detail/edit panel is open
      if (viewLead) {
        setViewTimelineLoading(true);
        fetch(`/api/leads/${viewLead.id}/follow-ups`)
          .then((r) => r.json())
          .then((d) => setViewTimeline(d.followUps ?? []))
          .catch(() => {})
          .finally(() => setViewTimelineLoading(false));
      }
      if (editingLead) {
        setTimelineLoading(true);
        fetch(`/api/leads/${editingLead.id}/follow-ups`)
          .then((r) => r.json())
          .then((d) => setTimeline(d.followUps ?? []))
          .catch(() => {})
          .finally(() => setTimelineLoading(false));
      }
      await loadLeads();
    } catch (caught) {
      setFuError(getErrorMessage(caught, "Failed to save follow-up."));
    } finally {
      setFuSaving(false);
    }
  }

  // ── Lead actions ─────────────────────────────────────────────────────────────

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
      await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "Enrolled" }),
      });
      await loadLeads();
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

  function openEnrollmentRequest(lead: Lead) {
    setErLead(lead);
    setErNotes("");
    setErStartDate("");
    setErError("");
    setErModalOpen(true);
  }

  async function submitEnrollmentRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!erLead) return;
    setErSaving(true);
    setErError("");
    try {
      const res = await fetch("/api/enrollment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: erLead.id,
          leadRef: erLead.leadId,
          leadName: erLead.fullName,
          leadPhone: erLead.phone,
          course: erLead.course,
          notes: erNotes,
          expectedStartDate: erStartDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      setErModalOpen(false);
      setNotice(`Enrollment request submitted for ${erLead.fullName}. Admin will review soon.`);
    } catch (caught) {
      setErError(getErrorMessage(caught, "Failed to submit request."));
    } finally {
      setErSaving(false);
    }
  }

  async function bulkAssign() {
    if (!bulkAssignTo || selected.size === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all(
        [...selected].map((id) =>
          fetch(`/api/leads/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assignedTo: bulkAssignTo }),
          })
        )
      );
      setNotice(`Assigned ${selected.size} lead${selected.size > 1 ? "s" : ""} to ${bulkAssignTo}.`);
      setSelected(new Set());
      setBulkAssignTo("");
      await loadLeads();
    } catch {
      setError("Bulk assignment failed. Please try again.");
    } finally {
      setBulkSaving(false);
    }
  }

  // ── Bulk follow-up ───────────────────────────────────────────────────────────
  const [bulkFuOpen, setBulkFuOpen] = useState(false);
  const [bulkFuDate, setBulkFuDate] = useState(new Date().toISOString().slice(0, 10));
  const [bulkFuType, setBulkFuType] = useState("WhatsApp Message");
  const [bulkFuNotes, setBulkFuNotes] = useState("");
  const [bulkFuSaving, setBulkFuSaving] = useState(false);
  const [bulkFuError, setBulkFuError] = useState("");

  async function bulkFollowUp() {
    if (selected.size === 0 || !bulkFuDate) return;
    setBulkFuSaving(true);
    setBulkFuError("");
    const selectedLeads = leads.filter((l) => selected.has(l.id));
    try {
      const results = await Promise.allSettled(
        selectedLeads.map((lead) =>
          fetch("/api/follow-ups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contactName: lead.fullName,
              phone: lead.phone,
              course: lead.course === "Other" && lead.customCourse ? lead.customCourse : lead.course,
              followUpDate: bulkFuDate,
              type: bulkFuType,
              notes: bulkFuNotes,
              status: "Pending",
            }),
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        setBulkFuError(`${failed} follow-up(s) failed to create.`);
      } else {
        setNotice(`Created ${selected.size} follow-up${selected.size > 1 ? "s" : ""} for ${bulkFuDate}.`);
        setBulkFuOpen(false);
        setBulkFuNotes("");
        setSelected(new Set());
      }
    } catch {
      setBulkFuError("Failed to create follow-ups. Please try again.");
    } finally {
      setBulkFuSaving(false);
    }
  }

  async function exportLeads() {
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/leads/export?${queryString}`);
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

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of leadStages) counts[s] = 0;
    for (const l of leads) counts[l.stage] = (counts[l.stage] ?? 0) + 1;
    return counts;
  }, [leads]);

  return (
    <>
      {/* Bulk follow-up modal */}
      {bulkFuOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setBulkFuOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between rounded-t-2xl bg-[#0D1F0E] px-6 py-5 text-white">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Bulk Action</p>
                  <h2 className="mt-0.5 text-lg font-bold">Add Follow-Up for {selected.size} Lead{selected.size > 1 ? "s" : ""}</h2>
                </div>
                <button onClick={() => setBulkFuOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20" type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {bulkFuError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{bulkFuError}</div>
                )}
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  One follow-up will be created for each of the <strong>{selected.size}</strong> selected leads using the settings below.
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-700">Follow-up date *</label>
                  <input
                    type="date"
                    required
                    value={bulkFuDate}
                    onChange={(e) => setBulkFuDate(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-700">Type</label>
                  <select
                    value={bulkFuType}
                    onChange={(e) => setBulkFuType(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]"
                  >
                    {followUpTypes.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-700">Notes / script</label>
                  <textarea
                    value={bulkFuNotes}
                    onChange={(e) => setBulkFuNotes(e.target.value)}
                    rows={3}
                    placeholder="What to say, key points, context…"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setBulkFuOpen(false)}
                    className="h-10 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button type="button" onClick={() => void bulkFollowUp()} disabled={bulkFuSaving || !bulkFuDate}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60">
                    {bulkFuSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                    Create {selected.size} Follow-Up{selected.size > 1 ? "s" : ""}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Lead detail panel */}
      <LeadDetailPanel
        lead={viewLead}
        timeline={viewTimeline}
        timelineLoading={viewTimelineLoading}
        converting={converting}
        onClose={() => setViewLead(null)}
        onEdit={(lead) => { setViewLead(null); openEditForm(lead); }}
        onAddFollowUp={(lead) => { openFollowUpFor(lead); }}
        onEditFollowUp={(fu) => { if (viewLead) openEditFollowUp(fu, viewLead); }}
        onConvert={(lead) => { setViewLead(null); void convertToEnrollment(lead); }}
      />

      {/* Lead edit/create drawer */}
      <LeadDrawer
        open={drawerOpen}
        editingLead={editingLead}
        form={form}
        formError={formError}
        saving={saving}
        timeline={timeline}
        timelineLoading={timelineLoading}
        onClose={closeDrawer}
        onSubmit={saveLead}
        updateForm={updateForm}
        onAddFollowUp={editingLead ? () => { openFollowUpFor(editingLead); } : undefined}
        onEditFollowUp={editingLead ? (fu) => { openEditFollowUp(fu, editingLead); } : undefined}
        isSales={isSales}
        salesUsers={salesUsers}
      />

      {/* Follow-up add/edit drawer */}
      <FollowUpDrawer
        open={fuDrawerOpen}
        lead={fuLead}
        isEditing={!!fuEditId}
        form={fuForm}
        saving={fuSaving}
        error={fuError}
        onClose={() => { setFuDrawerOpen(false); setFuEditId(null); }}
        onSubmit={saveFollowUp}
        updateForm={(f, v) => setFuForm((cur) => ({ ...cur, [f]: v }))}
      />

      {/* Enrollment Request modal (sales only) */}
      {erModalOpen && erLead && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setErModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
              <div className="border-b border-slate-200 bg-[#0D1F0E] px-6 py-5 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#4DB6AC]">Enrollment Request</p>
                    <h2 className="mt-1 text-lg font-bold text-white">Request Enrollment for {erLead.fullName}</h2>
                  </div>
                  <button onClick={() => setErModalOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20" type="button">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <form onSubmit={submitEnrollmentRequest} className="p-6 space-y-4">
                {erError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{erError}</div>}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1 text-sm">
                  <p><span className="font-bold text-slate-600">Lead:</span> <span className="text-slate-900">{erLead.fullName}</span></p>
                  <p><span className="font-bold text-slate-600">Phone:</span> <span className="text-slate-900">{erLead.phone}</span></p>
                  <p><span className="font-bold text-slate-600">Course:</span> <span className="text-slate-900">{erLead.course}</span></p>
                </div>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Expected start date (optional)</span>
                  <input type="date" value={erStartDate} onChange={(e) => setErStartDate(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]" />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Notes for Admin / Manager</span>
                  <textarea value={erNotes} onChange={(e) => setErNotes(e.target.value)} rows={3}
                    placeholder="Any special notes, agreed pricing discussion, parent preferences..."
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]" />
                </label>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setErModalOpen(false)}
                    className="flex-1 h-10 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={erSaving}
                    className="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2E7D32] text-sm font-bold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                    {erSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Send Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      <div className="space-y-6">
        {/* Header */}
        <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#2E7D32]">Admissions CRM</p>
              <h1 className="mt-2 text-3xl font-bold text-[#0D1F0E]">Leads</h1>
              <p className="mt-2 max-w-2xl text-base text-slate-500">
                Track every inquiry from first contact through enrollment and payment.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <input ref={fileInputRef} className="hidden" type="file" accept=".csv,text/csv" onChange={importLeads} />
              <button
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#2E7D32] hover:bg-[#E8F5E9] disabled:opacity-60"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
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
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-9">
          {leadStages.map((s) => {
            const cfg = stageConfig[s];
            return (
              <button
                key={s}
                onClick={() => setStage(stage === s ? "all" : s)}
                className={`rounded-xl border p-3 text-center transition hover:shadow-sm ${
                  stage === s ? "border-[#2E7D32] bg-[#E8F5E9] shadow-sm" : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-xl font-bold text-[#0D1F0E]">{stageCounts[s]}</p>
                <div className="mt-1 flex items-center justify-center gap-1">
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <p className="text-[10px] font-semibold text-slate-500 leading-tight">{s}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Alerts */}
        {(notice || error || dupWarning) && (
          <div className="space-y-2">
            {notice && (
              <div className="flex items-center justify-between rounded-xl border border-green-200 bg-[#E8F5E9] px-4 py-3 text-sm font-semibold text-[#2E7D32]">
                <span>{notice}</span>
                <button onClick={() => setNotice("")} type="button"><X className="h-4 w-4" /></button>
              </div>
            )}
            {error && (
              <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                <span>{error}</span>
                <button onClick={() => setError("")} type="button"><X className="h-4 w-4" /></button>
              </div>
            )}
            {dupWarning && (
              <div className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-800">Duplicate phone detected</span>
                  <button onClick={() => setDupWarning(null)} type="button"><X className="h-4 w-4 text-amber-700" /></button>
                </div>
                <p className="text-amber-700">{dupWarning.message}</p>
                {dupWarning.duplicate && (
                  <p className="text-xs text-amber-600">
                    Existing: <strong>{dupWarning.duplicate.fullName}</strong> · {dupWarning.duplicate.stage} · {dupWarning.duplicate.course}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <DateRangePicker from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
          </div>
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
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#2E7D32]"
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
                  setSearch(""); setStage("all"); setSource("all");
                  const r = thisMonthRange(); setDateFrom(r.from); setDateTo(r.to);
                }}
                type="button"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {/* Table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-[#0D1F0E]">Lead Pipeline</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {loading ? "Loading..." : `${leads.length} result${leads.length === 1 ? "" : "s"}${selected.size > 0 ? ` · ${selected.size} selected` : ""}`}
              </p>
            </div>
            {/* Bulk action bar — shows when any leads are selected */}
            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Bulk assign — admin/manager only */}
                {!isSales && (
                  <>
                    <select
                      value={bulkAssignTo}
                      onChange={(e) => setBulkAssignTo(e.target.value)}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#2E7D32]"
                    >
                      <option value="">Assign {selected.size} lead{selected.size > 1 ? "s" : ""} to…</option>
                      {salesUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                    <button onClick={() => void bulkAssign()} disabled={!bulkAssignTo || bulkSaving} type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2E7D32] px-4 text-sm font-bold text-white hover:bg-[#1B5E20] disabled:opacity-50">
                      {bulkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                      Assign
                    </button>
                  </>
                )}
                {/* Bulk follow-up — all roles */}
                <button
                  onClick={() => { setBulkFuOpen(true); setBulkFuError(""); }}
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-700 hover:bg-amber-100"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  Follow-Up {selected.size}
                </button>
                <button onClick={() => setSelected(new Set())} type="button"
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50">
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              </div>
            )}
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
                <p className="text-lg font-bold text-[#0D1F0E]">{hasFilters ? "No matching leads" : "No leads yet"}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {hasFilters ? "Try adjusting your filters." : "Add your first lead to start tracking."}
                </p>
              </div>
              {!hasFilters && (
                <button className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2E7D32] px-5 text-sm font-bold text-white" onClick={openCreateForm} type="button">
                  <Plus className="h-4 w-4" />Add Lead
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    {!isSales && (
                      <th className="w-10 px-3 py-3">
                        <input type="checkbox"
                          checked={selected.size === leads.length && leads.length > 0}
                          onChange={(e) => setSelected(e.target.checked ? new Set(leads.map((l) => l.id)) : new Set())}
                          className="h-4 w-4 rounded border-slate-300 accent-[#2E7D32]" />
                      </th>
                    )}
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
                    const waUrl = whatsappUrl(lead.phone);
                    const notesPreview = lead.notes?.trim().slice(0, 90);
                    const ageDays = leadAgeDays(lead.updatedAt);
                    const isStale = ageDays >= 7 && !["Paid", "Lost", "Enrolled"].includes(lead.stage);
                    return (
                      <tr
                        key={lead.id}
                        className={`transition hover:bg-slate-50/80 ${urgency === "overdue" ? "bg-rose-50/40" : urgency === "today" ? "bg-amber-50/40" : isStale ? "bg-orange-50/30" : ""}`}
                      >
                        {!isSales && (
                          <td className="w-10 px-3 py-4">
                            <input type="checkbox"
                              checked={selected.has(lead.id)}
                              onChange={(e) => {
                                const s = new Set(selected);
                                e.target.checked ? s.add(lead.id) : s.delete(lead.id);
                                setSelected(s);
                              }}
                              className="h-4 w-4 rounded border-slate-300 accent-[#2E7D32]" />
                          </td>
                        )}
                        <td className="px-4 py-4 font-mono text-xs font-semibold text-slate-500">
                          {lead.leadId}
                          {isStale && (
                            <div className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-600">
                              <Clock className="h-2.5 w-2.5" />{ageDays}d
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 max-w-[220px]">
                          <button
                            type="button"
                            onClick={() => openViewPanel(lead)}
                            className="text-left group"
                          >
                            <p className="font-bold text-[#0D1F0E] group-hover:text-[#2E7D32] transition-colors underline-offset-2 group-hover:underline">
                              {lead.fullName}
                            </p>
                          </button>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                            <span>{lead.phone}</span>
                            {waUrl && (
                              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[#2E7D32] hover:underline"
                                onClick={(e) => e.stopPropagation()}>
                                <MessageCircle className="h-3 w-3" />WA
                              </a>
                            )}
                          </div>
                          {notesPreview && (
                            <p className="mt-1 text-[11px] text-slate-500 leading-relaxed line-clamp-2 italic">
                              "{notesPreview}{lead.notes.length > 90 ? "…" : ""}"
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-slate-700">{lead.course === "Other" && lead.customCourse ? lead.customCourse : lead.course}</td>
                        <td className="px-4 py-4">
                          <Badge className={sourceConfig[lead.source]}>{lead.source}</Badge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${stageConfig[lead.stage]?.dot ?? "bg-slate-300"}`} />
                            <Badge className={stageConfig[lead.stage]?.cls ?? "bg-slate-100 text-slate-600 ring-slate-200"}>
                              {lead.stage}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {urgency === "overdue" && (
                            <div className="flex items-center gap-1 text-rose-700">
                              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="text-xs font-bold">Overdue</span>
                            </div>
                          )}
                          {urgency === "today" && (
                            <div className="flex items-center gap-1 text-amber-700">
                              <BellRing className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="text-xs font-bold">Today</span>
                            </div>
                          )}
                          <span className={`text-xs ${urgency === "overdue" ? "text-rose-600" : urgency === "today" ? "text-amber-700" : "text-slate-500"}`}>
                            {formatDate(lead.nextFollowUpDate)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs font-medium text-slate-600">
                          {lead.assignedTo || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-4">
                          <div className="relative flex justify-end gap-1.5">
                            {waUrl && (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setWaMenuId(waMenuId === lead.id ? null : lead.id)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-green-200 bg-[#E8F5E9] text-[#2E7D32] transition hover:bg-green-100"
                                  title="WhatsApp templates">
                                  <MessageCircle className="h-4 w-4" />
                                </button>
                                {waMenuId === lead.id && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setWaMenuId(null)} />
                                    <div className="absolute right-0 top-10 z-50 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                                      <p className="border-b border-slate-100 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">WhatsApp Templates</p>
                                      {[
                                        { label: "Initial contact", text: `Hi ${lead.fullName}! 👋 I'm from Nitaq Academy Sharjah. I noticed you're interested in ${lead.course}. Would you like to know more about our upcoming batches and pricing?` },
                                        { label: "Follow-up reminder", text: `Hi ${lead.fullName}, just following up on your interest in ${lead.course} at Nitaq Academy. Have you had a chance to consider enrolling? I'd love to help you get started! 😊` },
                                        { label: "Share brochure", text: `Hi ${lead.fullName}! I'm sending you the Nitaq Academy brochure for ${lead.course}. Feel free to reach out if you have any questions. We'd be happy to schedule a quick call! 📚` },
                                        { label: "Enrollment offer", text: `Hi ${lead.fullName}! Great news — we have limited seats available for ${lead.course} at Nitaq Academy Sharjah. Enroll now to secure your spot. Reply YES and I'll guide you through the process! 🎓` },
                                        { label: "Payment reminder", text: `Hi ${lead.fullName}, hope you're doing well! This is a friendly reminder about the pending payment for your ${lead.course} enrollment at Nitaq Academy. Please let me know if you need any assistance. 🙏` },
                                      ].map((t) => (
                                        <a
                                          key={t.label}
                                          href={`${waUrl}?text=${encodeURIComponent(t.text)}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={() => setWaMenuId(null)}
                                          className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-[#E8F5E9] transition">
                                          <MessageCircle className="h-3.5 w-3.5 flex-shrink-0 text-[#2E7D32]" />
                                          <span className="font-medium text-slate-700">{t.label}</span>
                                        </a>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 text-amber-600 transition hover:bg-amber-50"
                              onClick={() => openFollowUpFor(lead)}
                              type="button"
                              title="Add follow-up"
                            >
                              <BellRing className="h-4 w-4" />
                            </button>
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-[#2E7D32] hover:bg-[#E8F5E9] hover:text-[#2E7D32]"
                              onClick={() => openEditForm(lead)}
                              type="button"
                              title="Edit lead"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            {lead.stage !== "Enrolled" && lead.stage !== "Paid" && (
                              isSales ? (
                                <button
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-teal-200 text-teal-600 transition hover:bg-teal-50"
                                  onClick={() => openEnrollmentRequest(lead)}
                                  type="button"
                                  title="Request Enrollment"
                                >
                                  <GraduationCap className="h-4 w-4" />
                                </button>
                              ) : (
                                <button
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-teal-200 text-teal-600 transition hover:bg-teal-50 disabled:opacity-40"
                                  onClick={() => void convertToEnrollment(lead)}
                                  type="button"
                                  disabled={converting === lead.id}
                                  title="Convert to Enrollment"
                                >
                                  {converting === lead.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                                </button>
                              )
                            )}
                            {canDelete && (
                              <button
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50"
                                onClick={() => void deleteLead(lead)}
                                type="button"
                                title="Delete lead"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
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

// ── Lead Detail Panel ────────────────────────────────────────────────────────

function LeadDetailPanel({
  lead, timeline, timelineLoading, converting,
  onClose, onEdit, onAddFollowUp, onEditFollowUp, onConvert,
}: {
  lead: Lead | null;
  timeline: FollowUpEntry[];
  timelineLoading: boolean;
  converting: string | null;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  onAddFollowUp: (lead: Lead) => void;
  onEditFollowUp: (fu: FollowUpEntry) => void;
  onConvert: (lead: Lead) => void;
}) {
  if (!lead) return null;
  const waUrl = whatsappUrl(lead.phone);
  const urgency = getFollowUpUrgency(lead.nextFollowUpDate);
  const canConvert = lead.stage !== "Enrolled" && lead.stage !== "Paid";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[#0D1F0E]/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[540px] flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="border-b border-white/10 bg-[#0D1F0E] px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-[#4DB6AC]">Lead Details</p>
              <h2 className="mt-1 text-xl font-bold truncate">{lead.fullName}</h2>
              <div className="mt-1 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${stageConfig[lead.stage]?.dot ?? "bg-slate-400"}`} />
                <span className="text-sm text-slate-300">{lead.stage}</span>
                <span className="text-slate-600">·</span>
                <span className="text-xs text-slate-400 font-mono">{lead.leadId}</span>
              </div>
            </div>
            <button
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50 px-6 py-3">
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-green-200 bg-[#E8F5E9] px-3 text-xs font-bold text-[#2E7D32] hover:bg-green-100 transition">
              <MessageCircle className="h-3.5 w-3.5" />WhatsApp
            </a>
          )}
          <button type="button" onClick={() => onAddFollowUp(lead)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 hover:bg-amber-100 transition">
            <BellRing className="h-3.5 w-3.5" />Add Follow-Up
          </button>
          <button type="button" onClick={() => onEdit(lead)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 transition">
            <Edit3 className="h-3.5 w-3.5" />Edit
          </button>
          {canConvert && (
            <button type="button" onClick={() => onConvert(lead)} disabled={converting === lead.id}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-700 hover:bg-teal-100 transition disabled:opacity-50">
              {converting === lead.id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <GraduationCap className="h-3.5 w-3.5" />}
              Enroll
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Contact info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="Phone">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">{lead.phone || "—"}</span>
                {waUrl && (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[#2E7D32] hover:underline text-xs flex items-center gap-0.5">
                    <MessageCircle className="h-3 w-3" />WA
                  </a>
                )}
              </div>
            </InfoRow>
            <InfoRow label="Email">
              <span className="text-sm font-semibold text-slate-800">{lead.email || "—"}</span>
            </InfoRow>
            <InfoRow label="Course Interest">
              <span className="text-sm font-semibold text-slate-800">{lead.course === "Other" && lead.customCourse ? lead.customCourse : lead.course}</span>
            </InfoRow>
            <InfoRow label="Source">
              <Badge className={sourceConfig[lead.source]}>{lead.source}</Badge>
            </InfoRow>
            <InfoRow label="Stage">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${stageConfig[lead.stage]?.dot ?? "bg-slate-300"}`} />
                <Badge className={stageConfig[lead.stage]?.cls ?? "bg-slate-100 text-slate-600 ring-slate-200"}>
                  {lead.stage}
                </Badge>
              </div>
            </InfoRow>
            <InfoRow label="Assigned To">
              <span className="text-sm font-semibold text-slate-800">{lead.assignedTo || "—"}</span>
            </InfoRow>
            <InfoRow label="Created">
              <span className="text-sm text-slate-600">{formatDate(lead.createdAt)}</span>
            </InfoRow>
            <InfoRow label="Next Follow-Up">
              <span className={`text-sm font-semibold ${
                urgency === "overdue" ? "text-rose-700" :
                urgency === "today" ? "text-amber-700" : "text-slate-800"
              }`}>
                {urgency === "overdue" && "⚠ "}
                {urgency === "today" && "● "}
                {formatDate(lead.nextFollowUpDate)}
              </span>
            </InfoRow>
          </div>

          {/* Notes */}
          {lead.notes && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Notes</p>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
              </div>
            </div>
          )}

          {/* Follow-up timeline */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Follow-Up History</p>
              <button type="button" onClick={() => onAddFollowUp(lead)}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 transition">
                + Add
              </button>
            </div>
            {timelineLoading ? (
              <div className="flex items-center gap-2 py-4 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading history...</span>
              </div>
            ) : timeline.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center">
                <CalendarDays className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No follow-ups recorded yet.</p>
                <button type="button" onClick={() => onAddFollowUp(lead)}
                  className="mt-2 text-xs font-bold text-amber-600 hover:underline">
                  Add the first one →
                </button>
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-200 pl-4 ml-2 space-y-0">
                {timeline.map((fu) => (
                  <div key={fu.id} className="relative pb-4 last:pb-0">
                    <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#2E7D32] shadow" />
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-700">{formatDate(fu.followUpDate)}</span>
                          <span className="text-[10px] rounded-full bg-white border border-slate-200 px-2 py-0.5 font-semibold text-slate-600">{fu.type}</span>
                          <TimelineStatusBadge status={fu.status} />
                        </div>
                        <button
                          type="button"
                          onClick={() => onEditFollowUp(fu)}
                          className="flex-shrink-0 grid h-6 w-6 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                          title="Edit follow-up"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                      {fu.notes && <p className="text-xs text-slate-600 leading-relaxed">{fu.notes}</p>}
                      {fu.assignedTo && <p className="mt-1.5 text-[10px] text-slate-500">by {fu.assignedTo}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex justify-between items-center">
          <span className="text-xs text-slate-400">Updated {formatDate(lead.updatedAt)}</span>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Close
          </button>
        </div>
      </aside>
    </>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">{label}</p>
      {children}
    </div>
  );
}

// ── Lead Edit/Create Drawer ───────────────────────────────────────────────────

function LeadDrawer({
  open, editingLead, form, formError, saving, timeline, timelineLoading,
  onClose, onSubmit, updateForm, onAddFollowUp, onEditFollowUp, isSales, salesUsers,
}: {
  open: boolean;
  editingLead: Lead | null;
  form: LeadFormState;
  formError: string;
  saving: boolean;
  timeline: FollowUpEntry[];
  timelineLoading: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  updateForm: (field: keyof LeadFormState, value: string) => void;
  onAddFollowUp?: () => void;
  onEditFollowUp?: (fu: FollowUpEntry) => void;
  isSales?: boolean;
  salesUsers?: SalesUser[];
}) {
  const [noteInput, setNoteInput] = useState("");
  const [noteLog, setNoteLog] = useState<NoteEntry[]>([]);
  const [noteSaving, setNoteSaving] = useState(false);

  // Sync noteLog from editingLead when drawer opens
  const prevLeadId = useRef<string | null>(null);
  if (editingLead && editingLead.id !== prevLeadId.current) {
    prevLeadId.current = editingLead.id;
    setNoteLog(editingLead.noteLog ?? []);
    setNoteInput("");
  }
  if (!editingLead && prevLeadId.current !== null) {
    prevLeadId.current = null;
    setNoteLog([]);
    setNoteInput("");
  }

  async function appendNote() {
    if (!editingLead || !noteInput.trim()) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/leads/${editingLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appendNote: noteInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setNoteLog(data.lead?.noteLog ?? []);
      setNoteInput("");
    } catch { /* ignore */ }
    finally { setNoteSaving(false); }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-[#0D1F0E]/40 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b border-slate-200 bg-[#0D1F0E] px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#4DB6AC]">Admissions</p>
              <h2 className="mt-1 text-xl font-bold">{editingLead ? `Edit — ${editingLead.fullName}` : "Add New Lead"}</h2>
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/20" onClick={onClose} type="button">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            {formError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{formError}</div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <DrawerField label="Full name" required value={form.fullName} onChange={(v) => updateForm("fullName", v)} placeholder="Student or parent name" />
              <DrawerField label="WhatsApp / Phone" required value={form.phone} onChange={(v) => updateForm("phone", v)} placeholder="+971..." />
              <DrawerField label="Email" type="email" value={form.email} onChange={(v) => updateForm("email", v)} placeholder="name@email.com" />
              <div className={form.course === "Other" ? "sm:col-span-2" : ""}>
                <DrawerSelect label="Course interest" value={form.course} options={courseList} onChange={(v) => { updateForm("course", v); if (v !== "Other") updateForm("customCourse", ""); }} />
                {form.course === "Other" && (
                  <input
                    className="mt-2 h-10 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]"
                    placeholder="Type the course name…"
                    value={form.customCourse}
                    onChange={(e) => updateForm("customCourse", e.target.value)}
                    maxLength={120}
                  />
                )}
              </div>
              <DrawerSelect label="Lead source" value={form.source} options={leadSources} onChange={(v) => updateForm("source", v)} />
              <DrawerSelect label="Stage" value={form.stage} options={leadStages} onChange={(v) => updateForm("stage", v)} />
              <DrawerField label="Next follow-up date" type="date" value={form.nextFollowUpDate} onChange={(v) => updateForm("nextFollowUpDate", v)} />
              {!isSales && (
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Assigned to</span>
                  {salesUsers && salesUsers.length > 0 ? (
                    <select
                      value={form.assignedTo}
                      onChange={(e) => updateForm("assignedTo", e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]"
                    >
                      <option value="">— Unassigned —</option>
                      {salesUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                  ) : (
                    <input
                      className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]"
                      value={form.assignedTo}
                      onChange={(e) => updateForm("assignedTo", e.target.value)}
                      placeholder="Staff name"
                    />
                  )}
                </label>
              )}
            </div>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">Notes</span>
              <textarea
                className="mt-1.5 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]"
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                placeholder="Conversation summary, parent preferences, key info..."
              />
            </label>

            {/* Note log (editing only) */}
            {editingLead && (
              <div>
                <p className="mb-2 text-sm font-bold text-slate-700">Note History</p>
                <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                  {noteLog.length === 0 ? (
                    <p className="text-xs text-slate-400">No notes recorded yet.</p>
                  ) : [...noteLog].reverse().map((n, i) => (
                    <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                      <p className="text-slate-800 leading-relaxed">{n.text}</p>
                      <p className="mt-1 text-slate-400">{n.by} · {new Date(n.at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void appendNote(); }}}
                    placeholder="Add a note and press Enter…"
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]"
                  />
                  <button type="button" onClick={() => void appendNote()} disabled={noteSaving || !noteInput.trim()}
                    className="inline-flex h-9 items-center rounded-xl bg-[#2E7D32] px-3 text-xs font-bold text-white hover:bg-[#1B5E20] disabled:opacity-50">
                    {noteSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                  </button>
                </div>
              </div>
            )}

            {/* Follow-up timeline (editing only) */}
            {editingLead && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-slate-700">Follow-up Timeline</p>
                  {onAddFollowUp && (
                    <button type="button" onClick={onAddFollowUp}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 hover:bg-amber-100 transition">
                      <BellRing className="h-3.5 w-3.5" />
                      Add Follow-up
                    </button>
                  )}
                </div>
                {timelineLoading ? (
                  <div className="flex items-center gap-2 py-4 text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Loading history...</span>
                  </div>
                ) : timeline.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center">
                    <CalendarDays className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No follow-ups recorded yet.</p>
                  </div>
                ) : (
                  <div className="relative space-y-0 border-l-2 border-slate-200 pl-4 ml-2">
                    {timeline.map((fu) => (
                      <div key={fu.id} className="relative pb-4 last:pb-0">
                        <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#2E7D32] shadow" />
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-slate-700">{formatDate(fu.followUpDate)}</span>
                              <span className="text-[10px] rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-600">{fu.type}</span>
                              <TimelineStatusBadge status={fu.status} />
                            </div>
                            {onEditFollowUp && (
                              <button
                                type="button"
                                onClick={() => onEditFollowUp(fu)}
                                className="flex-shrink-0 grid h-6 w-6 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                                title="Edit follow-up"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          {fu.notes && <p className="text-xs text-slate-600 leading-relaxed">{fu.notes}</p>}
                          {fu.assignedTo && <p className="mt-1 text-[10px] text-slate-500">by {fu.assignedTo}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100" onClick={onClose} type="button">
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

function TimelineStatusBadge({ status }: { status: string }) {
  const cls =
    status === "Done" ? "bg-[#E8F5E9] text-[#2E7D32]" :
    status === "Pending" ? "bg-amber-50 text-amber-700" :
    status === "No Response" ? "bg-rose-50 text-rose-600" :
    "bg-slate-100 text-slate-600";
  return <span className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${cls}`}>{status}</span>;
}

// ── Follow-Up Add Drawer ──────────────────────────────────────────────────────

function FollowUpDrawer({
  open, lead, isEditing, form, saving, error, onClose, onSubmit, updateForm,
}: {
  open: boolean;
  lead: Lead | null;
  isEditing?: boolean;
  form: FuFormState;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  updateForm: (field: keyof FuFormState, value: string) => void;
}) {
  const waUrl = lead ? whatsappUrl(lead.phone) : null;
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-[#0D1F0E]/40 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[500px] flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b border-slate-200 bg-[#0D1F0E] px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Follow-Up</p>
              <h2 className="mt-1 text-xl font-bold">{isEditing ? "Edit Follow-Up" : "Add Follow-Up"}</h2>
              {lead && <p className="mt-0.5 text-sm text-slate-300">for {lead.fullName}</p>}
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/20" onClick={onClose} type="button">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {lead && (
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="font-semibold">{lead.phone}</span>
              {waUrl && (
                <a href={waUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#2E7D32] font-semibold hover:underline">
                  <MessageCircle className="h-3.5 w-3.5" />WhatsApp
                </a>
              )}
              <span className="text-slate-400">·</span>
              <span>{lead.course}</span>
              <span className="text-slate-400">·</span>
              <Badge className={stageConfig[lead.stage]?.cls ?? "bg-slate-100 text-slate-600 ring-slate-200"}>
                {lead.stage}
              </Badge>
            </div>
          </div>
        )}

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <DrawerField label="Follow-up date" type="date" required value={form.followUpDate} onChange={(v) => updateForm("followUpDate", v)} />
              <DrawerSelectRaw label="Type" value={form.type} options={followUpTypes} onChange={(v) => updateForm("type", v)} />
              <DrawerSelectRaw label="Status / Outcome" value={form.status} options={followUpStatuses} onChange={(v) => updateForm("status", v)} />
              <DrawerField label="Assigned to" value={form.assignedTo} onChange={(v) => updateForm("assignedTo", v)} placeholder="Staff name" />
            </div>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">What happened / Notes</span>
              <textarea
                className="mt-1.5 min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]"
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                placeholder="What was discussed? Outcome? Next steps?"
              />
            </label>
          </div>
          <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <ChevronRight className="h-4 w-4" />
              {isEditing ? "Save Changes" : "Save Follow-Up"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function DrawerField({ label, value, onChange, required = false, type = "text", placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}{required ? " *" : ""}</span>
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

function DrawerSelect({ label, value, options, onChange }: {
  label: string; value: string; options: readonly string[]; onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <select className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]" onChange={(e) => onChange(e.target.value)} value={value}>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </label>
  );
}

function DrawerSelectRaw({ label, value, options, onChange }: {
  label: string; value: string; options: readonly string[]; onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <select className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]" onChange={(e) => onChange(e.target.value)} value={value}>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </label>
  );
}

function Select({ value, onChange, label, options }: {
  value: string; onChange: (v: string) => void; label: string; options: readonly string[];
}) {
  return (
    <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]" onChange={(e) => onChange(e.target.value)} value={value}>
      <option value="all">{label}</option>
      {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${className}`}>
      {children}
    </span>
  );
}
