"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  Check,
  CheckCircle2,
  MessageCircle,
  Pencil,
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
import DatePicker from "@/components/shared/DatePicker";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { Drawer, ConfirmDialog } from "@/components/ui/dialog";
import { TableFooter, usePagination, Pagination } from "@/components/ui/table";
import { Instrument } from "@/components/ui/instrument";
import { Spinner, SkeletonRows, LoadError } from "@/components/ui/feedback";

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

const statusLamp: Record<FollowUpStatus, LampVariant> = {
  Pending: "caution",
  Done: "ok",
  "No Response": "alert",
  Rescheduled: "off",
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

function whatsappUrl(phone: string, text?: string) {
  return buildWhatsAppUrl(phone, text) ?? "#";
}

function getErr(v: unknown, fallback: string) {
  if (v && typeof v === "object" && "message" in v && typeof v.message === "string")
    return v.message;
  return fallback;
}

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
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
  const [editingFu, setEditingFu] = useState<FollowUp | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"contactName" | "phone" | "followUpDate", string>>
  >({});
  const [deleteTarget, setDeleteTarget] = useState<FollowUp | null>(null);
  const [deleting, setDeleting] = useState(false);

  const searchLeads = useCallback((q: string) => {
    if (leadSearchRef.current) clearTimeout(leadSearchRef.current);
    if (!q.trim()) { setLeadResults([]); return; }
    leadSearchRef.current = setTimeout(async () => {
      setLeadSearchLoading(true);
      try {
        const res = await fetch(`/api/leads?search=${encodeURIComponent(q.trim())}&sort=newest`);
        const data = await res.json();
        setLeadResults((data.leads ?? []).slice(0, 6));
      } catch { /* degrade silently — manual entry still works */ }
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
    setListError("");
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
      if (!res.ok) throw data;
      setFollowUps(data.followUps ?? []);
    } catch (caught) {
      setListError(getErr(caught, "Couldn't load follow-ups. Check your connection and retry."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadFollowUps(); }, [statusFilter, viewFilter, dateFrom, dateTo]);

  async function markDone(id: string) {
    try {
      const res = await fetch(`/api/follow-ups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Done" }),
      });
      if (!res.ok) throw new Error();
      setNotice("Marked as done.");
      await loadFollowUps();
    } catch {
      setError("Couldn't update the follow-up. Try again.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/follow-ups/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNotice("Follow-up deleted.");
      setDeleteTarget(null);
      await loadFollowUps();
    } catch {
      setError("Couldn't delete the follow-up. Try again.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  function openCreate() {
    setEditingFu(null);
    setForm(emptyForm);
    setLeadSearch("");
    setLeadResults([]);
    setFormError("");
    setFieldErrors({});
    setDrawerOpen(true);
  }

  function openEdit(fu: FollowUp) {
    setEditingFu(fu);
    setForm({
      contactName: fu.contactName,
      phone: fu.phone,
      course: fu.course,
      followUpDate: fu.followUpDate.slice(0, 10),
      type: fu.type,
      notes: fu.notes,
      status: fu.status,
      assignedTo: fu.assignedTo,
      leadId: "",
    });
    setLeadSearch("");
    setLeadResults([]);
    setFormError("");
    setFieldErrors({});
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingFu(null);
    setForm(emptyForm);
    setLeadSearch("");
    setLeadResults([]);
    setFormError("");
    setFieldErrors({});
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "contactName" || key === "phone" || key === "followUpDate") {
      setFieldErrors((e) => ({ ...e, [key]: undefined }));
    }
  }

  async function submitForm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: typeof fieldErrors = {};
    if (!form.contactName.trim()) errs.contactName = "Contact name is required.";
    if (!form.phone.trim()) errs.phone = "Phone number is required.";
    if (!form.followUpDate) errs.followUpDate = "Pick a follow-up date.";
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    setFormError("");
    try {
      const url = editingFu ? `/api/follow-ups/${editingFu.id}` : "/api/follow-ups";
      const method = editingFu ? "PATCH" : "POST";
      const body = editingFu
        ? { contactName: form.contactName, phone: form.phone, course: form.course, followUpDate: form.followUpDate, type: form.type, notes: form.notes, status: form.status, assignedTo: form.assignedTo }
        : { ...form, leadId: form.leadId || undefined };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      setNotice(editingFu ? "Follow-up updated." : "Follow-up created.");
      closeDrawer();
      await loadFollowUps();
    } catch (caught) {
      setFormError(getErr(caught, editingFu ? "Couldn't update the follow-up. Try again." : "Couldn't create the follow-up. Try again."));
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return {
      overdue: followUps.filter(
        (f) => f.status === "Pending" && new Date(f.followUpDate) < today
      ).length,
      today: followUps.filter((f) => {
        const d = new Date(f.followUpDate); d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime() && f.status === "Pending";
      }).length,
    };
  }, [followUps]);

  const { slice: pageRows, page, pages, setPage, total } = usePagination(followUps, 50);

  return (
    <>
      {/* Add / edit drawer */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingFu ? "Edit Follow-Up" : "Add Follow-Up"}
        size="md"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={closeDrawer} disabled={saving}>
              Cancel
            </Button>
            <Button variant="solid" type="submit" form="followup-form" disabled={saving}>
              {saving && <Spinner className="h-3.5 w-3.5" />}
              {editingFu ? "Save Changes" : "Create Follow-Up"}
            </Button>
          </>
        }
      >
        {editingFu && <p className="mb-3 text-sm text-dim">{editingFu.contactName}</p>}
        <form id="followup-form" onSubmit={submitForm} noValidate className="space-y-4">
          {formError && (
            <div role="alert" className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2.5 text-sm font-semibold text-alert">
              {formError}
            </div>
          )}
          {/* Lead search picker — only shown when creating */}
          {!editingFu && (
            <div className="relative">
              <Field label="Search Existing Lead" help={form.leadId ? undefined : "Optional — auto-fills details below"}>
                <div className="relative">
                  <Input
                    value={leadSearch}
                    onChange={(e) => { setLeadSearch(e.target.value); searchLeads(e.target.value); }}
                    placeholder="Type name or phone to search leads..."
                    autoComplete="off"
                  />
                  {leadSearchLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Spinner />
                    </span>
                  )}
                </div>
              </Field>
              {leadResults.length > 0 && (
                <div className="absolute left-0 right-0 z-10 mt-1 overflow-hidden rounded-ctl border border-bezel bg-raised shadow-raise">
                  {leadResults.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => pickLead(lead)}
                      className="flex w-full items-center gap-3 border-b border-bezel/60 px-3 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-well"
                    >
                      <div>
                        <p className="font-bold text-ink">{lead.fullName}</p>
                        <p className="text-xs text-dim" data-numeric>
                          {lead.phone} · {lead.course} · <span className="font-semibold">{lead.stage}</span>
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {form.leadId && (
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-phos">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  Linked to lead — details auto-filled below
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact Name" required error={fieldErrors.contactName}>
              <Input
                value={form.contactName}
                onChange={(e) => setField("contactName", e.target.value)}
                placeholder="Lead or student name"
              />
            </Field>
            <Field label="Phone" required error={fieldErrors.phone}>
              <Input
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="+971..."
              />
            </Field>
            <Field label="Course">
              <Select value={form.course} onChange={(e) => setField("course", e.target.value)}>
                {courseList.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Follow-Up Date" required error={fieldErrors.followUpDate}>
              <DatePicker required value={form.followUpDate} onChange={(v) => setField("followUpDate", v)} />
            </Field>
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setField("type", e.target.value as FollowUpType)}>
                {followUpTypes.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Assigned To">
              <Input
                value={form.assignedTo}
                onChange={(e) => setField("assignedTo", e.target.value)}
                placeholder="Staff name"
              />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setField("status", e.target.value as FollowUpStatus)}>
                {followUpStatuses.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Notes / What To Say">
            <Textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={3}
              placeholder="Script, key points, context..."
            />
          </Field>
        </form>
      </Drawer>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete Follow-Up"
        message={deleteTarget ? `Delete the follow-up for ${deleteTarget.contactName}? This cannot be undone.` : ""}
        confirmLabel="Delete"
        busy={deleting}
      />

      <div className="space-y-4">
        <PageHeader
          title="Follow-Ups"
          subtitle="Track every call, message, and meeting. Start here every morning."
          actions={
            <Button variant="solid" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Follow-Up
            </Button>
          }
        />

        {/* Summary instruments */}
        {(counts.overdue > 0 || counts.today > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {counts.overdue > 0 && (
              <button
                type="button"
                onClick={() => { setStatusFilter("Pending"); setViewFilter("overdue"); }}
                className="w-full text-left"
                aria-label={`Show ${counts.overdue} overdue follow-ups`}
              >
                <Instrument
                  label="Overdue"
                  value={counts.overdue}
                  tone="alert"
                  sub="Pending past their date"
                  corner={<Lamp variant="alert" pulse>Overdue</Lamp>}
                />
              </button>
            )}
            {counts.today > 0 && (
              <button
                type="button"
                onClick={() => { setStatusFilter("Pending"); setViewFilter("today"); }}
                className="w-full text-left"
                aria-label={`Show ${counts.today} follow-ups due today`}
              >
                <Instrument
                  label="Due Today"
                  value={counts.today}
                  tone="caution"
                  sub="Scheduled for today"
                  corner={<Lamp variant="caution">Today</Lamp>}
                />
              </button>
            )}
          </div>
        )}

        {/* Alerts */}
        {(notice || error) && (
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
          </div>
        )}

        {/* Filters */}
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              from={dateFrom}
              to={dateTo}
              onChange={(f, t) => { setDateFrom(f); setDateTo(t); setViewFilter("all"); }}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
              {(["all", "Pending", "Done", "No Response", "Rescheduled"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? "primary" : "ghost"}
                  aria-pressed={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "all" ? "All" : s}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 sm:ml-auto" role="group" aria-label="Filter by due date">
              {(["all", "today", "overdue", "upcoming"] as const).map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant={viewFilter === v ? "primary" : "ghost"}
                  aria-pressed={viewFilter === v}
                  onClick={() => setViewFilter(v)}
                >
                  {v === "all" ? "All Dates" : v}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* List */}
        {loading ? (
          <Card>
            <SkeletonRows rows={6} cols={4} />
          </Card>
        ) : listError ? (
          <LoadError message={listError} onRetry={() => void loadFollowUps()} />
        ) : followUps.length === 0 ? (
          <Card>
            <EmptyState
              icon={BellRing}
              title="No Follow-Ups"
              description="Adjust the filters or add a new follow-up."
              action={
                <Button variant="primary" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add Follow-Up
                </Button>
              }
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-bezel/60">
              {pageRows.map((f) => {
                const urgency = getUrgency(f.followUpDate, f.status);
                return (
                  <li key={f.id} className="flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-well sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-ink">{f.contactName}</p>
                        <Lamp variant={statusLamp[f.status] ?? "off"}>{f.status}</Lamp>
                        {urgency === "overdue" && <Lamp variant="alert" pulse>Overdue</Lamp>}
                        {urgency === "today" && <Lamp variant="caution">Today</Lamp>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-dim">
                        <span>{f.course}</span>
                        <span aria-hidden>·</span>
                        <span>{f.type}</span>
                        <span aria-hidden>·</span>
                        <span
                          className={
                            urgency === "overdue"
                              ? "font-semibold text-alert"
                              : urgency === "today"
                                ? "font-semibold text-caution"
                                : ""
                          }
                          data-numeric
                        >
                          {formatDate(f.followUpDate)}
                        </span>
                        {f.assignedTo && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{f.assignedTo}</span>
                          </>
                        )}
                      </div>
                      {f.notes && (
                        <p className="mt-1.5 line-clamp-2 text-xs text-faint" title={f.notes}>{f.notes}</p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      {f.phone && (
                        <a
                          href={whatsappUrl(f.phone, f.notes?.trim() || undefined)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open WhatsApp chat with ${f.contactName}`}
                          title="Open WhatsApp with the follow-up note"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-ctl text-phos transition-colors hover:bg-well"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => openEdit(f)}
                        aria-label={`Edit follow-up for ${f.contactName}`}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {f.status !== "Done" && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => void markDone(f.id)}
                          aria-label={`Mark follow-up for ${f.contactName} as done`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Done
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="iconSm"
                        className="text-alert hover:text-alert"
                        onClick={() => setDeleteTarget(f)}
                        aria-label={`Delete follow-up for ${f.contactName}`}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <TableFooter>
              <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={pageRows.length} />
            </TableFooter>
          </Card>
        )}
      </div>
    </>
  );
}
