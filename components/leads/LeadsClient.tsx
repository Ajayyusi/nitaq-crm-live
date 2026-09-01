"use client";

import {
  ChangeEvent,
  FormEvent,
  ReactNode,
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
  GraduationCap,
  MessageCircle,
  Pencil,
  Plus,
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
import DatePicker from "@/components/shared/DatePicker";
import { thisMonthRange } from "@/lib/dateRange";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Input, Textarea, Select, Field, SearchInput } from "@/components/ui/input";
import { Dialog, Drawer, ConfirmDialog } from "@/components/ui/dialog";
import {
  TableShell,
  Table,
  THead,
  Th,
  Tr,
  Td,
  TableFooter,
  usePagination,
  Pagination,
} from "@/components/ui/table";
import { Spinner, SkeletonRows, LoadError } from "@/components/ui/feedback";

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

type LeadFieldErrors = Partial<Record<"fullName" | "phone", string>>;

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

/* Stage → annunciator vocabulary (semantic variants, not colors). */
const stageLamp: Record<LeadStage, LampVariant> = {
  Lead: "advisory",
  Contacted: "advisory",
  Interested: "ok",
  "Not Interested": "off",
  "Not Connecting": "caution",
  "Not Answering": "caution",
  "Invalid Number": "alert",
  Enrolled: "ok",
  Paid: "ok",
  Lost: "off",
};

const stageDot: Record<LampVariant, string> = {
  ok: "bg-phos",
  caution: "bg-caution",
  alert: "bg-alert",
  advisory: "bg-advisory",
  off: "bg-faint",
};

const fuStatusLamp: Record<string, LampVariant> = {
  Pending: "caution",
  Done: "ok",
  "No Response": "alert",
  Rescheduled: "off",
};

/* WhatsApp outreach templates — message text is a preserved business contract. */
function waTemplates(lead: Lead) {
  return [
    { label: "Initial contact", text: `Hi ${lead.fullName}! 👋 I'm from Nitaq Academy Sharjah. I noticed you're interested in ${lead.course}. Would you like to know more about our upcoming batches and pricing?` },
    { label: "Follow-up reminder", text: `Hi ${lead.fullName}, just following up on your interest in ${lead.course} at Nitaq Academy. Have you had a chance to consider enrolling? I'd love to help you get started! 😊` },
    { label: "Share brochure", text: `Hi ${lead.fullName}! I'm sending you the Nitaq Academy brochure for ${lead.course}. Feel free to reach out if you have any questions. We'd be happy to schedule a quick call! 📚` },
    { label: "Enrollment offer", text: `Hi ${lead.fullName}! Great news — we have limited seats available for ${lead.course} at Nitaq Academy Sharjah. Enroll now to secure your spot. Reply YES and I'll guide you through the process! 🎓` },
    { label: "Payment reminder", text: `Hi ${lead.fullName}, hope you're doing well! This is a friendly reminder about the pending payment for your ${lead.course} enrollment at Nitaq Academy. Please let me know if you need any assistance. 🙏` },
  ];
}

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

// Plain "open chat" link (no message) — normalises the number so UAE local
// formats like 05xxxxxxxx still resolve to a valid international wa.me link.
function whatsappUrl(phone: string) {
  return buildWhatsAppUrl(phone);
}

function leadAgeDays(updatedAt: string): number {
  if (!updatedAt) return 0;
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000);
}

function courseLabel(lead: Lead) {
  return lead.course === "Other" && lead.customCourse ? lead.customCourse : lead.course;
}

export default function LeadsClient({ role = "sales" }: { role?: string }) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [dateFrom, setDateFrom] = useState(() => thisMonthRange().from);
  const [dateTo, setDateTo] = useState(() => thisMonthRange().to);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState("");
  const [converting, setConverting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LeadFieldErrors>({});
  const [notice, setNotice] = useState("");

  // Lead detail view panel
  const [viewLead, setViewLead] = useState<Lead | null>(null);
  const [viewTimeline, setViewTimeline] = useState<FollowUpEntry[]>([]);
  const [viewTimelineLoading, setViewTimelineLoading] = useState(false);
  const [viewTimelineError, setViewTimelineError] = useState("");

  // Lead edit/create drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadFormState>(emptyForm);
  // Timeline inside edit drawer
  const [timeline, setTimeline] = useState<FollowUpEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState("");

  // Follow-up add/edit drawer
  const [fuDrawerOpen, setFuDrawerOpen] = useState(false);
  const [fuLead, setFuLead] = useState<Lead | null>(null);
  const [fuEditId, setFuEditId] = useState<string | null>(null);
  const [fuForm, setFuForm] = useState<FuFormState>(emptyFuForm);
  const [fuSaving, setFuSaving] = useState(false);
  const [fuError, setFuError] = useState("");
  const [fuDateError, setFuDateError] = useState("");

  // Enrollment request modal (sales only)
  const [erModalOpen, setErModalOpen] = useState(false);
  const [erLead, setErLead] = useState<Lead | null>(null);
  const [erNotes, setErNotes] = useState("");
  const [erStartDate, setErStartDate] = useState("");
  const [erSaving, setErSaving] = useState(false);
  const [erError, setErError] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const isSales = role === "sales";
  const canDelete = role === "admin" || role === "manager";

  // Sales users list for assignment dropdown (admin/manager only).
  // On failure the drawer degrades to a free-text assignee input.
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

  // Keep the follow-up drawer's open state in a ref so the drawers layered
  // beneath it can ignore ESC/close while it is on top.
  const fuOpenRef = useRef(false);
  useEffect(() => {
    fuOpenRef.current = fuDrawerOpen;
  }, [fuDrawerOpen]);

  // Debounce the search box (300ms) before it hits the API.
  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

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
    searchInput.trim() || stage !== "all" || source !== "all" ||
    dateFrom !== defaultRange.from || dateTo !== defaultRange.to
  );

  async function loadLeads() {
    setLoading(true);
    setLoadFailed("");
    try {
      const res = await fetch(`/api/leads?${queryString}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw data;
      setLeads(data.leads ?? []);
    } catch (caught) {
      setLoadFailed(getErrorMessage(caught, "Couldn't load leads. Check your connection and retry."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  // ── Lead detail view ─────────────────────────────────────────────────────────

  function loadViewTimeline(leadId: string) {
    setViewTimelineLoading(true);
    setViewTimelineError("");
    fetch(`/api/leads/${leadId}/follow-ups`)
      .then((r) => r.json())
      .then((d) => setViewTimeline(d.followUps ?? []))
      .catch(() => setViewTimelineError("Couldn't load the follow-up history."))
      .finally(() => setViewTimelineLoading(false));
  }

  function openViewPanel(lead: Lead) {
    setViewLead(lead);
    setViewTimeline([]);
    loadViewTimeline(lead.id);
  }

  // ── Lead drawer ──────────────────────────────────────────────────────────────

  function loadEditTimeline(leadId: string) {
    setTimelineLoading(true);
    setTimelineError("");
    fetch(`/api/leads/${leadId}/follow-ups`)
      .then((r) => r.json())
      .then((d) => setTimeline(d.followUps ?? []))
      .catch(() => setTimelineError("Couldn't load the follow-up history."))
      .finally(() => setTimelineLoading(false));
  }

  function openCreateForm() {
    setEditingLead(null);
    setForm(emptyForm);
    setFormError("");
    setFieldErrors({});
    setNotice("");
    setTimeline([]);
    setDrawerOpen(true);
  }

  function openEditForm(lead: Lead) {
    setEditingLead(lead);
    setForm(asLeadForm(lead));
    setFormError("");
    setFieldErrors({});
    setNotice("");
    setTimeline([]);
    setDrawerOpen(true);
    loadEditTimeline(lead.id);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingLead(null);
    setFormError("");
    setFieldErrors({});
    setTimeline([]);
  }

  function updateForm(field: keyof LeadFormState, value: string) {
    setForm((cur) => ({ ...cur, [field]: value }));
    if (field === "fullName" || field === "phone") {
      setFieldErrors((cur) => ({ ...cur, [field]: undefined }));
    }
  }

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errs: LeadFieldErrors = {};
    if (!form.fullName.trim()) errs.fullName = "Full name is required.";
    if (!form.phone.trim()) errs.phone = "Phone number is required.";
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
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
      setFormError(getErrorMessage(caught, "Couldn't save the lead. Try again."));
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
    setFuDateError("");
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
    setFuDateError("");
    setFuDrawerOpen(true);
  }

  async function saveFollowUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fuLead) return;
    if (!fuForm.followUpDate) {
      setFuDateError("Pick a follow-up date.");
      return;
    }
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
      if (viewLead) loadViewTimeline(viewLead.id);
      if (editingLead) loadEditTimeline(editingLead.id);
      await loadLeads();
    } catch (caught) {
      setFuError(getErrorMessage(caught, "Couldn't save the follow-up. Try again."));
    } finally {
      setFuSaving(false);
    }
  }

  // ── Lead actions ─────────────────────────────────────────────────────────────

  async function confirmDeleteLead() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/leads/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw data;
      setNotice("Lead deleted.");
      await loadLeads();
    } catch (caught) {
      setError(getErrorMessage(caught, "Couldn't delete the lead. Try again."));
    } finally {
      setDeleteBusy(false);
      setDeleteTarget(null);
    }
  }

  async function convertToEnrollment(lead: Lead) {
    setConverting(lead.id);
    setError("");
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "Enrolled" }),
      });
      const data = await res.json();
      await loadLeads();
      if (isSales) {
        // Sales don't have access to the enrollments page — the enrollment
        // record was created server-side; admin/manager completes the details.
        setError("");
      } else if (data.enrollmentId) {
        router.push(`/enrollments?new=${data.enrollmentId}`);
      } else {
        router.push("/enrollments");
      }
    } catch {
      setError("Couldn't start the conversion. Try again.");
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
      setErError(getErrorMessage(caught, "Couldn't submit the request. Try again."));
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
      setError("Bulk assignment failed. Try again.");
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
      setBulkFuError("Couldn't create the follow-ups. Try again.");
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
      setError(getErrorMessage(caught, "Couldn't export the leads. Try again."));
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
      setError(getErrorMessage(caught, "Couldn't import the file. Check the CSV and try again."));
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

  const { slice: pageLeads, page, pages, setPage, total } = usePagination(leads, 50);

  return (
    <>
      {/* Bulk follow-up modal */}
      <Dialog
        open={bulkFuOpen}
        onClose={() => setBulkFuOpen(false)}
        title={`Add Follow-Up for ${selected.size} Lead${selected.size > 1 ? "s" : ""}`}
        guarded
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setBulkFuOpen(false)} disabled={bulkFuSaving}>
              Cancel
            </Button>
            <Button variant="solid" type="button" onClick={() => void bulkFollowUp()} disabled={bulkFuSaving || !bulkFuDate}>
              {bulkFuSaving ? <Spinner className="h-3.5 w-3.5" /> : <BellRing className="h-4 w-4" />}
              Create {selected.size} Follow-Up{selected.size > 1 ? "s" : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {bulkFuError && (
            <div role="alert" className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2.5 text-sm font-semibold text-alert">
              {bulkFuError}
            </div>
          )}
          <div className="rounded-ctl border border-caution/30 bg-[var(--lamp-caution-bg)] px-3 py-2.5 text-sm text-dim">
            One follow-up will be created for each of the{" "}
            <strong className="text-ink" data-numeric>{selected.size}</strong> selected leads using the settings below.
          </div>
          <Field label="Follow-Up Date" required>
            <DatePicker required value={bulkFuDate} onChange={setBulkFuDate} />
          </Field>
          <Field label="Type">
            <Select value={bulkFuType} onChange={(e) => setBulkFuType(e.target.value)}>
              {followUpTypes.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Notes / Script">
            <Textarea
              value={bulkFuNotes}
              onChange={(e) => setBulkFuNotes(e.target.value)}
              rows={3}
              placeholder="What to say, key points, context…"
            />
          </Field>
        </div>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteLead()}
        title="Delete Lead"
        message={deleteTarget ? `Delete the lead for ${deleteTarget.fullName}? This cannot be undone.` : ""}
        confirmLabel="Delete"
        busy={deleteBusy}
      />

      {/* Lead detail panel */}
      <LeadDetailPanel
        lead={viewLead}
        timeline={viewTimeline}
        timelineLoading={viewTimelineLoading}
        timelineError={viewTimelineError}
        onRetryTimeline={() => { if (viewLead) loadViewTimeline(viewLead.id); }}
        converting={converting}
        onClose={() => { if (fuOpenRef.current) return; setViewLead(null); }}
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
        fieldErrors={fieldErrors}
        saving={saving}
        timeline={timeline}
        timelineLoading={timelineLoading}
        timelineError={timelineError}
        onRetryTimeline={() => { if (editingLead) loadEditTimeline(editingLead.id); }}
        onClose={() => { if (fuOpenRef.current) return; closeDrawer(); }}
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
        dateError={fuDateError}
        onClose={() => { setFuDrawerOpen(false); setFuEditId(null); }}
        onSubmit={saveFollowUp}
        updateForm={(f, v) => {
          setFuForm((cur) => ({ ...cur, [f]: v }));
          if (f === "followUpDate") setFuDateError("");
        }}
      />

      {/* Enrollment Request modal (sales only) */}
      <Dialog
        open={erModalOpen && !!erLead}
        onClose={() => setErModalOpen(false)}
        title={erLead ? `Request Enrollment — ${erLead.fullName}` : "Request Enrollment"}
        guarded
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setErModalOpen(false)} disabled={erSaving}>
              Cancel
            </Button>
            <Button variant="solid" type="submit" form="enrollment-request-form" disabled={erSaving}>
              {erSaving && <Spinner className="h-3.5 w-3.5" />}
              Send Request
            </Button>
          </>
        }
      >
        {erLead && (
          <form id="enrollment-request-form" onSubmit={submitEnrollmentRequest} className="space-y-4">
            {erError && (
              <div role="alert" className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2.5 text-sm font-semibold text-alert">
                {erError}
              </div>
            )}
            <div className="space-y-1 rounded-ctl border border-bezel bg-well p-4 text-sm">
              <p><span className="font-bold text-dim">Lead:</span> <span className="text-ink">{erLead.fullName}</span></p>
              <p><span className="font-bold text-dim">Phone:</span> <span className="text-ink" data-numeric>{erLead.phone}</span></p>
              <p><span className="font-bold text-dim">Course:</span> <span className="text-ink">{erLead.course}</span></p>
            </div>
            <Field label="Expected Start Date" help="Optional">
              <DatePicker value={erStartDate} onChange={setErStartDate} placeholder="Select start date" />
            </Field>
            <Field label="Notes for Admin / Manager">
              <Textarea
                value={erNotes}
                onChange={(e) => setErNotes(e.target.value)}
                rows={3}
                placeholder="Any special notes, agreed pricing discussion, parent preferences..."
              />
            </Field>
          </form>
        )}
      </Dialog>

      <div className="space-y-4">
        <PageHeader
          title="Leads"
          subtitle="Track every inquiry from first contact through enrollment and payment."
          actions={
            <>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept=".csv,text/csv"
                onChange={importLeads}
                tabIndex={-1}
                aria-hidden="true"
              />
              <Button variant="secondary" disabled={importing} onClick={() => fileInputRef.current?.click()}>
                {importing ? <Spinner className="h-3.5 w-3.5" /> : <Upload className="h-4 w-4" />}
                Import CSV
              </Button>
              <Button variant="secondary" onClick={() => void exportLeads()}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="solid" onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
                Add Lead
              </Button>
            </>
          }
        />

        {/* Stage pipeline strip */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-10" role="group" aria-label="Filter by stage">
          {leadStages.map((s) => {
            const active = stage === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStage(active ? "all" : s)}
                aria-pressed={active}
                className={`face p-3 text-center transition-all duration-150 hover:border-bezel-strong ${
                  active ? "border-phos shadow-glow" : ""
                }`}
              >
                <p className="readout text-xl font-bold text-ink" data-numeric>{stageCounts[s]}</p>
                <div className="mt-1 flex items-center justify-center gap-1">
                  <span aria-hidden className={`h-1.5 w-1.5 flex-shrink-0 rounded-lamp ${stageDot[stageLamp[s]]}`} />
                  <span className="placard leading-tight">{s}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Alerts */}
        {(notice || error || dupWarning) && (
          <div className="space-y-2">
            {notice && (
              <div role="status" className="flex items-center justify-between gap-2 rounded-ctl border border-phos/30 bg-[var(--lamp-ok-bg)] px-3 py-2 text-sm font-semibold text-phos">
                <span>{notice}</span>
                <Button variant="ghost" size="iconSm" onClick={() => setNotice("")} aria-label="Dismiss message">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {error && (
              <div role="alert" className="flex items-center justify-between gap-2 rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2 text-sm font-semibold text-alert">
                <span>{error}</span>
                <Button variant="ghost" size="iconSm" onClick={() => setError("")} aria-label="Dismiss error">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {dupWarning && (
              <div role="alert" className="rounded-ctl border border-caution/30 bg-[var(--lamp-caution-bg)] px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-caution">Duplicate phone detected</span>
                  <Button variant="ghost" size="iconSm" onClick={() => setDupWarning(null)} aria-label="Dismiss duplicate warning">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-dim">{dupWarning.message}</p>
                {dupWarning.duplicate && (
                  <p className="mt-0.5 text-xs text-faint">
                    Existing: <strong className="text-ink">{dupWarning.duplicate.fullName}</strong> · {dupWarning.duplicate.stage} · {dupWarning.duplicate.course}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
          </div>
          <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_160px_auto]">
            <SearchInput
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, phone, or lead ID"
              aria-label="Search leads"
            />
            <Select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter by stage">
              <option value="all">All Stages</option>
              {leadStages.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
            <Select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by source">
              <option value="all">All Sources</option>
              {leadSources.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortOrder)} aria-label="Sort order">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchInput(""); setSearch(""); setStage("all"); setSource("all");
                  const r = thisMonthRange(); setDateFrom(r.from); setDateTo(r.to);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </Card>

        {/* Bulk action bar — shows when any leads are selected */}
        {selected.size > 0 && (
          <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
            <span className="text-sm font-semibold text-ink" aria-live="polite" data-numeric>
              {selected.size} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {/* Bulk assign — admin/manager only */}
              {!isSales && (
                <>
                  <Select
                    value={bulkAssignTo}
                    onChange={(e) => setBulkAssignTo(e.target.value)}
                    aria-label="Assign selected leads to"
                    className="w-56"
                  >
                    <option value="">Assign {selected.size} lead{selected.size > 1 ? "s" : ""} to…</option>
                    {salesUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                  </Select>
                  <Button variant="primary" size="sm" onClick={() => void bulkAssign()} disabled={!bulkAssignTo || bulkSaving}>
                    {bulkSaving ? <Spinner className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                    Assign
                  </Button>
                </>
              )}
              {/* Bulk follow-up — all roles */}
              <Button variant="primary" size="sm" onClick={() => { setBulkFuOpen(true); setBulkFuError(""); }}>
                <BellRing className="h-3.5 w-3.5" />
                Follow-Up {selected.size}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </Card>
        )}

        {/* Table */}
        {loading ? (
          <TableShell>
            <SkeletonRows rows={8} cols={6} />
          </TableShell>
        ) : loadFailed ? (
          <LoadError message={loadFailed} onRetry={() => void loadLeads()} />
        ) : leads.length === 0 ? (
          <TableShell>
            <EmptyState
              icon={UserPlus}
              title={hasFilters ? "No Matching Leads" : "No Leads Yet"}
              description={hasFilters ? "Try adjusting your filters." : "Add your first lead to start tracking."}
              action={
                !hasFilters ? (
                  <Button variant="primary" onClick={openCreateForm}>
                    <Plus className="h-4 w-4" />
                    Add Lead
                  </Button>
                ) : undefined
              }
            />
          </TableShell>
        ) : (
          <TableShell>
            <Table>
              <THead>
                <tr>
                  {!isSales && (
                    <Th className="w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === leads.length && leads.length > 0}
                        onChange={(e) => setSelected(e.target.checked ? new Set(leads.map((l) => l.id)) : new Set())}
                        className="h-4 w-4 accent-phos"
                        aria-label="Select all leads"
                      />
                    </Th>
                  )}
                  <Th>ID</Th>
                  <Th>Lead</Th>
                  <Th>Course</Th>
                  <Th>Source</Th>
                  <Th>Stage</Th>
                  <Th>Follow-Up</Th>
                  <Th>Assigned</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </THead>
              <tbody>
                {pageLeads.map((lead) => {
                  const urgency = getFollowUpUrgency(lead.nextFollowUpDate);
                  const waUrl = whatsappUrl(lead.phone);
                  const notesPreview = lead.notes?.trim().slice(0, 90);
                  const ageDays = leadAgeDays(lead.updatedAt);
                  const isStale = ageDays >= 7 && !["Paid", "Lost", "Enrolled"].includes(lead.stage);
                  return (
                    <Tr
                      key={lead.id}
                      clickable
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button, a, input, [role='menu']")) return;
                        openViewPanel(lead);
                      }}
                    >
                      {!isSales && (
                        <Td className="w-10">
                          <input
                            type="checkbox"
                            checked={selected.has(lead.id)}
                            onChange={(e) => {
                              const s = new Set(selected);
                              if (e.target.checked) s.add(lead.id);
                              else s.delete(lead.id);
                              setSelected(s);
                            }}
                            className="h-4 w-4 accent-phos"
                            aria-label={`Select ${lead.fullName}`}
                          />
                        </Td>
                      )}
                      <Td className="whitespace-nowrap align-top">
                        <span className="readout text-xs font-semibold text-dim" data-numeric>{lead.leadId}</span>
                        {isStale && (
                          <span
                            className="mt-1 flex items-center gap-0.5 text-[10px] font-bold text-caution"
                            title={`No activity for ${ageDays} days`}
                          >
                            <Clock className="h-2.5 w-2.5" aria-hidden />
                            {ageDays}d
                          </span>
                        )}
                      </Td>
                      <Td className="max-w-[240px] align-top">
                        <button type="button" onClick={() => openViewPanel(lead)} className="group flex max-w-full items-center gap-1 text-left">
                          <span className="truncate font-bold text-ink underline-offset-2 transition-colors group-hover:text-phos group-hover:underline">
                            {lead.fullName}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-faint transition-colors group-hover:text-phos" aria-hidden />
                        </button>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-dim">
                          <span data-numeric>{lead.phone}</span>
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open WhatsApp chat with ${lead.fullName}`}
                              className="inline-flex items-center gap-0.5 text-phos hover:underline"
                            >
                              <MessageCircle className="h-3 w-3" aria-hidden />
                              WA
                            </a>
                          )}
                        </span>
                        {notesPreview && (
                          <p className="mt-1 line-clamp-2 text-[11px] italic leading-relaxed text-faint" title={lead.notes}>
                            "{notesPreview}{lead.notes.length > 90 ? "…" : ""}"
                          </p>
                        )}
                      </Td>
                      <Td className="max-w-[180px]">
                        <span className="block truncate text-sm text-ink" title={courseLabel(lead)}>{courseLabel(lead)}</span>
                      </Td>
                      <Td>
                        <span className="text-xs text-dim">{lead.source}</span>
                      </Td>
                      <Td>
                        <Lamp variant={stageLamp[lead.stage] ?? "off"}>{lead.stage}</Lamp>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {urgency === "overdue" && <Lamp variant="alert">Overdue</Lamp>}
                        {urgency === "today" && <Lamp variant="caution">Today</Lamp>}
                        <span
                          className={`block text-xs ${
                            urgency === "overdue"
                              ? "mt-1 font-semibold text-alert"
                              : urgency === "today"
                                ? "mt-1 font-semibold text-caution"
                                : "text-dim"
                          }`}
                          data-numeric
                        >
                          {formatDate(lead.nextFollowUpDate)}
                        </span>
                      </Td>
                      <Td className="text-xs text-dim">
                        {lead.assignedTo || <span className="text-faint">—</span>}
                      </Td>
                      <Td>
                        <div className="relative flex justify-end gap-1">
                          {waUrl && (
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="iconSm"
                                onClick={() => setWaMenuId(waMenuId === lead.id ? null : lead.id)}
                                className="text-phos hover:text-phos"
                                aria-label={`WhatsApp templates for ${lead.fullName}`}
                                aria-haspopup="menu"
                                aria-expanded={waMenuId === lead.id}
                                title="WhatsApp templates"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                              {waMenuId === lead.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={(e) => { e.stopPropagation(); setWaMenuId(null); }}
                                    aria-hidden="true"
                                  />
                                  <div
                                    role="menu"
                                    aria-label="WhatsApp message templates"
                                    className="absolute right-0 top-10 z-50 w-64 overflow-hidden rounded-card border border-bezel bg-raised shadow-raise"
                                  >
                                    <p className="placard border-b border-bezel px-4 py-2.5">WhatsApp Templates</p>
                                    {waTemplates(lead).map((t) => (
                                      <a
                                        key={t.label}
                                        role="menuitem"
                                        href={buildWhatsAppUrl(lead.phone, t.text) ?? "#"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setWaMenuId(null)}
                                        className="flex w-full items-center gap-3 border-b border-bezel/60 px-4 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-well"
                                      >
                                        <MessageCircle className="h-3.5 w-3.5 flex-shrink-0 text-phos" aria-hidden />
                                        <span className="font-medium text-ink">{t.label}</span>
                                      </a>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() => openFollowUpFor(lead)}
                            aria-label={`Add follow-up for ${lead.fullName}`}
                            title="Add follow-up"
                          >
                            <BellRing className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() => openEditForm(lead)}
                            aria-label={`Edit ${lead.fullName}`}
                            title="Edit lead"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {lead.stage !== "Enrolled" && lead.stage !== "Paid" && (
                            isSales ? (
                              <Button
                                variant="ghost"
                                size="iconSm"
                                onClick={() => openEnrollmentRequest(lead)}
                                className="text-advisory hover:text-advisory"
                                aria-label={`Request enrollment for ${lead.fullName}`}
                                title="Request enrollment"
                              >
                                <GraduationCap className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="iconSm"
                                onClick={() => void convertToEnrollment(lead)}
                                disabled={converting === lead.id}
                                className="text-advisory hover:text-advisory"
                                aria-label={`Convert ${lead.fullName} to enrollment`}
                                title="Convert to enrollment"
                              >
                                {converting === lead.id ? <Spinner className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
                              </Button>
                            )
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => setDeleteTarget(lead)}
                              className="text-alert hover:text-alert"
                              aria-label={`Delete ${lead.fullName}`}
                              title="Delete lead"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <TableFooter>
              <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={pageLeads.length} />
            </TableFooter>
          </TableShell>
        )}
      </div>
    </>
  );
}

// ── Lead Detail Panel ────────────────────────────────────────────────────────

function LeadDetailPanel({
  lead, timeline, timelineLoading, timelineError, onRetryTimeline, converting,
  onClose, onEdit, onAddFollowUp, onEditFollowUp, onConvert,
}: {
  lead: Lead | null;
  timeline: FollowUpEntry[];
  timelineLoading: boolean;
  timelineError: string;
  onRetryTimeline: () => void;
  converting: string | null;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  onAddFollowUp: (lead: Lead) => void;
  onEditFollowUp: (fu: FollowUpEntry) => void;
  onConvert: (lead: Lead) => void;
}) {
  const waUrl = lead ? whatsappUrl(lead.phone) : null;
  const urgency = lead ? getFollowUpUrgency(lead.nextFollowUpDate) : null;
  const canConvert = lead ? lead.stage !== "Enrolled" && lead.stage !== "Paid" : false;

  return (
    <Drawer
      open={!!lead}
      onClose={onClose}
      title={lead?.fullName ?? "Lead Details"}
      size="lg"
      guarded={false}
      footer={
        lead ? (
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-xs text-faint">Updated {formatDate(lead.updatedAt)}</span>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : undefined
      }
    >
      {lead && (
        <div className="space-y-6">
          {/* Identity strip */}
          <div className="flex flex-wrap items-center gap-2">
            <Lamp variant={stageLamp[lead.stage] ?? "off"}>{lead.stage}</Lamp>
            <span className="readout text-xs text-dim" data-numeric>{lead.leadId}</span>
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap gap-2">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 select-none items-center gap-2 rounded-ctl border border-phos/60 px-3 text-xs font-bold uppercase tracking-[0.08em] text-phos transition-colors hover:bg-phos hover:text-phos-ink"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                WhatsApp
              </a>
            )}
            <Button variant="secondary" size="sm" onClick={() => onAddFollowUp(lead)}>
              <BellRing className="h-3.5 w-3.5" />
              Add Follow-Up
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onEdit(lead)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            {canConvert && (
              <Button variant="primary" size="sm" onClick={() => onConvert(lead)} disabled={converting === lead.id}>
                {converting === lead.id
                  ? <Spinner className="h-3.5 w-3.5" />
                  : <GraduationCap className="h-3.5 w-3.5" />}
                Enroll
              </Button>
            )}
          </div>

          {/* Contact info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="Phone">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink" data-numeric>{lead.phone || "—"}</span>
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open WhatsApp chat with ${lead.fullName}`}
                    className="flex items-center gap-0.5 text-xs text-phos hover:underline"
                  >
                    <MessageCircle className="h-3 w-3" aria-hidden />
                    WA
                  </a>
                )}
              </div>
            </InfoRow>
            <InfoRow label="Email">
              <span className="break-all text-sm font-semibold text-ink">{lead.email || "—"}</span>
            </InfoRow>
            <InfoRow label="Course Interest">
              <span className="text-sm font-semibold text-ink">{courseLabel(lead)}</span>
            </InfoRow>
            <InfoRow label="Source">
              <span className="text-sm font-semibold text-ink">{lead.source}</span>
            </InfoRow>
            <InfoRow label="Stage">
              <Lamp variant={stageLamp[lead.stage] ?? "off"}>{lead.stage}</Lamp>
            </InfoRow>
            <InfoRow label="Assigned To">
              <span className="text-sm font-semibold text-ink">{lead.assignedTo || "—"}</span>
            </InfoRow>
            <InfoRow label="Created">
              <span className="text-sm text-dim" data-numeric>{formatDate(lead.createdAt)}</span>
            </InfoRow>
            <InfoRow label="Next Follow-Up">
              <div className="flex items-center gap-2">
                {urgency === "overdue" && <Lamp variant="alert">Overdue</Lamp>}
                {urgency === "today" && <Lamp variant="caution">Today</Lamp>}
                <span
                  className={`text-sm font-semibold ${
                    urgency === "overdue" ? "text-alert" : urgency === "today" ? "text-caution" : "text-ink"
                  }`}
                  data-numeric
                >
                  {formatDate(lead.nextFollowUpDate)}
                </span>
              </div>
            </InfoRow>
          </div>

          {/* Notes */}
          {lead.notes && (
            <div>
              <p className="placard mb-2">Notes</p>
              <div className="rounded-ctl border border-bezel bg-well px-4 py-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{lead.notes}</p>
              </div>
            </div>
          )}

          {/* Follow-up timeline */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="placard">Follow-Up History</p>
              <Button variant="ghost" size="sm" onClick={() => onAddFollowUp(lead)}>
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            <FollowUpTimeline
              timeline={timeline}
              loading={timelineLoading}
              error={timelineError}
              onRetry={onRetryTimeline}
              onEdit={onEditFollowUp}
              emptyAction={
                <Button variant="link" size="sm" onClick={() => onAddFollowUp(lead)}>
                  Add the first one
                </Button>
              }
            />
          </div>
        </div>
      )}
    </Drawer>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="placard mb-0.5">{label}</p>
      {children}
    </div>
  );
}

// ── Follow-up timeline (shared by detail panel + edit drawer) ────────────────

function FollowUpTimeline({
  timeline, loading, error, onRetry, onEdit, emptyAction,
}: {
  timeline: FollowUpEntry[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onEdit?: (fu: FollowUpEntry) => void;
  emptyAction?: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-faint">
        <Spinner />
        <span className="text-xs">Loading history...</span>
      </div>
    );
  }
  if (error) {
    return <LoadError message={error} onRetry={onRetry} className="py-6" />;
  }
  if (timeline.length === 0) {
    return (
      <div className="rounded-ctl border border-dashed border-bezel py-6 text-center">
        <CalendarDays className="mx-auto mb-2 h-6 w-6 text-faint" aria-hidden />
        <p className="text-xs text-dim">No follow-ups recorded yet.</p>
        {emptyAction && <div className="mt-1">{emptyAction}</div>}
      </div>
    );
  }
  return (
    <div className="relative ml-2 border-l-2 border-bezel pl-4">
      {timeline.map((fu) => (
        <div key={fu.id} className="relative pb-4 last:pb-0">
          <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-face bg-phos" aria-hidden />
          <div className="rounded-ctl border border-bezel bg-well p-3">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-ink" data-numeric>{formatDate(fu.followUpDate)}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">{fu.type}</span>
                <Lamp variant={fuStatusLamp[fu.status] ?? "off"}>{fu.status}</Lamp>
              </div>
              {onEdit && (
                <Button
                  variant="ghost"
                  size="iconSm"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => onEdit(fu)}
                  aria-label={`Edit follow-up from ${formatDate(fu.followUpDate)}`}
                  title="Edit follow-up"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
            {fu.notes && <p className="text-xs leading-relaxed text-dim">{fu.notes}</p>}
            {fu.assignedTo && <p className="mt-1 text-[10px] text-faint">by {fu.assignedTo}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Lead Edit/Create Drawer ───────────────────────────────────────────────────

function LeadDrawer({
  open, editingLead, form, formError, fieldErrors, saving,
  timeline, timelineLoading, timelineError, onRetryTimeline,
  onClose, onSubmit, updateForm, onAddFollowUp, onEditFollowUp, isSales, salesUsers,
}: {
  open: boolean;
  editingLead: Lead | null;
  form: LeadFormState;
  formError: string;
  fieldErrors: LeadFieldErrors;
  saving: boolean;
  timeline: FollowUpEntry[];
  timelineLoading: boolean;
  timelineError: string;
  onRetryTimeline: () => void;
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
  const [noteError, setNoteError] = useState("");

  // Sync noteLog from editingLead when drawer opens
  const prevLeadId = useRef<string | null>(null);
  if (editingLead && editingLead.id !== prevLeadId.current) {
    prevLeadId.current = editingLead.id;
    setNoteLog(editingLead.noteLog ?? []);
    setNoteInput("");
    setNoteError("");
  }
  if (!editingLead && prevLeadId.current !== null) {
    prevLeadId.current = null;
    setNoteLog([]);
    setNoteInput("");
    setNoteError("");
  }

  async function appendNote() {
    if (!editingLead || !noteInput.trim()) return;
    setNoteSaving(true);
    setNoteError("");
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
    } catch {
      setNoteError("Couldn't save the note. Try again.");
    } finally {
      setNoteSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editingLead ? `Edit Lead — ${editingLead.fullName}` : "Add New Lead"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="solid" type="submit" form="lead-form" disabled={saving}>
            {saving && <Spinner className="h-3.5 w-3.5" />}
            {editingLead ? "Save Changes" : "Create Lead"}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && (
          <div role="alert" className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2.5 text-sm font-semibold text-alert">
            {formError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full Name" required error={fieldErrors.fullName}>
            <Input
              value={form.fullName}
              onChange={(e) => updateForm("fullName", e.target.value)}
              placeholder="Student or parent name"
            />
          </Field>
          <Field label="WhatsApp / Phone" required error={fieldErrors.phone}>
            <Input
              value={form.phone}
              onChange={(e) => updateForm("phone", e.target.value)}
              placeholder="+971..."
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => updateForm("email", e.target.value)}
              placeholder="name@email.com"
            />
          </Field>
          <div className={form.course === "Other" ? "sm:col-span-2" : ""}>
            <Field label="Course Interest">
              <Select
                value={form.course}
                onChange={(e) => {
                  updateForm("course", e.target.value);
                  if (e.target.value !== "Other") updateForm("customCourse", "");
                }}
              >
                {courseList.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            </Field>
            {form.course === "Other" && (
              <Input
                className="mt-2"
                placeholder="Type the course name…"
                value={form.customCourse}
                onChange={(e) => updateForm("customCourse", e.target.value)}
                maxLength={120}
                aria-label="Custom course name"
              />
            )}
          </div>
          <Field label="Lead Source">
            <Select value={form.source} onChange={(e) => updateForm("source", e.target.value)}>
              {leadSources.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
          </Field>
          <Field label="Stage">
            <Select value={form.stage} onChange={(e) => updateForm("stage", e.target.value)}>
              {leadStages.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
          </Field>
          <Field label="Next Follow-Up Date">
            <DatePicker value={form.nextFollowUpDate} onChange={(v) => updateForm("nextFollowUpDate", v)} />
          </Field>
          {!isSales && (
            <Field label="Assigned To">
              {salesUsers && salesUsers.length > 0 ? (
                <Select value={form.assignedTo} onChange={(e) => updateForm("assignedTo", e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {salesUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </Select>
              ) : (
                <Input
                  value={form.assignedTo}
                  onChange={(e) => updateForm("assignedTo", e.target.value)}
                  placeholder="Staff name"
                />
              )}
            </Field>
          )}
        </div>

        <Field label="Notes">
          <Textarea
            className="min-h-24"
            value={form.notes}
            onChange={(e) => updateForm("notes", e.target.value)}
            placeholder="Conversation summary, parent preferences, key info..."
          />
        </Field>
      </form>

      {/* Note log (editing only) */}
      {editingLead && (
        <div className="mt-5">
          <p className="placard mb-2">Note History</p>
          <div className="mb-3 max-h-48 space-y-2 overflow-y-auto">
            {noteLog.length === 0 ? (
              <p className="text-xs text-faint">No notes recorded yet.</p>
            ) : [...noteLog].reverse().map((n, i) => (
              <div key={i} className="rounded-ctl border border-bezel bg-well px-3 py-2 text-xs">
                <p className="leading-relaxed text-ink">{n.text}</p>
                <p className="mt-1 text-faint">
                  {n.by} · {new Date(n.at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
          {noteError && (
            <p role="alert" className="mb-2 text-xs font-semibold text-alert">{noteError}</p>
          )}
          <div className="flex gap-2">
            <Input
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void appendNote(); } }}
              placeholder="Add a note and press Enter…"
              className="text-xs"
              aria-label="Add a note"
            />
            <Button variant="primary" size="sm" type="button" onClick={() => void appendNote()} disabled={noteSaving || !noteInput.trim()}>
              {noteSaving ? <Spinner className="h-3.5 w-3.5" /> : "Add"}
            </Button>
          </div>
        </div>
      )}

      {/* Follow-up timeline (editing only) */}
      {editingLead && (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="placard">Follow-Up Timeline</p>
            {onAddFollowUp && (
              <Button variant="secondary" size="sm" type="button" onClick={onAddFollowUp}>
                <BellRing className="h-3.5 w-3.5" />
                Add Follow-Up
              </Button>
            )}
          </div>
          <FollowUpTimeline
            timeline={timeline}
            loading={timelineLoading}
            error={timelineError}
            onRetry={onRetryTimeline}
            onEdit={onEditFollowUp}
          />
        </div>
      )}
    </Drawer>
  );
}

// ── Follow-Up Add/Edit Drawer ─────────────────────────────────────────────────

function FollowUpDrawer({
  open, lead, isEditing, form, saving, error, dateError, onClose, onSubmit, updateForm,
}: {
  open: boolean;
  lead: Lead | null;
  isEditing?: boolean;
  form: FuFormState;
  saving: boolean;
  error: string;
  dateError: string;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  updateForm: (field: keyof FuFormState, value: string) => void;
}) {
  const waUrl = lead ? whatsappUrl(lead.phone) : null;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit Follow-Up" : "Add Follow-Up"}
      size="md"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="solid" type="submit" form="lead-followup-form" disabled={saving}>
            {saving ? <Spinner className="h-3.5 w-3.5" /> : <ChevronRight className="h-4 w-4" />}
            {isEditing ? "Save Changes" : "Save Follow-Up"}
          </Button>
        </>
      }
    >
      {lead && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-ctl border border-bezel bg-well px-3 py-2.5 text-xs text-dim">
          <span className="font-bold text-ink">{lead.fullName}</span>
          <span className="font-semibold" data-numeric>{lead.phone}</span>
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-phos hover:underline"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              WhatsApp
            </a>
          )}
          <span aria-hidden>·</span>
          <span>{lead.course}</span>
          <Lamp variant={stageLamp[lead.stage] ?? "off"}>{lead.stage}</Lamp>
        </div>
      )}

      <form id="lead-followup-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {error && (
          <div role="alert" className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2.5 text-sm font-semibold text-alert">
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Follow-Up Date" required error={dateError || undefined}>
            <DatePicker required value={form.followUpDate} onChange={(v) => updateForm("followUpDate", v)} />
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={(e) => updateForm("type", e.target.value)}>
              {followUpTypes.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
          </Field>
          <Field label="Status / Outcome">
            <Select value={form.status} onChange={(e) => updateForm("status", e.target.value)}>
              {followUpStatuses.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
          </Field>
          <Field label="Assigned To">
            <Input
              value={form.assignedTo}
              onChange={(e) => updateForm("assignedTo", e.target.value)}
              placeholder="Staff name"
            />
          </Field>
        </div>
        <Field label="What Happened / Notes">
          <Textarea
            className="min-h-28"
            value={form.notes}
            onChange={(e) => updateForm("notes", e.target.value)}
            placeholder="What was discussed? Outcome? Next steps?"
          />
        </Field>
      </form>
    </Drawer>
  );
}
